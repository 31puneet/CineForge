import os
import re
import hashlib
import json
import copy
import math
import asyncio
from pathlib import Path
from typing import Optional
from pydantic import ValidationError
from langgraph.graph import StateGraph, END
from langchain_core.messages import AIMessage, SystemMessage, HumanMessage
from langchain_core.runnables import RunnableConfig

from schemas.state import FilmGraphState
from core.providers import GeminiAdapter, get_image_provider, get_audio_provider, extract_text_content, load_voice_presets_config
from core.storage import media_storage
from core.job_queue import run_parallel_shot_tasks, publish_job_status
from core.media_processor import probe, FFMPEG_BIN
from schemas.llm import LLMScriptData, LLMCharacterData
from core.config import settings, validate_safe_id, resolve_confined_path
from agents.editor_agent import assemble_video

PROVIDER_CLIP_SECONDS: float = getattr(settings, "PROVIDER_CLIP_SECONDS", 8.0)
PROVIDER_CLIP_LENGTH_SEC: float = PROVIDER_CLIP_SECONDS


async def _safe_update_state(update_state_fn, state):
    if update_state_fn:
        if asyncio.iscoroutinefunction(update_state_fn):
            await update_state_fn(state)
        else:
            update_state_fn(state)

def validate_and_split_dialogue(shots: list[dict], max_wps: float = 2.5) -> list[dict]:
    """
    Ensures spoken dialogue fits within shot duration (reserving pre/post audio margins)
    at max_wps (~2.5 words/sec). Splits overlength dialogue across consecutive shots of the
    same speaker, or raises ValueError when overflow cannot be transferred.
    """
    margin_sec = getattr(settings, "SHOT_PRE_DELAY_SEC", 0.5) + getattr(settings, "SHOT_POST_TAIL_SEC", 1.5)
    for i, shot in enumerate(shots):
        dur = float(shot.get("duration_seconds", PROVIDER_CLIP_SECONDS))
        speech_budget = max(0.0, dur - margin_sec)
        max_words = max(0, int(speech_budget * max_wps))
        dialogue = (shot.get("dialogue") or "").strip()
        words = dialogue.split()
        if len(words) > max_words:
            if max_words == 0 and len(words) > 0:
                if i + 1 >= len(shots):
                    raise ValueError(
                        f"Shot {i+1} duration ({dur:.1f}s) leaves no speech budget for {len(words)} words on the final shot."
                    )
            if i + 1 >= len(shots):
                raise ValueError(
                    f"Shot {i+1} dialogue ({len(words)} words) exceeds {max_words} words on the final shot."
                )
            next_shot = shots[i + 1]
            next_speaker = next_shot.get("speaker")
            curr_speaker = shot.get("speaker")
            if next_speaker and next_speaker != curr_speaker:
                raise ValueError(
                    f"Shot {i+1} dialogue ({len(words)} words) exceeds {max_words} words and next shot has a different speaker ('{next_speaker}')."
                )
            fitted_words = words[:max_words]
            overflow_words = words[max_words:]
            shot["dialogue"] = " ".join(fitted_words)
            next_existing = (next_shot.get("dialogue") or "").strip()
            if next_existing:
                next_shot["dialogue"] = f"{' '.join(overflow_words)} {next_existing}"
            else:
                next_shot["dialogue"] = " ".join(overflow_words)
            if not next_speaker:
                next_shot["speaker"] = curr_speaker
    return shots


