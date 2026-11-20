#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
보조금 레이더 (GrantRadar KR) — 전국민 생애주기·상황별 보조금 실시간 수집 파이프라인
=====================================================================================

수집 소스 (인증키 없이 즉시 동작)
  1) 온통청년 (youthcenter.go.kr)  : POST /pubot/search/portalPolicySearch (XSRF-TOKEN + ygt 쿠키 세션)
  2) 복지로   (bokjiro.go.kr)      : POST /ssis-tbu/TWAT52005M/twataa/wlfareInfo/selectWlfareInfo.do
  3) 기업마당 (bizinfo.go.kr)      : 목록 HTML 파싱
  4) K-Startup(k-startup.go.kr)    : 목록 HTML 파싱
  5) 보조금24 (api.odcloud.kr)     : DATA_GO_KR_KEY 가 있을 때만 자동 병합 (없으면 1~4로 완주)

출력
  public/data/policies.json  : 정규화 + 매칭 태그가 붙은 정책 목록
  public/data/meta.json      : 소스별 건수, 생애주기/직군/가구/분야/지역 분포, 수집 상태

사용
  python3 pipeline/collect_policies.py                # 전체 수집 (캐시 무시)
  python3 pipeline/collect_policies.py --only bokjiro # 한 소스만
  python3 pipeline/collect_policies.py --use-cache    # 2시간 이내 캐시 재사용
  python3 pipeline/collect_policies.py --max-bokjiro-pages 40   # 빠른 확인용
