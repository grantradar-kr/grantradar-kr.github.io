# 보조금 레이더 · GrantRadar KR

> 전 국민 생애주기·상황별 정부 보조금 실시간 매칭 서비스 · **GrantRadar KR / Bojogeum Radar**
> 웹(PWA) → Android/iOS 스토어 앱(Capacitor) 순서로 그대로 확장되는 단일 코드베이스입니다.
>
> **2026-11-18 실수집 결과** — 정책 **7,960건** (온통청년 3,942 · 복지로 5,620 · 기업마당 120 · K-Startup 45, 만료 1,624건 제외·중복 제거 후)
> · 마감 임박(D-7) 73건 · 상시 모집 7,327건 · gzip 약 1.0MB

```
work/grant_radar_app/
├── pipeline/                 # 실시간 정책 수집 파이프라인 (Python, 표준 라이브러리만 사용)
│   ├── collect_policies.py   # 온통청년·복지로·기업마당·K-Startup(+보조금24) 수집 → public/data
│   ├── make_brand_assets.py  # 앱 아이콘·OG 이미지 생성 (PIL)
│   └── fonts/                # 나눔고딕 (이미지 생성용)
├── public/
│   ├── data/policies.json    # 앱이 읽는 정책 데이터 (자동 생성)
│   ├── data/meta.json        # 소스별 건수·분포 통계 (자동 생성)
│   ├── icons/                # 192/512/maskable/애플터치 아이콘
│   ├── manifest.json         # PWA 매니페스트
│   ├── sw.js                 # 서비스 워커 (앱 셸 + 데이터 캐시)
│   └── og-cover.png          # SNS 공유 카드 (1200×630)
├── src/
│   ├── lib/                  # types, labels, matcher(일치율 엔진), storage, supabase, data, share
│   ├── components/           # 화면 + 모달 + 광고 슬롯
│   ├── App.tsx               # 라우팅·상태 오케스트레이션
│   └── main.tsx              # 엔트리 + SW 등록
├── supabase/schema.sql       # user_profiles / saved_policies + RLS
├── .github/workflows/
│   ├── deploy-pages.yml      # main push → 빌드 → GitHub Pages
│   ├── update-policies.yml   # 매일 06:00/18:00 KST 수집 → 커밋 → 자동 재배포
│   └── build-android.yml     # APK(debug) / AAB(release) 빌드
├── capacitor.config.ts       # appId kr.grantradar.app
└── vite.config.ts            # base './' (Pages 하위경로·앱 웹뷰 동시 지원)
```

---

## 1. 실시간 정책 수집 파이프라인

### 수집 소스 (인증키 없이 즉시 동작)

| 소스 | 엔드포인트 | 수집 방식 | 커버리지 |
|---|---|---|---|
| 온통청년 | `POST youthcenter.go.kr/pubot/search/portalPolicySearch` | `XSRF-TOKEN`·`ygt` 쿠키 세션 후 JSON API, `pageNum`/`listCount=500` | 청년정책 3,942건 (79개 필드 → 연령·소득·혼인·학력·취업·지역·서류) |
| 복지로 | `POST bokjiro.go.kr/ssis-tbu/TWAT52005M/twataa/wlfareInfo/selectWlfareInfo.do` | `JSESSIONID` 확보 후 `dmSearchParam.page` 로 9건/페이지 순회, 0.35초 지연 | 전체 5,620건(중앙부처 461 · 지자체 4,828 · 민간 331) |
| 기업마당 | `bizinfo.go.kr` 목록 HTML | 목록 파싱 → D-day·지역·주관기관 | 소상공인·자영업·수출·R&D |
| K-Startup | `k-startup.go.kr` 목록 HTML | 목록 파싱 → 마감일자·분류 | 예비창업·초기창업 |
| 보조금24 | `api.odcloud.kr/api/gov24/v3/serviceList` | `DATA_GO_KR_KEY` 있을 때만 자동 병합 | 정부24 서비스 전량 |