def _normalize_script_shots(shots: list[dict], duration: float) -> list[dict]:
    """Adjust shot durations to sum to target duration cleanly within [1.0, PROVIDER_CLIP_SECONDS]."""
    if not shots:
        raise ValueError("Script must contain at least one shot.")
    for s in shots:
        dur_val = float(s.get("duration_seconds", PROVIDER_CLIP_SECONDS))
        s["duration_seconds"] = max(1.0, min(PROVIDER_CLIP_SECONDS, dur_val))

    total_dur = round(sum(s["duration_seconds"] for s in shots), 1)
    if total_dur != round(float(duration), 1):
        diff = float(duration) - total_dur
        add_per = round(diff / len(shots), 1)
        for s in shots[:-1]:
            s["duration_seconds"] = round(
                max(1.0, min(PROVIDER_CLIP_SECONDS, s["duration_seconds"] + add_per)),
                1,
            )
        last_dur = round(float(duration) - sum(s["duration_seconds"] for s in shots[:-1]), 1)
        if last_dur > PROVIDER_CLIP_SECONDS:
            excess = round(last_dur - PROVIDER_CLIP_SECONDS, 1)
            shots[-1]["duration_seconds"] = PROVIDER_CLIP_SECONDS
            for s in reversed(shots[:-1]):
                if excess <= 0:
                    break
                headroom = round(PROVIDER_CLIP_SECONDS - s["duration_seconds"], 1)
                if headroom > 0:
                    allocated = min(headroom, excess)
                    s["duration_seconds"] = round(s["duration_seconds"] + allocated, 1)
                    excess = round(excess - allocated, 1)
        elif last_dur < 1.0:
            deficit = round(1.0 - last_dur, 1)
            shots[-1]["duration_seconds"] = 1.0
            for s in reversed(shots[:-1]):
                if deficit <= 0:
                    break
                reducible = round(s["duration_seconds"] - 1.0, 1)
                if reducible > 0:
                    take = min(reducible, deficit)
                    s["duration_seconds"] = round(s["duration_seconds"] - take, 1)
                    deficit = round(deficit - take, 1)
            if deficit > 0:
                shots[-1]["duration_seconds"] = round(1.0 - deficit, 1)
        else:
            shots[-1]["duration_seconds"] = last_dur

    for s in shots:
        s_dur = float(s.get("duration_seconds", 0))
        if s_dur < 1.0 or s_dur > PROVIDER_CLIP_SECONDS:
            raise ValueError(f"Shot duration {s_dur}s out of bounds [1.0, {PROVIDER_CLIP_SECONDS}]")
    final_total = sum(float(s.get("duration_seconds", 0)) for s in shots)
    if abs(final_total - float(duration)) > 0.5:
        raise ValueError(f"Final script duration {final_total:.1f}s does not match target {duration}s")
    return shots


async def script_agent_node(state: FilmGraphState, config: RunnableConfig):
    emitter = config["configurable"].get("emitter")
    
    # Push initial status and plan
    if emitter:
        await emitter.push("status", content="Analyzing your prompt...")
        await emitter.push("plan", steps=["Script Generation", "Character Design", "Voiceover", "Video Generation", "Editing"], current="Script Generation")

    # Separate the original story prompt from later revision feedback messages
    human_messages: list[str] = []
    skip_words = {"continue", "proceed", "next", "ok", "yes", "go on", "yep", "sure", "looks good", "approve", "approved", "perfect", "good", "move on", "advance"}
    for m in state.get("messages", []):
        if isinstance(m, HumanMessage) or getattr(m, "role", "") == "user":
            content = extract_text_content(m.content if hasattr(m, "content") else str(m)).strip()
            clean = content.lower().rstrip(".!")
            if len(content) > 1 and clean not in skip_words:
                human_messages.append(content)

    original_story_text = human_messages[0] if human_messages else ""
    revision_feedback_text = "\n".join(human_messages[1:]).strip() if len(human_messages) > 1 else ""
    if not original_story_text and state.get("messages"):
        original_story_text = extract_text_content(state["messages"][-1].content)

    duration = state.get("metadata", {}).get("targetDurationSeconds", 60)
    adapter = GeminiAdapter()
    num_shots = max(1, math.ceil(duration / PROVIDER_CLIP_SECONDS))
    approved = False
    
    while not approved:
        if emitter:
            await emitter.push("status", content="Generating script..." if state.get("script_version", 0) == 0 else "Revising script based on your feedback...")
            
        is_first_message = len(human_messages) <= 1 and not state.get("script_data")
        
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
CRITICAL MANDATE: You MUST remain 100% faithful and dedicated to the user's original story, characters, genre, and tone, while applying the requested revision feedback.
Original Story Request:
{original_story_text}

Revision Feedback to Apply:
{revision_feedback_text or 'Refine and polish the script.'}

