import os
import asyncio
from langgraph.graph import StateGraph, END
from schemas.state import FilmGraphState
from langchain_core.messages import AIMessage, SystemMessage, HumanMessage

from core.providers import GeminiAdapter, get_image_provider, get_audio_provider, extract_text_content
from schemas.llm import LLMScriptData, LLMCharacterData, LLMCharactersData
from core.config import settings

PROVIDER_CLIP_SECONDS: float = getattr(settings, "PROVIDER_CLIP_SECONDS", 8.0)
PROVIDER_CLIP_LENGTH_SEC: float = PROVIDER_CLIP_SECONDS

from langchain_core.runnables import RunnableConfig
import json
import copy
import math
from pydantic import ValidationError


async def _safe_update_state(update_state_fn, state):
    if update_state_fn:
        if asyncio.iscoroutinefunction(update_state_fn):
            await update_state_fn(state)
        else:
            update_state_fn(state)

def validate_and_split_dialogue(shots: list[dict], max_wps: float = 2.5) -> list[dict]:
    """
    Ensures spoken dialogue fits within shot duration at max_wps (~2.5 words/sec).
    Splits overlength dialogue across consecutive shots rather than letting audio outlast video.
    """
    for i, shot in enumerate(shots):
        dur = float(shot.get("duration_seconds", PROVIDER_CLIP_SECONDS))
        max_words = max(3, int(dur * max_wps))
        dialogue = (shot.get("dialogue") or "").strip()
        words = dialogue.split()
        if len(words) > max_words:
            fitted_words = words[:max_words]
            overflow_words = words[max_words:]
            shot["dialogue"] = " ".join(fitted_words)
            if i + 1 < len(shots) and overflow_words:
                next_shot = shots[i + 1]
                next_speaker = next_shot.get("speaker")
                curr_speaker = shot.get("speaker")
                if not next_speaker or next_speaker == curr_speaker:
                    next_existing = (next_shot.get("dialogue") or "").strip()
                    if next_existing:
                        next_shot["dialogue"] = f"{' '.join(overflow_words)} {next_existing}"
                    else:
                        next_shot["dialogue"] = " ".join(overflow_words)
                    if not next_speaker:
                        next_shot["speaker"] = curr_speaker
    return shots

