#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""정적 콘텐츠 생성기 — src/content/*.json 과 수집 데이터 하나로 앱 화면과 크롤러용 정적 HTML 을 함께 만든다.

    python3 pipeline/build_content.py

생성물 (public/ → dist/ 로 그대로 복사됨)
    public/guides/index.html      가이드 목록
    public/guides/<slug>.html     가이드 본문(자바스크립트 없이 읽히는 전체 텍스트)
    public/categories/index.html  분야·대상·특집 허브 목록
    public/categories/<slug>.html 분야 8 · 대상 6 · 특집 2 = 16개 허브(실제 공고 목록 포함)
    public/about.html             서비스 소개·데이터 출처·편집 원칙
    public/privacy.html           개인정보처리방침
    public/terms.html             이용약관
    public/sitemap.xml            검색엔진용 사이트맵 (홈·가이드·허브·법적 고지 전체)
    public/rss.xml                RSS 2.0 (최신 가이드 + 주요 허브) — 네이버 서치어드바이저 제출용
    public/robots.txt             Googlebot · Mediapartners-Google · Yeti(네이버) 허용 + 사이트맵
"""
from __future__ import annotations

import html
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote

APP = Path(__file__).resolve().parent.parent
CONTENT = APP / "src" / "content"
PUBLIC = APP / "public"
SITE = "https://grantradar-kr.github.io"
KST = timezone(timedelta(hours=9))

BRAND = "보조금 레이더"
BRAND_EN = "GrantRadar KR"
CONTACT = "eldbs9180@gmail.com"
# 공개 게시자 ID (ads.txt·소유권 확인용). VITE_ADSENSE_CLIENT 가 있으면 그 값을 쓴다.
ADSENSE_CLIENT = (os.environ.get("VITE_ADSENSE_CLIENT") or "").strip() or "ca-pub-3631676636047500"
ADSENSE_PUB = ADSENSE_CLIENT[3:] if ADSENSE_CLIENT.startswith("ca-") else ADSENSE_CLIENT
# 광고 단위 ID. 심사 통과 후 ADSENSE_SLOT 을 지정하면 정적 페이지에도 광고가 붙는다.
# 미설정이면 빈 <ins> 를 만들지 않는다(AdSense 정책: 광고 코드가 내용 없이 노출되지 않도록).
ADSENSE_SLOT = (os.environ.get("ADSENSE_SLOT") or "").strip()

SOURCE_LABELS = {
    "youthcenter": "온통청년",
    "bokjiro": "복지로",
    "bizinfo": "기업마당",
    "kstartup": "K-Startup",
    "gov24": "보조금24",
}

REGIONS = [
    "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
    "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
]

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
.stats{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}
.stat{flex:1 1 120px;background:#fff;border:1px solid #e6ece9;border-radius:14px;padding:12px 14px}
.stat b{display:block;font-size:19px;color:#0a5b48;letter-spacing:-.02em}
.stat span{font-size:11.5px;color:#5b6a65;font-weight:700}
.pilist{list-style:none;padding:0;margin:14px 0}
.pi{background:#fff;border:1px solid #e6ece9;border-radius:14px;padding:14px 16px;margin:10px 0}
.pi .src{font-size:11px;font-weight:800;color:#0a6b55;margin:0 0 4px}
.pi h3{margin:0;font-size:14.5px;line-height:1.5}
.pi h3 a{color:#0b1220}
.pi .sum{margin:6px 0 0;font-size:12.5px;color:#4b5a55}
.pi .links{margin:8px 0 0;font-size:11.5px;font-weight:800}
.pi .links a{color:#0a6b55}
.dday{display:inline-block;background:#fdecec;color:#b3261e;border-radius:6px;padding:1px 6px;font-size:10.5px;font-weight:800;margin-left:4px}
.hubnav{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 4px}
.hubnav a{background:#fff;border:1px solid #e6ece9;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:700;color:#33413c}
.hubnav a.on{background:#0a6b55;color:#fff;border-color:#0a6b55}
.ad{margin:20px 0;padding:10px 0;border-top:1px solid #e6ece9;border-bottom:1px solid #e6ece9}
.ad-label{font-size:10px;font-weight:800;letter-spacing:.1em;color:#9aa8a3;margin:0 0 6px}
.morebtn{display:block;text-align:center;background:#fff;border:1px solid #d8e3df;border-radius:12px;padding:11px;font-weight:800;font-size:13px;color:#0a6b55;margin:16px 0}
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


def ad_unit() -> str:
    """ADSENSE_SLOT 이 설정된 경우에만 광고 단위를 렌더한다(미설정 시 빈 <ins> 금지)."""
    if not ADSENSE_SLOT:
        return ""
    return (
        '<div class="ad"><p class="ad-label">광고</p>'
        '<ins class="adsbygoogle" style="display:block" '
        f'data-ad-client="{esc(ADSENSE_CLIENT)}" data-ad-slot="{esc(ADSENSE_SLOT)}" '
        'data-ad-format="auto" data-full-width-responsive="true"></ins></div>'
        "<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>"
    )


def page(title: str, description: str, body: str, prefix: str, extra_head: str = "", og_type: str = "article", canonical: str = "") -> str:
    canonical_head = ""
    if canonical:
        canonical_head = (
            f'<link rel="canonical" href="{esc(canonical)}" />\n'
            f'<meta property="og:url" content="{esc(canonical)}" />\n'
        )
    ads_head = (
        f'<meta name="google-adsense-account" content="{ADSENSE_CLIENT}" />\n'
        f'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={ADSENSE_CLIENT}" crossorigin="anonymous"></script>\n'
    )
    nav = (
        f'<nav class="top">'
        f'<a href="{prefix}index.html">홈</a>'
        f'<a href="{prefix}calculators/">계산기</a>'
        f'<a href="{prefix}guides/">가이드</a>'
        f'<a href="{prefix}index.html#/onboarding">보조금 찾기</a>'
        f'<a href="{prefix}about.html">서비스 소개</a>'
        f'</nav>'
    )
    footer_links = (
        f'<div class="links">'
        f'<a href="{prefix}index.html">홈</a>'
        f'<a href="{prefix}calculators/">모의계산기</a>'
        f'<a href="{prefix}guides/">가이드</a>'
        f'<a href="{prefix}categories/">분야·대상별 보조금</a>'
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
{canonical_head}<meta property="og:type" content="{esc(og_type)}" />
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


def breadcrumb_ld(trail: list[tuple[str, str]]) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": index + 1, "name": name, "item": url}
            for index, (name, url) in enumerate(trail)
        ],
    }


def jsonld(data: dict) -> str:
    return '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False) + "</script>\n"


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

    ad = ad_unit()
    for index, section in enumerate(guide.get("sections") or []):
        parts.append(f'<section><h2>{esc(section["heading"])}</h2>{blocks_html(section)}</section>')
        if index == 1:
            parts.append(
                '<p class="note">이 페이지는 광고 수익으로 운영됩니다. 광고는 본문과 구분해 표시되며, 추천·판정에는 영향을 주지 않습니다.</p>'
            )
            if ad:
                parts.append(ad)

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

    url = f"{SITE}/guides/{guide['slug']}.html"
    article_ld = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": guide["title"],
        "description": guide["summary"],
        "datePublished": guide["updated"],
        "dateModified": guide["updated"],
        "inLanguage": "ko-KR",
        "author": {"@type": "Organization", "name": BRAND, "email": CONTACT},
        "publisher": {"@type": "Organization", "name": BRAND, "email": CONTACT},
        "mainEntityOfPage": {"@type": "WebPage", "@id": url},
    }
    extra = jsonld(article_ld) + jsonld(
        breadcrumb_ld([("홈", f"{SITE}/"), ("가이드", f"{SITE}/guides/"), (guide["title"], url)])
    )
    if faq:
        extra += jsonld(
            {
                "@context": "https://schema.org",
                "@type": "FAQPage",
                "mainEntity": [
                    {
                        "@type": "Question",
                        "name": item["q"],
                        "acceptedAnswer": {"@type": "Answer", "text": item["a"]},
                    }
                    for item in faq
                ],
            }
        )
    body = "\n".join(parts)
    return page(f"{guide['title']} | {BRAND}", guide["summary"], body, "../", extra, canonical=url)


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
        f'<p class="lead">{BRAND}가 직접 작성한 심층 가이드 {len(guides)}편입니다. 기준중위소득 계산법, 중복 수혜 판단, 서류 체크리스트, 2026년 제도 변경처럼 공고 목록만으로는 알기 어려운 내용을 다룹니다. 모든 글에 기준일({updated})과 출처를 표시합니다.</p>'
        f'<div class="grid">{"".join(items)}</div>'
        f'<div class="hubnav"><a href="../categories/">분야별 보조금 보기</a><a href="../categories/urgent.html">마감 임박 보조금</a><a href="../categories/youth.html">청년 지원금</a></div>'
        f'<div class="cta"><strong>내 조건에 맞는 보조금 찾기</strong><a href="../index.html#/home">추천 보기</a></div>'
    )
    return page(
        f"보조금 가이드 {len(guides)}편 | {BRAND}",
        "기준중위소득 계산법, 중복 수혜, 서류 체크리스트, 근로장려금·기초연금·부모급여 같은 대표 제도의 조건과 신청 순서를 정리한 가이드 모음입니다.",
        body,
        "../",
        jsonld(breadcrumb_ld([("홈", f"{SITE}/"), ("가이드", f"{SITE}/guides/")])),
        canonical=f"{SITE}/guides/",
    )


# ------------------------------------------------------------------ 허브 정의
# kind: domain(관심 분야) / target(대상) / special(특집)
HUBS: list[dict] = [
    {
        "slug": "housing",
        "kind": "domain",
        "label": "주거·월세·전세",
        "title": "주거 보조금 모음 — 월세·전세자금·주거급여",
        "desc": "월세 지원, 전세자금 대출, 주거급여, 공공임대까지 주거 관련 보조금 공고를 한 페이지에 모았습니다.",
        "axis": "domains",
        "value": "housing",
        "intro": [
            "주거 지원은 크게 세 갈래로 나뉩니다. 매달 나가는 임차료를 줄여 주는 월세 지원, 목돈이 필요한 전세자금 대출, 그리고 소득이 낮은 가구의 주거비를 보전하는 주거급여입니다. 같은 ‘주거 지원’이라도 신청 창구가 국토교통부, 지자체, 한국토지주택공사, 복지로로 각각 달라 헷갈리기 쉽습니다.",
            "이 페이지는 다섯 개 공개 채널에서 수집한 공고 중 주거 분야로 분류된 것을 모아 마감이 가까운 순서로 보여 줍니다. 같은 사업이 중앙부처 공고와 지자체 공고로 두 번 올라오는 경우가 있으니, 신청 전에 주관 기관과 접수 기간을 확인하세요.",
            "주거 지원은 대부분 ‘무주택 세대주’와 ‘소득·재산 기준’을 함께 봅니다. 본인만 보는 것이 아니라 세대원 전체의 주택 소유 여부와 소득이 합산되는 경우가 많아, 세대 분리 여부가 결과를 바꿉니다.",
        ],
        "checkpoints": [
            "무주택 요건은 세대 단위로 판정되는 경우가 많습니다 — 세대원의 주택 소유 여부를 먼저 확인하세요.",
            "월세 지원과 주거급여는 중복 수령이 제한되는 경우가 많습니다. 이미 받고 있는 지원이 있는지 확인하세요.",
            "전세자금 대출은 보증기관(주택도시보증공사·한국주택금융공사) 심사를 함께 거칩니다.",
            "접수 기간이 짧은 사업이 많으므로 마감 임박 표시를 보고 예산 소진 전에 신청하세요.",
        ],
        "guides": ["monthly-rent-tax-credit", "housing-benefits", "median-income"],
    },
    {
        "slug": "finance",
        "kind": "domain",
        "label": "생활·금융·긴급복지",
        "title": "생활·금융 보조금 모음 — 생계급여·긴급복지·자산형성",
        "desc": "생계급여, 긴급복지, 자산형성(희망저축계좌 등), 채무·신용 지원까지 생활비와 관련된 보조금 공고를 모았습니다.",
        "axis": "domains",
        "value": "finance",
        "intro": [
            "생활·금융 분야는 ‘당장 돈이 필요한 상황’과 ‘앞으로 모으는 상황’이 함께 들어 있습니다. 갑작스러운 실직·질병·화재로 소득이 끊긴 경우에는 긴급복지 지원이, 꾸준히 소득이 있는 저소득 가구에는 자산형성 사업이 해당합니다.",
            "긴급복지 지원은 위기 상황을 증명하는 서류와 상담이 핵심입니다. 주민센터나 보건복지상담센터(129)에 상황을 먼저 알리고, 담당자가 안내하는 서류를 준비하는 순서가 빠릅니다. 혼자 판단해 포기하는 경우가 많은데, 실제로는 대상이 되는 경우가 적지 않습니다.",
            "자산형성 사업은 매달 본인이 저축한 금액에 정부가 같은 금액 또는 일정 비율을 더해 주는 구조입니다. 가입 후 중도해지하면 지원금이 환수되거나 이자가 줄어들 수 있으므로, 만기까지 유지할 수 있는 금액으로 시작해야 합니다.",
        ],
        "checkpoints": [
            "긴급복지 지원은 위기 사유 발생 즉시 상담하는 것이 원칙입니다 — 사후 신청은 제한될 수 있습니다.",
            "자산형성 사업은 3년 만기가 일반적이며, 중도해지 시 정부지원금이 환수됩니다.",
            "생계급여는 소득인정액이 기준중위소득 32% 이하일 때 지급됩니다.",
            "같은 목적의 현금 지원은 중복 수령이 제한되니, 이미 받는 급여를 먼저 확인하세요.",
        ],
        "guides": ["year-end-tax-refund", "median-income", "duplicate-benefits"],
    },
    {
        "slug": "employment",
        "kind": "domain",
        "label": "취업·구직지원",
        "title": "취업·구직 보조금 모음 — 국민취업지원·일자리 사업",
        "desc": "국민취업지원제도, 취업성공수당, 직업훈련, 지자체 일자리 사업 등 취업 지원 공고를 한 페이지에 정리했습니다.",
        "axis": "domains",
        "value": "employment",
        "intro": [
            "취업 지원은 ‘현금을 받는 사업’과 ‘서비스를 받는 사업’으로 나뉩니다. 구직촉진수당·취업성공수당처럼 현금이 나오는 사업은 요건 심사가 까다롭고, 직업훈련·일경험·컨설팅은 참여 신청만으로 시작할 수 있는 경우가 많습니다.",
            "중앙부처 사업(고용노동부)과 지자체 사업이 겹치는 구간이 넓습니다. 예를 들어 국민취업지원제도와 지자체 청년수당은 목적이 비슷해 중복 수령이 제한되는 경우가 있으므로, 신청 전에 이미 받고 있는 지원을 확인해야 합니다.",
            "고용24에서 본인의 고용보험 이력과 수급 자격을 조회할 수 있습니다. 실업급여 수급 이력, 최근 2년 취업일수 같은 정보가 요건 판정에 그대로 쓰이므로, 추측보다 조회 결과를 기준으로 판단하세요.",
        ],
        "checkpoints": [
            "실업급여와 국민취업지원제도 1유형은 중복 수령이 제한됩니다.",
            "구직촉진수당은 취업활동계획 승인 후에 지급됩니다 — 승인 전 활동은 인정되지 않을 수 있습니다.",
            "지자체 청년수당과 중앙부처 사업이 겹치면 한쪽만 선택해야 하는 경우가 있습니다.",
            "직업훈련은 훈련 수당이 별도로 나오는 경우가 있으니, 훈련기관 안내를 함께 확인하세요.",
        ],
        "guides": ["national-employment-support", "duplicate-benefits", "rejection-reasons"],
    },
    {
        "slug": "business",
        "kind": "domain",
        "label": "창업·소상공인",
        "title": "창업·소상공인 보조금 모음 — 정책자금·바우처·R&D",
        "desc": "소상공인 정책자금, 창업지원 사업, 수출바우처, R&D 지원 등 사업자를 위한 공고를 모아 정리했습니다.",
        "axis": "domains",
        "value": "business",
        "intro": [
            "사업자 지원은 ‘자금(융자·보조금)’과 ‘서비스(컨설팅·판로·수출)’로 나뉩니다. 융자는 이자가 붙는 대출이고, 보조금은 상환 의무가 없는 지원금입니다. 공고문에 ‘융자’라고 적혀 있으면 대출이라는 뜻이므로 상환 계획을 먼저 세워야 합니다.",
            "소상공인 정책자금은 대부분 매출 규모와 업력, 신용 상태를 함께 봅니다. 연매출 기준은 업종에 따라 다르게 적용되므로, 국세청 신고 매출과 실제 매출이 다르면 증빙 자료로 소명해야 합니다.",
            "창업 지원 사업은 ‘예비창업자’와 ‘기창업자’로 대상이 나뉘고, 업력 기준일이 공고마다 다릅니다. 사업자등록일이 기준일보다 뒤여야 하는 경우가 많아, 등록 시점을 계획할 때 공고 일정을 함께 보는 것이 좋습니다.",
        ],
        "checkpoints": [
            "‘융자’와 ‘보조금’을 구분하세요 — 융자는 상환해야 하는 대출입니다.",
            "매출 기준은 업종별로 다릅니다. 부가세 과세표준과 실제 매출을 함께 준비하세요.",
            "예비창업 지원은 사업자등록일이 기준일 이후여야 하는 경우가 많습니다.",
            "선정 후 협약·정산 절차가 있으므로 증빙(세금계산서·계좌이체 내역)을 남겨야 합니다.",
        ],
        "guides": ["small-business", "rejection-reasons", "median-income"],
    },
    {
        "slug": "childcare",
        "kind": "domain",
        "label": "출산·육아·보육",
        "title": "출산·육아 보조금 모음 — 부모급여·첫만남이용권·보육료",
        "desc": "부모급여, 첫만남이용권, 아동수당, 가정양육수당, 보육료 지원과 지자체 출산 지원금 공고를 모았습니다.",
        "axis": "domains",
        "value": "childcare",
        "intro": [
            "출산·육아 지원은 중앙정부 지원(부모급여·아동수당·첫만남이용권)과 지자체 지원(출산축하금·산후조리비)으로 나뉩니다. 중앙정부 지원은 전국 공통이지만, 지자체 지원은 거주 지역과 출생 순위에 따라 금액이 크게 달라집니다.",
            "가장 흔한 실수는 신청 시기입니다. 부모급여·아동수당·첫만남이용권은 출생일로부터 60일 이내에 신청하면 출생한 달부터 소급되지만, 60일이 지나면 신청한 달부터 지급됩니다. 출생신고와 함께 행복출산 원스톱 서비스로 한 번에 처리하는 것이 안전합니다.",
            "어린이집·유치원 이용 여부에 따라 받는 지원이 달라집니다. 부모급여는 보육료를 차감한 차액이 현금으로 지급되고, 가정양육수당은 시설을 이용하지 않을 때만 나옵니다. 같은 조건에서도 어떤 돌봄을 선택하느냐에 따라 실수령액이 달라지므로 두 경우를 함께 계산해 보세요.",
        ],
        "checkpoints": [
            "출생일로부터 60일 이내 신청하면 출생한 달부터 소급됩니다.",
            "지자체 출산 지원금은 거주 기간 요건이 있는 경우가 많습니다 — 전입일을 확인하세요.",
            "부모급여와 보육료는 동시에 전액 받을 수 없습니다(차액 지급 구조).",
            "첫만남이용권은 카드 포인트로 지급되며 출생일로부터 2년 안에 써야 합니다.",
        ],
        "guides": ["parental-benefit-childcare", "family-benefits", "duplicate-benefits"],
    },
    {
        "slug": "education",
        "kind": "domain",
        "label": "교육·장학금",
        "title": "교육·장학금 보조금 모음 — 국가장학금·학자금·평생교육",
        "desc": "국가장학금, 학자금 지원, 직업훈련, 평생교육 바우처 등 교육 관련 보조금 공고를 한 곳에 모았습니다.",
        "axis": "domains",
        "value": "education",
        "intro": [
            "교육 분야 지원은 ‘등록금을 직접 줄여 주는 장학금’과 ‘학습비를 지원하는 바우처’로 나뉩니다. 국가장학금처럼 등록금 고지서에서 차감되는 지원이 있고, 평생교육 바우처나 훈련비 지원처럼 본인이 결제한 뒤 정산받는 방식도 있습니다.",
            "장학금은 소득분위와 성적 기준을 함께 봅니다. 소득분위는 매 학기 변동될 수 있어, 지난 학기 결과만 믿지 말고 매번 재신청해야 합니다. 재학 중인 학교의 장학팀과 한국장학재단 안내를 함께 확인하면 놓치는 항목이 줄어듭니다.",
            "성인 학습자를 위한 지원은 ‘훈련 과정에 등록되어 있어야’ 지원되는 경우가 많습니다. 바우처를 먼저 신청하고 과정을 고르는 순서인지, 과정을 등록한 뒤 신청하는 순서인지 공고마다 다르므로 접수 요령을 확인하세요.",
        ],
        "checkpoints": [
            "국가장학금은 매 학기 신청해야 합니다 — 이전 학기 수혜가 자동 연장되지 않습니다.",
            "소득분위는 가구원 수와 소득·재산으로 매번 다시 산정됩니다.",
            "바우처 사업은 신청 순서와 사용 기한이 정해져 있어, 등록 전에 확인이 필요합니다.",
            "장학금과 학자금대출은 등록금 범위 안에서 조정될 수 있습니다.",
        ],
        "guides": ["duplicate-benefits", "median-income", "rejection-reasons"],
    },
    {
        "slug": "medical",
        "kind": "domain",
        "label": "의료비·건강",
        "title": "의료비 보조금 모음 — 재난적의료비·본인부담 지원",
        "desc": "재난적의료비, 본인부담상한제, 희귀질환 의료비, 건강검진 지원 등 의료비 관련 보조금을 정리했습니다.",
        "axis": "domains",
        "value": "medical",
        "intro": [
            "의료비 지원은 ‘병원비를 대신 내주는 사업’과 ‘낸 돈을 돌려받는 제도’로 나뉩니다. 재난적의료비 지원은 과도한 의료비가 발생했을 때 신청하는 사업이고, 본인부담상한제는 1년간 낸 본인부담금이 상한을 넘으면 초과분을 환급하는 제도입니다.",
            "질환별 지원은 대상 질환이 정해져 있습니다. 희귀질환·중증난치질환처럼 별도 등록이 필요한 경우, 진단서와 등록 결과가 있어야 신청할 수 있습니다. 본인이 어떤 제도에 해당하는지 모르겠다면, 진료받은 병원의 원무과나 보건소에 먼저 문의하는 것이 빠릅니다.",
            "의료비 지원은 대부분 소득·재산 기준과 ‘이미 받은 보험금’을 함께 봅니다. 실손보험금을 받은 뒤 그 금액을 빼고 지원하는 구조가 많으므로, 보험 청구 내역을 정리해 두면 심사가 빨라집니다.",
        ],
        "checkpoints": [
            "재난적의료비는 퇴원 후 일정 기간 안에 신청해야 합니다 — 기한을 확인하세요.",
            "본인부담상한제 환급은 자동 지급되는 경우와 신청해야 하는 경우가 있습니다.",
            "실손보험금을 받았다면 지원액에서 차감됩니다.",
            "질환별 지원은 등록(희귀질환 등) 여부가 신청 자격이 됩니다.",
        ],
        "guides": ["disability-senior-medical", "median-income", "rejection-reasons"],
    },
    {
        "slug": "senior-welfare",
        "kind": "domain",
        "label": "노인·기초연금",
        "title": "노인 복지 보조금 모음 — 기초연금·장기요양·노인일자리",
        "desc": "기초연금, 노인장기요양보험, 노인일자리, 경로당·돌봄 지원 등 어르신 대상 보조금 공고를 모았습니다.",
        "axis": "domains",
        "value": "senior_welfare",
        "intro": [
            "노후 지원은 ‘현금(연금)’과 ‘서비스(돌봄·일자리)’로 나뉩니다. 기초연금은 매달 현금으로 지급되고, 장기요양보험은 요양등급 판정을 거쳐 방문요양·시설 입소 같은 서비스로 제공됩니다. 두 제도는 목적이 달라 함께 이용할 수 있는 경우가 많습니다.",
            "기초연금은 소득인정액이 선정기준액 이하일 때 지급됩니다. 재산을 월 소득으로 환산해 계산하므로, 집이나 예금이 있어도 지역별 기본공제 안에 들어가면 대상이 될 수 있습니다. 정확한 금액은 신청 후 조사로 확정됩니다.",
            "노인일자리는 참여 신청을 받아 선발하는 사업으로, 지자체와 수행기관이 각각 모집합니다. 같은 지역에서도 사업 유형(공익활동·사회서비스형·시장형)에 따라 활동 시간과 급여가 다르므로, 거주지 주민센터나 노인복지관에 문의해 본인에게 맞는 유형을 고르세요.",
        ],
        "checkpoints": [
            "기초연금은 만 65세 생일이 지나면 바로 신청하세요 — 늦게 신청한 기간은 소급되지 않습니다.",
            "장기요양은 등급 판정(신청→방문조사→등급판정위원회) 절차를 거칩니다.",
            "노인일자리는 사업별 모집 시기가 달라, 주민센터·복지관 안내를 함께 확인하세요.",
            "국민연금 수령액에 따라 기초연금이 감액될 수 있습니다.",
        ],
        "guides": ["basic-pension", "disability-senior-medical", "median-income"],
    },
    {
        "slug": "youth",
        "kind": "target",
        "label": "청년 지원금",
        "title": "청년 지원금 모음 — 월세·구직수당·자산형성·취업",
        "desc": "만 19~34세 청년이 신청할 수 있는 주거·금융·취업·자산형성 지원 공고를 한 페이지에 모았습니다.",
        "axis": "life_stages",
        "value": "youth",
        "intro": [
            "청년 지원은 나이 기준이 제도마다 다릅니다. 만 19~34세를 기본으로 하면서, 병역을 이행한 경우 최대 6년을 빼고 계산하는 사업이 많습니다. 취업 준비생과 재직자를 구분하거나, 미혼·신혼을 나누는 사업도 있으므로 신청 전에 공고문의 ‘연령 산정 기준일’을 확인해야 합니다.",
            "청년 사업은 예산이 정해져 있어 조기 마감되는 경우가 많습니다. 특히 월세 지원, 자산형성 상품, 지자체 청년수당은 모집 시작일에 접수가 몰립니다. 마감 임박 표시가 붙은 공고를 우선 확인하고, 접수 시작 전에 필요한 서류를 준비해 두세요.",
            "청년층은 소득 기준이 완화되는 경우가 많습니다. 국민취업지원제도 1유형은 청년에게 기준중위소득 120%, 재산 5억 원 이하까지 인정합니다. 본인이 청년 요건에 해당하면 일반 기준보다 유리하므로, ‘청년’ 항목이 있는지 먼저 찾아보세요.",
        ],
        "checkpoints": [
            "나이 기준일은 공고마다 다릅니다 — ‘공고일 기준’인지 ‘신청일 기준’인지 확인하세요.",
            "병역 이행자는 최대 6년까지 연령이 차감되는 사업이 있습니다.",
            "청년 전용 사업은 소득 기준이 완화되거나 재산 기준이 높아지는 경우가 많습니다.",
            "지자체 청년수당은 거주 기간 요건이 붙는 경우가 많습니다.",
        ],
        "guides": ["youth-future-savings", "national-employment-support", "duplicate-benefits"],
    },
    {
        "slug": "single",
        "kind": "target",
        "label": "1인가구 지원",
        "title": "1인가구 지원금 모음 — 주거·생활비·고독사 예방",
        "desc": "1인가구를 대상으로 하는 주거·생활비·안전 지원 공고를 모았습니다. 가구원 수 기준 판정에 주의할 점도 정리했습니다.",
        "axis": "households",
        "value": "single",
        "intro": [
            "1인가구 지원은 ‘가구원 수’를 기준으로 판정하는 사업이 많아, 실제 거주 형태와 신고된 세대 구성이 다르면 문제가 생깁니다. 주민등록상 단독 세대인지, 다른 세대에 얹혀 있는지에 따라 자격이 갈리므로 신청 전에 주민등록등본을 먼저 확인하세요.",
            "1인가구는 소득인정액 계산에서도 유리합니다. 기준중위소득이 가구원 수가 적을수록 낮게 설정되지만, 공제 항목이 동일하게 적용되므로 실제로는 1인가구가 여러 제도에서 대상이 되는 경우가 적지 않습니다.",
            "주거비 부담이 큰 1인가구를 위한 월세 지원, 청년 대상 주택 공급, 생활비 지원 사업이 대표적입니다. 지자체별로 ‘1인가구 지원 조례’를 두고 별도 사업을 운영하는 곳도 있으니, 거주 지역의 조례 사업을 함께 찾아보세요.",
        ],
        "checkpoints": [
            "주민등록상 세대 구성과 실제 거주 형태가 다르면 자격 판정에 문제가 생길 수 있습니다.",
            "1인가구는 기준중위소득 금액이 가장 낮아, 소득 기준 판정에 특히 민감합니다.",
            "지자체 ‘1인가구 지원 조례’ 사업은 중앙정부 사업과 별도로 운영됩니다.",
            "월세 지원은 무주택 세대주 요건과 겹치는 경우가 많습니다.",
        ],
        "guides": ["housing-benefits", "median-income", "duplicate-benefits"],
    },
    {
        "slug": "low-income",
        "kind": "target",
        "label": "저소득·생계 지원",
        "title": "저소득·생계 지원 모음 — 생계급여·긴급복지·차상위",
        "desc": "소득인정액 기준으로 대상이 정해지는 생계·의료·주거·교육 급여와 차상위 계층 지원 사업을 모았습니다.",
        "axis": "households",
        "value": "low_income",
        "intro": [
            "저소득 지원은 ‘기준중위소득의 몇 % 이하’라는 형태로 자격이 정해집니다. 2026년 생계급여는 32%, 의료급여는 40%, 주거급여는 48%, 교육급여는 50%가 기준입니다. 같은 소득이라도 신청하는 급여에 따라 대상 여부가 달라집니다.",
            "자격 판정의 핵심은 소득인정액입니다. 통장에 찍히는 소득이 아니라, 재산을 월 소득으로 환산해 더한 값입니다. 그래서 소득이 적어도 재산이 많으면 탈락하고, 소득이 있어도 재산이 적으면 대상이 됩니다.",
            "수급자로 선정되면 다른 제도에서도 자동으로 유리해지는 경우가 많습니다. 차상위 계층 확인서가 있으면 통신비·전기료 감면, 문화바우처, 교육비 지원 같은 사업을 추가로 신청할 수 있습니다. 수급 신청과 함께 ‘차상위 확인’ 가능 여부를 문의해 보세요.",
        ],
        "checkpoints": [
            "급여별 기준선이 다릅니다 — 생계 32%, 의료 40%, 주거 48%, 교육 50%.",
            "재산은 기본재산액을 빼고 월 소득으로 환산해 더합니다(부채 차감).",
            "차상위 확인서를 받으면 감면·바우처 사업을 추가로 신청할 수 있습니다.",
            "소득·재산 변동이 생기면 신고해야 하며, 신고하지 않으면 환수 대상이 됩니다.",
        ],
        "guides": ["energy-voucher-winter", "median-income", "duplicate-benefits"],
    },
    {
        "slug": "disabled",
        "kind": "target",
        "label": "장애인 복지",
        "title": "장애인 복지 보조금 모음 — 장애인연금·활동지원·보조기기",
        "desc": "장애인연금, 활동지원서비스, 보조기기 지원, 장애인 일자리·교육 지원 공고를 한 페이지에 모았습니다.",
        "axis": "households",
        "value": "disabled",
        "intro": [
            "장애인 지원은 ‘소득 보전(연금)’과 ‘서비스(활동지원·재활·보조기기)’로 나뉩니다. 장애인연금은 중증장애인의 소득을 보전하는 현금 급여이고, 활동지원서비스는 일상생활을 돕는 인력을 지원하는 서비스입니다. 두 제도는 목적이 달라 함께 이용할 수 있습니다.",
            "장애 정도에 따라 대상이 달라집니다. 장애인연금은 장애정도가 심한 중증장애인을 대상으로 하고, 활동지원은 장애 정도와 서비스 필요도를 종합해 판정합니다. 본인의 장애정도 판정서와 복지카드를 기준으로 안내받는 것이 정확합니다.",
            "보조기기 지원은 ‘구매 지원’과 ‘대여’가 나뉘고, 품목에 따라 지원 한도가 다릅니다. 한국장애인개발원이나 지역 보조기기센터에서 상담을 받으면 본인에게 맞는 품목과 절차를 안내받을 수 있습니다.",
        ],
        "checkpoints": [
            "장애인연금은 장애 정도와 소득인정액을 함께 봅니다 — 65세 이후에는 기초연금과 관계를 확인하세요.",
            "활동지원은 서비스 필요도 판정 결과에 따라 시간이 정해집니다.",
            "보조기기 지원은 품목별 한도와 본인부담률이 다릅니다.",
            "장애인 일자리 사업은 지자체·수행기관별로 모집 시기가 다릅니다.",
        ],
        "guides": ["disability-senior-medical", "basic-pension", "median-income"],
    },
    {
        "slug": "single-parent",
        "kind": "target",
        "label": "한부모·다자녀",
        "title": "한부모·다자녀 지원 모음 — 아동양육비·주거·교육비",
        "desc": "한부모가족 아동양육비, 주거 지원, 다자녀 가구 감면·지원 사업 공고를 한 페이지에 정리했습니다.",
        "axis": "households",
        "value": "single_parent",
        "intro": [
            "한부모 지원은 ‘아동양육비 같은 현금 급여’와 ‘주거·교육·문화 지원’으로 나뉩니다. 한부모가족 지원은 소득인정액 기준을 충족해야 하고, 청소년 한부모처럼 연령 기준이 따로 적용되는 경우가 있습니다.",
            "다자녀 가구는 자녀 수에 따라 감면·지원이 달라집니다. 지자체마다 ‘다자녀’로 인정하는 자녀 수(2명 이상 또는 3명 이상)가 다르고, 도시철도·공공시설 감면, 주택 특별공급 같은 혜택이 따로 운영됩니다.",
            "신청 시에는 가족관계증명서와 소득 증빙이 기본입니다. 이혼·사별·미혼모 등 사유에 따라 추가 서류가 필요할 수 있으므로, 주민센터에서 본인 상황에 맞는 서류 목록을 먼저 확인하는 것이 빠릅니다.",
        ],
        "checkpoints": [
            "한부모가족 지원은 소득인정액 기준과 연령 기준을 함께 봅니다.",
            "청소년 한부모(24세 이하)는 별도 사업과 추가 지원이 있습니다.",
            "지자체마다 ‘다자녀’ 인정 기준(2명/3명 이상)이 다릅니다.",
            "주택 특별공급은 무주택 요건과 소득 기준이 함께 적용됩니다.",
        ],
        "guides": ["family-benefits", "parental-benefit-childcare", "duplicate-benefits"],
    },
    {
        "slug": "self-employed",
        "kind": "target",
        "label": "자영업·소상공인",
        "title": "자영업·소상공인 지원금 모음 — 정책자금·폐업·재기 지원",
        "desc": "자영업자·소상공인이 신청할 수 있는 정책자금, 경영안정, 폐업·재기 지원 공고를 모았습니다.",
        "axis": "jobs",
        "value": "self_employed",
        "intro": [
            "자영업 지원은 ‘계속 운영하는 사람’과 ‘폐업을 준비하는 사람’이 받는 지원이 다릅니다. 경영안정 자금·임대료 지원은 운영 중인 사업체가 대상이고, 폐업지원금·재기 지원은 사업을 정리한 사람에게 열려 있습니다.",
            "자금 지원은 대부분 ‘소상공인 확인’을 전제로 합니다. 업종과 상시근로자 수, 매출 규모로 소상공인 여부를 판단하며, 이 확인서가 있어야 정책자금 신청이 가능한 경우가 많습니다. 소상공인시장진흥공단의 확인 절차를 먼저 밟아 두면 이후 신청이 빨라집니다.",
            "고정비 부담이 큰 업종은 임대료·인건비 지원 사업을 함께 확인하세요. 지자체가 자체 예산으로 운영하는 소상공인 지원은 중앙정부 사업과 별개이므로, 거주 지역(사업장 소재지) 시·군·구 홈페이지를 확인해야 합니다.",
        ],
        "checkpoints": [
            "‘소상공인 확인’이 선행되어야 정책자금 신청이 가능한 경우가 많습니다.",
            "융자(대출)와 보조금(무상)을 구분해 상환 계획을 먼저 세우세요.",
            "사업장 소재지 지자체의 자체 지원 사업은 별도로 공고됩니다.",
            "폐업·재기 지원은 폐업일 기준 기한이 있는 경우가 많습니다.",
        ],
        "guides": ["small-business", "national-employment-support", "rejection-reasons"],
    },
    {
        "slug": "urgent",
        "kind": "special",
        "label": "마감 임박 D-7",
        "title": "마감 임박 보조금 — 7일 안에 접수가 끝나는 공고",
        "desc": "오늘부터 7일 안에 신청이 마감되는 보조금 공고를 모았습니다. 마감일과 주관 기관을 확인하고 바로 신청하세요.",
        "intro": [
            "보조금은 예산이 정해져 있어 마감일이 지나면 신청할 수 없습니다. 이 페이지는 수집 데이터에서 오늘부터 7일 안에 접수가 끝나는 공고만 골라 마감이 가까운 순서로 보여 줍니다.",
            "마감일이 임박한 공고는 대부분 접수 인원이 찬 상태일 수 있습니다. 사이트에 표시된 마감일과 실제 접수 상황이 다를 수 있으니, 신청 전에 주관 기관에 전화로 접수 가능 여부를 확인하는 것이 가장 확실합니다.",
            "이 목록은 매일 06:00와 18:00 수집 결과를 기준으로 자동 갱신됩니다. 어제 본 목록과 오늘 목록이 다를 수 있으므로, 저장해 둔 공고는 다시 확인하세요.",
        ],
        "checkpoints": [
            "마감일은 기관별 접수 시간(18시 마감 등)이 따로 있을 수 있습니다.",
            "예산 소진 시 조기 마감되는 사업이 많습니다.",
            "온라인 접수가 막히면 방문 접수 가능 여부를 확인하세요.",
            "마감 하루 전에는 담당자 통화가 어려우니 여유 있게 문의하세요.",
        ],
        "guides": ["energy-voucher-winter", "rejection-reasons", "duplicate-benefits"],
    },
    {
        "slug": "regions",
        "kind": "special",
        "label": "지역별 전국 17개 시·도",
        "title": "지역별 보조금 — 전국 17개 시·도 주요 공고 모음",
        "desc": "서울·경기부터 제주까지 17개 시·도의 주요 보조금 공고를 지역별로 모았습니다. 거주 지역 사업을 한 번에 확인하세요.",
        "intro": [
            "보조금은 중앙부처 사업과 지자체 사업으로 나뉘고, 지자체 사업은 거주지나 사업장 소재지에 따라 대상이 달라집니다. 이 페이지는 수집된 공고를 지역 태그로 나눠 17개 시·도별로 정리했습니다.",
            "‘전국’으로 표시된 공고는 지역 제한이 없는 사업입니다. 반대로 특정 시·도로 표시된 공고는 해당 지역 주민 또는 사업자만 신청할 수 있으므로, 본인 주소지와 일치하는지 확인해야 합니다.",
            "지자체 사업은 시·군·구 단위로 더 세분화되는 경우가 많습니다. 이 페이지는 시·도 단위 분류만 제공하므로, 정확한 공고는 해당 지자체 홈페이지의 ‘지원금’ 또는 ‘복지’ 메뉴를 함께 확인하세요.",
        ],
        "checkpoints": [
            "‘전국’ 공고는 지역 제한이 없는 사업입니다.",
            "지역 공고는 주민등록 주소지 또는 사업장 소재지 기준으로 판정합니다.",
            "시·군·구 단위 사업은 이 목록에 일부만 담길 수 있습니다.",
            "거주 기간(6개월 이상 등) 요건이 붙는 사업이 있습니다.",
        ],
        "guides": ["housing-benefits", "small-business", "median-income"],
    },
]

HUB_BY_SLUG = {hub["slug"]: hub for hub in HUBS}

sys.path.insert(0, str(Path(__file__).resolve().parent))
from calc_pages import CALC_CSS, CALC_FAQS, CALC_META, calc_body, hub_body  # noqa: E402

CALC_SLUGS = list(CALC_META.keys())


def calculators_hub_page() -> str:
    url = f"{SITE}/calculators/"
    extra = jsonld(
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "보조금 모의계산기 5종",
            "description": "기준중위소득 판정, 2026 실업급여, 근로·자녀장려금, 월세 세액공제를 로그인 없이 계산하는 무료 모의계산기 모음입니다.",
            "url": url,
            "inLanguage": "ko-KR",
            "isPartOf": {"@type": "WebSite", "name": BRAND, "url": f"{SITE}/"},
            "hasPart": [
                {
                    "@type": "WebApplication",
                    "name": meta["h1"],
                    "url": f"{SITE}/calculators/{slug}.html",
                    "applicationCategory": "FinanceApplication",
                    "operatingSystem": "Web",
                }
                for slug, meta in CALC_META.items()
            ],
        }
    ) + jsonld(breadcrumb_ld([("홈", f"{SITE}/"), ("모의계산기", url)]))
    return page(
        f"보조금 모의계산기 5종 — 연말정산·중위소득·실업급여·근로장려금·월세 세액공제 | {BRAND}",
        "2026 연말정산 절세·환급 시뮬레이터, 기준중위소득 판정, 2026 실업급여(구직급여), 근로·자녀장려금, 월세 세액공제를 회원가입 없이 바로 계산하는 무료 모의계산기 모음입니다.",
        hub_body(),
        "../",
        extra + jsonld_head_css(),
        og_type="website",
        canonical=url,
    )


def jsonld_head_css() -> str:
    return f"<style>{CALC_CSS}</style>"


def calculator_page(slug: str) -> str:
    meta = CALC_META[slug]
    url = f"{SITE}/calculators/{slug}.html"
    faqs = CALC_FAQS[slug]
    extra = f"<style>{CALC_CSS}</style>"
    extra += jsonld(
        {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": meta["h1"],
            "description": meta["description"],
            "url": url,
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web",
            "browserRequirements": "자바스크립트 없이도 본문을 읽을 수 있습니다",
            "inLanguage": "ko-KR",
            "isAccessibleForFree": True,
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "KRW"},
            "featureList": meta.get("features", ["가구원 수·소득·재산 입력", "2026년 고시 기준", "계산 결과와 기준선 비교"]),
            "publisher": {"@type": "Organization", "name": BRAND, "email": CONTACT, "url": f"{SITE}/"},
        }
    )
    extra += jsonld(
        {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": item["q"],
                    "acceptedAnswer": {"@type": "Answer", "text": item["a"]},
                }
                for item in faqs
            ],
        }
    )
    extra += jsonld(
        breadcrumb_ld(
            [
                ("홈", f"{SITE}/"),
                ("모의계산기", f"{SITE}/calculators/"),
                (meta["short"], url),
            ]
        )
    )
    return page(meta["title"], meta["description"], calc_body(slug), "../", extra, og_type="website", canonical=url)


def load_policies() -> tuple[list[dict], dict]:
    policies_path = PUBLIC / "data" / "policies.json"
    meta_path = PUBLIC / "data" / "meta.json"
    if not policies_path.exists():
        return [], {}
    items = json.loads(policies_path.read_text(encoding="utf-8"))
    meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
    return items, meta


def matches(policy: dict, hub: dict) -> bool:
    if hub["kind"] == "special":
        return False
    match = policy.get("match") or {}
    return hub["value"] in (match.get(hub.get("axis", "")) or [])


def sort_key(policy: dict):
    dday = policy.get("dday")
    if isinstance(dday, int) and dday >= 0:
        return (0, dday, policy.get("title", ""))
    return (1, 9999, policy.get("title", ""))


def hub_items(hub: dict, policies: list[dict]) -> list[dict]:
    if hub["slug"] == "urgent":
        picked = [p for p in policies if isinstance(p.get("dday"), int) and 0 <= p["dday"] <= 7]
        return sorted(picked, key=sort_key)
    if hub["slug"] == "regions":
        picked = [
            p for p in policies
            if any(region in ((p.get("match") or {}).get("regions") or []) for region in REGIONS)
        ]
        return sorted(picked, key=sort_key)
    return sorted([p for p in policies if matches(p, hub)], key=sort_key)


def schedule_text(policy: dict) -> str:
    if policy.get("is_always"):
        return "상시"
    deadline = policy.get("deadline")
    dday = policy.get("dday")
    if deadline:
        if isinstance(dday, int) and dday >= 0:
            return f"{deadline} 까지 (D-{dday})"
        return f"{deadline} 까지"
    return "접수 일정은 공고문 확인"


def policy_item_html(policy: dict) -> str:
    source = SOURCE_LABELS.get(policy.get("source", ""), policy.get("source", ""))
    org = (policy.get("org") or "").strip()
    bits = [source] + ([org] if org else []) + [schedule_text(policy)]
    dday = policy.get("dday")
    badge = ""
    if isinstance(dday, int) and 0 <= dday <= 3:
        badge = f'<span class="dday">D-{dday}</span>'
    summary = (policy.get("summary") or policy.get("support") or "").strip().replace("\n", " ")
    if len(summary) > 180:
        summary = summary[:180] + "…"
    app_link = f'../index.html#/policy/{quote(policy.get("id", ""), safe="")}'
    title = (policy.get("title") or "").strip()
    links = f'<a href="{esc(policy.get("url", ""))}" target="_blank" rel="noopener noreferrer">공고 원문 보기</a>'
    if policy.get("apply_url"):
        links += f' · <a href="{esc(policy["apply_url"])}" target="_blank" rel="noopener noreferrer">신청 페이지</a>'
    links += f' · <a href="{esc(app_link)}">앱에서 내 조건과 비교</a>'
    return (
        '<li class="pi">'
        f'<p class="src">{esc(" · ".join(b for b in bits if b))}{badge}</p>'
        f'<h3><a href="{esc(policy.get("url", ""))}" target="_blank" rel="noopener noreferrer">{esc(title)}</a></h3>'
        + (f'<p class="sum">{esc(summary)}</p>' if summary else "")
        + f'<p class="links">{links}</p>'
        "</li>"
    )


def hub_stats(items: list[dict]) -> dict:
    urgent = sum(1 for p in items if isinstance(p.get("dday"), int) and 0 <= p["dday"] <= 7)
    always = sum(1 for p in items if p.get("is_always"))
    region = sum(1 for p in items if "전국" in ((p.get("match") or {}).get("regions") or []))
    return {"total": len(items), "urgent": urgent, "always": always, "national": region}


def related_guides_html(slugs: list[str], guides_by_slug: dict[str, dict], prefix: str = "../") -> str:
    picked = [guides_by_slug[s] for s in slugs if s in guides_by_slug]
    if not picked:
        return ""
    lis = "".join(
        f'<li><a href="{prefix}guides/{g["slug"]}.html">{esc(g["title"])}</a></li>' for g in picked
    )
    return f'<section class="card"><h2>함께 읽으면 좋은 가이드</h2><ul>{lis}</ul></section>'


def hub_nav_html(current: str, kind: str | None = None) -> str:
    links = []
    for hub in HUBS:
        if kind and hub["kind"] != kind:
            continue
        cls = ' class="on"' if hub["slug"] == current else ""
        links.append(f'<a href="./{hub["slug"]}.html"{cls}>{esc(hub["label"])}</a>')
    return f'<div class="hubnav">{"".join(links)}</div>'


def region_sections_html(policies: list[dict]) -> str:
    blocks: list[str] = []
    for region in REGIONS:
        picked = [
            p for p in policies
            if region in ((p.get("match") or {}).get("regions") or [])
        ]
        picked.sort(key=sort_key)
        if not picked:
            continue
        urgent = sum(1 for p in picked if isinstance(p.get("dday"), int) and 0 <= p["dday"] <= 7)
        top = "".join(policy_item_html(p) for p in picked[:4])
        blocks.append(
            f'<section id="r-{esc(region)}"><h2>{esc(region)} 주요 보조금 ({len(picked):,}건'
            + (f" · 마감임박 {urgent}건" if urgent else "")
            + ")</h2>"
            f'<ul class="pilist">{top}</ul></section>'
        )
    return "\n".join(blocks)


def category_page(hub: dict, items: list[dict], meta: dict, guides_by_slug: dict[str, dict], limit: int = 35) -> str:
    stats = hub_stats(items)
    updated = (meta.get("generated_at") or "")[:10] or datetime.now(KST).date().isoformat()

    parts: list[str] = []
    parts.append(f'<p><a href="./">← 분야·대상별 보조금 목록</a></p>')
    if hub["kind"] == "domain":
        parts.append('<p><span class="cat">분야별</span></p>')
    elif hub["kind"] == "target":
        parts.append('<p><span class="cat">대상별</span></p>')
    else:
        parts.append('<p><span class="cat">특집</span></p>')
    parts.append(f'<h1>{esc(hub["title"])}</h1>')
    parts.append(f'<p class="lead">{esc(hub["desc"])}</p>')

    stats_html = (
        '<div class="stats">'
        f'<div class="stat"><b>{stats["total"]:,}</b><span>해당 공고</span></div>'
        f'<div class="stat"><b>{stats["urgent"]:,}</b><span>7일 내 마감</span></div>'
        f'<div class="stat"><b>{stats["always"]:,}</b><span>상시 접수</span></div>'
        f'<div class="stat"><b>{stats["national"]:,}</b><span>전국 대상</span></div>'
        "</div>"
        f'<p class="meta">데이터 기준 {esc(updated)} · 매일 06:00·18:00 자동 갱신</p>'
    )
    parts.append(stats_html)

    for paragraph in hub.get("intro") or []:
        parts.append(f"<p>{inline(paragraph)}</p>")

    checkpoints = hub.get("checkpoints") or []
    if checkpoints:
        lis = "".join(f"<li>{inline(c)}</li>" for c in checkpoints)
        parts.append(f'<section class="card takeaways"><h2>신청 전 체크포인트</h2><ul>{lis}</ul></section>')

    if hub["slug"] == "regions":
        parts.append('<h2>지역 바로가기</h2>')
        parts.append(
            '<div class="hubnav">'
            + "".join(f'<a href="#r-{esc(r)}">{esc(r)}</a>' for r in REGIONS)
            + "</div>"
        )
        ad = ad_unit()
        if ad:
            parts.append(ad)
        parts.append(region_sections_html(items))
        parts.append(
            '<div class="cta"><strong>내 조건을 넣으면 지역·나이·소득까지 맞춰 정리됩니다</strong>'
            '<p class="meta" style="color:#c8d3cf">조건을 저장하면 다음 방문부터 내 대상 공고만 보입니다.</p>'
            '<a href="../index.html#/home">내 조건으로 추천 받기</a></div>'
        )
        parts.append(hub_nav_html(hub["slug"]))
        parts.append(related_guides_html(hub.get("guides") or [], guides_by_slug))
        body = "\n".join(parts)
        url = f"{SITE}/categories/{hub['slug']}.html"
        extra = jsonld(
            {
                "@context": "https://schema.org",
                "@type": "CollectionPage",
                "name": hub["title"],
                "description": hub["desc"],
                "url": url,
                "inLanguage": "ko-KR",
                "isPartOf": {"@type": "WebSite", "name": BRAND, "url": f"{SITE}/"},
                "dateModified": updated,
            }
        ) + jsonld(breadcrumb_ld([("홈", f"{SITE}/"), ("분야·대상별", f"{SITE}/categories/"), (hub["label"], url)]))
        return page(f'{hub["title"]} | {BRAND}', hub["desc"], body, "../", extra, og_type="website", canonical=url)

    listed = items[:limit]
    parts.append(f'<h2>{esc(hub["label"])} 주요 공고 {len(listed)}건</h2>')
    parts.append('<p class="note">마감이 가까운 순서로 정렬했습니다. 제목을 누르면 공고 원문으로 이동합니다.</p>')
    parts.append(f'<ul class="pilist">{"".join(policy_item_html(p) for p in listed)}</ul>')

    ad = ad_unit()
    if ad:
        parts.append(ad)

    if len(items) > limit:
        parts.append(
            f'<p class="note">이 밖에 {len(items) - limit:,}건이 더 있습니다. 앱에서 조건을 입력하면 전체 목록을 일치율 순으로 볼 수 있습니다.</p>'
        )
    parts.append(
        '<div class="cta"><strong>내 조건을 넣으면 이 목록이 내 것만 남습니다</strong>'
        '<p class="meta" style="color:#c8d3cf">나이·직군·가구 상황·지역을 30초만 설정하면 일치율 순으로 정리됩니다.</p>'
        '<a href="../index.html#/home">내 조건으로 추천 받기</a></div>'
    )

    parts.append("<h2>다른 분야·대상 보기</h2>")
    parts.append(hub_nav_html(hub["slug"]))
    parts.append(related_guides_html(hub.get("guides") or [], guides_by_slug))

    body = "\n".join(parts)
    url = f"{SITE}/categories/{hub['slug']}.html"
    extra = jsonld(
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": hub["title"],
            "description": hub["desc"],
            "url": url,
            "inLanguage": "ko-KR",
            "isPartOf": {"@type": "WebSite", "name": BRAND, "url": f"{SITE}/"},
            "dateModified": updated,
            "mainEntity": {
                "@type": "ItemList",
                "numberOfItems": len(listed),
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": index + 1,
                        "name": p.get("title", ""),
                        "url": p.get("url", ""),
                    }
                    for index, p in enumerate(listed[:20])
                ],
            },
        }
    ) + jsonld(breadcrumb_ld([("홈", f"{SITE}/"), ("분야·대상별", f"{SITE}/categories/"), (hub["label"], url)]))
    return page(f'{hub["title"]} | {BRAND}', hub["desc"], body, "../", extra, og_type="website", canonical=url)


def categories_index_page(counts: dict[str, int], updated: str) -> str:
    groups = [
        ("분야별 보조금", "domain", "관심 분야로 찾기 — 주거, 생활·금융, 취업, 창업, 육아, 교육, 의료, 노후"),
        ("대상별 보조금", "target", "내 상황으로 찾기 — 청년, 1인가구, 저소득, 장애인, 한부모·다자녀, 자영업"),
        ("특집", "special", "마감 임박 공고와 전국 17개 시·도별 공고"),
    ]
    parts = [
        '<p><span class="cat">Categories</span></p>',
        "<h1>분야·대상별 보조금 찾기</h1>",
        f'<p class="lead">보조금 레이더가 매일 수집한 공고를 분야 8개, 대상 6개, 특집 2개로 나눠 정리했습니다. 내 상황과 가까운 항목을 고르면 해당 공고 목록과 신청 전 체크포인트를 바로 볼 수 있습니다.</p>',
        f'<p class="meta">데이터 기준 {esc(updated)} · 매일 06:00·18:00 자동 갱신</p>',
    ]
    for title, kind, desc in groups:
        items = [h for h in HUBS if h["kind"] == kind]
        cards = "".join(
            f'<a class="gitem" href="./{h["slug"]}.html">'
            f'<em>{esc(h["label"])} · {counts.get(h["slug"], 0):,}건</em>'
            f'<strong>{esc(h["title"])}</strong>'
            f'<span>{esc(h["desc"])}</span></a>'
            for h in items
        )
        parts.append(f"<h2>{esc(title)}</h2>")
        parts.append(f'<p class="meta">{esc(desc)}</p>')
        parts.append(f'<div class="grid">{cards}</div>')

    parts.append(
        '<div class="cta"><strong>조건을 저장하면 내 대상 공고만 남습니다</strong>'
        '<a href="../index.html#/home">내 조건으로 추천 받기</a></div>'
    )
    parts.append('<h2>가이드에서 계산법 확인하기</h2>')
    parts.append(
        '<div class="hubnav">'
        '<a href="../guides/median-income.html">기준중위소득 계산</a>'
        '<a href="../guides/earned-income-tax-credit.html">근로장려금</a>'
        '<a href="../guides/basic-pension.html">기초연금</a>'
        '<a href="../guides/youth-future-savings.html">청년미래적금</a>'
        "</div>"
    )
    body = "\n".join(parts)
    extra = jsonld(
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "분야·대상별 보조금 찾기",
            "url": f"{SITE}/categories/",
            "inLanguage": "ko-KR",
            "isPartOf": {"@type": "WebSite", "name": BRAND, "url": f"{SITE}/"},
            "dateModified": updated,
            "hasPart": [
                {"@type": "WebPage", "name": h["title"], "url": f"{SITE}/categories/{h['slug']}.html"} for h in HUBS
            ],
        }
    ) + jsonld(breadcrumb_ld([("홈", f"{SITE}/"), ("분야·대상별", f"{SITE}/categories/")]))
    return page(
        f"분야·대상별 보조금 찾기 ({len(HUBS)}개) | {BRAND}",
        "주거·생활금융·취업·창업·육아·교육·의료·노후 8개 분야와 청년·1인가구·저소득·장애인·한부모·자영업 6개 대상, 마감 임박·지역별 특집으로 정부 보조금을 찾아보세요.",
        body,
        "../",
        extra,
        og_type="website",
        canonical=f"{SITE}/categories/",
    )


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
    hub_links = "".join(f'<li><a href="./categories/{h["slug"]}.html">{esc(h["title"])}</a></li>' for h in HUBS)
    parts.append(f"<section><h2>분야·대상별 보조금</h2><ul>{hub_links}</ul></section>")
    return page(
        f"서비스 소개 | {BRAND}",
        "보조금 레이더의 데이터 출처와 수집 주기, 추천 계산 방식, 편집 원칙, 운영 문의를 안내합니다.",
        "\n".join(parts),
        "",
        canonical=f"{SITE}/about.html",
    )


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
    return page(
        f'{esc(doc.get("title", label))} | {BRAND}',
        f"{BRAND} {label} — 수집 항목, 광고·제3자 쿠키, 이용자 권리, 문의처를 안내합니다.",
        "\n".join(parts),
        "",
        canonical=f"{SITE}/{'privacy' if label == '개인정보처리방침' else 'terms'}.html",
    )


def sitemap_xml(guides: list[dict], updated: str) -> str:
    urls: list[tuple[str, str, str]] = [
        (f"{SITE}/", "1.0", updated),
        (f"{SITE}/calculators/", "0.9", updated),
        (f"{SITE}/guides/", "0.9", updated),
        (f"{SITE}/categories/", "0.9", updated),
    ]
    for slug in CALC_SLUGS:
        urls.append((f"{SITE}/calculators/{slug}.html", "0.9", updated))
    for guide in guides:
        urls.append((f"{SITE}/guides/{guide['slug']}.html", "0.8", guide.get("updated", updated)))
    for hub in HUBS:
        priority = "0.8" if hub["slug"] in ("urgent", "youth", "housing", "finance") else "0.7"
        urls.append((f"{SITE}/categories/{hub['slug']}.html", priority, updated))
    urls += [
        (f"{SITE}/about.html", "0.6", updated),
        (f"{SITE}/privacy.html", "0.3", updated),
        (f"{SITE}/terms.html", "0.3", updated),
    ]
    body = "".join(
        f"<url><loc>{esc(loc)}</loc><lastmod>{esc(lastmod)}</lastmod><priority>{priority}</priority></url>"
        for loc, priority, lastmod in urls
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        f"{body}</urlset>\n"
    )


def rss_xml(guides: list[dict], meta: dict, updated: str) -> str:
    now = datetime.now(KST)
    build = now.strftime("%a, %d %b %Y %H:%M:%S +0900")

    def pubdate(value: str) -> str:
        try:
            day = datetime.strptime(value, "%Y-%m-%d").replace(hour=9, tzinfo=KST)
        except ValueError:
            day = now
        return day.strftime("%a, %d %b %Y %H:%M:%S +0900")

    items: list[str] = []
    for guide in sorted(guides, key=lambda g: g.get("updated", ""), reverse=True):
        link = f"{SITE}/guides/{guide['slug']}.html"
        items.append(
            "<item>"
            f"<title>{esc(guide['title'])}</title>"
            f"<link>{esc(link)}</link>"
            f"<guid isPermaLink=\"true\">{esc(link)}</guid>"
            f"<category>{esc(guide['category'])}</category>"
            f"<description>{esc(guide['summary'])}</description>"
            f"<pubDate>{pubdate(guide.get('updated', updated))}</pubDate>"
            "</item>"
        )
    hub_notes = {
        "urgent": "7일 안에 접수가 끝나는 보조금 공고 모음",
        "youth": "청년(만 19~34세)이 신청할 수 있는 지원금 모음",
        "housing": "월세·전세·주거급여 등 주거 보조금 모음",
        "finance": "생계급여·긴급복지·자산형성 등 생활·금융 보조금 모음",
        "business": "소상공인 정책자금·창업지원 공고 모음",
    }
    for slug, note in hub_notes.items():
        hub = HUB_BY_SLUG[slug]
        link = f"{SITE}/categories/{slug}.html"
        items.append(
            "<item>"
            f"<title>{esc(hub['title'])}</title>"
            f"<link>{esc(link)}</link>"
            f"<guid isPermaLink=\"true\">{esc(link)}</guid>"
            f"<description>{esc(note)}</description>"
            f"<pubDate>{pubdate(updated)}</pubDate>"
            "</item>"
        )
    total = meta.get("total")
    for slug, calc_meta in CALC_META.items():
        link = f"{SITE}/calculators/{slug}.html"
        items.append(
            "<item>"
            f"<title>{esc(calc_meta['h1'])}</title>"
            f"<link>{esc(link)}</link>"
            f"<guid isPermaLink=\"true\">{esc(link)}</guid>"
            "<category>모의계산기</category>"
            f"<description>{esc(calc_meta['description'])}</description>"
            f"<pubDate>{pubdate(updated)}</pubDate>"
            "</item>"
        )
    items.append(
        "<item>"
        f"<title>보조금 모의계산기 5종 — 연말정산·중위소득·실업급여·근로장려금·월세 세액공제</title>"
        f"<link>{esc(SITE + '/calculators/')}</link>"
        f"<guid isPermaLink=\"true\">{esc(SITE + '/calculators/')}</guid>"
        "<category>모의계산기</category>"
        "<description>로그인 없이 쓰는 모의계산기 모음입니다. 2026 연말정산 절세·환급 시뮬레이터, 기준중위소득 판정, 2026 실업급여, 근로·자녀장려금, 월세 세액공제를 바로 계산합니다.</description>"
        f"<pubDate>{pubdate(updated)}</pubDate>"
        "</item>"
    )
    desc = (
        f"{BRAND} — 온통청년·복지로·기업마당·K-Startup·보조금24 공개 공고를 매일 두 차례 모아 정리하는 민간 정보 매칭 서비스입니다. "
        f"현재 {total:,}건의 공고를 분야·대상·지역별로 볼 수 있습니다." if isinstance(total, int) else
        f"{BRAND} — 정부·지자체 보조금 공고 매칭과 신청 가이드"
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>'
        f"<title>{esc(BRAND)} — 정부 보조금·지원금 가이드</title>"
        f"<link>{esc(SITE + '/')}</link>"
        f"<description>{esc(desc)}</description>"
        "<language>ko</language>"
        f"<lastBuildDate>{build}</lastBuildDate>"
        f'<atom:link href="{esc(SITE + "/rss.xml")}" rel="self" type="application/rss+xml" />'
        "<copyright>보조금 레이더</copyright>"
        "<ttl>720</ttl>"
        f'{"".join(items)}</channel>\n</rss>\n'
    )


ROBOTS = f"""# {BRAND} ({BRAND_EN}) — 민간 정보 매칭 서비스
User-agent: *
Allow: /
Disallow: /data/

