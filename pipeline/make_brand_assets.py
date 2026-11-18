#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""보조금 레이더 브랜드 이미지 생성기 — 앱 아이콘 / 마스커블 / 애플 터치 / OG 커버.
   python3 pipeline/make_brand_assets.py
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

BASE = Path(__file__).resolve().parent
APP = BASE.parent
ICON_DIR = APP / "public" / "icons"
PUBLIC = APP / "public"
FONT_DIR = BASE / "fonts"
ICON_DIR.mkdir(parents=True, exist_ok=True)

BRAND_TOP = (3, 44, 38)
BRAND_MID = (4, 120, 95)
BRAND_LOW = (18, 185, 141)


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    name = "NanumGothic-Bold.ttf" if bold else "NanumGothic-Regular.ttf"
    return ImageFont.truetype(str(FONT_DIR / name), size)


def vertical_gradient(size: tuple[int, int], top, mid, low) -> Image.Image:
    w, h = size
    img = Image.new("RGB", (w, h), top)
    px = img.load()
    for y in range(h):
        t = y / max(1, h - 1)
        if t < 0.55:
            k = t / 0.55
            c = tuple(int(top[i] + (mid[i] - top[i]) * k) for i in range(3))
        else:
            k = (t - 0.55) / 0.45
            c = tuple(int(mid[i] + (low[i] - mid[i]) * k) for i in range(3))
        for x in range(w):
            px[x, y] = c
    return img


def draw_radar(draw: ImageDraw.ImageDraw, cx: float, cy: float, r: float, scale: float = 1.0,
               ring_color=(255, 255, 255, 32), sweep_color=(255, 255, 255, 70)) -> None:
    # 스윕(부채꼴 광선)
    for i in range(46):
        angle = -62 + i * 1.5
        alpha = int(sweep_color[3] * (i / 46) ** 1.4)
        draw.pieslice(
            [cx - r, cy - r, cx + r, cy + r],
            start=angle, end=angle + 2.0,
            fill=(sweep_color[0], sweep_color[1], sweep_color[2], alpha),
        )
    # 동심원
    for k in (1.0, 0.68, 0.36):
        rr = r * k
        draw.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=ring_color, width=max(2, int(4 * scale)))
    # 중심 → 가장자리 십자선
    draw.line([cx - r, cy, cx + r, cy], fill=(255, 255, 255, 26), width=max(1, int(2 * scale)))
    draw.line([cx, cy - r, cx, cy + r], fill=(255, 255, 255, 26), width=max(1, int(2 * scale)))


def icon(size: int, maskable: bool = False) -> Image.Image:
    ss = 4  # 슈퍼샘플링
    s = size * ss
    base = vertical_gradient((s, s), BRAND_TOP, BRAND_MID, BRAND_LOW).convert("RGBA")

    # 부드러운 광원
    glow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-s * 0.25, -s * 0.35, s * 0.95, s * 0.85], fill=(80, 240, 190, 46))
    glow = glow.filter(ImageFilter.GaussianBlur(s * 0.12))
    base = Image.alpha_composite(base, glow)

    layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx = cy = s / 2
    r = s * (0.34 if not maskable else 0.28)
    draw_radar(d, cx, cy, r, scale=size / 192, ring_color=(255, 255, 255, 46))

    # 중앙 코인(원)
    coin_r = s * (0.175 if not maskable else 0.15)
    d.ellipse([cx - coin_r, cy - coin_r, cx + coin_r, cy + coin_r], fill=(255, 255, 255, 244))
    ring = coin_r * 0.86
    d.ellipse([cx - ring, cy - ring, cx + ring, cy + ring], outline=(4, 120, 95, 34), width=max(2, int(s * 0.006)))

    # 원화 기호
    f = font(int(coin_r * 1.28))
    text = "₩"
    bbox = d.textbbox((0, 0), text, font=f)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text((cx - tw / 2 - bbox[0], cy - th / 2 - bbox[1] - coin_r * 0.04), text, font=f, fill=(4, 90, 72, 255))

    # 레이더 점(신호)
    dot_r = s * 0.022
    dx = cx + math.cos(math.radians(-34)) * r * 0.86
    dy = cy + math.sin(math.radians(-34)) * r * 0.86
    d.ellipse([dx - dot_r * 2.4, dy - dot_r * 2.4, dx + dot_r * 2.4, dy + dot_r * 2.4], fill=(255, 255, 255, 60))
    d.ellipse([dx - dot_r, dy - dot_r, dx + dot_r, dy + dot_r], fill=(255, 255, 255, 255))

    base = Image.alpha_composite(base, layer)

    # 둥근 모서리 (마스커블은 꽉 찬 사각형)
    if not maskable:
        mask = Image.new("L", (s, s), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.225), fill=255)
        out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        out.paste(base, (0, 0), mask)
        base = out

    return base.resize((size, size), Image.LANCZOS)