async def script_agent_node(state: FilmGraphState, config: RunnableConfig):
    emitter = config["configurable"].get("emitter")
    
    # Push initial status and plan
    if emitter:
        await emitter.push("status", content="Analyzing your prompt...")
        await emitter.push("plan", steps=["Script Generation", "Character Design", "Voiceover", "Video Generation", "Editing"], current="Script Generation")

    # Extract the user's creative prompt
    user_prompt_text = ""
    for m in reversed(state.get("messages", [])):
        if isinstance(m, HumanMessage) or getattr(m, "role", "") == "user":
            content = extract_text_content(m.content if hasattr(m, "content") else str(m))
            clean = content.strip().lower()
            if len(content) > 1 and clean not in ["continue", "proceed", "next", "ok", "yes", "go on"]:
                user_prompt_text = content
                break
    if not user_prompt_text and state.get("messages"):
        user_prompt_text = extract_text_content(state["messages"][-1].content)

    duration = state.get("metadata", {}).get("targetDurationSeconds", 60)
    adapter = GeminiAdapter()
    num_shots = max(1, math.ceil(duration / PROVIDER_CLIP_SECONDS))
    approved = False
    
    while not approved:
        if emitter:
            await emitter.push("status", content="Generating script..." if state.get("script_version", 0) == 0 else "Revising script based on your feedback...")
            
        is_first_message = len(state["messages"]) == 1
        
        if is_first_message:
            system_prompt = f"""You are an expert AI Film Director and Screenwriter.
CRITICAL MANDATE: You MUST remain 100% faithful and dedicated to the user's specific story request, characters, genre, and tone.
- If the user asks for specific characters (e.g., 'Doraemon and Nobita', anime heroes, or everyday people like students/teachers), you MUST feature THOSE EXACT CHARACTERS in your script.
- NEVER replace the user's characters or scenario with unrelated generic themes (do NOT invent lone astronauts on Mars, cosmic warriors, or dark sci-fi unless explicitly requested by the user!).
- Match the exact genre and tone requested:
  * If anime / cartoon / comedy: Keep it fun, wholesome, humorous, and expressive, staying true to the iconic personalities and dialogue styles.
  * If slice-of-life / normal everyday: Keep dialogue natural, grounded, authentic, and relatable.
  * If fantasy / action / sci-fi: Provide immersive worldbuilding and dynamic cinematic beats.
- Target duration: {duration} seconds. Structure into {num_shots} shots, each around {PROVIDER_CLIP_LENGTH_SEC:.1f} seconds to match video provider clip length.
- Include lively spoken dialogue with explicit character speaker names so voiceover tracks can be generated.
Brainstorm the script outline line by line adhering strictly to the user's idea."""
        else:
            previous_script_json = json.dumps(state.get("script_data", {}), indent=2)
            system_prompt = f"""You are an expert AI Film Director and Screenwriter.
CRITICAL MANDATE: You MUST remain 100% faithful and dedicated to the user's specific story request, characters, genre, and tone.
- If the user asks for specific characters, you MUST feature THOSE EXACT CHARACTERS in your script.
- Target duration: {duration} seconds. Structure into {num_shots} shots, each around {PROVIDER_CLIP_LENGTH_SEC:.1f} seconds to match video provider clip length.
- Incorporate user feedback faithfully into the revision based on previous script:
{previous_script_json}
Output your thoughts line by line."""

        messages_for_llm = [SystemMessage(content=system_prompt)] + state["messages"]
        
        # 1. Brainstorm
        think_response = AIMessage(content="")
        if emitter:
            await emitter.push("status", content="Brainstorming script ideas...")
            async for chunk in adapter.astream(messages_for_llm, config=config):
                chunk_text = extract_text_content(chunk.content)
                think_response.content += chunk_text
                await emitter.push("thinking", content=chunk_text)
        else:
            response = await adapter.ainvoke(messages_for_llm, config=config)
            think_response = AIMessage(content=extract_text_content(response.content))
        
        # 2. Structured Output phase
        json_prompt = f"""User Story Request: '{user_prompt_text}'

Based on this brainstorm:
{think_response.content}

Generate the final structured movie script conforming to the schema and strictly adhering to the user's story and characters ('{user_prompt_text}').
CRITICAL REQUIREMENTS:
1. Adhere strictly to the requested characters and setting. DO NOT drift into unrelated themes.
2. Structure the movie into dramatic, well-paced shots (around {num_shots} shots).
3. The total film duration across all shots combined MUST match the target duration of {duration} seconds.
4. Each shot must have a duration around {PROVIDER_CLIP_LENGTH_SEC:.1f} seconds matching provider video clip length.
5. Each shot with dialogue must specify the character's exact name in 'speaker' and their spoken line in 'dialogue'.
6. Child & Family-Friendly Orientation: For kid/family themes, emphasize heartwarming friendship, playful banter, fun adventure, and cute character interactions that delight young audiences."""
        
        # Retry mechanism for malformed JSON and shot count validation
        script_data_dict = None
        max_retries = 3
        for attempt in range(max_retries):
            try:
                structured_data = await adapter.aget_structured_output(json_prompt, LLMScriptData)
                if len(structured_data.shots) < num_shots:
                    if attempt == max_retries - 1:
                        raise ValueError(
                            f"Model generated only {len(structured_data.shots)} shots, but {num_shots} are required. Retries exhausted."
                        )
                    json_prompt += f"\n\nPrevious attempt generated only {len(structured_data.shots)} shots. You MUST generate at least {num_shots} distinct, fully developed shots."
                    continue
                script_data_dict = structured_data.model_dump()
                

                        
                break
            except (json.JSONDecodeError, ValidationError, ValueError) as e:
                if attempt == max_retries - 1:
                    raise Exception(f"Failed to generate structured script after {max_retries} attempts: {str(e)}")
                # Append error feedback and try again
                json_prompt += f"\n\nYour previous output failed with error: {str(e)}. Please try again and follow the rules strictly."

        # Ensure shot durations sum to target duration, each <= PROVIDER_CLIP_SECONDS
        if script_data_dict and "shots" in script_data_dict:
            shots = script_data_dict["shots"]
            if len(shots) > num_shots:
                shots = shots[:num_shots]
            for s in shots:
                if s.get("duration_seconds", 0) > PROVIDER_CLIP_SECONDS:
                    s["duration_seconds"] = PROVIDER_CLIP_SECONDS
            total_dur = sum(s.get("duration_seconds", PROVIDER_CLIP_SECONDS) for s in shots)
            if total_dur != duration and shots:
                diff = duration - total_dur
                add_per = round(diff / len(shots), 1)
                for s in shots[:-1]:
                    s["duration_seconds"] = max(1.0, min(PROVIDER_CLIP_SECONDS, s.get("duration_seconds", PROVIDER_CLIP_SECONDS) + add_per))
                last_dur = round(duration - sum(s["duration_seconds"] for s in shots[:-1]), 1)
                if last_dur > PROVIDER_CLIP_SECONDS:
                    excess = last_dur - PROVIDER_CLIP_SECONDS
                    shots[-1]["duration_seconds"] = PROVIDER_CLIP_SECONDS
                    for s in reversed(shots[:-1]):
                        if excess <= 0:
                            break
                        headroom = PROVIDER_CLIP_SECONDS - s["duration_seconds"]
                        if headroom > 0:
                            allocated = min(headroom, excess)
                            s["duration_seconds"] = round(s["duration_seconds"] + allocated, 1)
                            excess -= allocated
                else:
                    shots[-1]["duration_seconds"] = max(1.0, last_dur)
            shots = validate_and_split_dialogue(shots, max_wps=getattr(settings, "MAX_WORDS_PER_SECOND", 2.5))
            script_data_dict["shots"] = shots
                
        # Update state version
        version = state.get("script_version", 0) + 1
        state["script_version"] = version
        state["script_data"] = script_data_dict
        
        # Store in history
        history = state.get("script_history", [])
        history.append({
            "version": version,
            "data": copy.deepcopy(script_data_dict)
        })
        state["script_history"] = history
        
        # Save state manually since we will pause
        update_state_fn = config["configurable"].get("update_state")
        await _safe_update_state(update_state_fn, state)
        
        if emitter:
            # Send message with link
            await emitter.push("message", content=f"I have drafted your script (v{version}). Take a look here:", link={"label": f"v{version}_script.json", "target": "script"})
            # Request approval
            await emitter.push("approval_request", stage="script")
            
            # Pause and wait for response
            response_data = await emitter.wait_for_approval()
            approved = response_data.get("approved", False)
            reason = response_data.get("reason", "")
            
            if approved:
                await emitter.push("message", content="✅ Script approved!\nQ: Does this script look good to you?\nA: Yes\n\nProceeding to Character Design! 🎨")
                state["approval_states"]["script_approved"] = True
                break
            else:
                summary_msg = f"🔁 Revision requested:\nQ: Does this script look good to you?\nA: No — '{reason}'\n\nLet me revise the script..."
                await emitter.push("message", content=summary_msg)
                # Append rejection feedback to messages silently so the LLM knows why it was rejected
                state["messages"].append(HumanMessage(content=f"I rejected the script version {version} with this feedback: {reason}. Please revise it."))
        else:
            # If no emitter (e.g. running outside API), just auto-approve for now
            approved = True
            state["approval_states"]["script_approved"] = True

    return state

