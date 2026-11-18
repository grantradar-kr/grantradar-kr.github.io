#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""보조금 레이더 정적 검증기 — JSON/YAML 파싱, 괄호 균형, import 경로, 자산 참조, 데이터 일관성.

    python3 pipeline/check_static.py
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
PUBLIC = APP / "public"
SRC = APP / "src"

errors: list[str] = []
warnings: list[str] = []
notes: list[str] = []


def fail(message: str) -> None:
    errors.append(message)


def warn(message: str) -> None:
    warnings.append(message)


# ---------------------------------------------------------------- 1) JSON / YAML
def check_json() -> None:
    files = [APP / "package.json", APP / "tsconfig.json", PUBLIC / "manifest.json"]
    files += sorted(PUBLIC.glob("data/*.json"))
    for path in files:
        if not path.exists():
            fail(f"JSON 없음: {path.relative_to(APP)}")
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                notes.append(f"JSON OK  {path.relative_to(APP)} (keys={len(data)})")
            elif isinstance(data, list):
                notes.append(f"JSON OK  {path.relative_to(APP)} (items={len(data):,})")
        except Exception as exc:  # noqa: BLE001
            fail(f"JSON 파싱 실패 {path.relative_to(APP)}: {exc}")


def check_yaml() -> None:
    try:
        import yaml  # type: ignore
    except ImportError:
        warn("PyYAML 미설치 → 워크플로 YAML 검사 건너뜀")
        return
    for path in sorted((APP / ".github" / "workflows").glob("*.yml")):
        try:
            docs = list(yaml.safe_load_all(path.read_text(encoding="utf-8")))
            if not any(docs):
                fail(f"빈 워크플로: {path.name}")
            else:
                notes.append(f"YAML OK  .github/workflows/{path.name} (jobs={list((docs[0] or {}).get('jobs', {}).keys())})")
        except Exception as exc:  # noqa: BLE001
            fail(f"YAML 파싱 실패 {path.name}: {exc}")


# ---------------------------------------------------------------- 2) TS/TSX 구문
def strip_strings_and_comments(source: str) -> str:
    out: list[str] = []
    i = 0
    n = len(source)
    while i < n:
        ch = source[i]
        if ch == "/" and i + 1 < n and source[i + 1] == "/":
            while i < n and source[i] != "\n":
                i += 1
            continue
        if ch == "/" and i + 1 < n and source[i + 1] == "*":
            i += 2
            while i + 1 < n and not (source[i] == "*" and source[i + 1] == "/"):
                i += 1
            i += 2
            continue
        if ch in ("'", '"', "`"):
            quote = ch
            i += 1
            while i < n:
                if source[i] == "\\":
                    i += 2
                    continue
                if source[i] == quote:
                    i += 1
                    break
                i += 1
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def check_ts_balance() -> None:
    pairs = {"(": ")", "[": "]", "{": "}"}
    for path in sorted(list(SRC.rglob("*.ts")) + list(SRC.rglob("*.tsx")) + [APP / "vite.config.ts", APP / "capacitor.config.ts"]):
        if not path.exists():
            continue
        code = strip_strings_and_comments(path.read_text(encoding="utf-8"))
        stack: list[str] = []
        ok = True
        for ch in code:
            if ch in pairs:
                stack.append(ch)
            elif ch in pairs.values():
                if not stack or pairs[stack.pop()] != ch:
                    ok = False
                    break
        if not ok or stack:
            fail(f"괄호 불균형: {path.relative_to(APP)} (남은 {stack[-3:]})")
    notes.append("TS/TSX 괄호 균형 검사 완료")


# ---------------------------------------------------------------- 3) import 경로
IMPORT_RE = re.compile(r"""from\s+['"](\.[^'"]+)['"]""")


def check_imports() -> None:
    for path in sorted(list(SRC.rglob("*.ts")) + list(SRC.rglob("*.tsx"))):
        source = path.read_text(encoding="utf-8")
        for target in IMPORT_RE.findall(source):
            base = (path.parent / target).resolve()
            candidates = [base, base.with_suffix(".ts"), base.with_suffix(".tsx"), base / "index.ts", base / "index.tsx"]
            if not any(c.exists() for c in candidates):
                fail(f"import 경로 미해결: {path.relative_to(APP)} → {target}")
    notes.append("import 경로 검사 완료")


