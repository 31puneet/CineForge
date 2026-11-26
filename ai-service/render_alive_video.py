import os
import json
import base64
import subprocess
import cv2
import numpy as np
import imageio_ffmpeg

def generate_alive_cinematic_movie(project_id: str = "6ac13c8b8d1adb207741a2cc"):
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

    target_w, target_h = 1280, 720
    fps = 25
    shot_dur = 10
    total_frames = fps * shot_dur

    # Specific live visual energy theme for each character
    fx_configs = {
        "solaris": {
            "spark_color": (80, 220, 255), # Radiant Golden Sun
            "flare_color": (0, 200, 255),
            "spark_count": 90,
            "spark_vy": -6.0,
            "glow_tint": "warm_gold",
            "camera_style": "heavy_push_shake"
        },
        "malakor": {
            "spark_color": (20, 80, 255), # Scorching Volcano Magma / Lava Sparks
            "flare_color": (0, 30, 220),
            "spark_count": 120,
            "spark_vy": -8.0,
            "glow_tint": "hellfire_red",
            "camera_style": "menacing_shake"
        },
        "shadow weaver": {
            "spark_color": (255, 90, 200), # Ethereal Amethyst Violet Arcane Glyphs
            "flare_color": (230, 40, 160),
            "spark_count": 80,
            "spark_vy": -4.0,
            "glow_tint": "mystic_purple",
            "camera_style": "floating_pan"
        },
        "titaness": {
            "spark_color": (255, 220, 60), # Electric Arc Blue / Cybernetic Shockwave
            "flare_color": (255, 180, 0),
            "spark_count": 100,
            "spark_vy": -7.0,
            "glow_tint": "electric_blue",
            "camera_style": "impact_charge"
        },
        "aero": {
            "spark_color": (255, 250, 180), # Supersonic Photon Thrust Trails
            "flare_color": (255, 230, 100),
            "spark_count": 130,
            "spark_vy": -11.0,
            "glow_tint": "cyan_velocity",
            "camera_style": "hyperspeed_streak"
        }
    }

    temp_clip_paths = []
    video_shot_records = []

    print(f"[CineForge VideoFX] Generating dynamic cinematic character video clips (60.0s total)...")

    for idx, shot in enumerate(shots):
        shot_id = shot.get("shot_id") or f"shot_{idx+1}"
        speaker = shot.get("speaker") or "Solaris"
        dialogue = shot.get("dialogue") or ""
        visual_desc = shot.get("visual_description") or ""
        vo = voiceovers.get(shot_id)

        spk_key = speaker.lower().strip()
        img_path = char_image_map.get(spk_key, char_image_map["solaris"])
        fx = fx_configs.get(spk_key, fx_configs["solaris"])

        # Load character portrait
        src_img = cv2.imread(img_path)
        if src_img is None:
            src_img = np.zeros((target_h, target_w, 3), dtype=np.uint8)

        ih, iw = src_img.shape[:2]
        base_scale = max(target_w / iw, target_h / ih) * 1.35
        resized = cv2.resize(src_img, (int(iw * base_scale), int(ih * base_scale)))
        rh, rw = resized.shape[:2]

        raw_motion_mp4 = os.path.join(renders_dir, f"raw_motion_{shot_id}.mp4")
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        writer = cv2.VideoWriter(raw_motion_mp4, fourcc, fps, (target_w, target_h))

        # Initialize particles for this character
        np.random.seed(200 + idx * 37)
        sparks = np.random.rand(fx["spark_count"], 5)
        sparks[:, 0] *= target_w
        sparks[:, 1] *= target_h
        sparks[:, 2] = (sparks[:, 2] - 0.5) * 5
        sparks[:, 3] = np.random.uniform(fx["spark_vy"] - 2, fx["spark_vy"] + 1, fx["spark_count"])
        sparks[:, 4] = sparks[:, 4] * 3.5 + 2

        # Precompute static vignette mask once per shot
        vignette = np.zeros((target_h, target_w), dtype=np.float32)
        cv2.circle(vignette, (target_w//2, target_h//2), int(target_w * 0.68), 1.0, -1)
        vignette = cv2.GaussianBlur(vignette, (151, 151), 0)[:, :, None]

        for f in range(total_frames):
            t = f / fps
            prog = f / total_frames

            # 1. Alive Dynamic Character Breathing & Cinematic Camera Motion
            if fx["camera_style"] == "heavy_push_shake":
                zoom = 1.08 + 0.22 * prog
                cam_x = np.sin(t * 3.2) * 7 + np.sin(t * 6.5) * 2.5
                cam_y = np.cos(t * 2.5) * 6 + np.cos(t * 5.0) * 2
            elif fx["camera_style"] == "menacing_shake":
                zoom = 1.25 - 0.15 * prog # menacing slow pull
                cam_x = np.sin(t * 4.5) * 9 + np.random.uniform(-1.5, 1.5) # tremor rumble
                cam_y = np.cos(t * 3.5) * 8 + np.random.uniform(-1.5, 1.5)
            elif fx["camera_style"] == "floating_pan":
                zoom = 1.14
                cam_x = np.sin(t * 1.5) * 25 + np.sin(t * 4.0) * 4 # floating ethereal drift
                cam_y = np.cos(t * 2.0) * 12
            elif fx["camera_style"] == "impact_charge":
                # charging power zoom with sudden heartbeat pulses
                zoom = 1.10 + 0.20 * prog + (0.04 if (f % 50 < 6) else 0.0)
                cam_x = np.sin(t * 3.0) * 6 + (np.random.uniform(-4, 4) if (f % 50 < 6) else 0)
                cam_y = np.cos(t * 3.5) * 6 + (np.random.uniform(-4, 4) if (f % 50 < 6) else 0)
            else: # hyperspeed_streak
                zoom = 1.12 + 0.18 * prog
                cam_x = -30 * prog + np.sin(t * 6.0) * 8
                cam_y = np.cos(t * 5.0) * 7

            crop_w = int(target_w / zoom)
            crop_h = int(target_h / zoom)

            cx = rw // 2 + int(cam_x)
            cy = rh // 2 + int(cam_y)
            x1 = max(0, min(rw - crop_w, cx - crop_w // 2))
            y1 = max(0, min(rh - crop_h, cy - crop_h // 2))

            crop = resized[y1:y1+crop_h, x1:x1+crop_w]
            frame = cv2.resize(crop, (target_w, target_h))

            # 2. Dynamic Alive Character Lighting Pulses
            pulse = 1.0 + 0.12 * np.sin(t * 3.8) + 0.06 * np.sin(t * 7.5)
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV).astype(np.float32)
            hsv[:, :, 1] = np.clip(hsv[:, :, 1] * (pulse * 1.05), 0, 255)
            hsv[:, :, 2] = np.clip(hsv[:, :, 2] * pulse, 0, 255)
            frame = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)

            # 3. Anamorphic Lens Flare & Volumetric Light Beam
            overlay = frame.copy()
            flare_alpha = 0.22 + 0.12 * np.sin(t * 3.0)
            fx_cx = int(target_w * 0.5 + np.sin(t * 1.8) * 50)
            fx_cy = int(target_h * 0.42 + np.cos(t * 1.4) * 35)

            cv2.circle(overlay, (fx_cx, fx_cy), int(150 * pulse), fx["flare_color"], -1)
            cv2.ellipse(overlay, (fx_cx, fx_cy), (int(480 * pulse), 16), 0, 0, 360, fx["flare_color"], -1)
            cv2.addWeighted(overlay, flare_alpha * 0.35, frame, 1.0 - (flare_alpha * 0.35), 0, frame)

            # 4. Alive Energy Sparks / Embers Floating Across Scene
            sparks[:, 0] += sparks[:, 2]
            sparks[:, 1] += sparks[:, 3]
            sparks[:, 0] = sparks[:, 0] % target_w
            sparks[:, 1] = sparks[:, 1] % target_h

            for sp in sparks:
                sx, sy, sz = int(sp[0]), int(sp[1]), int(sp[4])
                cv2.circle(frame, (sx, sy), sz, fx["spark_color"], -1)
                cv2.circle(frame, (sx, sy), sz + 2, fx["flare_color"], 1)

            # 5. Cinematic Vignette
            frame = (frame * vignette).astype(np.uint8)

            writer.write(frame)

        writer.release()

        # Audio track extraction
        audio_path = os.path.join(renders_dir, f"audio_{shot_id}.mp3")
        has_audio = False
        if vo and vo.get("audio_url"):
            try:
                b64 = vo["audio_url"].split("base64,")[1]
                with open(audio_path, "wb") as af:
                    af.write(base64.b64decode(b64))
                has_audio = True
            except Exception as e:
                print(f"[Warning] Failed audio decode: {e}")

        final_shot_mp4 = os.path.join(renders_dir, f"{shot_id}.mp4")
        temp_clip_paths.append(final_shot_mp4)

        # Mux Video + Audio with 1.2s atmospheric lead-in and audio padding for 10.0s exact
        if has_audio:
            mux_cmd = [
                ffmpeg, "-y",
                "-i", raw_motion_mp4,
                "-i", audio_path,
                "-filter_complex", "[1:a]adelay=1200|1200,apad=whole_dur=10[aout]",
                "-map", "0:v", "-map", "[aout]",
                "-c:v", "libx264", "-preset", "fast", "-crf", "21",
                "-c:a", "aac", "-b:a", "192k",
                "-t", "10",
                "-pix_fmt", "yuv420p",
                final_shot_mp4
            ]
        else:
            mux_cmd = [
                ffmpeg, "-y",
                "-i", raw_motion_mp4,
                "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
                "-c:v", "libx264", "-preset", "fast", "-crf", "21",
                "-c:a", "aac", "-b:a", "192k",
                "-t", "10",
                "-pix_fmt", "yuv420p",
                final_shot_mp4
            ]

        res = subprocess.run(mux_cmd, capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError(f"Failed to mux {shot_id}: {res.stderr[:200]}")
        print(f"  [OK] Shot {shot_id} rendered with live character FX & speech: {os.path.getsize(final_shot_mp4)} bytes")

        if os.path.exists(raw_motion_mp4):
            os.remove(raw_motion_mp4)

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

    # Assemble Final Film (60.0 Seconds Master Film)
    print("\n[CineForge] Assembling complete 60-Second Master Motion Movie...")
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
    print(f"  [OK] Master Alive Movie Film Created: {final_film_path} ({os.path.getsize(final_film_path)} bytes)")

    # Persist updated state
    data["current_stage"] = "video"
    data["video_shots"] = video_shot_records
    data["final_video_url"] = f"/renders/{project_id}/final_film.mp4"
    data["total_film_duration"] = round(sum(s["duration_seconds"] for s in video_shot_records), 1)
    data["approval_states"]["voiceovers_approved"] = True
    data["approval_states"]["video_approved"] = False

    with open(state_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print("[CineForge] Dynamic cinematic video pipeline completed successfully.")

if __name__ == "__main__":
    generate_alive_cinematic_movie()