- Target duration: {duration} seconds. Structure into {num_shots} shots, each around {PROVIDER_CLIP_LENGTH_SEC:.1f} seconds to match video provider clip length.
- Incorporate the revision feedback into the previous script below:
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
        revision_clause = f"\nRevision Feedback to Apply to the Original Story: '{revision_feedback_text}'\n" if revision_feedback_text else ""
        json_prompt = f"""Original Story Request: '{original_story_text}'{revision_clause}

Based on this brainstorm:
{think_response.content}

Generate the final structured movie script conforming to the schema and strictly adhering to the original story and characters ('{original_story_text}').
CRITICAL REQUIREMENTS:
1. Adhere strictly to the requested characters and setting. DO NOT drift into unrelated themes.
2. Structure the movie into exactly {num_shots} dramatic, well-paced shots.
3. The total film duration across all shots combined MUST match the target duration of {duration} seconds.
4. Each shot must have a duration around {PROVIDER_CLIP_LENGTH_SEC:.1f} seconds matching provider video clip length.
5. Each shot with dialogue must specify the character's exact name in 'speaker' and their spoken line in 'dialogue' (keep dialogue concise so it fits within each shot's speech budget).
6. Child & Family-Friendly Orientation: For kid/family themes, emphasize heartwarming friendship, playful banter, fun adventure, and cute character interactions that delight young audiences."""
        
        # Retry mechanism for malformed JSON, shot count, duration bounds, and dialogue fitting
        script_data_dict = None
        max_retries = 3
        max_wps = getattr(settings, "MAX_WORDS_PER_SECOND", 2.5)
        for attempt in range(max_retries):
            try:
                structured_data = await adapter.aget_structured_output(json_prompt, LLMScriptData)
                raw_count = len(structured_data.shots)
                if raw_count < num_shots:
                    raise ValueError(
                        f"Model generated only {raw_count} shots, but {num_shots} are required."
                    )
                if raw_count > num_shots:
                    can_keep_all = (raw_count * 1.0 <= duration <= raw_count * PROVIDER_CLIP_SECONDS)
                    if attempt < max_retries - 1 or not can_keep_all:
                        raise ValueError(
                            f"Model generated {raw_count} shots, expected {num_shots} shots so resolution fits the timeline."
                        )

                candidate_dict = structured_data.model_dump()
                shots = _normalize_script_shots(candidate_dict["shots"], duration)
                shots = validate_and_split_dialogue(shots, max_wps=max_wps)
                candidate_dict["shots"] = shots
                script_data_dict = candidate_dict
                break
            except (json.JSONDecodeError, ValidationError, ValueError) as e:
                if attempt == max_retries - 1:
                    raise Exception(f"Failed to generate structured script after {max_retries} attempts: {str(e)}")
                json_prompt += f"\n\nYour previous output failed with error: {str(e)}. Please fix this and try again."
                
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
            response_data = await emitter.wait_for_approval("script")
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
            # Per Agent.md, do not auto-approve generated artifacts; pause at END awaiting human approval.
            state["approval_states"]["script_approved"] = False
            break

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

        # Generate character concept portraits and persist via storage adapter
        pid = validate_safe_id(str(state.get("project_id", "default_project")), "project_id")
        char_refs_map = (state.get("metadata", {}) or {}).get("character_references", {}) or {}
        renders_root = Path(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "public", "renders")))
        renders_dir = str(resolve_confined_path(renders_root, pid))
        os.makedirs(renders_dir, exist_ok=True)

        import base64
        import httpx
        for idx, char in enumerate(char_list):
            char_id = validate_safe_id(str(char.get("character_id") or char.get("id") or f"char_{idx+1}"), "character_id")
            char["id"] = char_id
            char["character_id"] = char_id
            per_char_refs = char_refs_map.get(char_id) or char_refs_map.get(char.get("name", "")) or []
            if isinstance(per_char_refs, list) and per_char_refs:
                char["reference_urls"] = per_char_refs
            prompt_text = char.get("image_prompt") or char.get("visual_description") or char.get("description") or char.get("name")
            if prompt_text:
                try:
                    seed = abs(hash(f"{pid}_{char_id}_v{version}")) % 1000000
                    img_data = await image_adapter.generate_image(prompt_text, seed=seed, aspect_ratio="1:1")
                    if img_data:
                        char_file = str(resolve_confined_path(renders_dir, f"{char_id}_v{version}.jpg"))
                        if img_data.startswith("data:image") and "base64," in img_data:
                            b64_str = img_data.split("base64,", 1)[1]
                            raw_b = base64.b64decode(b64_str)
                            if len(raw_b) > 1000:
                                with open(char_file, "wb") as f_out:
                                    f_out.write(raw_b)
                                char["image_url"] = media_storage.upload_file(
                                    char_file,
                                    project_id=pid,
                                    object_key=f"projects/{pid}/characters/{char_id}/v{version}/image.jpg",
                                    bucket="cineforge-assets",
                                    content_type="image/jpeg",
                                    asset_type="image",
                                    character_id=char_id,
                                    version=version,
                                )
                            else:
                                char["image_url"] = img_data
                        elif img_data.startswith("http"):
                            headers = {"Authorization": f"Bearer {settings.POLLINATIONS_API_KEY}"} if settings.POLLINATIONS_API_KEY else {}
                            async with httpx.AsyncClient(timeout=60.0) as client:
                                r = await client.get(img_data, headers=headers)
                                if r.status_code == 200 and len(r.content) > 1000:
                                    with open(char_file, "wb") as f_out:
                                        f_out.write(r.content)
                                    char["image_url"] = media_storage.upload_file(
                                        char_file,
                                        project_id=pid,
                                        object_key=f"projects/{pid}/characters/{char_id}/v{version}/image.jpg",
                                        bucket="cineforge-assets",
                                        content_type="image/jpeg",
                                        asset_type="image",
                                        character_id=char_id,
                                        version=version,
                                    )
                                else:
                                    char["image_url"] = img_data
                        else:
                            char["image_url"] = img_data
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

            response_data = await emitter.wait_for_approval("characters")
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
            # Per Agent.md, do not auto-approve generated artifacts; pause at END awaiting human approval.
            state["approval_states"]["characters_approved"] = False
            break

    return state


