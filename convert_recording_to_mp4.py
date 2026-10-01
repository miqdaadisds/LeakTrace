import os
import imageio
from PIL import Image
import numpy as np

def convert_webp_animation_to_mp4():
    input_webp = r"C:\Users\Faazil\.gemini\antigravity-ide\brain\206f4476-1caf-493d-908a-850ce05d5a7a\leaktrace_ui_demo_1790896254318.webp"
    output_mp4 = r"C:\Users\Faazil\.gemini\antigravity-ide\scratch\SIH2026-WESEE-Cryptographic-Attribution\docs\assets\leaktrace_ui_demo.mp4"
    
    print(f"Reading frames from {input_webp}...")
    reader = imageio.get_reader(input_webp)
    total_frames = len(reader)
    print(f"Found {total_frames} continuous recording frames.")

    FPS = 10  # 10 fps -> ~32 seconds of live UI flow
    TARGET_W = 1920
    TARGET_H = 1080

    writer = imageio.get_writer(
        output_mp4,
        fps=FPS,
        codec="libx264",
        quality=8,
        pixelformat="yuv420p"
    )

    for i in range(total_frames):
        frame_rgba = reader.get_data(i)
        img = Image.fromarray(frame_rgba).convert("RGB")
        
        # Center onto 1920x1080 canvas
        canvas = Image.new("RGB", (TARGET_W, TARGET_H), (15, 23, 42))
        offset_x = (TARGET_W - img.width) // 2
        offset_y = (TARGET_H - img.height) // 2
        canvas.paste(img, (offset_x, offset_y))
        
        writer.append_data(np.array(canvas))
        if i % 50 == 0:
            print(f"Processed frame {i}/{total_frames}...")

    writer.close()
    file_size_mb = os.path.getsize(output_mp4) / (1024 * 1024)
    print(f"Done! Created real interaction MP4: {output_mp4} ({file_size_mb:.2f} MB, {total_frames/FPS:.1f}s)")

if __name__ == "__main__":
    convert_webp_animation_to_mp4()
