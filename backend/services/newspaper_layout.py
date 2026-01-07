import os
import uuid
from typing import List, Dict, Optional

from PIL import Image, ImageDraw, ImageFont


class NewspaperLayout:
    @staticmethod
    def _load_font(candidates: List[str], size: int):
        for path in candidates:
            if path and os.path.exists(path):
                try:
                    return ImageFont.truetype(path, size=size)
                except Exception:
                    continue
        try:
            return ImageFont.truetype("arial.ttf", size=size)
        except Exception:
            return ImageFont.load_default()

    @staticmethod
    def _wrap_text(draw: ImageDraw.Draw, text: str, font: ImageFont.ImageFont, max_width: int) -> List[str]:
        words = text.split()
        lines = []
        current = ""
        for w in words:
            test = (current + " " + w).strip()
            if draw.textlength(test, font=font) <= max_width:
                current = test
            else:
                if current:
                    lines.append(current)
                current = w
        if current:
            lines.append(current)
        return lines

    @staticmethod
    def render_digest(title: str, date_text: str, hero_image_path: Optional[str], articles: List[Dict], output_dir: str) -> str:
        os.makedirs(output_dir, exist_ok=True)
        W, H = 1920, 1080
        bg = Image.new("RGB", (W, H), (242, 244, 248))  # softer scaffold gray
        draw = ImageDraw.Draw(bg)

        # Fonts
        font_candidates = [
            "C:\\Windows\\Fonts\\segoeui.ttf",
            "C:\\Windows\\Fonts\\Segoe UI.ttf",
            "C:\\Windows\\Fonts\\arial.ttf",
        ]
        title_font = NewspaperLayout._load_font(font_candidates, 68)
        subtitle_font = NewspaperLayout._load_font(font_candidates, 34)
        body_font = NewspaperLayout._load_font(font_candidates, 26)
        small_font = NewspaperLayout._load_font(font_candidates, 20)

        # Header bar
        header_h = 120
        # gradient header
        header = Image.new("RGBA", (W, header_h), (0, 0, 0, 0))
        hd = ImageDraw.Draw(header)
        for i in range(header_h):
            # top dark navy to slightly lighter
            c = (26, 35, 49 + int(i * 0.1), 255)
            hd.line([(0, i), (W, i)], fill=c)
        bg.paste(header, (0, 0))
        draw.text((48, 26), title, fill=(255, 255, 255), font=title_font)
        draw.text((W - 280, 38), date_text, fill=(220, 225, 232), font=subtitle_font)

        # Hero image area
        margin = 40
        hero_x, hero_y = margin, header_h + 24
        hero_w, hero_h = 980, 540
        if hero_image_path and os.path.exists(hero_image_path):
            try:
                hero = Image.open(hero_image_path).convert("RGB")
                hero = hero.resize((hero_w, hero_h))
                # subtle shadow
                shadow = Image.new("RGBA", (hero_w + 20, hero_h + 20), (0, 0, 0, 0))
                sd = ImageDraw.Draw(shadow)
                sd.rectangle([10, 10, hero_w + 10, hero_h + 10], fill=(0, 0, 0, 40))
                bg.paste(shadow, (hero_x - 10, hero_y - 10), shadow)
                bg.paste(hero, (hero_x, hero_y))
            except Exception:
                draw.rectangle([hero_x, hero_y, hero_x + hero_w, hero_y + hero_h], outline=(31, 41, 55), width=3)
        else:
            draw.rectangle([hero_x, hero_y, hero_x + hero_w, hero_y + hero_h], outline=(31, 41, 55), width=3)
        draw.text((hero_x, hero_y - 40), "Top Theme", fill=(31, 41, 55), font=subtitle_font)

        # Articles grid on the right
        grid_x = hero_x + hero_w + 48
        grid_y = hero_y
        grid_w = W - grid_x - margin
        card_w = grid_w
        card_h = 200
        thumb_w = 260
        thumb_h = 168
        gap = 18

        # column separator
        draw.line([(grid_x - 24, header_h + 20), (grid_x - 24, H - 60)], fill=(203, 210, 220), width=2)

        for idx, art in enumerate(articles[:5]):
            y = grid_y + idx * (card_h + gap)
            # Card background with shadow
            shadow = Image.new("RGBA", (card_w + 12, card_h + 12), (0, 0, 0, 0))
            sd = ImageDraw.Draw(shadow)
            sd.rectangle([8, 8, card_w + 8, card_h + 8], fill=(0, 0, 0, 28))
            bg.paste(shadow, (grid_x - 8, y - 8), shadow)

            draw.rectangle([grid_x, y, grid_x + card_w, y + card_h], fill=(255, 255, 255), outline=(226, 232, 240))
            # Thumbnail
            tx, ty = grid_x + 12, y + 10
            thumb_box = [tx, ty, tx + thumb_w, ty + thumb_h]
            if art.get("image_path") and os.path.exists(art["image_path"]):
                try:
                    th = Image.open(art["image_path"]).convert("RGB")
                    th = th.resize((thumb_w, thumb_h))
                    bg.paste(th, (tx, ty))
                except Exception:
                    draw.rectangle(thumb_box, outline=(31, 41, 55))
            else:
                draw.rectangle(thumb_box, outline=(31, 41, 55))

            # Text area
            text_x = tx + thumb_w + 16
            text_w = card_w - (text_x - grid_x) - 16

            # Title
            title_text = art.get("title", "Untitled")
            title_lines = NewspaperLayout._wrap_text(draw, title_text, subtitle_font, text_w)
            title_render = title_lines[0] if title_lines else title_text
            if len(title_lines) > 1:
                title_render = title_render.rstrip() + "…"
            draw.text((text_x, y + 14), title_render, fill=(17, 24, 39), font=subtitle_font)

            # Authors
            authors = art.get("authors", "")
            draw.text((text_x, y + 62), authors, fill=(88, 96, 105), font=small_font)

            # Summary
            summary = art.get("summary", "")
            lines = NewspaperLayout._wrap_text(draw, summary, body_font, text_w)
            max_lines = 3
            for i, line in enumerate(lines[:max_lines]):
                draw.text((text_x, y + 98 + i * 30), line, fill=(39, 49, 65), font=body_font)
            if len(lines) > max_lines:
                draw.text((text_x, y + 98 + max_lines * 30), "…", fill=(39, 49, 65), font=body_font)

        # Footer
        draw.text((margin, H - 42), "Generated by Daily Scholar", fill=(120, 126, 134), font=small_font)

        # Save
        fname = f"{uuid.uuid4()}.png"
        path = os.path.join(output_dir, fname)
        bg.save(path)
        return fname

