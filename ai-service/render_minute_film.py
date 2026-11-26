import os
import json
import base64
import subprocess
import imageio_ffmpeg

def generate_full_minute_film(project_id: str = "6ac13c8b8d1adb207741a2cc"):
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    state_file = f".state_cache/{project_id}.json"
    if not os.path.exists(state_file):
        raise FileNotFoundError(f"State file {state_file} does not exist.")

    with open(state_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    script_data = data.get("script_data", {})
    shots = script_data.get("shots", [])
    voiceovers = {vo.get("shot_id"): vo for vo in data.get("voiceovers", [])}

    renders_dir = os.path.abspath(f"../frontend/public/renders/{project_id}")
    os.makedirs(renders_dir, exist_ok=True)

    char_image_map = {
        "solaris": os.path.abspath("../frontend/public/solaris.jpg"),
        "malakor": os.path.abspath("../frontend/public/malakor.jpg"),
        "shadow weaver": os.path.abspath("../frontend/public/shadow_weaver.jpg"),
        "titaness": os.path.abspath("../frontend/public/titaness.jpg"),
        "aero": os.path.abspath("../frontend/public/aero.jpg")
    }

    # Distinct cinematic camera motions calibrated for full 10-second (250 frames @ 25fps) acts:
    # 1. Shot 1: Solaris - Dramatic slow push-in establishing the citadel crisis
    # 2. Shot 2: Malakor - Slow menacing pull-out revealing the infernal rift
    # 3. Shot 3: Shadow Weaver - Panoramic sweeping pan right across the arcane barrier
    # 4. Shot 4: Titaness - Power zoom-in focusing on seismic gauntlets charge
    # 5. Shot 5: Aero - High-speed tracking pan left across the supersonic flight path
    # 6. Shot 6: Solaris / Assemble - Epic cosmic slow zoom-in as supernova strikes
    motion_filters = [
        "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='min(zoom+0.0006,1.20)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=250:s=1280x720:fps=25", # Shot 1: Push-in
        "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='min(max(zoom,pzoom)-0.0005,1.0)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=250:s=1280x720:fps=25", # Shot 2: Pull-out
        "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='1.10':x='if(lte(on,-1),(iw/2)-(iw/zoom/2),x+0.5)':y='ih/2-(ih/zoom/2)':d=250:s=1280x720:fps=25", # Shot 3: Pan right
        "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='min(zoom+0.0007,1.22)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=250:s=1280x720:fps=25", # Shot 4: Heavy zoom
        "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='1.08':x='if(lte(on,-1),(iw/2)-(iw/zoom/2),x-0.5)':y='ih/2-(ih/zoom/2)':d=250:s=1280x720:fps=25", # Shot 5: Pan left
        "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='min(zoom+0.0008,1.25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=250:s=1280x720:fps=25"  # Shot 6: Climax zoom
    ]

    video_shot_records = []
    temp_clip_paths = []

    print(f"[CineForge] Starting Full 60-Second (1 Minute) Movie Rendering for {project_id}...")
    print(f"[CineForge] Total script shots: {len(shots)}, Exactly 10.0s per shot = 60.0s total runtime.")

    for idx, shot in enumerate(shots):
        shot_id = shot.get("shot_id") or f"shot_{idx+1}"
        speaker = shot.get("speaker") or "Solaris"
        dialogue = shot.get("dialogue") or ""
        visual_desc = shot.get("visual_description") or ""
        vo = voiceovers.get(shot_id)
        shot_duration = 10.0 # Exactly 10 seconds per shot conforming to 1-minute target

        # Select character portrait asset
        spk_lower = speaker.lower().strip()
        img_path = char_image_map.get(spk_lower, char_image_map["solaris"])

        # Decode speech audio track
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

        clip_out = os.path.join(renders_dir, f"{shot_id}.mp4")
        temp_clip_paths.append(clip_out)

        motion_vf = motion_filters[idx % len(motion_filters)]

        # Script-synchronized cinematic audio delivery:
        # 1. Opening 1.2s: Scene atmosphere establishes with camera panning onto the character
        # 2. Middle ~4s: Character delivers scripted dialogue line with authentic emotion
        # 3. Trailing ~4.8s: Action continues, seismic energy radiates, holding suspense before next shot
        if has_audio:
            cmd = [
                ffmpeg, "-y",
                "-loop", "1", "-i", img_path,
                "-i", audio_path,
                "-filter_complex", f"[1:a]adelay=1200|1200,apad=whole_dur=10[aout];[0:v]{motion_vf}[vout]",
                "-map", "[vout]", "-map", "[aout]",
                "-c:v", "libx264", "-preset", "fast", "-crf", "21",
                "-c:a", "aac", "-b:a", "192k",
                "-t", "10",
                "-pix_fmt", "yuv420p",
                clip_out
            ]
        else:
            cmd = [
                ffmpeg, "-y",
                "-loop", "1", "-i", img_path,
                "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
                "-vf", motion_vf,
                "-c:v", "libx264", "-preset", "fast", "-crf", "21",
                "-c:a", "aac", "-b:a", "192k",
                "-t", "10",
                "-pix_fmt", "yuv420p",
                clip_out
            ]

        print(f"Rendering Shot {idx+1}/{len(shots)}: {shot_id} [{speaker}] (10.0s act)...")
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError(f"Shot {shot_id} failed: {res.stderr[:200]}")
        print(f"  [OK] Shot {shot_id} completed: 10.0s ({os.path.getsize(clip_out)} bytes)")

        rel_video_url = f"/renders/{project_id}/{shot_id}.mp4"
        rel_thumb_url = f"/{os.path.basename(img_path)}"

        video_shot_records.append({
            "shot_id": shot_id,
            "video_url": rel_video_url,
            "thumbnail_url": rel_thumb_url,
            "speaker": speaker,
            "dialogue": dialogue,
            "prompt": visual_desc,
            "duration_seconds": 10.0
        })

    # Assemble All 6 Shots into Master 60-Second (1 Minute) Film
    print("\n[CineForge] Concat Assembling Master 60-Second (1 Minute) Film...")
    concat_list_file = os.path.join(renders_dir, "concat_list.txt")
    with open(concat_list_file, "w", encoding="utf-8") as f:
        for p in temp_clip_paths:
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
        raise RuntimeError(f"Concat failed: {res_concat.stderr[:200]}")
    film_size = os.path.getsize(final_film_path)
    print(f"  [OK] Master film generated: {final_film_path} ({film_size} bytes)")

    # Persist updated state with actual total duration
    total_duration = round(sum(s["duration_seconds"] for s in video_shot_records), 1)
    data["current_stage"] = "video"
    data["video_shots"] = video_shot_records
    data["final_video_url"] = f"/renders/{project_id}/final_film.mp4"
    data["total_film_duration"] = total_duration
    data["approval_states"]["voiceovers_approved"] = True
    data["approval_states"]["video_approved"] = False

    with open(state_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print("[CineForge] 1-Minute script-synchronized movie pipeline successfully finished.")

if __name__ == "__main__":
    generate_full_minute_film()