def match_role_override_rule(speaker_name: str) -> Optional[dict]:
    """Match configured role overrides using whole-word boundaries to prevent substring false positives."""
    spk_key = (speaker_name or "").lower().strip()
    if not spk_key:
        return None
    role_overrides = load_voice_presets_config().get("role_overrides", [])
    for rule in role_overrides:
        for kw in rule.get("keywords", []):
            kw_clean = str(kw).strip().lower()
            if kw_clean and re.search(rf"\b{re.escape(kw_clean)}\b", spk_key):
                return rule
    return None


async def voiceover_agent_node(state: FilmGraphState, config: RunnableConfig):
    emitter = config["configurable"].get("emitter")
    update_state_fn = config["configurable"].get("update_state")
    project_id = validate_safe_id(str(state.get("project_id", "default_project")), "project_id")

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
    renders_root = Path(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "public", "renders")))
    renders_dir = str(resolve_confined_path(renders_root, project_id))
    os.makedirs(renders_dir, exist_ok=True)

    while not approved:
        if emitter:
            await emitter.push("status", content="Casting neural voices and generating studio-quality dialogue tracks...")

        voiceover_list = []
        shots = script_data.get("shots", [])

        assigned_speaker_voices = {}
        for idx, shot in enumerate(shots):
            speaker = shot.get("speaker")
            dialogue = shot.get("dialogue")
            shot_id = validate_safe_id(str(shot.get("shot_id") or f"shot_{idx+1}"), "shot_id")

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

                matched_rule = match_role_override_rule(speaker or "")
                if matched_rule:
                    voice_config = {
                        "voice": matched_rule["voice"],
                        "fallback_voice": matched_rule["voice"],
                        "pitch": matched_rule["pitch"],
                        "rate": matched_rule["rate"],
                        "label": matched_rule["label"],
                        "gender": matched_rule["gender"],
                    }

                assigned_speaker_voices[spk_key] = voice_config

            pitch = voice_config["pitch"]
            rate = voice_config["rate"]
            if rejection_feedback:
                fb_lower = rejection_feedback.lower()
                if any(k in fb_lower for k in ("slow", "slower", "calm")):
                    rate = "-10%"
                elif any(k in fb_lower for k in ("fast", "faster", "energetic", "upbeat")):
                    rate = "+10%"
                if any(k in fb_lower for k in ("deep", "deeper", "low", "lower")):
                    pitch = "-12Hz"
                elif any(k in fb_lower for k in ("high", "higher", "bright")):
                    pitch = "+8Hz"
                if rate == voice_config["rate"] and pitch == voice_config["pitch"]:
                    rate = "-5%"

            if emitter:
                await emitter.push("status", content=f"Rendering {voice_config.get('label', 'neural voice')} for {speaker} in Shot {idx+1}...")

            audio_url = await tts.generate_speech(
                text=dialogue,
                voice_id=voice_config["voice"],
                pitch=pitch,
                rate=rate
            )
            if not audio_url or not str(audio_url).strip():
                raise RuntimeError(f"Audio provider returned empty speech output for Shot {idx+1} ({shot_id})")

            words = len(dialogue.split())
            est_duration = max(1.5, round(words / 2.5, 1))

            # Persist audio clip to disk & upload to MinIO when enabled
            if audio_url and "base64," in audio_url:
                import base64
                audio_disk_path = str(resolve_confined_path(renders_dir, f"audio_{shot_id}.mp3"))
                b64_part = audio_url.split("base64,", 1)[1]
                with open(audio_disk_path, "wb") as af:
                    af.write(base64.b64decode(b64_part))
                audio_info = await asyncio.to_thread(probe, audio_disk_path)
                if audio_info.duration > 0:
                    est_duration = round(audio_info.duration, 2)
                audio_url = media_storage.upload_file(
                    audio_disk_path,
                    project_id=project_id,
                    object_key=f"projects/{project_id}/voiceovers/{shot_id}/v1/audio.mp3",
                    bucket="cineforge-assets",
                    content_type="audio/mpeg",
                    asset_type="audio",
                    version=1,
                )

            voiceover_list.append({
                "shot_id": shot_id,
                "speaker": speaker or "Narrator",
                "gender": voice_config.get("gender", "male"),
                "dialogue": dialogue,
                "voice_name": voice_config.get("label", voice_config["voice"]),
                "voice_id": voice_config.get("voice", "en-US-ChristopherNeural"),
                "audio_url": audio_url,
                "duration_seconds": est_duration,
                "version": 1,
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

            response_data = await emitter.wait_for_approval("voiceover")
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
            # Per Agent.md, do not auto-approve generated artifacts; pause at END awaiting human approval.
            state["approval_states"]["voiceovers_approved"] = False
            break

    return state


def _compute_shot_input_hash(visual_desc: str, dialogue: str, speaker: str, duration: float) -> str:
    payload = f"{speaker}|{round(duration, 2)}|{visual_desc}|{dialogue}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


async def video_agent_node(state: FilmGraphState, config: RunnableConfig):
    emitter = config["configurable"].get("emitter")
    update_state_fn = config["configurable"].get("update_state")
    project_id = validate_safe_id(str(state.get("project_id", "default_project")), "project_id")

    if emitter:
        await emitter.push("status", content="Starting Stage 4: Parallel Video Generation...")
        await emitter.push("plan_update", current="Video Generation")

    shots = state.get("script_data", {}).get("shots", [])
    existing_shots = {vs.get("shot_id"): vs for vs in state.get("video_shots", [])}

    renders_root = Path(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "public", "renders")))
    renders_dir = str(resolve_confined_path(renders_root, project_id))
    os.makedirs(renders_dir, exist_ok=True)

    import subprocess
    import base64
    import httpx
    import shutil
    from core.video_generator import generate_ai_video_clip, QuotaExceededError
    from core.providers import get_image_provider

    global_narrative = state.get("script_data", {}).get("global_narrative", "")
    characters = state.get("characters", [])
    records_by_idx: dict[int, dict] = {}
    state_lock = asyncio.Lock()

    async def _sync_records():
        async with state_lock:
            state["video_shots"] = [records_by_idx[k] for k in sorted(records_by_idx.keys())]
            await _safe_update_state(update_state_fn, state)

    # Pre-populate queued records so UI can show per-shot status immediately
    for idx, shot in enumerate(shots):
        shot_id = validate_safe_id(str(shot.get("shot_id") or shot.get("id") or f"shot_{idx+1}"), "shot_id")
        shot["shot_id"] = shot_id
        speaker = (shot.get("speaker") or "Narrator").strip()
        dialogue = shot.get("dialogue") or ""
        visual_desc = shot.get("visual_description") or shot.get("description") or ""
        shot_dur = float(shot.get("duration_seconds", PROVIDER_CLIP_SECONDS))
        input_hash = _compute_shot_input_hash(visual_desc, dialogue, speaker, shot_dur)
        prev = existing_shots.get(shot_id)
        final_clip_out = str(resolve_confined_path(renders_dir, f"{shot_id}.mp4"))
        can_reuse = False
        if prev and prev.get("status") == "completed" and prev.get("input_hash") == input_hash and os.path.exists(final_clip_out):
            try:
                p_info = await asyncio.to_thread(probe, final_clip_out)
                can_reuse = p_info.has_video and p_info.duration >= 1.0
            except Exception:
                can_reuse = False

        if can_reuse and prev:
            records_by_idx[idx] = prev
        else:
            records_by_idx[idx] = {
                "shot_id": shot_id,
                "input_hash": input_hash,
                "video_url": "",
                "thumbnail_url": "",
                "speaker": speaker,
                "dialogue": dialogue,
                "prompt": visual_desc,
                "duration_seconds": shot_dur,
                "duration_sec": shot_dur,
                "status": "queued",
                "approved": False,
                "version": (prev.get("version", 0) + 1) if prev else 1,
                "padding_applied": None,
                "static_fallback": False,
                "error_message": None,
            }
            await publish_job_status(project_id, shot_id, "QUEUED")
    await _sync_records()

    async def _process_single_shot(idx: int, shot: dict):
        shot_id = validate_safe_id(str(shot.get("shot_id") or shot.get("id") or f"shot_{idx+1}"), "shot_id")
        speaker = (shot.get("speaker") or "Narrator").strip()
        dialogue = shot.get("dialogue") or ""
        visual_desc = shot.get("visual_description") or shot.get("description") or ""
        shot_version = records_by_idx[idx].get("version", 1)

        final_clip_out = str(resolve_confined_path(renders_dir, f"{shot_id}.mp4"))
        thumb_path = str(resolve_confined_path(renders_dir, f"thumb_{shot_id}.jpg"))

        if records_by_idx[idx].get("status") == "completed" and os.path.exists(final_clip_out):
            return records_by_idx[idx]

        records_by_idx[idx]["status"] = "rendering"
        await publish_job_status(project_id, shot_id, "RUNNING")
        await _sync_records()

        ai_clip = None
        try:
            # 1. Generate unique scene keyframe
            shot_scene_img = str(resolve_confined_path(renders_dir, f"{shot_id}_scene.jpg"))
            img_path = None
            scene_context = visual_desc or dialogue or global_narrative

            if scene_context:
                if emitter:
                    await emitter.push("status", content=f"Designing scene visual for Shot {idx+1}/{len(shots)} ({speaker})...")
                img_provider = get_image_provider()
                desc_lower = f"{scene_context} {speaker} {global_narrative}".lower()
                is_kid_theme = any(k in desc_lower for k in ["tiger", "elephant", "cub", "kid", "child", "fun", "friend", "jungle", "cute", "disney", "pixar", "baby", "play", "doraemon", "nobita", "cartoon"])
                if is_kid_theme:
                    scene_prompt = f"Charming 3D Pixar Disney animated movie style, vibrant saturated colors, cute expressive characters, whimsical cinematic lighting: {scene_context}. Character focus: {speaker}. 16:9 widescreen, family-friendly, crisp high detail, shot {idx+1}"
                else:
                    scene_prompt = f"Official 2D anime art style, Studio Ghibli aesthetic: {scene_context}. Character focus: {speaker}. 16:9 widescreen, cinematic anime scene keyframe, crisp line art, beautiful lighting, shot {idx+1}"
                seed = abs(hash(f"{project_id}_{shot_id}_{idx}")) % 1000000
                scene_url = await img_provider.generate_image(scene_prompt, seed=seed, aspect_ratio="16:9")
                if scene_url and scene_url.startswith("data:image") and "base64," in scene_url:
                    img_bytes = base64.b64decode(scene_url.split("base64,", 1)[1])
                    if len(img_bytes) > 1000:
                        with open(shot_scene_img, "wb") as f_scene:
                            f_scene.write(img_bytes)
                        img_path = shot_scene_img
                elif scene_url and scene_url.startswith("http"):
                    async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0"}) as client:
                        r = await client.get(scene_url, timeout=30)
                        if r.status_code == 200 and len(r.content) > 1000:
                            with open(shot_scene_img, "wb") as f_scene:
                                f_scene.write(r.content)
                            img_path = shot_scene_img

            if not img_path or not os.path.exists(img_path):
                raise RuntimeError(f"Keyframe image generation failed for Shot {idx+1} ({shot_id}).")

            if emitter:
                await emitter.push("status", content=f"Rendering AI video for Shot {idx+1}/{len(shots)} ({speaker})...")

            raw_clip_out = str(resolve_confined_path(renders_dir, f"{shot_id}_raw.mp4"))
            char_match = next((c for c in characters if c.get("name", "").lower() == speaker.lower()), None)
            char_style = f" Character details: {char_match.get('description')}" if char_match and char_match.get("description") else ""
            motion_prompt = (
                f"{speaker}: {visual_desc or dialogue}.{char_style} "
                f"Vibrant cinematic animation, continuous lively character movement, expressive talking and gestures, "
                f"fluid dynamic interactions, 60fps high quality anime movie scene, no freeze frame, continuous motion."
            )

            clip_info = None
            max_attempts = 2
            for attempt in range(max_attempts):
                try:
                    ai_clip = await asyncio.to_thread(
                        generate_ai_video_clip,
                        image_path=img_path,
                        prompt=motion_prompt,
                        hf_token=settings.HUGGINGFACE_API_KEY,
                        duration=PROVIDER_CLIP_LENGTH_SEC,
                        steps=4,
                    )
                    if not ai_clip or not os.path.exists(ai_clip):
                        raise RuntimeError("No output video file generated")
                    clip_info = await asyncio.to_thread(probe, ai_clip)
                    if not clip_info.has_video:
                        raise RuntimeError("Output clip has no video stream")
                    if clip_info.duration <= 0.5 or (clip_info.fps is not None and clip_info.fps <= 1.0):
                        raise RuntimeError(f"Static clip detected: duration={clip_info.duration:.2f}s, fps={clip_info.fps}")
                    if clip_info.duration < 3.0:
                        raise RuntimeError(f"Clip too short: {clip_info.duration:.2f}s < 3.00s")
                    break
                except QuotaExceededError:
                    raise
                except Exception:
                    if attempt < max_attempts - 1:
                        await asyncio.sleep(2.0 * (attempt + 1))
                    else:
                        raise

            shutil.copyfile(ai_clip, raw_clip_out)
            target_dur = float(shot.get("duration_seconds", PROVIDER_CLIP_SECONDS))
            tmp_clip_out = str(resolve_confined_path(renders_dir, f".{shot_id}_tmp.mp4"))
            try:
                if clip_info.duration > target_dur + 0.1:
                    trim_cmd = [FFMPEG_BIN, "-y", "-i", ai_clip, "-t", str(target_dur), "-c", "copy", tmp_clip_out]
                    res = await asyncio.to_thread(lambda: subprocess.run(trim_cmd, capture_output=True))
                    if res.returncode != 0 or not os.path.exists(tmp_clip_out):
                        reencode_cmd = [
                            FFMPEG_BIN, "-y", "-i", ai_clip, "-t", str(target_dur),
                            "-c:v", "libx264", "-preset", "fast", "-crf", str(settings.VIDEO_CRF),
                            "-pix_fmt", "yuv420p", "-an", tmp_clip_out
                        ]
                        res = await asyncio.to_thread(lambda: subprocess.run(reencode_cmd, capture_output=True))
                    if res.returncode != 0 or not os.path.exists(tmp_clip_out):
                        raise RuntimeError(f"Failed to trim Shot {idx+1} ({shot_id}) to {target_dur:.2f}s")
                else:
                    shutil.copyfile(ai_clip, tmp_clip_out)

                trimmed_info = await asyncio.to_thread(probe, tmp_clip_out)
                if not trimmed_info.has_video or trimmed_info.duration <= 0.1:
                    raise RuntimeError(f"Validated clip for Shot {idx+1} ({shot_id}) is invalid")
                real_duration = round(trimmed_info.duration, 3)
                os.replace(tmp_clip_out, final_clip_out)
            finally:
                if os.path.exists(tmp_clip_out):
                    try:
                        os.unlink(tmp_clip_out)
                    except OSError:
                        pass

            thumb_cmd = [FFMPEG_BIN, "-y", "-ss", "00:00:01", "-i", final_clip_out, "-vframes", "1", thumb_path]
            await asyncio.to_thread(lambda: subprocess.run(thumb_cmd, capture_output=True))

            video_url = media_storage.upload_file(
                final_clip_out,
                project_id=project_id,
                object_key=f"projects/{project_id}/clips/{shot_id}/v{shot_version}/video.mp4",
                bucket="cineforge-renders",
                content_type="video/mp4",
                asset_type="video",
                version=shot_version,
            )
            thumb_url = media_storage.upload_file(
                thumb_path,
                project_id=project_id,
                object_key=f"projects/{project_id}/clips/{shot_id}/v{shot_version}/thumb.jpg",
                bucket="cineforge-renders",
                content_type="image/jpeg",
                asset_type="image",
                version=shot_version,
            ) if os.path.exists(thumb_path) else ""

            records_by_idx[idx].update({
                "video_url": video_url,
                "thumbnail_url": thumb_url,
                "duration_seconds": real_duration,
                "duration_sec": real_duration,
                "status": "completed",
                "approved": False,
                "error_message": None,
            })
            await publish_job_status(project_id, shot_id, "SUCCEEDED")
        except QuotaExceededError as qe:
            records_by_idx[idx].update({
                "status": "failed_quota",
                "approved": False,
                "error_message": str(qe),
            })
            await publish_job_status(project_id, shot_id, "FAILED", str(qe))
            if emitter:
                await emitter.push("error", message=f"Shot {idx+1} ({shot_id}) hit ZeroGPU quota: {qe}")
        except Exception as err:
            records_by_idx[idx].update({
                "status": "failed",
                "approved": False,
                "error_message": str(err),
            })
            await publish_job_status(project_id, shot_id, "FAILED", str(err))
            if emitter:
                await emitter.push("error", message=f"Shot {idx+1} ({shot_id}) failed: {err}")
        finally:
            if ai_clip and ai_clip.startswith("/tmp") and os.path.exists(ai_clip):
                try:
                    os.unlink(ai_clip)
                except OSError:
                    pass
            await _sync_records()
        return records_by_idx[idx]

    tasks = [lambda i=idx, s=shot: _process_single_shot(i, s) for idx, shot in enumerate(shots)]
    await run_parallel_shot_tasks(tasks, concurrency_limit=settings.VIDEO_CONCURRENCY_LIMIT)

    video_shot_records = [records_by_idx[k] for k in sorted(records_by_idx.keys())]
    state["current_stage"] = "video"
    state["video_shots"] = video_shot_records
    state["approval_states"]["video_approved"] = False
    state["approval_states"]["assembly_confirmed"] = False
    await _safe_update_state(update_state_fn, state)

    failed_shots = [s["shot_id"] for s in video_shot_records if s.get("status") != "completed"]
    if emitter:
        if failed_shots:
            await emitter.push(
                "message",
                content=f"⚠️ {len(failed_shots)} shot(s) failed ({', '.join(failed_shots)}), while {len(video_shot_records) - len(failed_shots)} succeeded. Regenerate failed shots in the Video tab:",
                link={"label": "Review Video Shots", "target": "video_tab"}
            )
        else:
            await emitter.push("status", content="All video shots processed. Ready for per-shot review.")
            await emitter.push(
                "message",
                content="🎬 Video clips are ready! Review and approve each shot in the Video tab to proceed with master film assembly:",
                link={"label": "Review Video Shots", "target": "video_tab"}
            )
            await emitter.push("approval_request", stage="video")
        await emitter.push("done")
    return state