async def character_agent_node(state: FilmGraphState, config: RunnableConfig):
    emitter = config["configurable"].get("emitter")
    update_state_fn = config["configurable"].get("update_state")

    state["current_stage"] = "character"
    await _safe_update_state(update_state_fn, state)

    version = state.get("character_version", 0)
    adapter = GeminiAdapter()
    image_adapter = get_image_provider()

    approved = False
    rejection_feedback = None

    while not approved:
        if emitter:
            await emitter.push("status", content="Extracting characters..." if version == 0 else "Revising characters based on feedback...")
            await emitter.push("plan", steps=["Script Generation", "Character Design", "Voiceover", "Video Generation", "Editing"], current="Character Design")

        script_data = state.get("script_data", {})
        script_json_str = json.dumps(script_data, indent=2)

        prompt = f"""Here is the approved movie script:
{script_json_str}

Extract and design all unique characters appearing in this script.
For each character, provide:
- id / character_id (e.g. 'char_1')
- name (e.g. 'Sarah (char_1)' or character name)
- role (e.g. 'Protagonist', 'Detective', 'Student')
- gender ('male' or 'female')
- description & visual_description: highly detailed physical appearance (face, costume, demeanor)
- image_prompt: visual prompt for image generation matching the genre."""

        if rejection_feedback:
            prompt += f"\n\nUser feedback from previous rejection:\n{rejection_feedback}\nPlease revise the characters according to this feedback."

        script_data_dict = None
        max_retries = 3
        for attempt in range(max_retries):
            try:
                structured_data = await adapter.aget_structured_output(prompt, LLMCharacterData)
                script_data_dict = structured_data.model_dump()
                break
            except Exception as e:
                if attempt == max_retries - 1:
                    raise Exception(f"Failed to generate characters: {str(e)}")
                prompt += f"\n\nError: {str(e)}. Please try again."

        version += 1
        state["character_version"] = version
        char_list = script_data_dict.get("characters", []) if script_data_dict else []

        # Generate character concept portraits
        for idx, char in enumerate(char_list):
            char_id = char.get("character_id") or char.get("id") or f"char_{idx+1}"
            char["id"] = char_id
            char["character_id"] = char_id
            prompt_text = char.get("image_prompt") or char.get("visual_description") or char.get("description") or char.get("name")
            if prompt_text:
                try:
                    seed = abs(hash(f"{state.get('project_id', '')}_{char_id}")) % 1000000
                    img_url = await image_adapter.generate_image(prompt_text, seed=seed, aspect_ratio="1:1")
                    if img_url:
                        char["image_url"] = img_url
                except Exception as img_err:
                    print(f"[Character Agent] Image gen failed for {char_id}: {img_err}")

        state["characters"] = char_list
        history = state.get("character_history", [])
        history.append({
            "version": version,
            "data": copy.deepcopy({"characters": char_list})
        })
        state["character_history"] = history

        if update_state_fn:
            await update_state_fn(state) if asyncio.iscoroutinefunction(update_state_fn) else update_state_fn(state)

        char_file_name = f"v{version}_characters.json"
        if emitter:
            await emitter.push("message", content=f"I have designed the characters (v{version}). Take a look here:", link={"label": char_file_name, "target": "characters_tab"})
            await emitter.push("approval_request", stage="characters")

            response_data = await emitter.wait_for_approval()
            approved = response_data.get("approved", False)
            reason = response_data.get("reason", "")

            if approved:
                await emitter.push("message", content="✅ Characters approved! Proceeding to Voiceover & Video generation.")
                state["approval_states"]["characters_approved"] = True
                break
            else:
                summary_msg = f"🔁 Revision requested:\nQ: Do these characters look good to you?\nA: No — '{reason}'\n\nLet me revise the characters..."
                await emitter.push("message", content=summary_msg)
                rejection_feedback = reason
                state["messages"].append(HumanMessage(content=f"I rejected the character list version {version} with this feedback: {reason}. Please revise it."))
        else:
            approved = True
            state["approval_states"]["characters_approved"] = True

    return state