# ---------------------------------------------------------------- 4) 자산 참조
def check_assets() -> None:
    manifest = json.loads((PUBLIC / "manifest.json").read_text(encoding="utf-8"))
    for icon in manifest.get("icons", []):
        src = icon.get("src", "").lstrip("./")
        if not (PUBLIC / src).exists():
            fail(f"manifest 아이콘 없음: {src}")
    for shortcut in manifest.get("shortcuts", []):
        for icon in shortcut.get("icons", []):
            src = icon.get("src", "").lstrip("./")
            if not (PUBLIC / src).exists():
                fail(f"shortcut 아이콘 없음: {src}")

    index = (APP / "index.html").read_text(encoding="utf-8")
    for ref in re.findall(r'(?:href|content)="\./([^"]+)"', index):
        if ref and not ref.startswith("http") and not (PUBLIC / ref).exists():
            warn(f"index.html 참조 자산 없음: ./{ref}")

    sw = (PUBLIC / "sw.js").read_text(encoding="utf-8")
    for ref in re.findall(r"'\./([^']+)'", sw):
        if ref and not (PUBLIC / ref).exists() and ref not in ("index.html",):
            warn(f"sw.js 프리캐시 자산 없음: ./{ref}")
    notes.append("자산(아이콘·manifest·sw) 검사 완료")


# ---------------------------------------------------------------- 5) 데이터 일관성
REQUIRED_FIELDS = ["id", "source", "title", "url", "match"]
AXES = ["life_stages", "jobs", "households", "domains", "regions"]


def check_data() -> None:
    policies_path = PUBLIC / "data" / "policies.json"
    meta_path = PUBLIC / "data" / "meta.json"
    if not policies_path.exists():
        fail("policies.json 없음 — 파이프라인을 실행하세요")
        return
    items = json.loads(policies_path.read_text(encoding="utf-8"))
    meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}

    if not items:
        fail("policies.json 이 비어 있습니다")
        return

    for item in items[:2000]:
        for field in REQUIRED_FIELDS:
            if field not in item:
                fail(f"필수 필드 누락: {item.get('id')} → {field}")
                break
        match = item.get("match") or {}
        if not any(match.get(axis) for axis in AXES):
            warn(f"매칭 축이 모두 비어 있음: {item.get('title')[:30]}")

    ids = [item["id"] for item in items]
    dup = [key for key, count in Counter(ids).items() if count > 1]
    if dup:
        fail(f"중복 id {len(dup)}건 (예: {dup[:3]})")

    sources = Counter(item["source"] for item in items)
    if meta.get("total") and meta["total"] != len(items):
        fail(f"meta.total({meta['total']}) 과 실제 건수({len(items)}) 불일치")

    # 태그 커버리지
    coverage = {axis: Counter() for axis in AXES}
    for item in items:
        for axis in AXES:
            for value in item["match"].get(axis, []) or []:
                coverage[axis][value] += 1

    expected = {
        "life_stages": {"infant", "student", "youth", "middle", "senior"},
        "jobs": {"student", "employee", "jobseeker", "self_employed", "freelancer", "artist", "pre_founder"},
        "households": {"single", "married", "single_parent", "multi_child", "homeless", "pregnant", "disabled", "low_income"},
        "domains": {"housing", "medical", "finance", "childcare", "education", "employment", "business", "senior_welfare"},
    }
    for axis, keys in expected.items():
        missing = keys - set(coverage[axis])
        if missing:
            fail(f"{axis} 누락 값: {sorted(missing)}")
        thin = [key for key in keys if coverage[axis][key] < 5]
        if thin:
            warn(f"{axis} 커버리지 적음: {thin}")

    # 마감/상시 논리
    bad_deadline = 0
    for item in items:
        deadline = item.get("deadline")
        dday = item.get("dday")
        if deadline and dday is not None and dday < 0:
            bad_deadline += 1
    if bad_deadline:
        fail(f"마감이 지난 공고가 {bad_deadline}건 남아 있습니다")

    size_mb = policies_path.stat().st_size / 1048576
    notes.append(f"정책 {len(items):,}건 · 소스 {dict(sources)} · {size_mb:.2f} MB")
    for axis in AXES:
        notes.append(f"  {axis}: {dict(coverage[axis].most_common(10))}")
    # 보조금24 병합으로 건수가 늘어 10MB 를 넘는 것이 정상 범위가 되었다.
    # 10MB 초과는 경고, 20MB 초과는 실패로 둔다(모바일 로딩·서비스워커 캐시 한계).
    if size_mb > 20:
        fail(f"policies.json 이 20MB 를 넘습니다 ({size_mb:.1f} MB) — 수집 범위를 줄이세요")
    elif size_mb > 10:
        warn(f"policies.json 이 10MB 를 넘습니다 ({size_mb:.1f} MB) — gzip 전송량·캐시 크기 확인")
    if (PUBLIC / "ads.txt").exists():
        notes.append("ads.txt 존재")
    else:
        warn("public/ads.txt 없음 — build_content.py 를 실행하세요")