> 복지로는 `ENFC_END_YMD = 1970xxxx` 또는 `2099-12-31`(사실상 상시)을 **상시 모집**으로 처리하고,
> 종료일이 지난 공고는 결과에서 제외합니다(`expired_filtered`).
> 온통청년은 `APLY_PRD_END_YMD = 0`(상시) 과 `APLY_PRD_SE_CD`(상시/진행중)를 함께 사용합니다.

### 실행

```bash
python3 pipeline/collect_policies.py                 # 전체 수집 (약 12~15분, 625페이지)
python3 pipeline/collect_policies.py --use-cache     # 2시간 내 캐시 재사용 (수 초)
python3 pipeline/collect_policies.py --only bokjiro --max-bokjiro-pages 40   # 빠른 점검
DATA_GO_KR_KEY=발급키 python3 pipeline/collect_policies.py                    # 보조금24 포함
```

- 복지로는 **100페이지 단위 청크 캐시**(`pipeline/.cache/bokjiro_YYYY-MM-DD_START_END.json`)를 남겨, 중간에 끊겨도 이어서 수집합니다.
- 네트워크 오류가 나도 직전 캐시(48시간)로 폴백하고 나머지 소스로 완주합니다.

### 정규화 스키마

```json
{
  "id": "bokjiro:WLF00006061",
  "source": "bokjiro",
  "title": "경상남도 주거취약계층 주택임대차 중개보수 지원사업",
  "summary": "…",
  "org": "경상남도 도시주택국 토지정보과",
  "url": "https://www.bokjiro.go.kr/…",
  "apply_url": "https://…",
  "posted_at": "2025-02-10",
  "deadline": "2026-12-31",
  "dday": 43,
  "is_always": false,
  "match": {
    "gender": "all",
    "life_stages": ["youth", "middle"],
    "jobs": ["self_employed"],
    "households": ["low_income", "homeless"],
    "domains": ["finance", "housing"],
    "regions": ["경남"],
    "age_min": 19,
    "age_max": 39,
    "income_note": "연소득 3,600만 원 이하"
  },
  "support": "지원 내용 요약",
  "documents": "제출 서류"
}
```

- `life_stages` 영유아·아동 / 학생 / 청년 / 중장년 / 노인
- `jobs` 학생·직장인·구직자·자영업·프리랜서·예술인·예비창업자
- `households` 1인·미혼 / 기혼·신혼 / 한부모·돌싱 / 다자녀 / 무주택 / 임산부·난임 / 장애인·보훈 / 저소득
- `domains` 주거 / 의료 / 생활·금융 / 영유아·보육 / 교육 / 취업 / 창업·소상공인 / 노인복지
- `regions` `["전국"]` 또는 시·도 배열

### 데이터 크기 최적화

- 빈 값·중복 값 제거, 요약 170자·본문 400자·서류 220자 컷
- `apply_url == url` 이면 생략, `is_always=false` 생략, `gender="all"` 생략
- 7,960건 기준 **원본 5.9MB / gzip 1.04MB** → 서비스 워커가 캐시하므로 재방문 시 즉시 표시됩니다.
  더 가볍게 운영하려면 `--max-bokjiro-pages` 를 낮춰 지자체 최신 공고만 담을 수 있습니다.

---

## 2. 앱 (React + Vite + Tailwind + PWA + Capacitor)

### 화면

| 화면 | 설명 |
|---|---|
| **추천(home)** | 내 조건 일치율 순 추천 · 판정 탭(완벽 일치/조건 확인/마감 임박) · 분야 필터 · 검색. 카드마다 일치율·사유·D-day |
| **둘러보기(browse)** | 로그인 없이 분야·생애주기별 전체 목록 (SEO·비회원 유입·AdSense 심사용) |
| **가이드(guides)** | 직접 작성한 심층 가이드 8편(`#/guides`, `#/guides/<slug>`) — 소득기준 계산, 중복 수혜, 서류 체크리스트, 신청 순서 |
| **서비스 소개(about)** | 데이터 출처·수집 주기·추천 계산 방식·편집 원칙·운영 문의 |
| **저장함(saved)** | 저장한 공고 + 신청 전 체크리스트 진행률 |
| **설정(settings)** | 내 조건 수정, 계정·동기화 상태, 가이드·서비스 소개 링크, 데이터 기준·소스별 건수, 내 데이터 내보내기/삭제, 약관 |
| **상세 모달** | 일치율 근거(이유/확인 필요), 대상 조건 칩, 지원 내용, 체크리스트, 공고 원문 서류, 공식 신청 링크, 공유 |