async def voiceover_agent_node(state: FilmGraphState, config: RunnableConfig):
    emitter = config["configurable"].get("emitter")
    update_state_fn = config["configurable"].get("update_state")

    state["current_stage"] = "voiceover"
    await _safe_update_state(update_state_fn, state)

    script_data = state.get("script_data")
    if not script_data:
        raise ValueError("Script data must exist before voiceover generation.")

    tts = get_audio_provider()
    characters = {c.get("name", "").lower(): c for c in state.get("characters", [])}
    characters.update({c.get("id", "").lower(): c for c in state.get("characters", [])})

    approved = False
    rejection_feedback = None

    while not approved:
        if emitter:
            await emitter.push("status", content="Casting neural voices and generating studio-quality dialogue tracks...")

        voiceover_list = []
        shots = script_data.get("shots", [])

        assigned_speaker_voices = {}
        for idx, shot in enumerate(shots):
            speaker = shot.get("speaker")
            dialogue = shot.get("dialogue")
            shot_id = shot.get("shot_id") or f"shot_{idx+1}"

            if not dialogue or dialogue.strip() in ["", "None", "none"]:
                continue

            spk_key = (speaker or "").lower().strip()
            char_info = characters.get(spk_key, {})
            if not char_info:
                for c_name, c_val in characters.items():
                    if spk_key and (spk_key in c_name or c_name in spk_key):
                        char_info = c_val
                        break

            if spk_key in assigned_speaker_voices:
                voice_config = assigned_speaker_voices[spk_key]
            else:
                voice_config = tts.match_character_voice(
                    char_name=speaker or "Character",
                    char_role=char_info.get("role", ""),
                    description=char_info.get("description", ""),
                    gender=char_info.get("gender", "")
                )
                
                # Specifically customize distinct character audio identities
                if "pd" in spk_key or "police" in spk_key or "dispatch" in spk_key or "enforcer" in spk_key:
                    voice_config = {
                        "voice": "en-US-BrianNeural",
                        "pitch": "+4Hz",
                        "rate": "+6%",
                        "label": "Tactical Radio Dispatcher (Male)",
                        "gender": "male"
                    }
                elif "ren" in spk_key or "vance" in spk_key:
                    voice_config = {
                        "voice": "en-US-ChristopherNeural",
                        "pitch": "-12Hz",
                        "rate": "-4%",
                        "label": "Gritty Cyber-Detective (Male)",
                        "gender": "male"
                    }
                elif "iris" in spk_key or "ax-9" in spk_key:
                    voice_config = {
                        "voice": "en-US-AvaNeural",
                        "pitch": "+2Hz",
                        "rate": "-1%",
                        "label": "Fugitive Android (Female)",
                        "gender": "female"
                    }
                
                assigned_speaker_voices[spk_key] = voice_config

            if emitter:
                await emitter.push("status", content=f"Rendering {voice_config.get('label', 'neural voice')} for {speaker} in Shot {idx+1}...")

            audio_url = await tts.generate_speech(
                text=dialogue,
                voice_id=voice_config["voice"],
                pitch=voice_config["pitch"],
                rate=voice_config["rate"]
            )

            words = len(dialogue.split())
            est_duration = max(1.5, round(words / 2.5, 1))

            voiceover_list.append({
                "shot_id": shot_id,
                "speaker": speaker or "Narrator",
                "gender": voice_config.get("gender", "male"),
                "dialogue": dialogue,
                "voice_name": voice_config.get("label", voice_config["voice"]),
                "voice_id": voice_config.get("voice", "en-US-ChristopherNeural"),
                "audio_url": audio_url,
                "duration_seconds": est_duration
            })

        state["voiceovers"] = voiceover_list
        await _safe_update_state(update_state_fn, state)

        if emitter:
            await emitter.push("status", content=f"Generated {len(voiceover_list)} voiceover lines. Ready for Director review.")
            await emitter.push("voiceovers_ready", content={"count": len(voiceover_list)})

            await emitter.push(
                "message",
                content=f"I've generated studio voiceovers for all {len(voiceover_list)} dialogue lines using distinct character voices. Take a listen in the Audio tab:",
                link={"label": f"Audio Tracks ({len(voiceover_list)})", "target": "audio_tab"}
            )
            await emitter.push("approval_request", stage="voiceover")

            response_data = await emitter.wait_for_approval()
            approved = response_data.get("approved", False)
            reason = response_data.get("reason", "")

            if approved:
                await emitter.push("message", content="✅ Voiceovers & audio approved!\nQ: Approve audio tracks?\nA: Yes\n\nReady for Stage 4: Video Generation Agent! 🎬")
                state["approval_states"]["voiceovers_approved"] = True
                break
            else:
                summary_msg = f"🔁 Audio revision requested:\nQ: Approve audio tracks?\nA: No — '{reason}'\n\nLet me adjust the voiceovers..."
                await emitter.push("message", content=summary_msg)
                rejection_feedback = reason
                state["messages"].append(HumanMessage(content=f"User requested voiceover revisions: {reason}"))
        else:
            approved = True
            state["approval_states"]["characters_approved"] = True
            state["approval_states"]["voiceovers_approved"] = True

    return state


