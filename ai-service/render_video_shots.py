import os
import json
import base64
import subprocess
import imageio_ffmpeg

def generate_video_shots(project_id: str = "6ac13c8b8d1adb207741a2cc"):
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    state_file = f".state_cache/{project_id}.json"
    if not os.path.exists(state_file):
        raise FileNotFoundError(f"State file {state_file} does not exist.")

    with open(state_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    script_data = data.get("script_data", {})
    shots = script_data.get("shots", [])
    voiceovers = {vo.get("shot_id"): vo for vo in data.get("voiceovers", [])}
    characters = {c.get("name", "").lower(): c for c in data.get("characters", [])}

    renders_dir = os.path.abspath(f"../frontend/public/renders/{project_id}")
    os.makedirs(renders_dir, exist_ok=True)

    video_shot_records = []
    temp_clip_paths = []

    print(f"[CineForge] Starting cinematic render for project {project_id} ({len(shots)} shots)...")

    # Image mapping for characters
    char_image_map = {
        "solaris": os.path.abspath("../frontend/public/solaris.jpg"),
        "malakor": os.path.abspath("../frontend/public/malakor.jpg"),
        "shadow weaver": os.path.abspath("../frontend/public/shadow_weaver.jpg"),
        "titaness": os.path.abspath("../frontend/public/titaness.jpg"),
        "aero": os.path.abspath("../frontend/public/aero.jpg")
    }

    # Different cinematic zoom / pan motions for visual variety
    motion_filters = [
        "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='min(zoom+0.0012,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=125:s=1280x720:fps=25", # Slow push-in
        "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='min(max(zoom,pzoom)-0.0012,1.0)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=125:s=1280x720:fps=25", # Slow pull-out
        "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='1.08':x='if(lte(on,-1),(iw/2)-(iw/zoom/2),x+0.8)':y='ih/2-(ih/zoom/2)':d=125:s=1280x720:fps=25", # Slow pan right
        "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='min(zoom+0.0015,1.20)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=125:s=1280x720:fps=25", # Dramatic zoom
        "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='1.06':x='if(lte(on,-1),(iw/2)-(iw/zoom/2),x-0.8)':y='ih/2-(ih/zoom/2)':d=125:s=1280x720:fps=25", # Slow pan left
        "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='min(zoom+0.0010,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=125:s=1280x720:fps=25" # Subtle push
    ]

    for idx, shot in enumerate(shots):
        shot_id = shot.get("shot_id") or f"shot_{idx+1}"
        speaker = shot.get("speaker") or "Solaris"
        dialogue = shot.get("dialogue") or ""
        visual_desc = shot.get("visual_description") or ""
        vo = voiceovers.get(shot_id)

        # Determine source image
        spk_lower = speaker.lower().strip()
        img_path = char_image_map.get(spk_lower, char_image_map["solaris"])

        # Determine audio duration and extract audio file
        audio_path = os.path.join(renders_dir, f"audio_{shot_id}.mp3")
        has_audio = False
        duration = 5.0 # fallback

        if vo and vo.get("audio_url"):
            try:
                b64 = vo["audio_url"].split("base64,")[1]
                with open(audio_path, "wb") as af:
                    af.write(base64.b64decode(b64))
                has_audio = True
                duration = vo.get("duration_seconds", 5.0) + 0.8 # add breathing room
            except Exception as e:
                print(f"Warning: Failed to decode audio for {shot_id}: {e}")

        clip_out = os.path.join(renders_dir, f"{shot_id}.mp4")
        temp_clip_paths.append(clip_out)

        # Select motion
        motion = motion_filters[idx % len(motion_filters)]

        # FFmpeg command to render the shot
        if has_audio:
            cmd = [
                ffmpeg, "-y",
                "-loop", "1", "-i", img_path,
                "-i", audio_path,
                "-vf", motion,
                "-c:v", "libx264", "-preset", "fast", "-crf", "22",
                "-c:a", "aac", "-b:a", "192k",
                "-t", str(duration),
                "-pix_fmt", "yuv420p",
                clip_out
            ]
        else:
            cmd = [
                ffmpeg, "-y",
                "-loop", "1", "-i", img_path,
                "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
                "-vf", motion,
                "-c:v", "libx264", "-preset", "fast", "-crf", "22",
                "-c:a", "aac", "-b:a", "192k",
                "-t", str(duration),
                "-pix_fmt", "yuv420p",
                clip_out
            ]

        print(f"Rendering Shot {idx+1}/{len(shots)}: {shot_id} ({speaker}) -> {duration:.1f}s...")
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError(f"FFmpeg error on {shot_id}: {res.stderr[:200]}")
        print(f"  [OK] Shot {shot_id} rendered successfully ({os.path.getsize(clip_out)} bytes)")

        # Web accessible URL
        rel_video_url = f"/renders/{project_id}/{shot_id}.mp4"
        rel_thumb_url = f"/{os.path.basename(img_path)}"

        video_shot_records.append({
            "shot_id": shot_id,
            "video_url": rel_video_url,
            "thumbnail_url": rel_thumb_url,
            "speaker": speaker,
            "dialogue": dialogue,
            "prompt": visual_desc,
            "duration_seconds": round(duration, 1)
        })

    # Assemble Final Combined Movie
    print("\n[CineForge] Assembling Final Film (All Shots Concat)...")
    concat_list_file = os.path.join(renders_dir, "concat_list.txt")
    with open(concat_list_file, "w", encoding="utf-8") as f:
        for p in temp_clip_paths:
            # Format paths for ffmpeg concat
            f.write(f"file '{p.replace(chr(92), '/')}'\n")

    final_film_path = os.path.join(renders_dir, "final_film.mp4")
    concat_cmd = [
        ffmpeg, "-y",
        "-f", "concat", "-safe", "0",
        "-i", concat_list_file,
        "-c", "copy",
        final_film_path
    ]
    res_concat = subprocess.run(concat_cmd, capture_output=True, text=True)
    if res_concat.returncode != 0:
        raise RuntimeError(f"Concat error: {res_concat.stderr[:200]}")
    print(f"  [OK] Final assembled film created: {final_film_path} ({os.path.getsize(final_film_path)} bytes)")

    # Update state cache
    data["current_stage"] = "video"
    data["video_shots"] = video_shot_records
    data["final_video_url"] = f"/renders/{project_id}/final_film.mp4"
    data["approval_states"]["voiceovers_approved"] = True
    data["approval_states"]["video_approved"] = False

    with open(state_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print("[CineForge] Video generation pipeline finished and saved to state cache.")
    return video_shot_records

if __name__ == "__main__":
    generate_video_shots()