async def confirm_assembly_node(state: FilmGraphState, config: RunnableConfig):
    """HITL-005 confirmation checkpoint before running Editor Agent assembly."""
    emitter = config["configurable"].get("emitter")
    update_state_fn = config["configurable"].get("update_state")

    if state.get("approval_states", {}).get("assembly_confirmed"):
        return state

    state["current_stage"] = "editor_ready"
    await _safe_update_state(update_state_fn, state)

    if emitter:
        await emitter.push(
            "message",
            content="All video shots are approved! Confirm to assemble the final master film:",
            link={"label": "Confirm Assembly", "target": "video_tab"}
        )
        await emitter.push("approval_request", stage="assembly")
        resp = await emitter.wait_for_approval("assembly")
        if resp.get("approved"):
            state["approval_states"]["assembly_confirmed"] = True
            await _safe_update_state(update_state_fn, state)
        else:
            state["approval_states"]["assembly_confirmed"] = False
    else:
        state["approval_states"]["assembly_confirmed"] = False

    return state


# Build the Graph

workflow = StateGraph(FilmGraphState)

workflow.add_node("script_agent", script_agent_node)
workflow.add_node("character_agent", character_agent_node)
workflow.add_node("voiceover_agent", voiceover_agent_node)
workflow.add_node("video_agent", video_agent_node)
workflow.add_node("confirm_assembly", confirm_assembly_node)
workflow.add_node("assemble_video", assemble_video)