async def video_agent_node(state: FilmGraphState, config: RunnableConfig):
    emitter = config["configurable"].get("emitter")
    update_state_fn = config["configurable"].get("update_state")
    project_id = state.get("project_id", "default_project")

    if emitter:
        await emitter.push("status", content="Starting Stage 4: Cinematic Video Generation...")
        await emitter.push("plan_update", current="Video Generation")

    shots = state.get("script_data", {}).get("shots", [])
    voiceovers = {vo.get("shot_id"): vo for vo in state.get("voiceovers", [])}

    renders_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "public", "renders", project_id))
    os.makedirs(renders_dir, exist_ok=True)

    import imageio_ffmpeg
    import subprocess
    import base64
    import httpx
    import asyncio
    import shutil
    from core.media_processor import probe, FFMPEG_BIN
    from core.video_generator import generate_ai_video_clip, QuotaExceededError
    from core.providers import get_image_provider

    video_shot_records = []
    global_narrative = state.get("script_data", {}).get("global_narrative", "")

    for idx, shot in enumerate(shots):
        shot_id = shot.get("shot_id") or f"shot_{idx+1}"
        speaker = (shot.get("speaker") or "Narrator").strip()
        dialogue = shot.get("dialogue") or ""
        visual_desc = shot.get("visual_description") or shot.get("description") or ""
        vo = voiceovers.get(shot_id)

        # 1. Generate unique scene keyframe using the script's visual context
        shot_scene_img = os.path.join(renders_dir, f"{shot_id}_scene.jpg")
        img_path = None
        scene_context = visual_desc or dialogue or global_narrative
        
        if scene_context:
            if emitter:
                await emitter.push("status", content=f"Designing scene visual for Shot {idx+1}/{len(shots)} ({speaker}): '{scene_context[:40]}...'")
            img_provider = get_image_provider()
            desc_lower = f"{scene_context} {speaker} {global_narrative}".lower()
            is_kid_theme = any(k in desc_lower for k in ["tiger", "elephant", "cub", "kid", "child", "fun", "friend", "jungle", "cute", "disney", "pixar", "baby", "play", "doraemon", "nobita", "cartoon"])
            if is_kid_theme:
                scene_prompt = f"Charming 3D Pixar Disney animated movie style, vibrant saturated colors, cute expressive characters, whimsical cinematic lighting: {scene_context}. Character focus: {speaker}. 16:9 widescreen, family-friendly, crisp high detail, shot {idx+1}"
            else:
                scene_prompt = f"Official 2D anime art style, Studio Ghibli aesthetic: {scene_context}. Character focus: {speaker}. 16:9 widescreen, cinematic anime scene keyframe, crisp line art, beautiful lighting, shot {idx+1}"
            seed = abs(hash(f"{project_id}_{shot_id}_{idx}")) % 1000000
            try:
                scene_url = await img_provider.generate_image(scene_prompt, seed=seed, aspect_ratio="16:9")
                if scene_url and scene_url.startswith("data:image") and "base64," in scene_url:
                    b64_data = scene_url.split("base64,", 1)[1]
                    img_bytes = base64.b64decode(b64_data)
                    if len(img_bytes) > 1000:
                        with open(shot_scene_img, "wb") as f_scene:
                            f_scene.write(img_bytes)
                        img_path = shot_scene_img
                        print(f"[Video Gen] Saved base64 scene keyframe for {shot_id}: {shot_scene_img} ({len(img_bytes)} bytes)")
                elif scene_url and scene_url.startswith("http"):
                    headers = {"User-Agent": "Mozilla/5.0"}
                    async with httpx.AsyncClient(headers=headers) as client:
                        r = await client.get(scene_url, timeout=30)
                        if r.status_code == 200 and len(r.content) > 1000:
                            with open(shot_scene_img, "wb") as f_scene:
                                f_scene.write(r.content)
                            img_path = shot_scene_img
                            print(f"[Video Gen] Saved HTTP scene keyframe for {shot_id}: {shot_scene_img} ({len(r.content)} bytes)")
            except Exception as e:
                print(f"[Video Gen] Error generating scene keyframe for {shot_id}: {e}")

        # If a shot's keyframe generation fails, raise an error instead of reusing another image
        if not img_path or not os.path.exists(img_path):
            err_msg = f"Shot {idx+1} ({shot_id}) keyframe image generation failed for speaker '{speaker}'. Reusing another image is forbidden."
            print(f"[Video Gen] {err_msg}")
            if emitter:
                await emitter.push("error", message=err_msg)
            raise RuntimeError(err_msg)

        if emitter:
            await emitter.push("status", content=f"Generating real AI video motion for Shot {idx+1}/{len(shots)} ({speaker})...")

        audio_path = os.path.join(renders_dir, f"audio_{shot_id}.mp3")
        has_audio = False
        if vo and vo.get("audio_url"):
            try:
                b64 = vo["audio_url"].split("base64,")[1]
                with open(audio_path, "wb") as af:
                    af.write(base64.b64decode(b64))
                has_audio = True
            except Exception as e:
                print(f"[Warning] Failed to decode audio for {shot_id}: {e}")

        raw_clip_out = os.path.join(renders_dir, f"{shot_id}_raw.mp4")
        final_clip_out = os.path.join(renders_dir, f"{shot_id}.mp4")

        # 2. Generate video using configured provider clip length with retry & backoff
        # Look up character reference for visual consistency
        characters = state.get("characters", [])
        char_match = next((c for c in characters if c.get("name", "").lower() == speaker.lower()), None)
        char_style = f" Character details: {char_match.get('description')}" if char_match and char_match.get("description") else ""
        motion_prompt = f"{speaker}: {visual_desc or dialogue}.{char_style} Cinematic animation, fluid motion."

        ai_clip = None
        clip_info = None
        max_attempts = 2
        for attempt in range(max_attempts):
            try:
                print(f"[Video Gen Project: {project_id} Shot: {shot_id}] Generation attempt {attempt + 1}/{max_attempts}")
                ai_clip = await asyncio.to_thread(
                    lambda: generate_ai_video_clip(
                        image_path=img_path,
                        prompt=motion_prompt,
                        hf_token=settings.HUGGINGFACE_API_KEY,
                        duration=PROVIDER_CLIP_LENGTH_SEC,
                        steps=4
                    )
                )
                if not ai_clip or not os.path.exists(ai_clip):
                    raise RuntimeError("No output video file generated")
                clip_info = probe(ai_clip)
                if not clip_info.has_video:
                    raise RuntimeError("Output clip has no video stream")
                if clip_info.duration <= 0.5 or (clip_info.fps is not None and clip_info.fps <= 1.0):
                    raise RuntimeError(f"Static clip detected: duration={clip_info.duration:.2f}s, fps={clip_info.fps}")
                # Minimum acceptable duration allows slow-mo stretch (up to 1.5s short)
                min_acceptable = max(1.0, PROVIDER_CLIP_LENGTH_SEC - 1.5)
                if clip_info.duration < min_acceptable:
                    raise RuntimeError(f"Clip too short: {clip_info.duration:.2f}s < {min_acceptable:.2f}s")
                break  # Successful generation
            except QuotaExceededError as qe:
                err_text = str(qe)
                print(f"[Video Gen Project: {project_id} Shot: {shot_id}] Quota exceeded: {err_text}")
                err_msg = f"ZeroGPU quota exhausted during Shot {idx+1}/{len(shots)} ({speaker}): {err_text}"
                if emitter:
                    await emitter.push("error", message=err_msg)
                raise RuntimeError(err_msg) from qe
            except Exception as e:
                print(f"[Video Gen Project: {project_id} Shot: {shot_id}] Attempt {attempt + 1} failed: {e}")
                if attempt < max_attempts - 1:
                    await asyncio.sleep(2.0 * (attempt + 1))
                else:
                    err_msg = f"Video generation failed for Shot {idx+1} ({shot_id}) after {max_attempts} attempts: {e}"
                    if emitter:
                        await emitter.push("error", message=err_msg)
                    raise RuntimeError(err_msg) from e

        shutil.copyfile(ai_clip, raw_clip_out)
        target_dur = float(shot.get("duration_seconds", PROVIDER_CLIP_SECONDS))
        if clip_info.duration > target_dur + 0.1:
            trim_cmd = [FFMPEG_BIN, "-y", "-i", ai_clip, "-t", str(target_dur), "-c", "copy", final_clip_out]
            res = await asyncio.to_thread(lambda: subprocess.run(trim_cmd, capture_output=True))
            if res.returncode != 0 or not os.path.exists(final_clip_out):
                shutil.copyfile(ai_clip, final_clip_out)
                real_duration = round(clip_info.duration, 3)
            else:
                real_duration = target_dur
        else:
            shutil.copyfile(ai_clip, final_clip_out)
            real_duration = round(clip_info.duration, 3)

        # Generate thumbnail
        thumb_path = os.path.join(renders_dir, f"thumb_{shot_id}.jpg")
        thumb_cmd = [FFMPEG_BIN, "-y", "-ss", "00:00:01", "-i", final_clip_out, "-vframes", "1", thumb_path]
        await asyncio.to_thread(lambda: subprocess.run(thumb_cmd, capture_output=True))

        rel_video_url = f"/renders/{project_id}/{shot_id}.mp4"
        rel_thumb_url = f"/renders/{project_id}/thumb_{shot_id}.jpg"

        video_shot_records.append({
            "shot_id": shot_id,
            "video_url": rel_video_url,
            "thumbnail_url": rel_thumb_url,
            "speaker": speaker,
            "dialogue": dialogue,
            "prompt": visual_desc,
            "duration_seconds": real_duration,
            "duration_sec": real_duration,
            "status": "completed",
            "padding_applied": None,
            "static_fallback": False,
            "error_message": None
        })

    state["current_stage"] = "video"
    state["video_shots"] = video_shot_records
    state["approval_states"]["video_approved"] = False

    await _safe_update_state(update_state_fn, state)

    if emitter:
        await emitter.push("status", content="All video shots processed. Ready for review and assembly.")
        await emitter.push(
            "message",
            content="🎬 Video clips have been processed. Review individual shots in the Video tab and approve to proceed with master film assembly:",
            link={"label": "Review Video Shots", "target": "video_tab"}
        )
        await emitter.push("approval_request", stage="video")
        await emitter.push("done")
    return state
  # Build the Graph