"""

from __future__ import annotations

import argparse
import html as htmllib
import http.cookiejar
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
APP_DIR = BASE_DIR.parent
DATA_DIR = APP_DIR / "public" / "data"
CACHE_DIR = BASE_DIR / ".cache"
DATA_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

KST = timezone(timedelta(hours=9))
TODAY = date.today()


def today_kst() -> date:
    override = os.environ.get("GRANT_RADAR_TODAY", "").strip()
    if override:
        try:
            return date.fromisoformat(override)
        except ValueError:
            pass
    return datetime.now(KST).date()


TODAY = today_kst()

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

_SOURCE_CACHE_FLAG: dict[str, bool] = {}

# 소스별 수집 중 발생한 페이지 오류 기록 (부분 수집 판정·폴백 판단에 사용)
_SOURCE_ERRORS: dict[str, dict] = {}

# 페이지 요청 재시도 정책: 최대 3회, 1.5초 → 3초 백오프
FETCH_RETRIES = 3
FETCH_BACKOFF = (1.5, 3.0)

# 직전 정상 건수 대비 이 비율 미만으로 급감하면 데이터 증발로 보고 기존 공고를 병합한다
DROP_RATIO = 0.65
# 직전 건수가 이보다 적은 소스는 비율 판정이 과민해지므로 비율 규칙을 적용하지 않는다
MIN_TREND_BASE = 20

SOURCE_LABEL = {
    "youthcenter": "온통청년",
    "bokjiro": "복지로",
    "bizinfo": "기업마당",
    "kstartup": "K-Startup",
    "gov24": "보조금24",
}

SIDO = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
        "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"]

SIDO_ALIASES = {
    "서울특별시": "서울", "서울시": "서울",
    "부산광역시": "부산", "부산시": "부산",
    "대구광역시": "대구", "대구시": "대구",
    "인천광역시": "인천", "인천시": "인천",
    "광주광역시": "광주", "광주시": "광주",
    "대전광역시": "대전", "대전시": "대전",
    "울산광역시": "울산", "울산시": "울산",
    "세종특별자치시": "세종", "세종시": "세종",
    "경기도": "경기", "경기": "경기",
    "강원특별자치도": "강원", "강원도": "강원", "강원": "강원",
    "충청북도": "충북", "충북": "충북",
    "충청남도": "충남", "충남": "충남",
    "전북특별자치도": "전북", "전라북도": "전북", "전북": "전북",
    "전라남도": "전남", "전남": "전남",
    "경상북도": "경북", "경북": "경북",
    "경상남도": "경남", "경남": "경남",
    "제주특별자치도": "제주", "제주도": "제주", "제주": "제주",
}

LIFE_RULES = {
    "infant": r"영유아|영아|유아|신생아|아동|어린이|미취학|보육료|보육시설|보육지원|육아|아이돌봄|놀이|유치원|산모|태아|수유|임신|출산",
    "student": r"학생|초등학생|중학생|고등학생|청소년|대학생|재학|학교|장학|교복|학자금|등록금|대학원|수능|진로|학습",
    "youth": r"청년|사회초년생|만\s*19|2030|청년층|청년농|청년창업",
    "middle": r"중장년|중년|장년|4050|40대|50대|신중년|은퇴|제2인생",
    "senior": r"노인|어르신|경로|고령|노후|요양|치매|기초연금|독거노인|실버|65세|노년",
}

JOB_RULES = {
    "student": r"학생|대학생|재학|휴학|장학|교복|학교|초등|중등|고등",
    "employee": r"직장인|재직|근로자|근로|사업장|고용보험|직장|임금|월급|직원",
    "jobseeker": r"구직|미취업|실업|취업준비|일자리|직업훈련|국민취업|취업지원|채용|고용",
    "self_employed": r"자영업|소상공인|소기업|사업자|점포|상인|전통시장|상권|골목|자영|가맹점",
    "freelancer": r"프리랜서|프리랜스|특고|플랫폼\s*노동|위탁|1인\s*사업|라이더|배달|프리",
    "artist": r"예술인|예술|창작|작가|화가|음악|공연|연극|무용|문학|문화예술|미술|사진|영화|디자인|웹툰|국악",
    "pre_founder": r"창업|예비창업|스타트업|벤처|초기창업|창업자|아이디어\s*사업|사업화",
}

HOUSE_RULES = {
    "single": r"1인\s*가구|단독가구|독신|미혼|혼자\s*사는|1인세대",
    "married": r"기혼|신혼|부부|배우자|혼인|결혼|예비부부|신혼부부",
    "single_parent": r"한부모|조손|미혼모|미혼부|모자\s*가정|부자\s*가정|이혼|돌싱|양육비|양육하는",
    "multi_child": r"다자녀|다둥이|셋째|세\s*자녀|2자녀|둘째|다출산|다문화\s*가정",
    "homeless": r"무주택|주택\s*미소유|전세|월세|임차|보증금|청약|주거급여|사글세",
    "pregnant": r"임산부|임신|난임|산모|출산|태아|산후|수유|임신부",
    "disabled": r"장애인|장애|보훈|국가유공|중증|발달장애|시각장애|청각장애|지체|뇌병변|자폐|장애아|의상자",
    "low_income": r"저소득|기초생활|수급자|수급|차상위|긴급복지|생계급여|의료급여|취약계층|위기가구|저임금|빈곤",
}

DOMAIN_RULES = {
    "housing": r"주거|전세|월세|임대|주택|보증금|청약|이사|난방|에너지바우처|주거비|고시원|셰어하우스|주거급여",
    "medical": r"의료|건강|병원|진료|검진|치료|수술|재활|치과|한의|정신건강|예방접종|응급|요양|질병|산후조리|투약",
    "finance": r"금융|대출|융자|저축|자산형성|적금|보험료|생활비|생계급여|긴급복지|통신비|감면|수당|국민연금|기초연금|채무|신용|카드|이자",
    "childcare": r"영유아|보육료|보육시설|보육지원|어린이집|육아|출산|임신|난임|산모|신생아|아동수당|부모급여|아이돌봄|유치원|놀이|양육",
    "education": r"교육|학비|장학|등록금|학습|대학|초등|중등|고등|평생교육|자격증|훈련|학원|도서|진로|교재|EBS|인강",
    "employment": r"취업|일자리|고용|채용|구직|직업훈련|인턴|근로|실업급여|직장|면접|자격|커리어|국민취업",
    "business": r"창업|소상공인|자영업|사업자|중소기업|벤처|스타트업|수출|법인|점포|상권|세무|가맹|프랜차이즈|공장|제조|R&D|특허|기술개발",
    "senior_welfare": r"노인|어르신|경로|요양|치매|노후|고령|실버|장기요양|기초연금|독거노인|노년|은퇴",
}

FEMALE_RULES = r"여성|여대생|임산부|산모|미혼모|모자보호|경력단절|여성기업|여성창업|여성농업인|다문화\s*여성|여성가족"
MALE_RULES = r"남성|남성가장|예비역|제대군인|병역|남학생|남자"

MAJOR_CITY_TO_SIDO = {
    "강남": "서울", "서초": "서울", "송파": "서울", "마포": "서울", "영등포": "서울",
    "성남": "경기", "판교": "경기", "수원": "경기", "용인": "경기", "고양": "경기",
    "양주": "경기", "의정부": "경기", "광명": "경기", "안양": "경기", "부천": "경기",
    "화성": "경기", "평택": "경기", "남양주": "경기", "김포": "경기", "파주": "경기",
    "해운대": "부산", "수성": "대구", "유성": "대전", "연수": "인천",
}


# --------------------------------------------------------------------------------------
# 공통 유틸
# --------------------------------------------------------------------------------------
def clean_text(value: object) -> str:
    if value is None:
        return ""
    s = str(value)
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.I)
    s = re.sub(r"</p>", " ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = htmllib.unescape(s)
    s = s.replace("\u00a0", " ").replace("\u200b", "")
    s = s.replace("새로운게시글", " ")
    s = re.sub(r"[ \t\r\f\v]+", " ", s)
    s = re.sub(r"\n{2,}", "\n", s)
    return s.strip()


def truncate(text: str, limit: int = 200) -> str:
    text = clean_text(text).replace("\n", " ")
    text = re.sub(r"\s{2,}", " ", text)
    if len(text) <= limit:
        return text
    cut = text[:limit]
    for sep in (". ", "다. ", "。", "·", ", "):
        idx = cut.rfind(sep)
        if idx > limit * 0.5:
            return cut[: idx + len(sep)].strip()
    return cut.rstrip() + "…"


def parse_ymd(value: object) -> date | None:
    """'20261231' / '2026-12-31' / '2026.12.31' / '2026/12/31' → date"""
    s = str(value or "").strip()
    if not s:
        return None
    m = re.search(r"(20\d{2})[-./]?(\d{1,2})[-./]?(\d{1,2})", s)
    if not m:
        return None
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if y == 1970 or y < 2000:
        return None
    try:
        return date(y, mo, d)
    except ValueError:
        return None


def parse_period_end(period: str) -> date | None:
    dates = re.findall(r"(20\d{2})[-./](\d{1,2})[-./](\d{1,2})", period or "")
    if not dates:
        return None
    y, m, d = map(int, dates[-1])
    try:
        return date(y, m, d)
    except ValueError:
        return None


def detect_regions(*texts: str) -> list[str]:
    blob = " ".join(t for t in texts if t)
    if not blob:
        return ["전국"]
    found: list[str] = []
    for alias, short in SIDO_ALIASES.items():
        if alias in blob and short not in found:
            found.append(short)
    if not found:
        for city, sido in MAJOR_CITY_TO_SIDO.items():
            if city in blob and sido not in found:
                found.append(sido)
    if not found or len(found) >= 12:
        return ["전국"]
    return found


def detect_gender(title: str, summary: str) -> str:
    blob = f"{title} {summary[:160]}"
    if re.search(r"제한없음|남녀\s*모두|성별\s*무관", blob):
        return "all"
    female = bool(re.search(FEMALE_RULES, blob))
    male = bool(re.search(MALE_RULES, blob))
    if female and not male:
        return "female"
    if male and not female:
        return "male"
    return "all"


def classify(title: str, summary: str, extra: str = "") -> dict:
    """제목·요약·추가 텍스트에서 매칭 축을 뽑아낸다."""
    blob = f"{title} {summary} {extra}"

    def hits(rules: dict[str, str]) -> list[str]:
        return [key for key, pattern in rules.items() if re.search(pattern, blob, re.I)]

    life = hits(LIFE_RULES)
    jobs = hits(JOB_RULES)
    households = hits(HOUSE_RULES)
    domains = hits(DOMAIN_RULES)
    return {
        "life_stages": life,
        "jobs": jobs,
        "households": households,
        "domains": domains,
    }


def merge_unique(*groups: list[str]) -> list[str]:
    out: list[str] = []
    for group in groups:
        for value in group or []:
            if value and value not in out:
                out.append(value)
    return out


def make_opener() -> tuple[urllib.request.OpenerDirector, http.cookiejar.CookieJar]:
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    opener.addheaders = [
        ("User-Agent", UA),
        ("Accept-Language", "ko-KR,ko;q=0.9,en;q=0.8"),
    ]
    return opener, jar


def _sleep_before_retry(attempt: int, url: str, exc: Exception) -> None:
    wait = FETCH_BACKOFF[min(attempt, len(FETCH_BACKOFF) - 1)]
    print(f"  [retry] {url} 실패({type(exc).__name__}: {exc}) → {wait:g}s 후 재시도 "
          f"({attempt + 1}/{FETCH_RETRIES - 1})", flush=True)
    time.sleep(wait)


def http_json(opener, url: str, payload: dict, headers: dict | None = None, timeout: int = 60):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    last: Exception | None = None
    for attempt in range(FETCH_RETRIES):
        try:
            req = urllib.request.Request(url, data=body, headers=headers or {})
            req.add_header("Content-Type", "application/json; charset=UTF-8")
            req.add_header("Accept", "application/json, text/plain, */*")
            with opener.open(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8", "ignore"))
        except Exception as exc:  # noqa: BLE001
            last = exc
            if attempt < FETCH_RETRIES - 1:
                _sleep_before_retry(attempt, url, exc)
    raise last  # type: ignore[misc]


def http_get_json(opener, url: str, timeout: int = 60):
    last: Exception | None = None
    for attempt in range(FETCH_RETRIES):
        try:
            req = urllib.request.Request(url)
            req.add_header("Accept", "application/json")
            with opener.open(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8", "ignore"))
        except Exception as exc:  # noqa: BLE001
            last = exc
            if attempt < FETCH_RETRIES - 1:
                _sleep_before_retry(attempt, url, exc)
    raise last  # type: ignore[misc]


def fetch_text(opener, url: str, timeout: int = 30) -> str:
    """HTML 본문을 가져온다. 실패하면 1.5초·3초 백오프로 최대 3회 재시도."""
    last: Exception | None = None
    for attempt in range(FETCH_RETRIES):
        try:
            req = urllib.request.Request(url)
            with opener.open(req, timeout=timeout) as resp:
                return resp.read().decode("utf-8", "ignore")
        except Exception as exc:  # noqa: BLE001
            last = exc
            if attempt < FETCH_RETRIES - 1:
                _sleep_before_retry(attempt, url, exc)
    raise last  # type: ignore[misc]


def _note_error(source: str, page: int, exc: Exception | str) -> dict:
    detail = str(exc) if isinstance(exc, str) else f"{type(exc).__name__}: {exc}"
    info = {"page": page, "error": detail}
    _SOURCE_ERRORS[source] = info
    return info


# --------------------------------------------------------------------------------------
# 1) 온통청년
# --------------------------------------------------------------------------------------
YOUTH_LIST_URL = "https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch"
YOUTH_API_URL = "https://www.youthcenter.go.kr/pubot/search/portalPolicySearch"
YOUTH_DETAIL_URL = "https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch/ythPlcyDetail/{doc_id}?isNew=N"


def collect_youthcenter(list_count: int = 500, max_pages: int = 12, delay: float = 0.4) -> list[dict]:
    opener, jar = make_opener()
    opener.addheaders = opener.addheaders + [("X-Requested-With", "XMLHttpRequest")]
    fetch_text(opener, YOUTH_LIST_URL, timeout=40)
    xsrf = next((c.value for c in jar if c.name == "XSRF-TOKEN"), "")
    headers = {
        "X-XSRF-TOKEN": xsrf,
        "Referer": YOUTH_LIST_URL,
        "Origin": "https://www.youthcenter.go.kr",
    }

    items: list[dict] = []
    total = None
    for page in range(1, max_pages + 1):
        payload = {
            "query": "",
            "sortFields": "",
            "searchFields": "all",
            "pageNum": page,
            "listCount": list_count,
        }
        try:
            data = http_json(opener, YOUTH_API_URL, payload, headers, timeout=90)
        except Exception as exc:  # noqa: BLE001
            _note_error("youthcenter", page, exc)
            print(f"  [youthcenter] page {page} 실패(재시도 소진): {exc}", flush=True)
            break
        rows = (data.get("searchResult") or {}).get("youthpolicy") or []
        if total is None:
            total = ((data.get("resultCount") or {}).get("youthpolicy")) or 0
        if not rows:
            break
        for row in rows:
            if str(row.get("USE_YN", "Y")).upper() != "Y":
                continue
            items.append(normalize_youthcenter(row))
        print(f"  [youthcenter] page {page}: +{len(rows)} (누적 {len(items)}/{total})", flush=True)
        if total and len(items) >= total:
            break
        time.sleep(delay)
    if "youthcenter" in _SOURCE_ERRORS:
        info = _SOURCE_ERRORS["youthcenter"]
        print(f"  [youthcenter] 부분 수집 — {info['page']}페이지에서 중단({info['error']}), {len(items)}건", flush=True)
    return items


def normalize_youthcenter(row: dict) -> dict:
    doc_id = str(row.get("DOCID") or "").strip()
    title = clean_text(row.get("PLCY_NM"))
    summary_src = row.get("PLCY_EXPLN_CN") or row.get("PLCY_SPRT_CN") or ""
    summary = truncate(summary_src, 220)
    org = clean_text(row.get("SPRVSN_INST_CD_NM")) or clean_text(row.get("RGTR_UP_INST_CD_NM"))
    oper = clean_text(row.get("OPER_INST_CD_NM"))
    if oper and oper not in org:
        org = f"{org}({oper})" if org else oper

    apply_url = clean_text(row.get("APLY_URL_ADDR")) or clean_text(row.get("REF_URL_ADDR1"))
    if apply_url and not apply_url.startswith("http"):
        apply_url = ""
    url = YOUTH_DETAIL_URL.format(doc_id=doc_id)

    # 접수기간
    is_always = str(row.get("APLY_PRD_SE_CD", "")) != "진행중"
    deadline = parse_ymd(row.get("APLY_PRD_END_YMD"))
    if deadline is None:
        is_always = True
    posted_at = parse_ymd(str(row.get("FRST_REG_DT", ""))[:10]) or parse_ymd(row.get("DATE", ""))

    # 연령
    age_min = _safe_int(row.get("SPRT_TRGT_MIN_AGE"))
    age_max = _safe_int(row.get("SPRT_TRGT_MAX_AGE"))
    if age_max is not None and age_max >= 9000:
        age_max = None
    if age_min is not None and age_min < 0:
        age_min = None

    # 혼인/취업/학력/특화
    marriage = _split_bar(row.get("MRG_STTS_NM"))
    employ = _split_bar(row.get("EMPM_STTS_NM"))
    edu = _split_bar(row.get("QLFC_ACBG_NM"))
    special = _split_bar(row.get("SPCL_FLD_NM"))
    keywords = str(row.get("PLCY_KYWD_NM") or "")
    lclsf = str(row.get("USER_LCLSF_NM") or row.get("USER_CLSF_NM") or "")
    region_names = str(row.get("STDG_NM") or "")
    support_cn = truncate(row.get("PLCY_SPRT_CN") or "", 700)
    if support_cn.strip() in ("-", "√", "없음", "해당없음"):
        support_cn = ""
    documents = truncate(row.get("SBMSN_DCMNT_CN") or "", 260)

    extra = " ".join([lclsf, keywords, " ".join(marriage), " ".join(employ), " ".join(edu), " ".join(special)])
    tag = classify(title, f"{summary} {support_cn}", extra)

    households = list(tag["households"])
    if marriage and not ("기혼" in marriage and "미혼" in marriage):
        if "기혼" in marriage:
            households = merge_unique(households, ["married"])
        if "미혼" in marriage:
            households = merge_unique(households, ["single"])
    if "한부모가정" in special or "조손" in extra:
        households = merge_unique(households, ["single_parent"])
    if "장애인" in special:
        households = merge_unique(households, ["disabled"])
    if "기초생활수급자" in extra:
        households = merge_unique(households, ["low_income"])
    if "여성" in special:
        pass

    jobs = list(tag["jobs"])
    job_map = {
        "미취업자": "jobseeker",
        "재직자": "employee",
        "자영업자": "self_employed",
        "프리랜서": "freelancer",
        "일용근로자": "employee",
        "단기근로자": "employee",
        "(예비)창업자": "pre_founder",
        "영농종사자": "self_employed",
    }
    for label, job in job_map.items():
        if label in employ:
            jobs = merge_unique(jobs, [job])
    if any("대학" in e or "고교" in e or "고졸" in e for e in edu):
        jobs = merge_unique(jobs, ["student"])
        tag["life_stages"] = merge_unique(tag["life_stages"], ["student"])

    life = list(tag["life_stages"])
    if age_min is not None or age_max is not None:
        lo = age_min if age_min is not None else 0
        hi = age_max if age_max is not None else 120
        if hi <= 8:
            life = merge_unique(life, ["infant"])
        elif hi <= 24:
            life = merge_unique(life, ["student"])
        if lo >= 60:
            life = merge_unique(life, ["senior"])
        elif lo >= 40 and hi <= 70:
            life = merge_unique(life, ["middle"])
        if lo <= 34 and hi >= 19:
            life = merge_unique(life, ["youth"])
    # 생애주기 제한을 찾지 못하면 제한 없음(전 연령)으로 둔다

    domains = list(tag["domains"]) or ["finance"]
    lclsf_map = {
        "주거": "housing",
        "일자리": "employment",
        "교육": "education",
        "금융": "finance",
        "복지": "finance",
        "문화": "finance",
        "참여": "employment",
    }
    for key, dom in lclsf_map.items():
        if key in lclsf:
            domains = merge_unique(domains, [dom])

    income_note = ""
    earn_min = _safe_int(row.get("EARN_MIN_AMT"))
    earn_max = _safe_int(row.get("EARN_MAX_AMT"))
    if earn_max and earn_max < 99999:
        income_note = f"연소득 {earn_max:,}만 원 이하"
    elif earn_min and earn_min > 0:
        income_note = f"연소득 {earn_min:,}만 원 이상"
    earn_etc = clean_text(row.get("EARN_ETC_CN") or "")
    if earn_etc:
        income_note = (income_note + " · " + truncate(earn_etc, 60)).strip(" ·")

    return {
        "id": f"youthcenter:{doc_id}",
        "source": "youthcenter",
        "title": title,
        "summary": summary,
        "org": org or "청년정책",
        "url": url,
        "apply_url": apply_url or None,
        "posted_at": posted_at.isoformat() if posted_at else None,
        "deadline": deadline.isoformat() if deadline else None,
        "dday": (deadline - TODAY).days if deadline else None,
        "is_always": bool(is_always and deadline is None),
        "match": {
            "gender": detect_gender(title, summary),
            "life_stages": life,
            "jobs": jobs,
            "households": households,
            "domains": domains,
            "regions": detect_regions(title, org, region_names[:2000]),
            "age_min": age_min,
            "age_max": age_max,
            "income_note": income_note,
        },
        "support": support_cn,
        "documents": documents,
        "keyword": truncate(keywords, 60),
        "category": lclsf or "청년정책",
        "raw_meta": {
            "marriage": "|".join(marriage),
            "employment": "|".join(employ),
            "education": "|".join(edu),
            "special": "|".join(special),
        },
    }


def _safe_int(value: object) -> int | None:
    try:
        if value is None or str(value).strip() == "":
            return None
        return int(float(str(value).replace(",", "").strip()))
    except (TypeError, ValueError):
        return None


def _split_bar(value: object) -> list[str]:
    s = str(value or "").replace("・", "·")
    return [v.strip() for v in re.split(r"[|,]", s) if v.strip() and v.strip() != "제한없음"]


# --------------------------------------------------------------------------------------
# 2) 복지로
# --------------------------------------------------------------------------------------
BOKJIRO_PAGE_URL = "https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52005M.do?page=1&orderBy=date&tabId={tab}"
BOKJIRO_API_URL = "https://www.bokjiro.go.kr/ssis-tbu/TWAT52005M/twataa/wlfareInfo/selectWlfareInfo.do"
BOKJIRO_DETAIL_URL = "https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52014M.do?wlfareInfoId={wid}&wlfareInfoReldBztpCd={trgt}"

BOKJIRO_LIFE_MAP = {
    "영유아": "infant",
    "아동": "infant",
    "청소년": "student",
    "청년": "youth",
    "중장년": "middle",
    "노인": "senior",
    "임신": "infant",
    "출산": "infant",
    "구분없음(전생애)": None,
}

BOKJIRO_FAMILY_MAP = {
    "저소득": "low_income",
    "한부모·조손": "single_parent",
    "다자녀": "multi_child",
    "다문화·탈북민": "married",
    "보훈": "disabled",
    "장애인": "disabled",
    "1인가구": "single",
    "신혼부부": "married",
}

BOKJIRO_THEME_MAP = {
    "서민금융": "finance",
    "신체건강": "medical",
    "정신건강": "medical",
    "질병": "medical",
    "일자리": "employment",
    "주거": "housing",
    "교육": "education",
    "문화·여가": "finance",
    "임신·출산": "childcare",
    "보육": "childcare",
    "고용": "employment",
    "안전·위기": "finance",
    "생활지원": "finance",
    "가족": "finance",
}


def collect_bokjiro(max_pages: int = 700, delay: float = 0.35, start_page: int = 1) -> list[dict]:
    opener, _ = make_opener()
    opener.addheaders = opener.addheaders + [("X-Requested-With", "XMLHttpRequest")]
    fetch_text(opener, BOKJIRO_PAGE_URL.format(tab=1), timeout=40)

    dm = {
        "onlineYn": "", "searchTerm": "", "tabId": "1", "orderBy": "date",
        "bkjrLftmCycCd": "", "daesang": "", "period": "", "age": "", "region": "",
        "jjim": "", "subject": "", "favoriteKeyword": "", "sidoCd": "", "sggCd": "",
        "endYn": "",
    }
    headers = {"Referer": BOKJIRO_PAGE_URL.format(tab=1)}

    seen: set[str] = set()
    items: list[dict] = []
    counts = {}
    for page in range(start_page, max_pages + 1):
        payload = {"dmSearchParam": {**dm, "page": page}, "page": page, "pageIndex": page}
        try:
            data = http_json(opener, BOKJIRO_API_URL, payload, headers, timeout=60)
        except Exception as exc:  # noqa: BLE001
            _note_error("bokjiro", page, exc)
            print(f"  [bokjiro] page {page} 실패(재시도 소진): {exc}", flush=True)
            break
        if "dmMessage" in data and "dsServiceList0" not in data:
            msg = (data.get("dmMessage") or {}).get("content")
            _note_error("bokjiro", page, f"오류응답: {msg}")
            print(f"  [bokjiro] page {page} 오류응답: {msg}", flush=True)
            break
        if not counts:
            counts = data.get("dmCount") or {}
        added = 0
        for idx in range(4):
            for row in data.get(f"dsServiceList{idx}") or []:
                wid = str(row.get("WLFARE_INFO_ID") or "").strip()
                if not wid or wid in seen:
                    continue
                seen.add(wid)
                items.append(normalize_bokjiro(row))
                added += 1
        if page % 25 == 0 or page <= 3:
            print(f"  [bokjiro] page {page}: +{added} (누적 {len(items)})", flush=True)
        if added == 0:
            break
        time.sleep(delay)
    print(f"  [bokjiro] 서버 집계: {counts}", flush=True)
    return items


def _parse_return_str(value: object) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for chunk in re.split(r";", str(value or "")):
        if ":" not in chunk:
            continue
        key, val = chunk.split(":", 1)
        out[key.strip()] = [v.strip() for v in re.split(r"[|,]", val) if v.strip()]
    return out


def normalize_bokjiro(row: dict) -> dict:
    wid = str(row.get("WLFARE_INFO_ID") or "").strip()
    title = clean_text(row.get("WLFARE_INFO_NM"))
    summary = truncate(row.get("WLFARE_INFO_OUTL_CN") or "", 220)
    org = clean_text(row.get("BIZ_CHR_INST_NM")) or "복지로"
    addr = clean_text(row.get("ADDR"))
    trgt_code = str(row.get("WLFARE_GDNC_TRGT_KCD") or "").strip()

    codes = _parse_return_str(row.get("RETURN_STR"))
    life_labels = merge_unique(codes.get("LFTM_CYC_CD", []), codes.get("BKJR_LFTM_CYC_CD", []))
    family_labels = merge_unique(codes.get("FMLY_CIRC_CD", []), codes.get("FMLY_CRTR_ERSW_CD", []))
    theme_labels = merge_unique(codes.get("INTRS_THEMA_CD", []))

    life: list[str] = []
    for label in life_labels:
        for key, mapped in BOKJIRO_LIFE_MAP.items():
            if key in label and mapped:
                life.append(mapped)
    households: list[str] = []
    for label in family_labels:
        for key, mapped in BOKJIRO_FAMILY_MAP.items():
            if key in label:
                households.append(mapped)
    if "장애" in " ".join(codes.get("DSPSN_REG_DCD", [])):
        households.append("disabled")
    if "임신" in " ".join(theme_labels) or "임신" in title:
        households.append("pregnant")

    domains: list[str] = []
    for label in theme_labels:
        for key, mapped in BOKJIRO_THEME_MAP.items():
            if key in label:
                domains.append(mapped)

    tag = classify(title, summary, " ".join(life_labels + family_labels + theme_labels))
    life = merge_unique(life, tag["life_stages"])
    households = merge_unique(households, tag["households"])
    domains = merge_unique(domains, tag["domains"])
    jobs = list(tag["jobs"])

    if not domains:
        domains = ["finance"]

    begin = parse_ymd(row.get("ENFC_BGNG_YMD"))
    end = parse_ymd(row.get("ENFC_END_YMD"))
    if end is not None and (end.year >= 2099 or (end - TODAY).days > 3650):
        end = None
    is_always = end is None
    deadline = None if is_always else end

    online = str(row.get("ONLINEYN") or "").upper() == "Y"
    apply_url = clean_text(row.get("ONAP_URL") or "") or None
    if apply_url and not apply_url.startswith("http"):
        apply_url = None

    regions = detect_regions(title, addr, org)
    if addr:
        addr_short = detect_regions(addr)
        if addr_short != ["전국"]:
            regions = addr_short

    return {
        "id": f"bokjiro:{wid}",
        "source": "bokjiro",
        "title": title,
        "summary": summary,
        "org": org,
        "url": BOKJIRO_DETAIL_URL.format(wid=wid, trgt=trgt_code or "01"),
        "apply_url": apply_url,
        "posted_at": begin.isoformat() if begin else None,
        "deadline": deadline.isoformat() if deadline else None,
        "dday": (deadline - TODAY).days if deadline else None,
        "is_always": bool(is_always),
        "match": {
            "gender": detect_gender(title, summary),
            "life_stages": life,
            "jobs": jobs,
            "households": households,
            "domains": domains,
            "regions": regions,
            "age_min": None,
            "age_max": None,
            "income_note": "",
        },
        "support": truncate(row.get("WLFARE_INFO_OUTL_CN") or "", 600),
        "documents": "",
        "keyword": " ".join(theme_labels)[:60],
        "category": " ".join(theme_labels) or "복지서비스",
        "raw_meta": {
            "target": trgt_code,
            "online": "Y" if online else "N",
            "life": "|".join(life_labels),
            "family": "|".join(family_labels),
            "theme": "|".join(theme_labels),
        },
    }


BOKJIRO_CHUNK = 100


def bokjiro_chunk_path(start: int, end: int) -> Path:
    return CACHE_DIR / f"bokjiro_{TODAY.isoformat()}_{start}_{end}.json"


def _bokjiro_covered_pages() -> set[int]:
    covered: set[int] = set()
    pattern = re.compile(r"bokjiro_" + re.escape(TODAY.isoformat()) + r"_(\d+)_(\d+)\.json$")
    for path in CACHE_DIR.glob(f"bokjiro_{TODAY.isoformat()}_*.json"):
        m = pattern.search(path.name)
        if m:
            covered.update(range(int(m.group(1)), int(m.group(2)) + 1))
    return covered


def collect_bokjiro_chunked(max_pages: int = 700, delay: float = 0.35, from_page: int = 1) -> list[dict]:
    """100페이지 단위로 끊어 받아 청크 파일로 남긴다.
    이미 받아 둔 구간(파일명 bokjiro_YYYY-MM-DD_START_END.json)은 건너뛰므로
    중간에 끊겨도 이어서 수집할 수 있다."""
    merged: dict[str, dict] = {}

    def absorb(path: Path) -> None:
        try:
            rows = json.loads(path.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            return
        for row in rows:
            merged[row["id"]] = row

    covered = _bokjiro_covered_pages()
    _SOURCE_CACHE_FLAG["bokjiro"] = len(covered) >= max_pages
    for path in sorted(CACHE_DIR.glob(f"bokjiro_{TODAY.isoformat()}_*.json")):
        absorb(path)
    if covered:
        print(f"  [bokjiro] 기존 청크 {len(covered)}페이지 재사용 · 누적 {len(merged)}건", flush=True)

    page = max(1, from_page)
    while page <= max_pages:
        if page in covered:
            page += 1
            continue
        run_end = page
        while run_end + 1 <= max_pages and (run_end + 1) not in covered and run_end + 1 - page < BOKJIRO_CHUNK - 1:
            run_end += 1
        _SOURCE_ERRORS.pop("bokjiro", None)
        rows = collect_bokjiro(max_pages=run_end, delay=delay, start_page=page)
        chunk_error = _SOURCE_ERRORS.get("bokjiro")
        if chunk_error:
            # 페이지 오류로 청크가 미완성 → '완료' 청크로 남기지 않고 부분 결과만 병합한 뒤 중단한다.
            # (다음 실행에서 같은 구간을 다시 받아 채운다)
            if rows:
                partial = CACHE_DIR / f"bokjiro_{TODAY.isoformat()}_{page}_{run_end}.partial.json"
                partial.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
                for row in rows:
                    merged[row["id"]] = row
            print(f"  [bokjiro] {page}~{run_end}p 청크 중단({chunk_error['page']}페이지 오류) · 누적 {len(merged)}건", flush=True)
            break
        if not rows:
            print(f"  [bokjiro] {page}페이지부터 데이터 없음 → 수집 종료", flush=True)
            (bokjiro_chunk_path(page, run_end)).write_text("[]", encoding="utf-8")
            break
        path = bokjiro_chunk_path(page, run_end)
        path.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
        for row in rows:
            merged[row["id"]] = row
        print(f"  [bokjiro] {page}~{run_end}p 완료 · 누적 {len(merged)}건", flush=True)
        page = run_end + 1
    return list(merged.values())


# --------------------------------------------------------------------------------------
# 3) 기업마당
# --------------------------------------------------------------------------------------
BIZINFO_LIST = "https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?rows=15&cpage={page}"
BIZINFO_VIEW = "https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/view.do?pblancId={pid}"


def collect_bizinfo(pages: int = 8, delay: float = 0.3) -> list[dict]:
    opener, _ = make_opener()
    items: list[dict] = []
    seen: set[str] = set()
    for page in range(1, pages + 1):
        try:
            body = fetch_text(opener, BIZINFO_LIST.format(page=page), timeout=30)
        except Exception as exc:  # noqa: BLE001
            info = _note_error("bizinfo", page, exc)
            print(f"  [bizinfo] page {page} 실패(재시도 소진): {exc} → 부분 결과 {len(items)}건", flush=True)
            break
        n_before = len(items)
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", body, re.S):
            if "<td" not in tr:
                continue
            tds = [clean_text(td) for td in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)]
            if len(tds) < 7:
                continue
            m = re.search(r"pblancId=(PBLN_[0-9]+)", tr)
            if not m:
                continue
            pid = m.group(1)
            if pid in seen:
                continue
            seen.add(pid)
            category, title, period, region, org, posted = tds[1], tds[2], tds[3], tds[4], tds[5], tds[6]
            end_dt = parse_period_end(period)
            items.append(normalize_bizinfo(pid, category, title, period, region, org, posted, end_dt))
        print(f"  [bizinfo] page {page}: +{len(items) - n_before} (누적 {len(items)})", flush=True)
        if len(items) == n_before:
            break
        time.sleep(delay)
    if "bizinfo" in _SOURCE_ERRORS:
        info = _SOURCE_ERRORS["bizinfo"]
        print(f"  [bizinfo] 부분 수집 — {info['page']}페이지에서 중단({info['error']}), {len(items)}건", flush=True)
    return items


def normalize_bizinfo(pid, category, title, period, region, org, posted, end_dt) -> dict:
    tag = classify(title, f"{category} {org}", region)
    households = list(tag["households"])
    jobs = list(tag["jobs"]) or ["self_employed"]
    domains = list(tag["domains"]) or ["business"]
    life = list(tag["life_stages"])
    regions = detect_regions(title, region, org)
    deadline = end_dt
    return {
        "id": f"bizinfo:{pid}",
        "source": "bizinfo",
        "title": clean_text(title),
        "summary": truncate(f"{category} · {org} · 접수 {period}", 200),
        "org": clean_text(org) or "기업마당",
        "url": BIZINFO_VIEW.format(pid=pid),
        "apply_url": BIZINFO_VIEW.format(pid=pid),
        "posted_at": (parse_ymd(posted) or None).isoformat() if parse_ymd(posted) else None,
        "deadline": deadline.isoformat() if deadline else None,
        "dday": (deadline - TODAY).days if deadline else None,
        "is_always": deadline is None,
        "match": {
            "gender": detect_gender(title, category),
            "life_stages": life,
            "jobs": jobs,
            "households": households,
            "domains": domains,
            "regions": regions,
            "age_min": None,
            "age_max": None,
            "income_note": "",
        },
        "support": truncate(f"[{category}] {org} · 접수기간 {period}", 400),
        "documents": "",
        "keyword": clean_text(category)[:60],
        "category": clean_text(category) or "기업지원",
        "raw_meta": {"period": period, "region_label": region},
    }


# --------------------------------------------------------------------------------------
# 4) K-Startup
# --------------------------------------------------------------------------------------
KSTARTUP_LIST = "https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?page={page}"
KSTARTUP_VIEW = "https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn={sn}"


def collect_kstartup(pages: int = 3, delay: float = 0.3) -> list[dict]:
    opener, _ = make_opener()
    items: list[dict] = []
    seen: set[str] = set()
    for page in range(1, pages + 1):
        try:
            body = fetch_text(opener, KSTARTUP_LIST.format(page=page), timeout=30)
        except Exception as exc:  # noqa: BLE001
            info = _note_error("kstartup", page, exc)
            print(f"  [kstartup] page {page} 실패(재시도 소진): {exc} → 부분 결과 {len(items)}건", flush=True)
            break
        n_before = len(items)
        for blk in re.findall(r"<li[^>]*>(.*?)</li>", body, re.S):
            m = re.search(r"go_view\((\d+)\)", blk)
            if not m:
                continue
            sn = m.group(1)
            if sn in seen:
                continue
            seen.add(sn)
            text = clean_text(blk)
            t_m = re.search(r'class="tit"[^>]*>(.*?)</p>', blk, re.S)
            if t_m:
                title = clean_text(t_m.group(1))
            else:
                a_m = re.search(r"go_view\(\d+\)[^>]*>(.*?)</a>", blk, re.S)
                title = clean_text(a_m.group(1)) if a_m else text[:80]
            title = re.sub(r"\s*새로운게시글\s*$", "", title).strip()
            cat_m = re.search(r'class="flag[^"]*"[^>]*>(.*?)</span>', blk, re.S)
            category = clean_text(cat_m.group(1)) if cat_m else "창업지원"
            end_m = re.search(r"마감일자\s*(20\d{2}-\d{2}-\d{2})", text)
            end_dt = parse_ymd(end_m.group(1)) if end_m else None
            org_m = re.search(r"(창업진흥원|중소벤처기업부|[^\s]+진흥원|[^\s]+테크노파크|[^\s]+센터)", text)
            org = org_m.group(1) if org_m else "창업진흥원"
            items.append(normalize_kstartup(sn, title, category, org, end_dt, text))
        print(f"  [kstartup] page {page}: +{len(items) - n_before} (누적 {len(items)})", flush=True)
        if len(items) == n_before:
            break
        time.sleep(delay)
    if "kstartup" in _SOURCE_ERRORS:
        info = _SOURCE_ERRORS["kstartup"]
        print(f"  [kstartup] 부분 수집 — {info['page']}페이지에서 중단({info['error']}), {len(items)}건", flush=True)
    return items


def normalize_kstartup(sn: str, title: str, category: str, org: str, end_dt: date | None, text: str) -> dict:
    tag = classify(title, f"{category} {org} {text[:200]}", "")
    body = clean_text(text)
    body = body.replace(clean_text(title), " ")
    body = re.sub(r"^\s*(공공|민간|교육|사업화|시설|멘토링)[\sㆍ·]*", "", body)
    body = re.sub(r"D-\d+", " ", body)
    body = re.split(r"등록일자", body)[0]
    body = re.sub(r"\s{2,}", " ", body).strip(" ·-")
    deadline_label = end_dt.isoformat() if end_dt else "공고문 참조"
    summary_line = truncate(f"{category} · {org} · 마감 {deadline_label}", 200)
    jobs = merge_unique(tag["jobs"], ["pre_founder"])
    domains = merge_unique(tag["domains"], ["business"])
    life = list(tag["life_stages"])
    return {
        "id": f"kstartup:{sn}",
        "source": "kstartup",
        "title": clean_text(title),
        "summary": summary_line,
        "org": clean_text(org) or "창업진흥원",
        "url": KSTARTUP_VIEW.format(sn=sn),
        "apply_url": KSTARTUP_VIEW.format(sn=sn),
        "posted_at": None,
        "deadline": end_dt.isoformat() if end_dt else None,
        "dday": (end_dt - TODAY).days if end_dt else None,
        "is_always": end_dt is None,
        "match": {
            "gender": detect_gender(title, category),
            "life_stages": life,
            "jobs": jobs,
            "households": tag["households"],
            "domains": domains,
            "regions": detect_regions(title, text[:300]),
            "age_min": None,
            "age_max": None,
            "income_note": "",
        },
        "support": truncate(body, 300),
        "documents": "",
        "keyword": clean_text(category)[:60],
        "category": clean_text(category) or "창업지원",
        "raw_meta": {},
    }


# --------------------------------------------------------------------------------------
# 5) 보조금24 (DATA_GO_KR_KEY 있을 때만)
# --------------------------------------------------------------------------------------
GOV24_LIST = "https://api.odcloud.kr/api/gov24/v3/serviceList"
GOV24_COND = "https://api.odcloud.kr/api/gov24/v3/supportConditions"


def collect_gov24(key: str) -> list[dict]:
    if not key:
        return []
    opener, _ = make_opener()
    rows: list[dict] = []
    for endpoint, label in ((GOV24_LIST, "serviceList"), (GOV24_COND, "supportConditions")):
        page = 1
        while page <= 60:
            qs = urllib.parse.urlencode({
                "page": page, "perPage": 500, "returnType": "JSON",
                "serviceKey": key,
            })
            try:
                data = http_get_json(opener, f"{endpoint}?{qs}", timeout=60)
            except Exception as exc:  # noqa: BLE001
                _note_error("gov24", page, exc)
                print(f"  [gov24] {label} page {page} 실패(재시도 소진): {exc}", flush=True)
                break
            chunk = data.get("data") or []
            if not chunk:
                break
            if label == "serviceList":
                rows.extend(chunk)
            else:
                cond_by_id = {str(c.get("서비스ID")): c for c in chunk}
                for row in rows:
                    sid = str(row.get("서비스ID"))
                    if sid in cond_by_id:
                        row["_conditions"] = cond_by_id[sid]
            print(f"  [gov24] {label} page {page}: +{len(chunk)}", flush=True)
            if len(chunk) < 500:
                break
            page += 1
            time.sleep(0.3)
    return [normalize_gov24(row) for row in rows]


def normalize_gov24(row: dict) -> dict:
    sid = str(row.get("서비스ID") or "").strip()
    title = clean_text(row.get("서비스명"))
    summary = truncate(row.get("서비스목적요약") or row.get("지원내용") or "", 220)
    org = clean_text(row.get("소관기관명")) or clean_text(row.get("부서명")) or "보조금24"
    cond = row.get("_conditions") or {}
    cond_text = " ".join(str(v) for v in cond.values() if isinstance(v, str))
    extra = " ".join([
        str(row.get("지원대상") or ""), str(row.get("선정기준") or ""),
        str(row.get("지원유형") or ""), cond_text[:400],
    ])
    tag = classify(title, f"{summary} {extra}", "")
    life = list(tag["life_stages"])
    households = list(tag["households"])
    if "수급" in extra or "차상위" in extra:
        households = merge_unique(households, ["low_income"])
    deadline = parse_ymd(row.get("신청기한") or "") or None
    apply_url = clean_text(row.get("온라인신청사이트URL") or "") or None
    return {
        "id": f"gov24:{sid}",
        "source": "gov24",
        "title": title,
        "summary": summary,
        "org": org,
        "url": clean_text(row.get("상세조회URL") or "") or "https://www.gov.kr/portal/service/serviceInfo",
        "apply_url": apply_url,
        "posted_at": None,
        "deadline": deadline.isoformat() if deadline else None,
        "dday": (deadline - TODAY).days if deadline else None,
        "is_always": deadline is None,
        "match": {
            "gender": detect_gender(title, summary),
            "life_stages": life,
            "jobs": tag["jobs"],
            "households": households,
            "domains": list(tag["domains"]) or ["finance"],
            "regions": detect_regions(title, org, str(row.get("소관기관명") or "")),
            "age_min": _safe_int(row.get("지원대상연령시작")),
            "age_max": _safe_int(row.get("지원대상연령종료")),
            "income_note": truncate(str(row.get("소득요건") or ""), 60),
        },
        "support": truncate(str(row.get("지원내용") or ""), 600),
        "documents": truncate(str(row.get("제출서류") or ""), 260),
        "keyword": truncate(str(row.get("서비스분야") or ""), 60),
        "category": clean_text(row.get("서비스분야")) or "정부지원",
        "raw_meta": {},
    }


# --------------------------------------------------------------------------------------
# 캐시 & 병합
# --------------------------------------------------------------------------------------
def cache_path(name: str) -> Path:
    return CACHE_DIR / f"{name}_{TODAY.isoformat()}.json"


def load_cache(name: str, max_age_hours: float = 2.0) -> list[dict] | None:
    path = cache_path(name)
    if not path.exists():
        return None
    age_h = (time.time() - path.stat().st_mtime) / 3600
    if age_h > max_age_hours:
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return None


def save_cache(name: str, items: list[dict]) -> None:
    try:
        cache_path(name).write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
    except Exception as exc:  # noqa: BLE001
        print(f"  cache 저장 실패({name}): {exc}", flush=True)


def run_source(name: str, fn, use_cache: bool) -> tuple[list[dict], dict]:
    t0 = time.time()
    if use_cache:
        cached = load_cache(name)
        if cached is not None:
            print(f"  [cache] {name}: {len(cached)}건 재사용", flush=True)
            return cached, {"source": name, "ok": True, "count": len(cached), "cached": True, "elapsed_sec": 0.0}
    _SOURCE_ERRORS.pop(name, None)
    try:
        items = fn()
        if items:
            save_cache(name, items)
        page_error = _SOURCE_ERRORS.get(name)
        status = {
            "source": name,
            "ok": bool(items),
            "count": len(items),
            "cached": bool(_SOURCE_CACHE_FLAG.get(name)),
            "elapsed_sec": round(time.time() - t0, 2),
        }
        if page_error:
            # 중간 페이지 오류로 조기 종료한 부분 수집 — 결과를 성공으로 단정하지 않는다
            status["had_error"] = True
            status["partial"] = True
            status["error_page"] = page_error["page"]
            status["error"] = page_error["error"]
        return items, status
    except Exception as exc:  # noqa: BLE001
        print(f"  [error] {name}: {type(exc).__name__} {exc}", flush=True)
        cached = load_cache(name, max_age_hours=48)
        if cached:
            print(f"  [fallback] {name}: 이전 캐시 {len(cached)}건 사용", flush=True)
            return cached, {"source": name, "ok": True, "count": len(cached), "cached": True,
                            "error": f"{type(exc).__name__}: {exc}", "elapsed_sec": round(time.time() - t0, 2)}
        return [], {"source": name, "ok": False, "count": 0, "cached": False,
                    "error": f"{type(exc).__name__}: {exc}", "elapsed_sec": round(time.time() - t0, 2)}


def dedupe(items: list[dict]) -> list[dict]:
    """같은 소스 안에서는 id로만 중복 제거(지역별 동명 정책 보존),
    소스가 다를 때만 제목 기준으로 대표 1건을 남긴다."""
    priority = {"youthcenter": 0, "gov24": 1, "bokjiro": 2, "bizinfo": 3, "kstartup": 4}
    items = sorted(items, key=lambda x: priority.get(x["source"], 9))
    seen_ids: set[str] = set()
    title_owner: dict[str, str] = {}
    out: list[dict] = []
    for item in items:
        if item["id"] in seen_ids:
            continue
        key_title = re.sub(r"[\s\[\]()·,.\-]", "", item["title"])[:60]
        owner = title_owner.get(key_title)
        if key_title and owner and owner != item["source"]:
            continue
        seen_ids.add(item["id"])
        if key_title:
            title_owner[key_title] = item["source"]
        out.append(item)
    return out


def compact(item: dict) -> dict:
    """프론트엔드 전송용 압축 — 빈 값·중복 값 제거로 용량을 줄인다."""
    out = {k: v for k, v in item.items() if k != "raw_meta" and v not in ("", None, [], {})}
    match = dict(out.get("match", {}))
    match = {k: v for k, v in match.items() if v not in ("", None, [])}
    if match.get("gender") == "all":
        match.pop("gender", None)
    out["match"] = match

    summary = str(out.get("summary", "")).strip()
    support = str(out.get("support", "")).strip()
    if support and summary and (support == summary or support.startswith(summary[:80])):
        out.pop("support", None)
    elif support:
        out["support"] = truncate(support, 400)
    if out.get("documents"):
        out["documents"] = truncate(str(out["documents"]), 220)
    if summary:
        out["summary"] = truncate(summary, 170)
    if out.get("apply_url") and out["apply_url"] == out.get("url"):
        out.pop("apply_url")
    if out.get("is_always") is not True:
        out.pop("is_always", None)
    if out.get("keyword") and out.get("keyword") == out.get("category"):
        out.pop("keyword")
    return out


def build_stats(items: list[dict], statuses: list[dict], started: datetime, elapsed: float,
                filtered_expired: int, raw_total: int) -> dict:
    def dist(field: str) -> dict[str, int]:
        counter: dict[str, int] = {}
        for it in items:
            for value in it["match"].get(field, []) or []:
                counter[value] = counter.get(value, 0) + 1
        return dict(sorted(counter.items(), key=lambda kv: -kv[1]))

    by_source: dict[str, int] = {}
    for it in items:
        by_source[it["source"]] = by_source.get(it["source"], 0) + 1

    urgent = [it for it in items if it.get("dday") is not None and 0 <= it["dday"] <= 7]
    always = [it for it in items if it.get("is_always")]
    size = (DATA_DIR / "policies.json").stat().st_size if (DATA_DIR / "policies.json").exists() else 0

    return {
        "app": "보조금 레이더",
        "app_en": "GrantRadar KR",
        "generated_at": datetime.now(KST).isoformat(timespec="seconds"),
        "started_at": started.isoformat(timespec="seconds"),
        "today": TODAY.isoformat(),
        "total": len(items),
        "raw_total": raw_total,
        "expired_filtered": filtered_expired,
        "by_source": by_source,
        "source_labels": {k: SOURCE_LABEL[k] for k in SOURCE_LABEL},
        "distributions": {
            "life_stages": dist("life_stages"),
            "jobs": dist("jobs"),
            "households": dist("households"),
            "domains": dist("domains"),
            "regions": dist("regions"),
        },
        "counts": {
            "urgent7": len(urgent),
            "always": len(always),
            "with_apply_url": sum(1 for it in items if it.get("apply_url")),
        },
        "sources": statuses,
        "elapsed_sec": round(elapsed, 2),
        "data_bytes": size,
        "license": "공공데이터포털·온통청년·복지로·기업마당·K-Startup 공개 데이터 기반 (민간 정보 매칭 서비스)",
    }


def print_coverage(items: list[dict]) -> None:
    def count(pred) -> int:
        return sum(1 for it in items if pred(it))

    checks = [
        ("영유아·보육", lambda i: "childcare" in i["match"].get("domains", []) or "infant" in i["match"].get("life_stages", [])),
        ("노인복지", lambda i: "senior_welfare" in i["match"].get("domains", []) or "senior" in i["match"].get("life_stages", [])),
        ("의료·건강", lambda i: "medical" in i["match"].get("domains", [])),
        ("주거", lambda i: "housing" in i["match"].get("domains", [])),
        ("예술인", lambda i: "artist" in i["match"].get("jobs", [])),
        ("프리랜서", lambda i: "freelancer" in i["match"].get("jobs", [])),
        ("한부모·돌싱", lambda i: "single_parent" in i["match"].get("households", [])),
        ("다자녀", lambda i: "multi_child" in i["match"].get("households", [])),
        ("장애인·보훈", lambda i: "disabled" in i["match"].get("households", [])),
        ("저소득", lambda i: "low_income" in i["match"].get("households", [])),
        ("중장년", lambda i: "middle" in i["match"].get("life_stages", [])),
        ("청년", lambda i: "youth" in i["match"].get("life_stages", [])),
        ("자영업·소상공인", lambda i: "self_employed" in i["match"].get("jobs", [])),
        ("예비창업", lambda i: "pre_founder" in i["match"].get("jobs", [])),
        ("여성 전용", lambda i: i["match"].get("gender") == "female"),
    ]
    print("\n=== 상황별 커버리지 실측 ===")
    for label, pred in checks:
        n = count(pred)
        flag = "OK " if n > 0 else "!! "
        print(f" {flag}{label:<16} {n:>5}건")


# --------------------------------------------------------------------------------------
# 기존 데이터 보존 · 폴백
# --------------------------------------------------------------------------------------
def load_existing_payload() -> list[dict]:
    path = DATA_DIR / "policies.json"
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        print(f"  [warn] 기존 policies.json 읽기 실패: {exc}", flush=True)
        return []
    return data if isinstance(data, list) else []


def refresh_valid_existing(items: list[dict]) -> tuple[list[dict], int]:
    """기존 공고의 dday를 오늘 기준으로 다시 계산해 돌려주고, 이미 마감된 공고 수를 함께 돌려준다."""
    out: list[dict] = []
    dropped = 0
    for it in items:
        if not isinstance(it, dict) or not it.get("id"):
            continue
        item = dict(it)
        deadline = item.get("deadline")
        if deadline:
            parsed = parse_ymd(deadline)
            if parsed is not None:
                item["dday"] = (parsed - TODAY).days
            else:
                item.pop("dday", None)
        dday = item.get("dday")
        if isinstance(dday, int) and dday < 0:
            dropped += 1
            continue
        out.append(item)
    return out, dropped


def merge_with_previous(name: str, new_items: list[dict], prev_items: list[dict], status: dict) -> list[dict]:
    """직전 정상 건수 대비 급감했거나 페이지 오류로 조기 종료했으면
    기존 policies.json의 유효 공고를 병합해 데이터 증발을 막는다."""
    if not prev_items:
        return new_items

    new_valid_n = sum(1 for it in new_items if it.get("dday") is None or it["dday"] >= 0)
    had_error = bool(status.get("had_error"))
    ratio = new_valid_n / len(prev_items) if prev_items else 1.0
    dropped = len(prev_items) >= MIN_TREND_BASE and ratio < DROP_RATIO
    error_short = had_error and new_valid_n < len(prev_items)
    if not (dropped or error_short):
        return new_items

    seen = {it["id"] for it in new_items}
    carry = [it for it in prev_items if it["id"] not in seen]
    reasons: list[str] = []
    if dropped:
        reasons.append(f"직전 정상 {len(prev_items)}건 대비 {new_valid_n}건({ratio * 100:.0f}%) 급감")
    if error_short:
        reasons.append(f"페이지 오류({status.get('error_page')}p: {status.get('error')})로 조기 종료")
    status["fallback_used"] = True
    status["live_count"] = new_valid_n
    status["merged_from_previous"] = len(carry)
    status["count"] = len(new_items) + len(carry)
    status["fallback_reason"] = " · ".join(reasons) + f" → 기존 유효 공고 {len(carry)}건 병합"
    print(f"  [fallback] {name}: {' · '.join(reasons)} → 기존 유효 공고 {len(carry)}건 병합 "
          f"(총 {len(new_items) + len(carry)}건)", flush=True)
    return new_items + carry


def main() -> int:
    parser = argparse.ArgumentParser(description="보조금 레이더 수집 파이프라인")
    parser.add_argument("--only", default="", help="youthcenter|bokjiro|bizinfo|kstartup|gov24 (쉼표 구분)")
    parser.add_argument("--use-cache", action="store_true", help="2시간 이내 캐시 재사용")
    parser.add_argument("--max-bokjiro-pages", type=int, default=700)
    parser.add_argument("--bokjiro-from", type=int, default=1, help="복지로 수집 시작 페이지(청크 이어받기)")
    parser.add_argument("--youth-pages", type=int, default=12)
    parser.add_argument("--bizinfo-pages", type=int, default=8)
    parser.add_argument("--kstartup-pages", type=int, default=3)
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    started_dt = datetime.now(KST)
    t0 = time.time()
    wanted = [s.strip() for s in args.only.split(",") if s.strip()] or list(SOURCE_LABEL.keys())

    print(f"=== 보조금 레이더 수집 시작 {started_dt.isoformat(timespec='seconds')} (기준일 {TODAY}) ===", flush=True)

    collected: list[dict] = []
    statuses: list[dict] = []

    runners = []
    if "youthcenter" in wanted:
        runners.append(("youthcenter", lambda: collect_youthcenter(max_pages=args.youth_pages)))
    if "bokjiro" in wanted:
        runners.append(("bokjiro", lambda: collect_bokjiro_chunked(max_pages=args.max_bokjiro_pages, from_page=args.bokjiro_from)))
    if "bizinfo" in wanted:
        runners.append(("bizinfo", lambda: collect_bizinfo(pages=args.bizinfo_pages)))
    if "kstartup" in wanted:
        runners.append(("kstartup", lambda: collect_kstartup(pages=args.kstartup_pages)))
    if "gov24" in wanted:
        key = os.environ.get("DATA_GO_KR_KEY", "").strip()
        if key:
            runners.append(("gov24", lambda: collect_gov24(key)))
        else:
            print("  [gov24] DATA_GO_KR_KEY 미설정 → 건너뜀 (나머지 소스로 완주)", flush=True)
            statuses.append({"source": "gov24", "ok": True, "count": 0, "cached": False,
                             "skipped": "DATA_GO_KR_KEY 미설정", "elapsed_sec": 0})

    for name, fn in runners:
        print(f"\n--- {SOURCE_LABEL[name]} ({name}) ---", flush=True)
        items, status = run_source(name, fn, args.use_cache)
        collected.extend(items)
        statuses.append(status)

    # 덮어쓰기 전에 기존 데이터를 읽어 소스별로 비교한다 (데이터 증발 방지)
    prev_by_source: dict[str, list[dict]] = {}
    prev_valid_items, prev_dropped = refresh_valid_existing(load_existing_payload())
    for it in prev_valid_items:
        prev_by_source.setdefault(it.get("source") or "", []).append(it)

    new_by_source: dict[str, list[dict]] = {}
    for it in collected:
        new_by_source.setdefault(it["source"], []).append(it)

    ran = {name for name, _ in runners}
    final_items: list[dict] = []
    for name in SOURCE_LABEL:
        prev_items = prev_by_source.get(name, [])
        status = next((s for s in statuses if s["source"] == name), None)
        if name not in ran:
            # --only 로 선택하지 않았거나(또는 키 미설정으로 건너뛴) 소스는 기존 데이터를 그대로 보존한다
            if not prev_items:
                continue
            final_items.extend(prev_items)
            note = "이번 실행에서 수집하지 않아 기존 데이터 유지"
            if status is None:
                status = {"source": name, "ok": True, "count": len(prev_items), "cached": False,
                          "elapsed_sec": 0}
                statuses.append(status)
            status.update({"count": len(prev_items), "ok": True, "preserved": True, "note": note})
            status.pop("skipped", None)
            print(f"  [보존] {name}: 이번 실행 제외 → 기존 {len(prev_items)}건 유지", flush=True)
            continue
        final_items.extend(merge_with_previous(name, new_by_source.get(name, []), prev_items, status or {}) if status is not None
                           else new_by_source.get(name, []))

    raw_total = len(final_items)
    active = [it for it in final_items if it.get("dday") is None or it["dday"] >= 0]
    filtered_expired = raw_total - len(active) + prev_dropped
    merged = dedupe(active)
    merged.sort(key=lambda it: (
        0 if it.get("dday") is not None and it["dday"] <= 7 else 1,
        it.get("dday") if it.get("dday") is not None else 9999,
        it["title"],
    ))
    payload = [compact(it) for it in merged]

    if not payload:
        print("!! 수집 결과가 비었습니다. 기존 파일을 유지합니다.", flush=True)
        return 2

    order = {name: idx for idx, name in enumerate(SOURCE_LABEL)}
    statuses.sort(key=lambda s: order.get(s.get("source", ""), 99))

    (DATA_DIR / "policies.json").write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    meta = build_stats(payload, statuses, started_dt, time.time() - t0, filtered_expired, raw_total)
    (DATA_DIR / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8"
    )

    if not args.quiet:
        print("\n=== 소스별 건수 ===")
        for st in statuses:
            flags = ["cache" if st.get("cached") else "live"]
            if st.get("preserved"):
                flags.append("보존")
            if st.get("fallback_used"):
                flags.append("폴백")
            if st.get("partial"):
                flags.append(f"부분수집({st.get('error_page')}p)")
            if st.get("error"):
                flags.append(str(st["error"]))
            print(f"  {SOURCE_LABEL.get(st['source'], st['source']):<10} {st['count']:>5}건 "
                  f"({', '.join(flags)})")
            if st.get("fallback_reason"):
                print(f"    └ {st['fallback_reason']}")
        print(f"  {'합계(중복제거)':<10} {len(payload):>5}건  (만료 제외 {filtered_expired}건)")
        print_coverage(payload)
        size_kb = (DATA_DIR / "policies.json").stat().st_size / 1024
        print(f"\npolicies.json {size_kb:.0f} KB · meta.json · {meta['elapsed_sec']}s")

    return 0


if __name__ == "__main__":
    sys.exit(main())
