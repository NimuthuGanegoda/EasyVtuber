import os
from PIL import Image, ImageDraw, ImageFont

def create_vtuber_placeholder(filename, character_name, bg_color):
    images_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'images')
    os.makedirs(images_dir, exist_ok=True)
    
    filepath = os.path.join(images_dir, filename)
    
    # Create a 512x512 image with a transparent background
    img = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw a colored circle/oval for the face/head placeholder
    draw.ellipse((100, 100, 412, 412), fill=bg_color)
    
    # Add text
    try:
        # Try a built-in default font, scaled up by drawing text multiple times or just using it
        # Since default font is small, we'll just draw it centered
        text = f"{character_name}\nPlaceholder\nReplace with\nTransparent PNG"
        
        # Center text (rough estimate for default font)
        draw.text((150, 230), text, fill=(255, 255, 255, 255))
    except Exception as e:
        print(f"Font error: {e}")
        
    img.save(filepath)
    print(f"Created placeholder: {filepath}")

if __name__ == "__main__":
    create_vtuber_placeholder('HuTao_GenshinImpact.png', 'Hu Tao (Genshin)', (200, 100, 100, 255))
    create_vtuber_placeholder('Yinlin_WutheringWaves.png', 'Yinlin (WuWa)', (150, 100, 200, 255))
    create_vtuber_placeholder('Gawr_Gura.png', 'Gawr Gura', (100, 150, 250, 255))
    create_vtuber_placeholder('Houshou_Marine.png', 'Houshou Marine', (200, 50, 100, 255))