from agents.editor_agent import assemble_video

# Build the Graph
workflow = StateGraph(FilmGraphState)

workflow.add_node("script_agent", script_agent_node)
workflow.add_node("character_agent", character_agent_node)
workflow.add_node("voiceover_agent", voiceover_agent_node)
workflow.add_node("video_agent", video_agent_node)
workflow.add_node("assemble_video", assemble_video)

def entry_router(state: FilmGraphState) -> str:
    if not state.get("approval_states", {}).get("script_approved"):
        return "script_agent"
    elif not state.get("approval_states", {}).get("characters_approved"):
        return "character_agent"
    elif not state.get("approval_states", {}).get("voiceovers_approved"):
        return "voiceover_agent"
    elif not state.get("approval_states", {}).get("video_approved"):
        return "video_agent"
    elif not state.get("approval_states", {}).get("editor_approved"):
        return "assemble_video"
    return END

def after_script_router(state: FilmGraphState) -> str:
    if state.get("approval_states", {}).get("script_approved"):
        return "character_agent"
    return END

def after_character_router(state: FilmGraphState) -> str:
    if state.get("approval_states", {}).get("characters_approved"):
        return "voiceover_agent"
    return END

def after_voiceover_router(state: FilmGraphState) -> str:
    if state.get("approval_states", {}).get("voiceovers_approved"):
        return "video_agent"
    return END

def after_video_router(state: FilmGraphState) -> str:
    if state.get("approval_states", {}).get("video_approved"):
        return "assemble_video"
    return END

workflow.set_conditional_entry_point(
    entry_router,
    {
        "script_agent": "script_agent",
        "character_agent": "character_agent",
        "voiceover_agent": "voiceover_agent",
        "video_agent": "video_agent",
        "assemble_video": "assemble_video",
        END: END
    }
)

workflow.add_conditional_edges(
    "script_agent",
    after_script_router,
    {
        "character_agent": "character_agent",
        END: END
    }
)

workflow.add_conditional_edges(
    "character_agent",
    after_character_router,
    {
        "voiceover_agent": "voiceover_agent",
        END: END
    }
)

workflow.add_conditional_edges(
    "voiceover_agent",
    after_voiceover_router,
    {
        "video_agent": "video_agent",
        END: END
    }
)

workflow.add_conditional_edges(
    "video_agent",
    after_video_router,
    {
        "assemble_video": "assemble_video",
        END: END
    }
)

workflow.add_edge("assemble_video", END)

# Compile the graph
app = workflow.compile()