def wrap_text(draw: ImageDraw.ImageDraw, text: str, f: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split(" ")
    lines: list[str] = []
    cur = ""
    for word in words:
        trial = (cur + " " + word).strip()
        if draw.textbbox((0, 0), trial, font=f)[2] <= max_width or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def og_cover() -> Image.Image:
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), (247, 249, 250))
    d = ImageDraw.Draw(img)

    # 배경 격자
    for x in range(0, W, 40):
        d.line([(x, 0), (x, H)], fill=(238, 242, 244), width=1)
    for y in range(0, H, 40):
        d.line([(0, y), (W, y)], fill=(238, 242, 244), width=1)

    # 우측 브랜드 패널
    panel = vertical_gradient((470, H), BRAND_TOP, BRAND_MID, BRAND_LOW).convert("RGBA")
    mask = Image.new("L", (470, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, 470, H], radius=0, fill=255)
    img.paste(panel.convert("RGB"), (W - 470, 0), mask)

    pd = ImageDraw.Draw(img, "RGBA")
    draw_radar(pd, W - 235, H / 2, 190, scale=1.6, ring_color=(255, 255, 255, 58))

    # 아이콘(코인)
    coin_r = 82
    cx, cy = W - 235, H / 2
    pd.ellipse([cx - coin_r, cy - coin_r, cx + coin_r, cy + coin_r], fill=(255, 255, 255, 246))
    f_won = font(int(coin_r * 1.3))
    bbox = pd.textbbox((0, 0), "₩", font=f_won)
    pd.text((cx - (bbox[2] - bbox[0]) / 2 - bbox[0], cy - (bbox[3] - bbox[1]) / 2 - bbox[1] - 6),
            "₩", font=f_won, fill=(4, 100, 80, 255))

    # 좌측 텍스트
    left = 72
    d.rounded_rectangle([left, 92, left + 208, 132], radius=20, fill=(226, 247, 240))
    d.text((left + 20, 100), "무료 · 매일 자동 업데이트", font=font(21, bold=True), fill=(4, 110, 88))

    d.text((left, 168), "보조금 레이더", font=font(94), fill=(10, 24, 20))
    d.text((left, 278), "내 조건에 맞는 정부 지원금만 골라서", font=font(40), fill=(31, 58, 51))

    chips = ["청년", "중장년", "노인", "영유아", "한부모", "다자녀", "장애인", "자영업", "예술인"]
    x, y = left, 356
    for chip in chips:
        f = font(26, bold=True)
        w = d.textbbox((0, 0), chip, font=f)[2] + 34
        if x + w > W - 520:
            x = left
            y += 56
        d.rounded_rectangle([x, y, x + w, y + 46], radius=23, fill=(255, 255, 255), outline=(214, 226, 222), width=2)
        d.text((x + 17, y + 9), chip, font=f, fill=(24, 58, 50))
        x += w + 12

    d.text((left, 496), "온통청년 · 복지로 · 기업마당 · K-Startup 실시간 수집", font=font(25, bold=False), fill=(84, 110, 103))
    note = "본 서비스는 정부·공공기관 공식 앱이 아닌 민간 정보 매칭 플랫폼이며, 최종 자격·신청은 공식 사이트에서 확인하세요."
    note_lines = wrap_text(d, note, font(21, bold=False), 640)
    ny = 538
    for line in note_lines:
        d.text((left, ny), line, font=font(21, bold=False), fill=(132, 152, 146))
        ny += 28

    img = img.filter(ImageFilter.SMOOTH)
    return img


def main() -> None:
    icon(512).save(ICON_DIR / "icon-512.png")
    icon(192).save(ICON_DIR / "icon-192.png")
    icon(512, maskable=True).save(ICON_DIR / "icon-maskable-512.png")
    icon(180).save(ICON_DIR / "apple-touch-icon.png")
    icon(32).save(ICON_DIR / "favicon-32.png")
    og_cover().save(PUBLIC / "og-cover.png", quality=92)
    print("생성 완료:")
    for p in sorted(ICON_DIR.glob("*.png")) + [PUBLIC / "og-cover.png"]:
        print(f"  {p.relative_to(APP)}  {p.stat().st_size/1024:.1f}KB")


if __name__ == "__main__":
    main()
