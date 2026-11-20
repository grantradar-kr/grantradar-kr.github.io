#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""collect_policies.py 의 데이터 증발 방지(폴백·보존) 로직 회귀 테스트.

실제 소스에 접속하지 않고 수집 함수를 대체해 아래를 검증한다.
  1) 페이지 오류로 120건 → 60건 반토막: 기존 유효 공고와 병합해 120건 유지 + meta.sources.fallback_used
  2) --only bizinfo: 선택하지 않은 소스(youthcenter 등)의 기존 데이터 보존
  3) 만료된 기존 공고는 병합 대상에서 제외 (dday 재계산)
  4) 정상 수집(120→120)에는 폴백이 걸리지 않음
"""
from __future__ import annotations

import importlib.util
import json
import shutil
import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("collect_policies", HERE / "collect_policies.py")
cp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cp)

TODAY = cp.TODAY


def make_item(source: str, i: int, deadline: date | None = None) -> dict:
    return {
        "id": f"{source}:{i}",
        "source": source,
        "title": f"{source} 공고 {i}",
        "summary": "요약",
        "org": "기관",
        "url": "https://example.com",
        "posted_at": None,
        "deadline": deadline.isoformat() if deadline else None,
        "dday": (deadline - TODAY).days if deadline else None,
        "is_always": deadline is None,
        "match": {"life_stages": ["youth"], "jobs": ["jobseeker"], "domains": ["finance"]},
    }


def setup(tmp: Path, prev_items: list[dict]) -> None:
    data_dir = tmp / "public" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "policies.json").write_text(json.dumps(prev_items, ensure_ascii=False), encoding="utf-8")
    cp.DATA_DIR = data_dir
    cp.CACHE_DIR = tmp / ".cache"
    cp.CACHE_DIR.mkdir(parents=True, exist_ok=True)


def run(argv: list[str]) -> int:
    old = sys.argv
    sys.argv = ["collect_policies.py", "--quiet", *argv]
    try:
        return cp.main()
    finally:
        sys.argv = old


def read() -> tuple[list[dict], dict]:
    payload = json.loads((cp.DATA_DIR / "policies.json").read_text(encoding="utf-8"))
    meta = json.loads((cp.DATA_DIR / "meta.json").read_text(encoding="utf-8"))
    return payload, meta


failures: list[str] = []


def check(label: str, cond: bool, detail: str = "") -> None:
    print(f"{'PASS' if cond else 'FAIL'}  {label}{' — ' + detail if detail else ''}")
    if not cond:
        failures.append(label)


tmp_root = Path(tempfile.mkdtemp(prefix="gr_fallback_"))

try:
    # ---------- 1) 페이지 오류로 반토막 + --only: 기존 120건 유지 ----------
    tmp = tmp_root / "case1"
    prev = [make_item("bizinfo", i) for i in range(120)]
    prev += [make_item("youthcenter", i) for i in range(30)]
    setup(tmp, prev)

    def only_60_with_error(pages: int = 8):
        cp._note_error("bizinfo", 5, "URLError: <urlopen error [Errno 111] Connection refused>")
        return [make_item("bizinfo", i) for i in range(60)]

    cp.collect_bizinfo = only_60_with_error
    rc = run(["--only", "bizinfo"])
    payload, meta = read()
    by_source = meta["by_source"]
    check("case1 exit 0", rc == 0, f"rc={rc}")
    check("case1 bizinfo 120건 복구(병합)", by_source.get("bizinfo") == 120, f"bizinfo={by_source.get('bizinfo')}")
    check("case1 youthcenter 보존", by_source.get("youthcenter") == 30, f"youthcenter={by_source.get('youthcenter')}")
    st = next(s for s in meta["sources"] if s["source"] == "bizinfo")
    check("case1 fallback_used=true", st.get("fallback_used") is True, json.dumps(st, ensure_ascii=False))
    check("case1 live_count=60", st.get("live_count") == 60, f"live_count={st.get('live_count')}")
    check("case1 사유 기록", "급감" in (st.get("fallback_reason") or "") and "페이지 오류" in (st.get("fallback_reason") or ""),
          st.get("fallback_reason", ""))
    check("case1 kept ids 포함", any(p["id"] == "bizinfo:119" for p in payload))

    # ---------- 2) 만료 공고는 병합 제외, dday 재계산 ----------
    tmp = tmp_root / "case2"
    past = TODAY - timedelta(days=3)
    soon = TODAY + timedelta(days=5)
    prev = [make_item("bizinfo", i) for i in range(120)]
    prev[0] = make_item("bizinfo", 0, past)   # 이미 마감
    prev[1] = make_item("bizinfo", 1, soon)   # 5일 뒤 마감
    prev[1]["dday"] = 99                      # 오래된 저장값(재계산 검증)
    setup(tmp, prev)
    cp.collect_bizinfo = lambda pages=8: [make_item("bizinfo", i) for i in range(200, 260)]
    cp._SOURCE_ERRORS.pop("bizinfo", None)
    rc = run(["--only", "bizinfo"])
    payload, meta = read()
    ids = {p["id"] for p in payload}
    check("case2 만료 공고 제외", "bizinfo:0" not in ids)
    kept = next((p for p in payload if p["id"] == "bizinfo:1"), None)
    check("case2 dday 재계산", kept is not None and kept.get("dday") == 5, f"dday={kept and kept.get('dday')}")
    check("case2 나머지 유지", meta["by_source"].get("bizinfo") == 179, f"bizinfo={meta['by_source'].get('bizinfo')}")

    # ---------- 3) 정상 수집(120→120)에는 폴백 없음 ----------
    tmp = tmp_root / "case3"
    setup(tmp, [make_item("bizinfo", i) for i in range(120)])
    cp.collect_bizinfo = lambda pages=8: [make_item("bizinfo", i) for i in range(120)]
    cp._SOURCE_ERRORS.pop("bizinfo", None)
    rc = run(["--only", "bizinfo"])
    payload, meta = read()
    st = next(s for s in meta["sources"] if s["source"] == "bizinfo")
    check("case3 정상 수집 120건", meta["by_source"].get("bizinfo") == 120, f"bizinfo={meta['by_source'].get('bizinfo')}")
    check("case3 폴백 미사용", not st.get("fallback_used"), json.dumps(st, ensure_ascii=False))

    # ---------- 4) 소스 전체 실패 시 기존 데이터 유지 ----------
    tmp = tmp_root / "case4"
    setup(tmp, [make_item("bizinfo", i) for i in range(120)])

    def boom(pages: int = 8):
        cp._note_error("bizinfo", 1, "URLError: [Errno 111] Connection refused")
        return []

    cp.collect_bizinfo = boom
    rc = run(["--only", "bizinfo"])
    payload, meta = read()
    check("case4 전멸 시 기존 유지", meta["by_source"].get("bizinfo") == 120, f"bizinfo={meta['by_source'].get('bizinfo')}")
    st = next(s for s in meta["sources"] if s["source"] == "bizinfo")
    check("case4 fallback 기록", st.get("fallback_used") is True, json.dumps(st, ensure_ascii=False))
finally:
    shutil.rmtree(tmp_root, ignore_errors=True)

print()
if failures:
    print(f"실패 {len(failures)}건: {failures}")
    sys.exit(1)
print("모든 폴백 회귀 테스트 통과")