# ---------------------------------------------------------------- 6) 편집 콘텐츠
CONTENT = SRC / "content"


def check_content() -> None:
    """가이드·약관 JSON 과 그것으로 만든 정적 HTML 이 함께 있는지 확인한다."""
    guides_path = CONTENT / "guides.json"
    legal_path = CONTENT / "legal.json"
    if not guides_path.exists():
        fail("src/content/guides.json 없음")
        return
    data = json.loads(guides_path.read_text(encoding="utf-8"))
    guides = data.get("guides", [])
    if len(guides) < 6:
        fail(f"가이드가 {len(guides)}편뿐입니다 (최소 6편 필요)")
    slugs = set()
    for guide in guides:
        slug = guide.get("slug", "")
        if not slug:
            fail("가이드 slug 누락")
            continue
        if slug in slugs:
            fail(f"가이드 slug 중복: {slug}")
        slugs.add(slug)
        body = " ".join(
            [guide.get("lead", ""), guide.get("summary", "")]
            + [p for s in guide.get("sections", []) for p in (s.get("paragraphs") or []) + (s.get("bullets") or [])]
            + [block for item in guide.get("faq", []) for block in (item.get("q", ""), item.get("a", ""))]
        )
        length = len(re.sub(r"\s", "", body))
        if length < 1000:
            fail(f"가이드 본문이 짧습니다: {slug} ({length:,}자)")
        page = PUBLIC / "guides" / f"{slug}.html"
        if not page.exists():
            fail(f"정적 가이드 페이지 없음: public/guides/{slug}.html (build_content.py 실행)")
        elif page.stat().st_size < 4000:
            fail(f"정적 가이드 페이지가 너무 작습니다: {slug}")
    for name in ("guides/index.html", "about.html", "privacy.html", "terms.html", "sitemap.xml", "ads.txt"):
        if not (PUBLIC / name).exists():
            fail(f"정적 페이지 없음: public/{name}")
    if legal_path.exists():
        legal = json.loads(legal_path.read_text(encoding="utf-8"))
        for key in ("privacy", "terms"):
            if not legal.get(key, {}).get("sections"):
                fail(f"legal.json {key} 섹션 비어 있음")
        privacy_text = json.dumps(legal.get("privacy", {}), ensure_ascii=False)
        for keyword in ("AdSense", "애드핏", "쿠키"):
            if keyword not in privacy_text:
                fail(f"개인정보처리방침에 '{keyword}' 안내가 없습니다")
    index = (APP / "index.html").read_text(encoding="utf-8")
    for keyword in ("ADSENSE_META", "ADSENSE_SCRIPT"):
        if keyword not in index:
            warn(f"index.html 에 {keyword} 자리표시자가 없습니다")
    ads = (PUBLIC / "ads.txt").read_text(encoding="utf-8") if (PUBLIC / "ads.txt").exists() else ""
    if ads and "google.com, pub-" not in ads:
        fail("ads.txt 형식 확인 필요")
    notes.append(f"콘텐츠 검사 완료 — 가이드 {len(guides)}편")


def main() -> int:
    print("=== 보조금 레이더 정적 검증 ===\n")
    check_json()
    check_yaml()
    check_ts_balance()
    check_imports()
    check_assets()
    check_data()
    check_content()

    for line in notes:
        print(f"  {line}")
    if warnings:
        print("\n경고:")
        for line in warnings:
            print(f"  ! {line}")
    if errors:
        print("\n오류:")
        for line in errors:
            print(f"  x {line}")
        print(f"\n실패 — 오류 {len(errors)}건, 경고 {len(warnings)}건")
        return 1
    print(f"\n통과 — 오류 0건, 경고 {len(warnings)}건")
    return 0


if __name__ == "__main__":
    sys.exit(main())