def entry_router(state: FilmGraphState) -> str:
    approvals = state.get("approval_states", {})
    if not approvals.get("script_approved"):
        return "script_agent"
    elif not approvals.get("characters_approved"):
        return "character_agent"
    elif not approvals.get("voiceovers_approved"):
        return "voiceover_agent"
    elif not approvals.get("video_approved"):
        return "video_agent"
    elif not approvals.get("assembly_confirmed"):
        return "confirm_assembly"
    elif not approvals.get("editor_approved"):
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
        return "confirm_assembly"
    return END

def after_confirm_assembly_router(state: FilmGraphState) -> str:
    if state.get("approval_states", {}).get("assembly_confirmed"):
        return "assemble_video"
    return END

workflow.set_conditional_entry_point(
    entry_router,
    {
        "script_agent": "script_agent",
        "character_agent": "character_agent",
        "voiceover_agent": "voiceover_agent",
        "video_agent": "video_agent",
        "confirm_assembly": "confirm_assembly",
        "assemble_video": "assemble_video",
        END: END
    }
)

workflow.add_conditional_edges("script_agent", after_script_router, {"character_agent": "character_agent", END: END})
workflow.add_conditional_edges("character_agent", after_character_router, {"voiceover_agent": "voiceover_agent", END: END})
workflow.add_conditional_edges("voiceover_agent", after_voiceover_router, {"video_agent": "video_agent", END: END})
workflow.add_conditional_edges("video_agent", after_video_router, {"confirm_assembly": "confirm_assembly", END: END})
workflow.add_conditional_edges("confirm_assembly", after_confirm_assembly_router, {"assemble_video": "assemble_video", END: END})
workflow.add_edge("assemble_video", END)

app = workflow.compile()


