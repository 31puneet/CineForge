import asyncio
import json
from core.providers import EdgeTTSAudioAdapter

async def render_all():
    tts = EdgeTTSAudioAdapter()
    path = ".state_cache/6ac13c8b8d1adb207741a2cc.json"
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Classify gender on characters
    for c in data.get("characters", []):
        name = c["name"].lower()
        if "shadow" in name or "weaver" in name or "titaness" in name:
            c["gender"] = "female"
        else:
            c["gender"] = "male"

    chars_map = {c["name"].lower(): c for c in data.get("characters", [])}

    new_vos = []
    for shot in data.get("script_data", {}).get("shots", []):
        speaker = shot.get("speaker")
        dialogue = shot.get("dialogue")
        shot_id = shot.get("shot_id")
        if not dialogue or dialogue.strip() in ["", "None"]:
            continue
        c_info = chars_map.get((speaker or "").lower(), {})
        vcfg = tts.match_character_voice(
            char_name=speaker or "Character",
            char_role=c_info.get("role", ""),
            description=c_info.get("description", ""),
            gender=c_info.get("gender", "")
        )
        print(f"Rendering {shot_id} for {speaker} using {vcfg['label']} ({vcfg['voice']})...")
        audio_url = await tts.generate_speech(
            text=dialogue,
            voice_id=vcfg["voice"],
            pitch=vcfg["pitch"],
            rate=vcfg["rate"]
        )
        words = len(dialogue.split())
        est_duration = max(1.5, round(words / 2.5, 1))
        new_vos.append({
            "shot_id": shot_id,
            "speaker": speaker,
            "gender": vcfg.get("gender", "male"),
            "dialogue": dialogue,
            "voice_name": vcfg.get("label", vcfg["voice"]),
            "voice_id": vcfg.get("voice"),
            "audio_url": audio_url,
            "duration_seconds": est_duration
        })

    data["voiceovers"] = new_vos
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"Successfully generated {len(new_vos)} classified audio tracks!")

if __name__ == "__main__":
    asyncio.run(render_all())