### 일치율 엔진 (`src/lib/matcher.ts`)

```
기본 54점
+ 연령 일치 13 / 성별 일치 7 / 지역 일치 11 / 전국 4
+ 직군 일치 12 / 가구 상황 일치 12 / 관심 분야 9 / 생애주기 7
+ 마감 임박(D-7) 3
- 성별 불일치 42 · 연령 불일치 38 · 지역 불일치 16 · 마감 지남 50  → 하드 차단(verdict 상한)
→ 82점 이상 '내 조건 완벽 일치', 60~81 '조건 확인 필요', 그 미만 '가능성 낮음'
```

사유는 문장으로 남깁니다. 예: `만 34세 지원 가능 (만 19~39세)`, `경기 거주 조건 일치`, `가구 상황 일치 · 한부모·돌싱`.

### 로컬 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc --noEmit + vite build → dist/
npm run preview
```

> `dist/data/policies.json` 은 파이프라인이 만듭니다. 저장소에 커밋되어 있으므로 clone 직후에도 앱이 바로 뜹니다.

### 환경변수 (`.env.local`)

```dotenv
# Supabase (선택 — 없으면 자동으로 기기 저장 모드)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...

# AdSense (게시자 ID 는 기본값이 코드에 내장되어 있다)
VITE_ADSENSE_CLIENT=ca-pub-3631676636047500
# 광고 단위 ID — 승인 후 AdSense 콘솔에서 생성해 넣는다(비우면 <ins> 슬롯 미렌더)
VITE_ADSENSE_SLOT=

# 카카오 애드핏 (선택)
VITE_ADFIT_UNIT=
VITE_ADFIT_WIDTH=320
VITE_ADFIT_HEIGHT=100
# auto | adsense | adfit | none
VITE_AD_NETWORK=auto
VITE_SHOW_AD_PLACEHOLDER=false

# 앱 버전 표기
VITE_APP_VERSION=v1.0.0
```

---

## 3. Supabase 연동 (선택)

1. [supabase.com](https://supabase.com) 에서 프로젝트 생성 → **SQL Editor** 에 `supabase/schema.sql` 전체 실행
2. **Authentication → Providers → Email** 활성화 (이메일 확인 메일을 끄면 가입 즉시 로그인)
3. **Project Settings → API** 의 URL / anon key 를 위 환경변수(또는 GitHub Secrets)에 입력
4. 앱 상단의 `기기 저장` 배지를 눌러 회원가입 → 로그인하면 내 조건·저장 목록이 동기화됩니다.

RLS 정책이 걸려 있어 **본인 행만** 읽고 쓸 수 있습니다(`auth.uid() = user_id`).
클라우드가 설정되지 않아도 앱은 로컬 프로필/저장 목록으로 100% 동작합니다.

---

## 4. 배포

### GitHub Pages (PWA 먼저 오픈)

```bash
git init && git add . && git commit -m "feat: 보조금 레이더 v1"
gh repo create grant-radar-kr --public --source=. --remote=origin --push
```

1. 저장소 **Settings → Pages → Build and deployment → Source: GitHub Actions**
2. (선택) **Settings → Secrets and variables → Actions** 에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ADSENSE_CLIENT`, `VITE_ADSENSE_SLOT`, `DATA_GO_KR_KEY` 추가
3. `main` 에 push 하면 `deploy-pages.yml` 이 빌드·배포 → `https://<계정>.github.io/grant-radar-kr/`
4. `update-policies.yml` 이 매일 06:00·18:00 KST 에 데이터를 갱신하고 커밋 → push → 자동 재배포
5. 커스텀 도메인을 붙이면 `public/CNAME` 에 도메인을 넣고 DNS(CNAME → `<계정>.github.io`)를 설정

### Android (Capacitor)

