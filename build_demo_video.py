import glob
import os
import numpy as np
from PIL import Image
import imageio

def make_even(val):
    return val if val % 2 == 0 else val + 1

def generate_mp4_demo():
    input_dir = os.path.join(os.path.dirname(__file__), "docs", "screenshots")
    output_mp4 = os.path.join(os.path.dirname(__file__), "docs", "assets", "leaktrace_ui_demo.mp4")
    
    png_files = sorted(glob.glob(os.path.join(input_dir, "slide_*.png")))
    if not png_files:
        print("No slide images found!")
        return

    print(f"Found {len(png_files)} slides. Generating HD MP4 video...")

    # Target resolution: standard 1080p (1920x1080) for universal compatibility
    TARGET_W, TARGET_H = 1920, 1080
    FPS = 30
    HOLD_SECONDS = 4.0   # Hold each slide for 4 seconds
    FADE_SECONDS = 0.5   # Smooth 0.5s transition
    HOLD_FRAMES = int(HOLD_SECONDS * FPS)
    FADE_FRAMES = int(FADE_SECONDS * FPS)

    processed_frames = []
    for f in png_files:
        img = Image.open(f).convert("RGB")
        # Resize maintaining aspect ratio with black letterbox
        img.thumbnail((TARGET_W, TARGET_H), Image.Resampling.LANCZOS)
        
        # Center on 1920x1080 canvas
        canvas = Image.new("RGB", (TARGET_W, TARGET_H), (15, 23, 42)) # Deep navy background
        offset_x = (TARGET_W - img.width) // 2
        offset_y = (TARGET_H - img.height) // 2
        canvas.paste(img, (offset_x, offset_y))
        processed_frames.append(np.array(canvas))

    writer = imageio.get_writer(
        output_mp4,
        fps=FPS,
        codec="libx264",
        quality=8,
        pixelformat="yuv420p"
    )

    for i in range(len(processed_frames)):
        curr_frame = processed_frames[i]
        
        # Hold slide
        for _ in range(HOLD_FRAMES):
            writer.append_data(curr_frame)

        # Cross-fade to next slide
        if i < len(processed_frames) - 1:
            next_frame = processed_frames[i + 1]
            for f_idx in range(FADE_FRAMES):
                alpha = f_idx / float(FADE_FRAMES)
                blended = (curr_frame.astype(np.float32) * (1.0 - alpha) + 
                           next_frame.astype(np.float32) * alpha).astype(np.uint8)
                writer.append_data(blended)

    writer.close()
    file_size_mb = os.path.getsize(output_mp4) / (1024 * 1024)
    print(f"Success! Generated playable MP4: {output_mp4} ({file_size_mb:.2f} MB)")

if __name__ == "__main__":
    generate_mp4_demo()