# 검색엔진 (콘텐츠 본문·가이드 수집 허용)
User-agent: Googlebot
Allow: /

# 네이버 검색봇
User-agent: Yeti
Allow: /

# 다음 검색봇
User-agent: Daum
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
    policies, meta = load_policies()

    updated = guides["updated"]
    items = guides["guides"]
    guides_by_slug = {g["slug"]: g for g in items}
    data_updated = (meta.get("generated_at") or "")[:10] or updated

    guides_dir = PUBLIC / "guides"
    guides_dir.mkdir(parents=True, exist_ok=True)
    (guides_dir / "index.html").write_text(guide_index_page(items, updated), encoding="utf-8")
    for guide in items:
        (guides_dir / f"{guide['slug']}.html").write_text(guide_page(guide), encoding="utf-8")

    categories_dir = PUBLIC / "categories"
    categories_dir.mkdir(parents=True, exist_ok=True)
    hub_counts: dict[str, int] = {}
    for hub in HUBS:
        hub_policies = hub_items(hub, policies)
        hub_counts[hub["slug"]] = len(hub_policies)
        (categories_dir / f"{hub['slug']}.html").write_text(
            category_page(hub, hub_policies, meta, guides_by_slug), encoding="utf-8"
        )
    (categories_dir / "index.html").write_text(
        categories_index_page(hub_counts, data_updated), encoding="utf-8"
    )

    calculators_dir = PUBLIC / "calculators"
    calculators_dir.mkdir(parents=True, exist_ok=True)
    (calculators_dir / "index.html").write_text(calculators_hub_page(), encoding="utf-8")
    for calc_slug in CALC_SLUGS:
        (calculators_dir / f"{calc_slug}.html").write_text(calculator_page(calc_slug), encoding="utf-8")

    (PUBLIC / "about.html").write_text(about_page(guides["site"], items, updated), encoding="utf-8")
    (PUBLIC / "privacy.html").write_text(legal_page(legal["privacy"], "개인정보처리방침", legal["updated"]), encoding="utf-8")
    (PUBLIC / "terms.html").write_text(legal_page(legal["terms"], "이용약관", legal["updated"]), encoding="utf-8")
    sitemap = sitemap_xml(items, data_updated)
    (PUBLIC / "sitemap.xml").write_text(sitemap, encoding="utf-8")
    rss = rss_xml(items, meta, data_updated)
    (PUBLIC / "rss.xml").write_text(rss, encoding="utf-8")
    (PUBLIC / "robots.txt").write_text(ROBOTS, encoding="utf-8")
    (PUBLIC / "ads.txt").write_text(f"google.com, {ADSENSE_PUB}, DIRECT, f08c47fec0942fa0\n", encoding="utf-8")

    print("=== 정적 콘텐츠 생성 ===")
    print(f"  가이드 {len(items)}편 → public/guides/*.html")
    for guide in items:
        chars = len(re.sub(r"\s", "", json.dumps(guide, ensure_ascii=False)))
        print(f"    · {guide['slug']} ({chars:,}자)")
    print(f"  허브 {len(HUBS)}개 → public/categories/*.html")
    print(f"  계산기 {len(CALC_SLUGS) + 1}개 → public/calculators/*.html")
    for hub in HUBS:
        print(f"    · {hub['slug']} ({hub['kind']}, {hub_counts[hub['slug']]:,}건)")
    urls = sitemap.count("<loc>")
    print(f"  public/about.html · privacy.html · terms.html")
    print(f"  public/sitemap.xml ({urls}개 URL) · rss.xml (항목 {rss.count('<item>')}개) · robots.txt · ads.txt")
    print(f"  광고 단위: {'설정됨 (slot ' + ADSENSE_SLOT + ')' if ADSENSE_SLOT else '미설정 → <ins> 렌더 안 함'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