```bash
npm run build
npx cap add android          # 최초 1회
npx cap sync android
npx cap open android         # Android Studio
# 또는 CLI 빌드
cd android && ./gradlew assembleDebug     # app/build/outputs/apk/debug/app-debug.apk
```

- `capacitor.config.ts`: `appId kr.grantradar.app`, `appName 보조금 레이더`, `webDir dist`
- 릴리스 AAB: 키스토어 생성 → `android/app/build.gradle` 에 signingConfigs 추가(`build-android.yml` 이 자동 주입) → `./gradlew bundleRelease`
- GitHub Actions: **Actions → Build Android APK / AAB → Run workflow** (서명 시크릿이 있으면 릴리스도 함께 빌드)

필요 시크릿: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`

### iOS

```bash
npx cap add ios
npx cap sync ios
npx cap open ios             # Xcode → Signing & Capabilities 에서 팀 선택
```

App Store 심사 시 “정부 공식 앱이 아님”을 스토어 설명과 앱 내 고지로 명확히 밝혀야 합니다(현재 앱 하단 고지 포함).

---

## 5. 수익화 슬롯

| 위치 | 형태 | 상태 |
|---|---|---|
| 웹 | Google AdSense (`AdSlot`, `VITE_ADSENSE_CLIENT`/`SLOT`) | 게시자 ID 기본값 내장 · 광고 단위 ID 입력 시 `<ins>` 슬롯 표시 |
| 웹 | 카카오 애드핏 (`VITE_ADFIT_UNIT`/`WIDTH`/`HEIGHT`) | 단위 ID 입력 시 AdSense 대신 사용 |
| 앱 | AdMob 배너 (`@capacitor-community/admob` 연결 지점) | 플러그인 추가 후 네이티브 배너 |
| 공통 | 광고 표시는 상시. 설정에서 끄는 스위치는 없다. 단위 ID 가 없으면 아무것도 렌더하지 않아 빈 박스가 생기지 않는다 | 적용 |

- **게시자 ID 기본값**: `ca-pub-3631676636047500`. `index.html` 의 `<!--ADSENSE_META-->`·`<!--ADSENSE_SCRIPT-->` 자리를 빌드 시 치환해
  `<meta name="google-adsense-account">` 와 공식 스크립트를 넣는다(환경변수 `VITE_ADSENSE_CLIENT` 가 있으면 그 값 우선).
- **ads.txt**: `public/ads.txt` 에 `google.com, pub-3631676636047500, DIRECT, f08c47fec0942fa0` 가 들어 있고,
  `python3 pipeline/build_content.py`(또는 `npm run build` 의 prebuild)가 `VITE_ADSENSE_CLIENT` 기준으로 다시 생성한다.
- **광고 단위(슬롯)**: 승인 후 AdSense 콘솔에서 광고 단위를 만들고 `VITE_ADSENSE_SLOT`(빌드 시) 또는 `public/ad-config.json`(빌드 없이)에 넣는다.
  값이 비어 있으면 `<ins>` 를 렌더하지 않고, `index.html` 의 자동 광고·소유권 스니펫만 동작한다.
- **네트워크 우선순위**: `VITE_AD_NETWORK` = `auto`(기본) → AdSense(게시자+슬롯) → AdFit(단위) 순으로 하나만 사용한다. 두 스크립트를 동시에 넣지 않는다.

### 빌드 없이 광고 설정 바꾸기 (`public/ad-config.json`)

```json
{ "adfitUnit": "DAN-xxxxx", "adfitWidth": 320, "adfitHeight": 100 }
```

`AdSlot` 이 마운트될 때 한 번 읽는다. 워크플로 시크릿을 건드리지 않고 애드핏 단위를 붙일 때 사용한다.

### 콘텐츠·SEO 산출물

`python3 pipeline/build_content.py` 가 `src/content/*.json` 하나로 앱 화면과 **자바스크립트 없이 읽히는 정적 페이지**를 함께 만든다.

| 생성물 | 내용 |
|---|---|
| `public/guides/<slug>.html` (8편) | 가이드 전문 + 표 + FAQ + 출처. Article 구조화 데이터 포함 |
| `public/guides/index.html` | 가이드 목록 |
| `public/about.html` | 서비스 소개·데이터 출처·편집 원칙·운영 문의 |
| `public/privacy.html` · `terms.html` | 개인정보처리방침(AdSense·애드핏 쿠키, 거부 방법 포함)·이용약관 |
| `public/sitemap.xml` · `robots.txt` | Googlebot · Mediapartners-Google · AdsBot-Google 허용, `/data/` 차단 |
| `public/ads.txt` | AdSense 게시자 인증 |

AdSense 심사에서 문제가 되는 ‘목록·외부 링크 위주’ 구성을 피하기 위해, 모든 가이드는 자체 작성 본문(편당 1,400~2,200 한글 자)과
기준일·출처를 갖는다. `pipeline/check_static.py` 가 가이드 수·본문 길이·정적 페이지 존재·방침 내 광고 고지를 검사한다.

---

## 6. 운영 체크리스트

- [ ] 첫 배포 후 `public/data/policies.json` 이 최신인지 확인 (`meta.json` 의 `generated_at`)
- [ ] `update-policies.yml` 수동 1회 실행해 커밋·재배포가 도는지 확인
- [ ] Supabase 프로젝트 생성 후 `schema.sql` 실행, 이메일 인증 정책 결정
- [x] 개인정보처리방침 문의 이메일(`sasolution.edu@gmail.com`) 교체
- [ ] AdSense 신청 전 개인정보·약관 페이지 링크 확인 (설정 → 약관)
- [ ] Play Console / App Store Connect 앱 등록, 스크린샷·개인정보 보호 양식 작성

## 7. 검증 (자체 테스트)

```bash
python3 pipeline/build_content.py     # 가이드·약관 정적 HTML + sitemap·robots·ads.txt 생성
python3 pipeline/check_static.py      # JSON/YAML 파싱 · 괄호 · import · 자산 · 데이터 일관성 · 콘텐츠
npx tsc --noEmit -p tsconfig.json     # TypeScript 타입 검사
npx vite build                        # 프로덕션 빌드
npx esbuild src/lib/matcher.ts --bundle --format=esm --outfile=pipeline/.cache/matcher.bundle.mjs
node pipeline/verify_matcher.mjs      # 7개 페르소나로 일치율 엔진 실데이터 검증
node pipeline/smoke_test.mjs          # jsdom 렌더 스모크 테스트
node pipeline/ui_flow_test.mjs        # 온보딩→추천→상세→체크리스트→저장함→둘러보기→설정 흐름
```

2026-11-18 재검증 결과: 정적 검사 **오류 0건**(경고 1건 — 12.9MB 데이터 규모), 타입 검사·빌드 통과,
jsdom 렌더 스모크 통과, 사용자 흐름 **11개 항목 전부 통과**.

> 이 환경에는 Node 가 기본 설치되어 있지 않아 검증 시 `PATH=/workspace/.local/node/bin:$PATH` 로 Node 20 을 사용했습니다.

## 8. 알려진 한계

- 태그는 제목·요약·공고 코드 기반 **자동 분류**입니다. 소득·재산·가구원 수 같은 세부 자격은 공고 원문 확인이 필요합니다.
- 가이드의 금액·기준은 작성 시점(2026-11-18) 고시·공고 기준입니다. 제도 변경 시 본문과 정적 페이지를 함께 갱신해야 합니다(`src/content/guides.json` 수정 후 `npm run content`).
- 광고 단위(슬롯) ID 를 넣기 전까지는 `<ins>` 슬롯이 렌더되지 않고, `index.html` 의 자동 광고·소유권 스니펫만 동작합니다.
- 복지로는 목록 API가 9건/페이지 고정이라 전체 수집에 시간이 걸립니다(청크 캐시로 완화).
- 지자체 공고는 동명 정책이 많아, 같은 제목이라도 지역이 다르면 별도 항목으로 유지합니다.
- 광고·Supabase는 설정 전까지 완전히 비활성이며, 그 상태에서도 앱 기능은 동일합니다.
