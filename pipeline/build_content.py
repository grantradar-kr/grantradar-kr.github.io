#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""정적 콘텐츠 생성기 — src/content/*.json 하나로 앱 화면과 크롤러용 정적 HTML 을 함께 만든다.

    python3 pipeline/build_content.py

생성물 (public/ → dist/ 로 그대로 복사됨)
    public/guides/index.html      가이드 목록
    public/guides/<slug>.html     가이드 본문(자바스크립트 없이 읽히는 전체 텍스트)
    public/about.html             서비스 소개·데이터 출처·편집 원칙
    public/privacy.html           개인정보처리방침
    public/terms.html             이용약관
    public/sitemap.xml            검색엔진용 사이트맵
    public/robots.txt             Googlebot · Mediapartners-Google 허용 + 사이트맵
"""
from __future__ import annotations

import html
import json
import os
import re
import sys
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
CONTENT = APP / "src" / "content"
PUBLIC = APP / "public"
SITE = "https://grantradar-kr.github.io"

BRAND = "보조금 레이더"
BRAND_EN = "GrantRadar KR"
CONTACT = "sasolution.edu@gmail.com"
# 공개 게시자 ID (ads.txt·소유권 확인용). VITE_ADSENSE_CLIENT 가 있으면 그 값을 쓴다.
ADSENSE_CLIENT = (os.environ.get("VITE_ADSENSE_CLIENT") or "").strip() or "ca-pub-3631676636047500"
ADSENSE_PUB = ADSENSE_CLIENT[3:] if ADSENSE_CLIENT.startswith("ca-") else ADSENSE_CLIENT

STYLE = """
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:#f6f8f7;color:#0b1220;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif;line-height:1.75;-webkit-text-size-adjust:100%}
a{color:#0a6b55;text-decoration:none}
a:hover{text-decoration:underline}
.wrap{max-width:760px;margin:0 auto;padding:0 20px}
header.site{background:#fff;border-bottom:1px solid #e6ece9;position:sticky;top:0;z-index:5}
header.site .wrap{display:flex;align-items:center;gap:16px;padding-top:12px;padding-bottom:12px;flex-wrap:wrap}
.brand{font-weight:800;font-size:16px;color:#0b1220}
.brand small{display:block;font-size:10px;letter-spacing:.14em;color:#0a6b55;font-weight:700}
nav.top{display:flex;gap:14px;font-size:13px;font-weight:700;color:#4b5a55;flex-wrap:wrap}
nav.top a{color:#4b5a55}
main{padding:26px 0 48px}
h1{font-size:26px;line-height:1.4;letter-spacing:-.02em;margin:10px 0 8px}
h2{font-size:17px;margin:30px 0 8px;letter-spacing:-.01em}
h3{font-size:14px;margin:18px 0 6px}
p{margin:8px 0}
ul{padding-left:20px;margin:8px 0}
li{margin:4px 0}
.cat{display:inline-block;background:#e6f6ef;color:#0a6b55;font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px}
.meta{font-size:12px;color:#6b7a75;font-weight:600}
.lead{font-size:15px;color:#33413c}
.card{background:#fff;border:1px solid #e6ece9;border-radius:16px;padding:16px 18px;margin:16px 0}
.takeaways{background:#effaf4;border-color:#c8ecdb}
.takeaways h2{margin-top:0;font-size:14px;color:#0a5b48}
table{width:100%;border-collapse:collapse;font-size:13px;margin:10px 0;background:#fff;border-radius:12px;overflow:hidden}
caption{caption-side:top;text-align:left;font-size:12px;font-weight:700;color:#4b5a55;padding:4px 0}
th,td{border:1px solid #e6ece9;padding:8px 10px;text-align:left;vertical-align:top}
th{background:#f2f6f4;font-weight:800;white-space:nowrap}
.note{background:#f4f6f5;border-radius:10px;padding:9px 11px;font-size:12px;color:#5b6a65}
.dl dt{font-weight:800;margin-top:10px}
.dl dd{margin:4px 0 0;color:#33413c}
.cta{background:#0b1220;color:#fff;border-radius:16px;padding:16px 18px;margin:24px 0}
.cta strong{display:block;font-size:15px;line-height:1.5}
.cta p{margin:6px 0 0}
.cta a{display:inline-block;margin-top:10px;background:#fff;color:#0b1220;font-weight:800;padding:9px 14px;border-radius:10px;font-size:13px}
footer.site{border-top:1px solid #e6ece9;background:#fff;padding:20px 0 34px;font-size:12px;color:#6b7a75}
footer.site .links{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:8px;font-weight:700}
.grid{display:grid;gap:12px}
@media(min-width:640px){.grid{grid-template-columns:1fr 1fr}}
.gitem{display:block;background:#fff;border:1px solid #e6ece9;border-radius:14px;padding:14px 16px}
.gitem strong{display:block;font-size:14px;color:#0b1220;line-height:1.5}
.gitem span{display:block;font-size:12px;color:#5b6a65;margin-top:6px}
.gitem em{display:block;font-size:11px;color:#0a6b55;font-style:normal;font-weight:800;margin-bottom:6px}
"""

INLINE_RE = re.compile(r"\[([^\]]+)\]\((https?://[^)\s]+)\)|\*\*([^*]+)\*\*")


def esc(text: str) -> str:
    return html.escape(text, quote=True)


def inline(text: str) -> str:
    """**굵게**, [라벨](주소)만 처리하는 최소 마크다운."""
    out: list[str] = []
    for line_index, line in enumerate(text.split("\n")):
        if line_index:
            out.append("<br />")
        last = 0
        for match in INLINE_RE.finditer(line):
            out.append(esc(line[last:match.start()]))
            label, url, bold = match.group(1), match.group(2), match.group(3)
            if label and url:
                out.append(f'<a href="{esc(url)}" target="_blank" rel="noopener noreferrer">{esc(label)}</a>')
            elif bold:
                out.append(f"<strong>{esc(bold)}</strong>")
            last = match.end()
        out.append(esc(line[last:]))
    return "".join(out)


def page(title: str, description: str, body: str, prefix: str, extra_head: str = "") -> str:
    nav = (
        f'<nav class="top">'
        f'<a href="{prefix}index.html">홈</a>'
        f'<a href="{prefix}guides/">가이드</a>'
        f'<a href="{prefix}about.html">서비스 소개</a>'
        f'</nav>'
    )
    ads_head = (
        f'<meta name="google-adsense-account" content="{ADSENSE_CLIENT}" />\n'
        f'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={ADSENSE_CLIENT}" crossorigin="anonymous"></script>\n'
    )
    footer_links = (
        f'<div class="links">'
        f'<a href="{prefix}index.html">홈</a>'
        f'<a href="{prefix}guides/">가이드</a>'
        f'<a href="{prefix}about.html">서비스 소개</a>'
        f'<a href="{prefix}privacy.html">개인정보처리방침</a>'
        f'<a href="{prefix}terms.html">이용약관</a>'
        f'</div>'
    )
    return f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{esc(title)}</title>
<meta name="description" content="{esc(description)}" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="{BRAND}" />
<meta property="og:title" content="{esc(title)}" />
<meta property="og:description" content="{esc(description)}" />
<meta property="og:locale" content="ko_KR" />
<meta name="twitter:card" content="summary" />
<link rel="icon" type="image/png" sizes="192x192" href="{prefix}icons/icon-192.png" />
{ads_head}<style>{STYLE}</style>
{extra_head}</head>
<body>
<header class="site"><div class="wrap"><a class="brand" href="{prefix}index.html">{BRAND}<small>{BRAND_EN}</small></a>{nav}</div></header>
<main><div class="wrap">
{body}
</div></main>
<footer class="site"><div class="wrap">
{footer_links}
<p>{BRAND}는 정부·공공기관 공식 서비스가 아닌 민간 정보 매칭 플랫폼입니다. 최종 자격 확인과 신청은 공고 원문과 담당 기관을 통해 진행해 주세요.</p>
<p>문의 <a href="mailto:{CONTACT}">{CONTACT}</a></p>
</div></footer>
</body>
</html>
"""


def blocks_html(section: dict) -> str:
    out: list[str] = []
    for paragraph in section.get("paragraphs") or []:
        out.append(f"<p>{inline(paragraph)}</p>")
    bullets = section.get("bullets") or []
    if bullets:
        out.append("<ul>" + "".join(f"<li>{inline(item)}</li>" for item in bullets) + "</ul>")
    table = section.get("table")
    if table:
        head = "".join(f"<th>{esc(cell)}</th>" for cell in table["headers"])
        rows = "".join(
            "<tr>" + "".join(f"<td>{inline(cell)}</td>" for cell in row) + "</tr>" for row in table["rows"]
        )
        caption = f"<caption>{esc(table['caption'])}</caption>" if table.get("caption") else ""
        out.append(f"<table>{caption}<thead><tr>{head}</tr></thead><tbody>{rows}</tbody></table>")
    if section.get("note"):
        out.append(f'<p class="note">{inline(section["note"])}</p>')
    return "\n".join(out)


def guide_page(guide: dict) -> str:
    parts: list[str] = []
    parts.append(f'<p><a href="./">← 가이드 목록</a></p>')
    parts.append(f'<p><span class="cat">{esc(guide["category"])}</span></p>')
    parts.append(f'<h1>{esc(guide["title"])}</h1>')
    parts.append(f'<p class="lead">{inline(guide["lead"])}</p>')
    parts.append(
        f'<p class="meta">약 {guide["readMinutes"]}분 · 기준일 {esc(guide["updated"])} · {BRAND} 편집</p>'
    )
    if guide.get("takeaways"):
        items = "".join(f"<li>{inline(item)}</li>" for item in guide["takeaways"])
        parts.append(f'<section class="card takeaways"><h2>3줄 요약</h2><ul>{items}</ul></section>')

    for index, section in enumerate(guide.get("sections") or []):
        parts.append(f'<section><h2>{esc(section["heading"])}</h2>{blocks_html(section)}</section>')
        if index == 1:
            parts.append(
                '<p class="note">이 페이지는 광고 수익으로 운영됩니다. 광고는 본문과 구분해 표시되며, 추천·판정에는 영향을 주지 않습니다.</p>'
            )

    faq = guide.get("faq") or []
    if faq:
        items = "".join(f"<dt>Q. {inline(item['q'])}</dt><dd>{inline(item['a'])}</dd>" for item in faq)
        parts.append(f'<section class="card"><h2>자주 묻는 질문</h2><dl class="dl">{items}</dl></section>')

    sources = guide.get("sources") or []
    if sources:
        lis = "".join(
            f'<li><a href="{esc(source["url"])}" target="_blank" rel="noopener noreferrer">{esc(source["label"])}</a></li>'
            for source in sources
        )
        parts.append(
            '<section class="card"><h2>출처와 확인일</h2>'
            f"<ul>{lis}</ul>"
            f'<p class="note">이 글은 {esc(guide["updated"])} 기준으로 작성했습니다. 제도와 금액은 이후 바뀔 수 있으므로 신청 전 공고 원문을 확인하세요. 오류 제보는 {CONTACT} 으로 보내 주시면 확인 후 수정합니다.</p>'
            "</section>"
        )

    parts.append(
        '<div class="cta"><strong>내 조건에 맞는 공고부터 확인해 보세요</strong>'
        '<p class="meta" style="color:#c8d3cf">가이드는 판단 기준을 설명합니다. 실제 공고는 조건을 입력하면 일치율 순으로 정리됩니다.</p>'
        '<a href="../index.html#/home">보조금 레이더에서 추천 보기</a></div>'
    )

    extra = (
        '<script type="application/ld+json">'
        + json.dumps(
            {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": guide["title"],
                "description": guide["summary"],
                "datePublished": guide["updated"],
                "dateModified": guide["updated"],
                "inLanguage": "ko-KR",
                "author": {"@type": "Organization", "name": BRAND, "email": CONTACT},
                "publisher": {"@type": "Organization", "name": BRAND, "email": CONTACT},
                "mainEntityOfPage": {"@type": "WebPage", "@id": f"{SITE}/guides/{guide['slug']}.html"},
            },
            ensure_ascii=False,
        )
        + "</script>\n"
    )
    body = "\n".join(parts)
    return page(f"{guide['title']} | {BRAND}", guide["summary"], body, "../", extra)


def guide_index_page(guides: list[dict], updated: str) -> str:
    items = []
    for guide in guides:
        items.append(
            f'<a class="gitem" href="./{guide["slug"]}.html">'
            f'<em>{esc(guide["category"])}</em>'
            f'<strong>{esc(guide["title"])}</strong>'
            f'<span>{esc(guide["summary"])}</span></a>'
        )
    body = (
        f'<p class="cat">Guides</p>'
        f"<h1>신청 전에 읽는 보조금 가이드</h1>"
        f'<p class="lead">{BRAND}가 직접 작성한 심층 가이드 {len(guides)}편입니다. 기준중위소득 계산법, 중복 수혜 판단, 서류 체크리스트처럼 공고 목록만으로는 알기 어려운 내용을 다룹니다. 모든 글에 기준일({updated})과 출처를 표시합니다.</p>'
        f'<div class="grid">{"".join(items)}</div>'
        f'<div class="cta"><strong>내 조건에 맞는 보조금 찾기</strong><a href="../index.html#/home">추천 보기</a></div>'
    )
    return page(f"보조금 가이드 {len(guides)}편 | {BRAND}", "기준중위소득 계산법, 중복 수혜, 서류 체크리스트, 신청 순서 등 보조금 신청 전에 필요한 내용을 정리한 가이드 모음입니다.", body, "../")


def about_page(site: dict, guides: list[dict], updated: str) -> str:
    parts = [f'<p class="cat">About</p>', f"<h1>{BRAND}는 이렇게 만들어집니다</h1>"]
    for paragraph in site.get("intro") or []:
        parts.append(f"<p>{inline(paragraph)}</p>")
    for section in site.get("sections") or []:
        parts.append(f'<section><h2>{esc(section["heading"])}</h2>{blocks_html(section)}</section>')
    operator = site.get("operator") or {}
    parts.append(
        '<section class="card"><h2>운영·문의</h2>'
        f'<p>{esc(operator.get("name", BRAND))} · <a href="mailto:{esc(operator.get("email", CONTACT))}">{esc(operator.get("email", CONTACT))}</a></p>'
        f'<p class="note">{esc(operator.get("note", ""))}</p>'
        f"<p>콘텐츠 기준일 {esc(updated)} · 가이드 {len(guides)}편</p></section>"
    )
    links = "".join(f'<li><a href="./guides/{g["slug"]}.html">{esc(g["title"])}</a></li>' for g in guides)
    parts.append(f"<section><h2>가이드 목록</h2><ul>{links}</ul></section>")
    return page(f"서비스 소개 | {BRAND}", "보조금 레이더의 데이터 출처와 수집 주기, 추천 계산 방식, 편집 원칙, 운영 문의를 안내합니다.", "\n".join(parts), "")


def legal_page(doc: dict, label: str, updated: str) -> str:
    parts = [f'<p class="cat">{esc(label)}</p>', f'<h1>{esc(doc.get("title", label))}</h1>']
    if doc.get("intro"):
        parts.append(f'<p class="note">{inline(doc["intro"])}</p>')
    for section in doc.get("sections") or []:
        blocks: list[str] = []
        for block in section.get("blocks") or []:
            kind = block.get("type")
            if kind == "h4" and block.get("text"):
                blocks.append(f"<h3>{inline(block['text'])}</h3>")
            elif kind == "ul" and block.get("items"):
                blocks.append("<ul>" + "".join(f"<li>{inline(i)}</li>" for i in block["items"]) + "</ul>")
            elif kind == "note" and block.get("text"):
                blocks.append(f'<p class="note">{inline(block["text"])}</p>')
            elif block.get("text"):
                blocks.append(f"<p>{inline(block['text'])}</p>")
        parts.append(f'<section><h2>{esc(section["title"])}</h2>{"".join(blocks)}</section>')
    parts.append(f'<p class="meta">시행일 {esc(updated)} · 문의 {CONTACT}</p>')
    return page(f'{esc(doc.get("title", label))} | {BRAND}', f"{BRAND} {label} — 수집 항목, 광고·제3자 쿠키, 이용자 권리, 문의처를 안내합니다.", "\n".join(parts), "")


def sitemap_xml(guides: list[dict], updated: str) -> str:
    urls = [
        (f"{SITE}/", "1.0", updated),
        (f"{SITE}/guides/", "0.8", updated),
        (f"{SITE}/about.html", "0.6", updated),
        (f"{SITE}/privacy.html", "0.3", updated),
        (f"{SITE}/terms.html", "0.3", updated),
    ]
    for guide in guides:
        urls.append((f"{SITE}/guides/{guide['slug']}.html", "0.7", guide.get("updated", updated)))
    body = "".join(
        f"<url><loc>{esc(loc)}</loc><lastmod>{esc(lastmod)}</lastmod><priority>{priority}</priority></url>"
        for loc, priority, lastmod in urls
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        f"{body}</urlset>\n"
    )


ROBOTS = f"""# {BRAND} ({BRAND_EN}) — 민간 정보 매칭 서비스
User-agent: *
Allow: /
Disallow: /data/

# 검색엔진 (콘텐츠 본문·가이드 수집 허용)
User-agent: Googlebot
Allow: /

# Google AdSense 광고 심사 크롤러
User-agent: Mediapartners-Google
Allow: /

User-agent: AdsBot-Google
Allow: /

Sitemap: {SITE}/sitemap.xml
"""


def main() -> int:
    guides = json.loads((CONTENT / "guides.json").read_text(encoding="utf-8"))
    legal = json.loads((CONTENT / "legal.json").read_text(encoding="utf-8"))

    updated = guides["updated"]
    items = guides["guides"]

    guides_dir = PUBLIC / "guides"
    guides_dir.mkdir(parents=True, exist_ok=True)

    (guides_dir / "index.html").write_text(guide_index_page(items, updated), encoding="utf-8")
    for guide in items:
        target = guides_dir / f"{guide['slug']}.html"
        target.write_text(guide_page(guide), encoding="utf-8")

    (PUBLIC / "about.html").write_text(about_page(guides["site"], items, updated), encoding="utf-8")
    (PUBLIC / "privacy.html").write_text(legal_page(legal["privacy"], "개인정보처리방침", legal["updated"]), encoding="utf-8")
    (PUBLIC / "terms.html").write_text(legal_page(legal["terms"], "이용약관", legal["updated"]), encoding="utf-8")
    (PUBLIC / "sitemap.xml").write_text(sitemap_xml(items, updated), encoding="utf-8")
    (PUBLIC / "robots.txt").write_text(ROBOTS, encoding="utf-8")
    (PUBLIC / "ads.txt").write_text(f"google.com, {ADSENSE_PUB}, DIRECT, f08c47fec0942fa0\n", encoding="utf-8")

    print("=== 정적 콘텐츠 생성 ===")
    print(f"  가이드 {len(items)}편 → public/guides/*.html")
    for guide in items:
        chars = len(re.sub(r"\s", "", json.dumps(guide, ensure_ascii=False)))
        print(f"    · {guide['slug']} ({chars:,}자)")
    print("  public/about.html · privacy.html · terms.html · sitemap.xml · robots.txt · ads.txt")
    return 0


if __name__ == "__main__":
    sys.exit(main())
