#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""정적 모의계산기 페이지(허브 + 3종)의 본문·스크립트.

build_content.py 가 page() 틀과 JSON-LD 를 붙여 public/calculators/*.html 로 저장한다.
계산 기준값은 src/lib/calculators.ts 와 동일하게 유지한다(2026-11-21 확인).
"""
from __future__ import annotations

CALC_CSS = """
.calc{background:#fff;border:1px solid #e6ece9;border-radius:16px;padding:16px 18px;margin:18px 0}
.calc h2{margin:0;font-size:15px;color:#0b1220}
.calc .calcrow{display:grid;gap:10px;margin-top:12px}
@media(min-width:640px){.calc .calcrow{grid-template-columns:1fr 1fr}}
.calc label{display:block;font-size:12px;font-weight:700;color:#33413c}
.calc label span.hint{display:block;font-size:11px;font-weight:500;color:#87958f;margin-top:3px}
.calc input,.calc select{width:100%;margin-top:4px;padding:9px 10px;border:1px solid #d8e3df;border-radius:10px;
  font-size:14px;font-family:inherit;background:#fff;color:#0b1220}
.calc input:focus,.calc select:focus{outline:2px solid #12b98d;outline-offset:1px;border-color:#12b98d}
.calc .chk{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:12.5px;font-weight:700;color:#33413c}
.calc .chk input{width:16px;height:16px;margin:0}
.out{margin-top:14px;background:#effaf4;border:1px solid #c8ecdb;border-radius:14px;padding:13px 15px}
.out .head{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 10px}
.out .head span{font-size:12px;font-weight:800;color:#0a5b48}
.out .big{font-size:22px;font-weight:800;color:#07402f;letter-spacing:-.02em;line-height:1.2}
.out .sub{font-size:11.5px;font-weight:600;color:#3f7a68}
.out .kv{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
.out .kv>div{background:#fff;border:1px solid #c8ecdb;border-radius:10px;padding:8px 10px}
.out .kv b{display:block;font-size:15px;color:#0b1220;letter-spacing:-.01em}
.out .kv em{display:block;font-size:10.5px;font-style:normal;font-weight:700;color:#6b7a75;margin-bottom:1px}
.out .kv i{display:block;font-size:10px;font-style:normal;color:#9aa8a3;margin-top:2px}
.out ul{list-style:none;padding:0;margin:10px 0 0}
.out ul li{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #e6ece9;border-radius:8px;
  padding:5px 9px;margin:4px 0;font-size:12px}
.out ul li .lb{flex:1;color:#33413c;font-weight:700}
.out ul li .lb em{font-style:normal;font-weight:600;color:#87958f;font-size:10.5px}
.out ul li b{font-size:11.5px;color:#33413c;white-space:nowrap}
.out ul li .df{font-size:10.5px;color:#87958f;min-width:64px;text-align:right}
.ok{color:#0a6b55;font-weight:800;font-size:11px;min-width:26px}
.no{color:#b3261e;font-weight:800;font-size:11px;min-width:26px}
.out p.sum{margin:10px 0 0;font-size:12px;line-height:1.7;color:#0a4a3a}
.calcnote{font-size:11.5px;line-height:1.7;color:#6b7a75;background:#f4f6f5;border-radius:10px;padding:9px 11px;margin:10px 0 0}
.faqbox dl{margin:6px 0 0}
"""

DISCLAIMER = (
    "※ 본 계산 결과는 2026년 고시 기준 참고용 모의계산이며, 실제 수급 여부와 최종 지급액은 "
    "복지로·고용24·국세청 홈택스 심사에 따릅니다."
)

SHARED_JS = """function calcWon(v){return Math.round(v).toLocaleString('ko-KR')+'원';}
function calcNum(id){var el=document.getElementById(id);if(!el)return 0;
  var v=parseInt(String(el.value).replace(/[^0-9]/g,''),10);return isNaN(v)?0:v;}
function calcBind(ids,fn){ids.forEach(function(id){var el=document.getElementById(id);if(!el)return;
  el.addEventListener('input',fn);el.addEventListener('change',fn);});fn();}
"""

MEDIAN_JS = """
(function(){
var MEDIAN={2026:[2564238,4199292,5359036,6494738,7556719,8555952,9515150],
            2027:[2736042,4480645,5718091,6929885,8063019,9129201,10152665]};
var BASE={metro:135000000,city:85000000,rural:72500000};
var TH=[["생계급여",32],["의료급여",40],["주거급여",48],["교육급여·차상위",50],["국민취업지원·청년월세",60],
        ["중위 100%",100],["국민취업지원(청년)",120],["중위 150%",150],["중위 180%",180]];
function med(y,n){var t=MEDIAN[y];return n<=7?t[n-1]:t[6]+(t[6]-t[5])*(n-7);}
function run(){
  var h=calcNum('mn-house')||1;
  var income=calcNum('mn-income');
  var asset=calcNum('mn-asset');
  var region=document.getElementById('mn-region').value;
  var m26=med(2026,h), m27=med(2027,h);
  var base=BASE[region]||BASE.metro;
  var assetIncome=Math.max(0,Math.round((Math.max(0,asset-base)*0.04)/12));
  var recognized=income+assetIncome;
  var ratio=(recognized/m26)*100, ratio27=(recognized/m27)*100;
  var rows='', pitched=[];
  TH.forEach(function(item){
    var limit=Math.floor(m26*item[1]/100);
    var pass=recognized<=limit;
    var diff=Math.abs(recognized-limit);
    if(pass&&item[1]<=100)pitched.push(item[0]);
    rows+='<li><span class="'+(pass?'ok':'no')+'">'+(pass?'통과':'미달')+'</span>'+
      '<span class="lb">'+item[0]+' <em>중위 '+item[1]+'%</em></span>'+
      '<b>'+calcWon(limit)+'</b><span class="df">'+(pass?'-':'+')+calcWon(diff).replace('원','')+'</span></li>';
  });
  var sum=pitched.length
    ? '이 소득·재산이면 '+pitched.join(' · ')+' 기준선 안에 들어옵니다. 실제 판정은 소득인정액을 정밀 계산해 이뤄집니다.'
    : '중위 100% 기준선도 넘습니다. 청년·다자녀·사업자용 완화 기준이 있는지 공고문에서 확인해 보세요.';
  document.getElementById('mn-out').innerHTML=
    '<div class="head"><span>2026년 '+h+'인 가구 기준</span><strong class="big">'+calcWon(m26)+'</strong>'+
    '<span class="sub">/월 · 2027년 '+calcWon(m27)+'</span></div>'+
    '<div class="kv"><div><em>소득인정액(간이)</em><b>'+calcWon(recognized)+'</b><i>재산 환산 '+calcWon(assetIncome)+' 포함</i></div>'+
    '<div><em>2026 기준중위소득 대비</em><b>'+ratio.toFixed(1)+'%</b><i>2027년 기준으로는 '+ratio27.toFixed(1)+'%</i></div></div>'+
    '<ul>'+rows+'</ul><p class="sum">'+sum+'</p>';
}
calcBind(['mn-house','mn-income','mn-asset','mn-region'],run);
})();
"""

UNEMPLOYMENT_JS = """
(function(){
var DAYS={lt1:[120,120],'1to3':[150,180],'3to5':[180,210],'5to10':[210,240],gte10:[240,270]};
var MAXD=68100, HOURLY=10320;
function run(){
  var wage=calcNum('ub-wage');
  var age=calcNum('ub-age');
  var band=document.getElementById('ub-band').value;
  var hours=parseInt(document.getElementById('ub-hours').value,10)||8;
  var disabled=document.getElementById('ub-disabled').checked;
  var baseDaily=Math.round(wage/30);
  var rawDaily=Math.round(baseDaily*0.6);
  var minDaily=Math.round(HOURLY*hours*0.8);
  var daily=rawDaily, kind='none', limitValue=0;
  if(rawDaily>MAXD){daily=MAXD;kind='max';limitValue=MAXD;}
  else if(rawDaily<minDaily){daily=minDaily;kind='min';limitValue=minDaily;}
  var high=age>=50||disabled;
  var days=(DAYS[band]||DAYS.lt1)[high?1:0];
  var total=daily*days, monthly=daily*30;
  var label=kind==='max'?'상한액 적용':(kind==='min'?'하한액 적용':'상·하한 안쪽(평균임금 60%)');
  document.getElementById('ub-out').innerHTML=
    '<div class="head"><span>1일 구직급여</span><strong class="big">'+calcWon(daily)+'</strong>'+
    '<span class="sub">'+label+'</span></div>'+
    '<div class="kv"><div><em>소정급여일수</em><b>'+days+'일</b><i>'+(high?'50세 이상·장애인 기준':'50세 미만 기준')+'</i></div>'+
    '<div><em>예상 총 수령액</em><b>'+calcWon(total)+'</b><i>월 환산(30일) '+calcWon(monthly)+'</i></div></div>'+
    '<p class="sum">기초일액(평균임금 일액) '+calcWon(baseDaily)+' × 60% = '+calcWon(rawDaily)+
    '. 실제 지급은 실업인정(1~4주)마다 이뤄지고, 7일 대기기간과 미인정일은 빠집니다.</p>';
}
calcBind(['ub-wage','ub-age','ub-band','ub-hours','ub-disabled'],run);
})();
"""

EITC_JS = """
(function(){
var PARAM={single:{max:1650000,fs:4000000,fe:9000000,cap:22000000},
           singleEarner:{max:2850000,fs:7000000,fe:14000000,cap:32000000},
           dual:{max:3300000,fs:8000000,fe:17000000,cap:44000000}};
var CHILD_CAP=70000000, CHILD_MAX=1000000, CHILD_MIN=500000, FULL={singleEarner:21000000,dual:25000000,single:0};
function baseEitc(x,p){
  if(x<=0||x>=p.cap)return 0;
  if(x<p.fs)return Math.round(p.max*x/p.fs);
  if(x<=p.fe)return p.max;
  return Math.round(p.max*(1-(x-p.fe)/(p.cap-p.fe)));
}
function childCredit(x,n,type){
  if(n<=0||type==='single'||x>=CHILD_CAP)return 0;
  var full=FULL[type], per;
  if(x<=full){per=CHILD_MAX;}
  else{per=Math.round(CHILD_MAX-(CHILD_MAX-CHILD_MIN)*(x-full)/(CHILD_CAP-full));}
  return per*n;
}
function run(){
  var type=document.getElementById('et-type').value;
  var income=calcNum('et-income');
  var children=calcNum('et-children');
  var band=document.getElementById('et-asset').value;
  var p=PARAM[type]||PARAM.single;
  var factor=band==='over'?0:(band==='mid'?0.5:1);
  var e=baseEitc(income,p);
  if(e>0&&e<30000)e=30000;
  var c=childCredit(income,children,type);
  var re=Math.round(e*factor), rc=Math.round(c*factor);
  var le=Math.round(re*0.95), lc=Math.round(rc*0.95);
  var flag=factor===0.5?'<span class="no">재산 50% 감액</span>':(factor===0?'<span class="no">재산 2.4억 이상 — 제외</span>':'');
  var childNote=type==='single'?'단독가구는 대상 아님':('산정액 '+calcWon(c)+' ('+children+'명)');
  var sum=factor===0?'재산 합계가 2억 4,000만 원 이상이면 근로·자녀장려금 대상에서 제외됩니다.'
    :((re+rc)===0?'총급여가 소득상한('+calcWon(p.cap)+')을 넘어 근로장려금은 0원입니다. 자녀장려금은 총소득 7,000만 원 미만이면 별도로 받을 수 있습니다.'
    :'자녀장려금은 총소득 7,000만 원 미만이면 근로장려금과 별개로 지급됩니다(자녀 1인당 50만~100만 원).');
  document.getElementById('et-out').innerHTML=
    '<div class="head"><span>정기신청 예상 합계</span><strong class="big">'+calcWon(re+rc)+'</strong>'+flag+'</div>'+
    '<div class="kv"><div><em>근로장려금</em><b>'+calcWon(re)+'</b><i>산정액 '+calcWon(e)+'</i></div>'+
    '<div><em>자녀장려금</em><b>'+calcWon(rc)+'</b><i>'+childNote+'</i></div></div>'+
    '<div class="kv"><div><em>기한 후 신청(12.1까지)</em><b>'+calcWon(le+lc)+'</b><i>5% 감액 · 다음 해 1월 지급</i></div>'+
    '<div><em>소득상한</em><b>'+calcWon(p.cap)+'</b><i>부부합산 총급여 기준</i></div></div>'+
    '<p class="sum">'+sum+'</p>';
}
calcBind(['et-type','et-income','et-children','et-asset'],run);
})();
"""

JS_BY_SLUG = {
    "median-income": MEDIAN_JS,
    "unemployment-benefit": UNEMPLOYMENT_JS,
    "eitc": EITC_JS,
}

# 계산기 페이지에서 연결하는 가이드 제목(정적 링크 텍스트용)
GUIDE_TITLES = {
    "median-income": "기준중위소득·소득분위 계산법 (2026~2027)",
    "housing-benefits": "주거급여·청년월세·전세자금 비교",
    "unemployment-benefit": "2026 실업급여 조건·수령액·신청 절차",
    "national-employment-support": "2026 국민취업지원제도 구직촉진수당",
    "earned-income-tax-credit": "2026 근로장려금·자녀장려금 총정리",
    "rejection-reasons": "지원금 신청이 탈락하는 10가지 이유",
}


def _script(slug: str) -> str:
    return "<script>\n" + SHARED_JS + JS_BY_SLUG[slug] + "</script>\n"


# ------------------------------------------------------------------ 기준값 표
MEDIAN_TABLE = """
<table><caption>가구원 수별 기준중위소득 (단위: 원/월)</caption>
<thead><tr><th>가구원 수</th><th>2026년</th><th>2027년</th></tr></thead>
<tbody>
<tr><td>1인</td><td>2,564,238</td><td>2,736,042</td></tr>
<tr><td>2인</td><td>4,199,292</td><td>4,480,645</td></tr>
<tr><td>3인</td><td>5,359,036</td><td>5,718,091</td></tr>
<tr><td>4인</td><td>6,494,738</td><td>6,929,885</td></tr>
<tr><td>5인</td><td>7,556,719</td><td>8,063,019</td></tr>
<tr><td>6인</td><td>8,555,952</td><td>9,129,201</td></tr>
<tr><td>7인</td><td>9,515,150</td><td>10,152,665</td></tr>
</tbody></table>
<p class="note">8인 이상은 7인 가구 값에 (7인 − 6인) 차액을 1명마다 더해 산정합니다. 2027년 값은 보건복지부 고시
제2026-157호(2026.7.29., 2027.1.1. 시행)로 확정된 금액입니다.</p>
"""

BENEFIT_TABLE = """
<table><caption>2026년 급여별 선정기준 (단위: 원/월)</caption>
<thead><tr><th>구분</th><th>1인 가구</th><th>4인 가구</th><th>기준</th></tr></thead>
<tbody>
<tr><td>생계급여</td><td>820,556</td><td>2,078,316</td><td>중위 32%</td></tr>
<tr><td>의료급여</td><td>1,025,695</td><td>2,597,895</td><td>중위 40%</td></tr>
<tr><td>주거급여</td><td>1,230,834</td><td>3,117,474</td><td>중위 48%</td></tr>
<tr><td>교육급여</td><td>1,282,119</td><td>3,247,369</td><td>중위 50%</td></tr>
</tbody></table>
"""

UNEMP_TABLE = """
<table><caption>2026년 구직급여일액 기준 (2026.1.1. 이후 이직자)</caption>
<thead><tr><th>구분</th><th>금액</th><th>정하는 방식</th></tr></thead>
<tbody>
<tr><td>상한액</td><td>1일 68,100원</td><td>급여기초임금일액 113,500원 × 60%</td></tr>
<tr><td>하한액(8시간)</td><td>1일 66,048원</td><td>최저임금 10,320원 × 8시간 × 80%</td></tr>
<tr><td>하한액(4시간)</td><td>1일 33,024원</td><td>최저임금 10,320원 × 4시간 × 80%</td></tr>
<tr><td>30일 환산</td><td>1,981,440 ~ 2,043,000원</td><td>상·하한을 30일로 환산</td></tr>
</tbody></table>
<p class="note">2025년 12월 31일 이전 이직자는 상한 66,000원(급여기초임금일액 11만 원)이 적용됩니다.</p>
"""

DAYS_TABLE = """
<table><caption>연령·가입기간별 소정급여일수</caption>
<thead><tr><th>고용보험 가입기간</th><th>50세 미만</th><th>50세 이상·장애인</th></tr></thead>
<tbody>
<tr><td>1년 미만</td><td>120일</td><td>120일</td></tr>
<tr><td>1년 이상 ~ 3년 미만</td><td>150일</td><td>180일</td></tr>
<tr><td>3년 이상 ~ 5년 미만</td><td>180일</td><td>210일</td></tr>
<tr><td>5년 이상 ~ 10년 미만</td><td>210일</td><td>240일</td></tr>
<tr><td>10년 이상</td><td>240일</td><td>270일</td></tr>
</tbody></table>
"""

EITC_TABLE = """
<table><caption>2025년 귀속(2026년 신청) 근로장려금 소득요건·최대 지급액</caption>
<thead><tr><th>가구 유형</th><th>부부합산 총소득</th><th>최대 지급액</th></tr></thead>
<tbody>
<tr><td>단독가구</td><td>2,200만 원 미만</td><td>165만 원</td></tr>
<tr><td>홑벌이가구</td><td>3,200만 원 미만</td><td>285만 원</td></tr>
<tr><td>맞벌이가구</td><td>4,400만 원 미만</td><td>330만 원</td></tr>
</tbody></table>
<p class="note">자녀장려금은 18세 미만 부양자녀가 있는 홑벌이·맞벌이 가구가 대상이며, 부부합산 총소득 7,000만 원
미만이면 신청할 수 있습니다. 지급액은 자녀 1인당 최소 50만 원에서 최대 100만 원입니다.</p>
"""

ASSET_TABLE = """
<table><caption>재산 요건 (2025년 6월 1일 기준, 부채 차감 없음)</caption>
<thead><tr><th>가구원 전체 재산 합계</th><th>지급 비율</th></tr></thead>
<tbody>
<tr><td>1억 7,000만 원 미만</td><td>산정액 100%</td></tr>
<tr><td>1억 7,000만 원 이상 ~ 2억 4,000만 원 미만</td><td>산정액 50%</td></tr>
<tr><td>2억 4,000만 원 이상</td><td>대상 제외</td></tr>
</tbody></table>
"""

SCHEDULE_TABLE = """
<table><caption>2025년 귀속분 신청·지급 일정</caption>
<thead><tr><th>구분</th><th>신청 기간</th><th>지급 비율</th><th>지급 시기</th></tr></thead>
<tbody>
<tr><td>정기신청</td><td>2026년 5월 1일 ~ 6월 1일</td><td>산정액 100%</td><td>2026년 8월 27일</td></tr>
<tr><td>기한 후 신청</td><td>2026년 12월 1일(화)까지</td><td>산정액 95%</td><td>2027년 1월 15일 예정</td></tr>
</tbody></table>
"""

# ------------------------------------------------------------------ 페이지 정의
CALC_META: dict[str, dict] = {
    "median-income": {
        "slug": "median-income",
        "title": "2026 기준중위소득 계산기 — 내 소득은 몇 %인가 | 보조금 레이더",
        "h1": "2026 기준중위소득 계산기 — 내 소득은 몇 %인가",
        "description": "가구원 수와 월 소득·재산을 넣으면 2026·2027년 기준중위소득 대비 비율과 생계·의료·주거·교육급여 기준선 통과 여부를 바로 계산합니다. 회원가입 없이 무료.",
        "keyword": "2026 기준중위소득 계산기, 중위소득 60%, 생계급여 32%, 소득인정액 계산",
        "short": "중위소득 계산기",
        "related_guides": ["median-income", "housing-benefits"],
        "related_hubs": [("low-income", "저소득·생계 지원 모음"), ("youth", "청년 지원금 모음"), ("housing", "주거 보조금 모음")],
        "app": "#/calculators/median-income",
    },
    "unemployment-benefit": {
        "slug": "unemployment-benefit",
        "title": "2026 실업급여(구직급여) 계산기 — 1일 급여·수령일수 | 보조금 레이더",
        "h1": "2026 실업급여(구직급여) 계산기",
        "description": "퇴직 전 3개월 평균 월급과 나이·고용보험 가입기간으로 2026년 1일 구직급여(상한 68,100원·하한 66,048원)와 소정급여일수, 예상 총 수령액을 계산합니다.",
        "keyword": "2026 실업급여 계산기, 구직급여 계산, 실업급여 상한 68100, 소정급여일수",
        "short": "실업급여 계산기",
        "related_guides": ["unemployment-benefit", "national-employment-support"],
        "related_hubs": [("employment", "취업·구직 보조금 모음"), ("finance", "생활·금융·긴급복지")],
        "app": "#/calculators/unemployment-benefit",
    },
    "eitc": {
        "slug": "eitc",
        "title": "2026 근로장려금·자녀장려금 계산기 — 예상 지급액 | 보조금 레이더",
        "h1": "2026 근로장려금·자녀장려금 계산기",
        "description": "가구 유형과 부부합산 총급여, 부양자녀 수, 재산 구간으로 근로장려금·자녀장려금 예상액을 계산합니다. 재산 50% 감액과 기한 후 신청 5% 감액을 함께 비교합니다.",
        "keyword": "근로장려금 계산기, 2026 근로장려금, 자녀장려금 계산, 맞벌이 근로장려금 소득상한",
        "short": "근로장려금 계산기",
        "related_guides": ["earned-income-tax-credit", "rejection-reasons"],
        "related_hubs": [("finance", "생활·금융·긴급복지"), ("self-employed", "자영업·소상공인 지원금")],
        "app": "#/calculators/eitc",
    },
}

CALC_FAQS: dict[str, list[dict]] = {
    "median-income": [
        {
            "q": "기준중위소득 60% 이하라는 말은 무슨 뜻인가요?",
            "a": "그 해 기준중위소득 금액에 0.6을 곱한 금액 이하라는 뜻입니다. 2026년 3인 가구라면 5,359,036원의 60%인 3,215,421원이 기준선이 됩니다. 공고의 기준은 대개 소득인정액과 비교하며, 통장에 찍히는 소득만 보지 않습니다.",
        },
        {
            "q": "이 계산기의 소득인정액과 실제 심사 결과가 다른 이유는 무엇인가요?",
            "a": "이 계산기는 월 소득에 재산의 월 소득환산액만 더한 간이 방식입니다. 실제 기초생활보장 심사에서는 근로소득공제(30%)와 가구특성별 지출비용이 추가로 차감되고, 금융재산 2,000만 원 공제·부채 차감·자동차 환산이 반영됩니다. 그래서 실제 소득인정액이 계산값보다 낮게 나오는 경우가 많습니다.",
        },
        {
            "q": "2027년 기준으로는 왜 비율이 달라지나요?",
            "a": "기준중위소득이 매년 인상되기 때문입니다. 2027년 4인 가구 기준중위소득은 2026년보다 6.7% 오른 6,929,885원으로, 같은 소득이라도 비율은 낮아집니다. 다만 급여별 선정기준 금액도 함께 오르므로, 해가 바뀔 때는 두 해 기준을 함께 확인하는 것이 안전합니다.",
        },
        {
            "q": "재산이 있으면 무조건 탈락인가요?",
            "a": "아닙니다. 지역별 기본재산액(대도시 1억 3,500만 원, 중소도시 8,500만 원, 농어촌 7,250만 원)까지는 공제되고, 남는 금액에 연 4%를 적용해 12개월로 나눈 금액만 월 소득에 더해집니다. 전세보증금 5,000만 원은 대도시 기준 전액 공제됩니다.",
        },
    ],
    "unemployment-benefit": [
        {
            "q": "2026년 실업급여 상한액이 66,000원이라는 말도 있던데요?",
            "a": "66,000원은 2025년 12월 31일 이전에 이직한 사람에게 적용되는 종전 상한입니다. 2026년 최저임금 인상으로 하한액(66,048원)이 기존 상한액보다 높아지면서, 2025년 12월 시행령 개정으로 2026년 1월 1일 이후 이직자의 상한액은 1일 68,100원(급여기초임금일액 113,500원)으로 올랐습니다.",
        },
        {
            "q": "월급이 높으면 실업급여도 많이 받나요?",
            "a": "상한액 때문에 차이가 크지 않습니다. 2026년 기준으로 1일 68,100원이 최대이므로, 월 환산(30일)으로는 약 204만 원이 상한입니다. 반대로 월급이 낮아도 하한액(하루 8시간 기준 66,048원)이 적용되어 월 198만 원 수준이 보장됩니다.",
        },
        {
            "q": "계산된 총액을 한 번에 받을 수 있나요?",
            "a": "아닙니다. 실업급여는 1~4주 단위로 실업인정을 받은 뒤 그 기간만큼 지급됩니다. 수급기간은 이직일 다음 날부터 12개월이고, 7일의 대기기간과 구직활동이 인정되지 않은 날은 지급되지 않습니다. 계산기의 총액은 최대 수령 가능액입니다.",
        },
        {
            "q": "고용보험에 가입한 기간이 여러 직장으로 나뉘어 있어도 되나요?",
            "a": "됩니다. 이직일 이전 18개월 동안의 피보험 단위기간을 합산해 180일 이상이면 기간 요건을 충족합니다. 다만 고용보험에 가입되지 않은 단기 근무는 합산되지 않으므로, 고용24의 피보험자격 이력 조회로 실제 합계를 먼저 확인하세요.",
        },
    ],
    "eitc": [
        {
            "q": "2026년에 신청하는 근로장려금은 어느 해 소득인가요?",
            "a": "2025년 귀속분입니다. 근로장려금은 소득이 발생한 다음 해에 신청합니다. 2026년 5월 1일~6월 1일 정기신청(2026년 8월 27일 지급)을 놓쳤다면 2026년 12월 1일까지 기한 후 신청할 수 있고, 이 경우 산정액의 95%가 2027년 1월 15일에 지급됩니다.",
        },
        {
            "q": "맞벌이 소득상한이 올라간다는 이야기가 있던데요?",
            "a": "2026년 세법개정안에 2027년 귀속분(2027년 신청)부터 맞벌이 소득상한을 4,400만 원에서 5,200만 원으로, 최대 지급액을 330만 원에서 360만 원으로 올리는 내용이 담겨 있습니다. 단독(2,600만 원·180만 원), 홑벌이(3,700만 원·310만 원)도 함께 확대됩니다. 확정 전까지는 현행 기준으로 판단하세요.",
        },
        {
            "q": "근로장려금은 탈락인데 자녀장려금은 받을 수 있나요?",
            "a": "가능합니다. 자녀장려금은 총소득 7,000만 원 미만이면 대상이 되므로, 근로장려금 소득상한(단독 2,200만·홑벌이 3,200만·맞벌이 4,400만 원)을 넘는 가구도 자녀장려금은 받을 수 있습니다. 두 제도는 한 번의 신청으로 함께 심사됩니다.",
        },
        {
            "q": "재산이 1억 7,000만 원을 넘으면 얼마나 줄어드나요?",
            "a": "산정된 지급액의 50%만 지급됩니다. 2억 4,000만 원 이상이면 아예 대상에서 제외됩니다. 재산은 2025년 6월 1일 기준으로 가구원 전체 합계를 보며, 전세보증금 반환 채무나 담보대출 같은 부채는 차감하지 않습니다.",
        },
    ],
}


def _calculator_form(slug: str) -> str:
    if slug == "median-income":
        options = "".join(
            f'<option value="{n}"{" selected" if n == 3 else ""}>{n}인 가구</option>' for n in range(1, 11)
        )
        return f"""
<form class="calc" id="mn-form" onsubmit="return false">
  <h2>📊 내 조건으로 계산하기</h2>
  <div class="calcrow">
    <label>가구원 수<span class="hint">주민등록등본상 생계·주거를 함께 하는 사람</span>
      <select id="mn-house">{options}</select></label>
    <label>월 세전소득 (원)<span class="hint">근로·사업소득 합계, 4대보험·세금 떼기 전</span>
      <input type="number" id="mn-income" value="3000000" min="0" step="10000" inputmode="numeric" /></label>
    <label>일반재산 (원, 선택)<span class="hint">전세보증금·집·토지 등. 모르면 비워 두세요</span>
      <input type="number" id="mn-asset" value="" min="0" step="1000000" inputmode="numeric" placeholder="예: 50000000" /></label>
    <label>지역 구분<span class="hint">기본재산액 공제: 대도시 1억 3,500만 · 중소도시 8,500만 · 농어촌 7,250만 원</span>
      <select id="mn-region">
        <option value="metro">대도시 (특별시·광역시 구, 특례시)</option>
        <option value="city">중소도시 (도의 시, 세종)</option>
        <option value="rural">농어촌 (도의 군)</option>
      </select></label>
  </div>
  <div class="out" id="mn-out"></div>
  <p class="calcnote">{DISCLAIMER}<br />
  소득인정액(간이) = 월 소득 + max(0, 일반재산 − 기본재산액) × 4% ÷ 12. 실제 심사에서는 근로소득공제와 가구특성별
  지출비용이 추가로 차감되어 소득인정액이 더 낮게 산정될 수 있습니다.</p>
</form>
{_script(slug)}
"""
    if slug == "unemployment-benefit":
        return f"""
<form class="calc" id="ub-form" onsubmit="return false">
  <h2>🧾 내 조건으로 계산하기</h2>
  <div class="calcrow">
    <label>퇴직 전 3개월 평균 월급 (원)<span class="hint">세전 기준, 상여금 포함 임금총액</span>
      <input type="number" id="ub-wage" value="3000000" min="0" step="10000" inputmode="numeric" /></label>
    <label>만 나이<span class="hint">이직일(마지막 근로일) 기준</span>
      <input type="number" id="ub-age" value="34" min="15" max="80" step="1" inputmode="numeric" /></label>
    <label>고용보험 가입기간
      <select id="ub-band">
        <option value="lt1">1년 미만</option>
        <option value="1to3">1년 이상 ~ 3년 미만</option>
        <option value="3to5" selected>3년 이상 ~ 5년 미만</option>
        <option value="5to10">5년 이상 ~ 10년 미만</option>
        <option value="gte10">10년 이상</option>
      </select></label>
    <label>1일 소정근로시간<span class="hint">마지막 사업장 기준. 하한액이 시간에 비례합니다</span>
      <select id="ub-hours">
        <option value="8" selected>하루 8시간</option>
        <option value="7">하루 7시간</option>
        <option value="6">하루 6시간</option>
        <option value="5">하루 5시간</option>
        <option value="4">하루 4시간</option>
      </select></label>
  </div>
  <label class="chk"><input type="checkbox" id="ub-disabled" /> 장애인 (50세 이상과 같은 소정급여일수 적용)</label>
  <div class="out" id="ub-out"></div>
  <p class="calcnote">{DISCLAIMER}<br />
  기초일액은 편의상 ‘월평균임금 ÷ 30’으로 계산했습니다. 실제로는 이직 전 3개월 임금총액을 그 기간 총일수(89~92일)로
  나누므로 하루 1,000~2,000원 차이가 날 수 있습니다.</p>
</form>
{_script(slug)}
"""
    return f"""
<form class="calc" id="et-form" onsubmit="return false">
  <h2>💸 내 조건으로 계산하기</h2>
  <div class="calcrow">
    <label>가구 유형<span class="hint">단독 2,200만 · 홑벌이 3,200만 · 맞벌이 4,400만 원 미만</span>
      <select id="et-type">
        <option value="single">단독가구 (배우자·부양자녀 없음)</option>
        <option value="singleEarner" selected>홑벌이가구</option>
        <option value="dual">맞벌이가구</option>
      </select></label>
    <label>부부합산 연간 총급여 (원)<span class="hint">근로·사업소득 합계(비과세 제외)</span>
      <input type="number" id="et-income" value="20000000" min="0" step="1000000" inputmode="numeric" /></label>
    <label>18세 미만 부양자녀 수<span class="hint">자녀장려금은 1인당 50만~100만 원</span>
      <input type="number" id="et-children" value="1" min="0" max="10" step="1" inputmode="numeric" /></label>
    <label>가구원 합산 재산<span class="hint">2025년 6월 1일 기준 · 부채는 차감하지 않음</span>
      <select id="et-asset">
        <option value="under" selected>1억 7,000만 원 미만</option>
        <option value="mid">1억 7,000만 ~ 2억 4,000만 원 (50% 감액)</option>
        <option value="over">2억 4,000만 원 이상 (대상 제외)</option>
      </select></label>
  </div>
  <div class="out" id="et-out"></div>
  <p class="calcnote">{DISCLAIMER}<br />
  근로장려금은 점증·평탄·점감 구간으로 계산합니다. 2025년 귀속 기준 최대 지급액은 단독 165만·홑벌이 285만·맞벌이
  330만 원이고, 맞벌이 최대 지급 구간은 800만~1,700만 원입니다.</p>
</form>
{_script(slug)}
"""


def _related_html(meta: dict) -> str:
    guides = "".join(
        f'<li><a href="../guides/{slug}.html">{GUIDE_TITLES.get(slug, slug)}</a></li>'
        for slug in meta["related_guides"]
    )
    hubs = "".join(f'<li><a href="../categories/{slug}.html">{label}</a></li>' for slug, label in meta["related_hubs"])
    return (
        '<section class="card"><h2>함께 보면 좋은 자료</h2>'
        f"<ul>{guides}{hubs}"
        f'<li><a href="../index.html{meta["app"]}">앱에서 같은 계산기 열기</a></li></ul></section>'
    )


def calc_body(slug: str) -> str:
    meta = CALC_META[slug]
    faqs = CALC_FAQS[slug]
    dl = "".join(f"<dt>Q. {item['q']}</dt><dd>{item['a']}</dd>" for item in faqs)
    head = (
        '<p><a href="./">← 계산기 3종</a></p>'
        '<p><span class="cat">모의계산기</span></p>'
        f"<h1>{meta['h1']}</h1>"
        f'<p class="lead">{meta["description"]}</p>'
        '<p class="meta">기준 확인일 2026-11-21 · 보조금 레이더 편집 · 회원가입 없이 무료</p>'
    )
    form = _calculator_form(slug)
    tail = f'<section class="card faqbox"><h2>자주 묻는 질문</h2><dl class="dl">{dl}</dl></section>'
    tail += _related_html(meta)
    tail += (
        '<div class="cta"><strong>계산이 끝났다면, 받을 수 있는 공고를 확인하세요</strong>'
        '<p class="meta" style="color:#c8d3cf">나이·직군·가구 상황·지역을 넣으면 일치율 순으로 정리됩니다. 로그인 없이 이용할 수 있습니다.</p>'
        '<a href="../index.html#/home">내 조건으로 공고 찾기</a></div>'
    )

    if slug == "median-income":
        mid = (
            "<h2>2026년·2027년 기준중위소득</h2>"
            + MEDIAN_TABLE
            + "<h2>급여별 선정기준은 몇 %인가</h2>"
            + BENEFIT_TABLE
            + "<h2>소득인정액은 이렇게 계산한다</h2>"
            "<ul>"
            "<li>1단계 — 가구원 수를 확정합니다. 주민등록등본상 생계와 주거를 함께 하는 사람이 기준입니다.</li>"
            "<li>2단계 — 그 가구원 수의 기준중위소득에 공고의 %를 곱해 내 기준선을 구합니다.</li>"
            "<li>3단계 — 소득인정액 = 소득평가액 + 재산의 소득환산액. 소득평가액은 실제소득에서 근로소득공제와 가구특성별 지출비용을 뺀 값입니다.</li>"
            "<li>4단계 — 재산의 소득환산액 = [(재산 − 기본재산액 − 부채) × 연 4%] ÷ 12개월. 금융재산은 2,000만 원까지 공제합니다.</li>"
            "</ul>"
            '<p class="note">기준중위소득은 2026년 현재 15개 부처 80여 개 사업의 선정기준으로 쓰입니다. 사업마다 적용 비율이 달라, 같은 소득으로 어떤 사업은 통과하고 어떤 사업은 미달합니다.</p>'
            "<h2>예시로 확인하기</h2>"
            "<p>대도시 1인 가구, 월 근로소득 200만 원, 전세보증금 5,000만 원, 금융재산 500만 원이라면 보증금은 기본재산액(1억 3,500만 원) 안에 들어 전액 공제되어 재산 환산액이 0원입니다. 근로소득공제를 반영하면 소득인정액은 대략 중위 60%(1,538,543원)를 조금 넘는 수준이 되어 청년월세 같은 60% 기준 사업과는 경계에 서게 됩니다.</p>"
        )
    elif slug == "unemployment-benefit":
        mid = (
            "<h2>2026년 하루 얼마를 받나</h2>"
            + UNEMP_TABLE
            + "<h2>며칠을 받는지는 나이와 가입기간이 정한다</h2>"
            + DAYS_TABLE
            + "<h2>수급 자격은 세 가지를 함께 본다</h2>"
            "<ul>"
            "<li>이직일 이전 18개월 중 피보험 단위기간이 통산 180일 이상</li>"
            "<li>이직 사유가 비자발적(권고사직·계약만료·정리해고 등) 또는 정당한 사유</li>"
            "<li>근로 의사와 능력이 있는데 취업하지 못한 상태에서 적극적으로 구직</li>"
            "</ul>"
            '<p class="note">2026년 9월 고용보험위원회는 구직급여를 무급휴일을 제외한 주 6일 기준으로 지급하고 상한액을 하한액의 103%에 연동하는 개편 방안을 냈습니다. 법령 개정이 필요한 확정 전 방안이므로, 실제 적용 여부는 고용노동부 발표를 확인하세요.</p>'
            "<h2>계산 예시</h2>"
            "<p>만 34세, 가입기간 4년, 평균 월급 300만 원이라면 기초일액 10만 원의 60%는 6만 원이지만 하한액 66,048원이 적용됩니다. 소정급여일수는 180일이므로 총 11,888,640원, 월 환산 1,981,440원입니다. 같은 조건에서 월급이 450만 원이면 상한액 68,100원이 적용되어 총 12,258,000원으로, 차이는 37만 원 남짓입니다.</p>"
        )
    else:
        mid = (
            "<h2>2026년 신청분(2025년 귀속) 소득요건과 최대 지급액</h2>"
            + EITC_TABLE
            + "<h2>재산 요건</h2>"
            + ASSET_TABLE
            + "<h2>신청 일정</h2>"
            + SCHEDULE_TABLE
            + "<h2>계산 구조를 알면 예상액이 보인다</h2>"
            "<p>근로장려금은 총급여액 등에 따라 점증·평탄·점감 세 구간으로 계산합니다. 단독가구는 400만~900만 원 구간에서 최대 165만 원을 받고, 그 아래는 비례해 늘고 위로는 상한(2,200만 원)까지 비례해 줄어듭니다. 홑벌이는 700만~1,400만 원, 맞벌이는 800만~1,700만 원이 최대 지급 구간입니다.</p>"
            '<p class="note">산정액이 3만 원보다 적으면 최소 3만 원이 지급됩니다. 지급액은 국세청이 소득·재산 자료를 심사해 확정하므로, 이 계산기의 예상액과 다를 수 있습니다.</p>'
            "<h2>2027년 귀속분은 기준이 올라간다</h2>"
            "<p>2026년 세법개정안에는 2027년 귀속분부터 단독 2,600만 원·180만 원, 홑벌이 3,700만 원·310만 원, 맞벌이 5,200만 원·360만 원으로 소득상한과 최대 지급액을 올리는 내용이 담겨 있습니다. 국회 논의를 거치는 단계이므로 확정 전까지는 현행 기준으로 판단하세요.</p>"
        )

    return "\n".join([head, form, mid, tail])


def hub_body() -> str:
    cards = []
    for slug, meta in CALC_META.items():
        cards.append(
            f'<a class="gitem" href="./{slug}.html"><em>{meta["short"]}</em>'
            f'<strong>{meta["h1"]}</strong><span>{meta["description"]}</span></a>'
        )
    return (
        '<p><a href="../index.html">← 보조금 레이더 홈</a></p>'
        '<p><span class="cat">Calculators</span></p>'
        "<h1>보조금 모의계산기 3종</h1>"
        '<p class="lead">내 숫자를 넣으면 얼마를 받을 수 있는지 바로 확인하는 계산기입니다. 로그인·회원가입 없이 쓸 수 있고, '
        '입력값은 서버로 전송되지 않습니다. 모든 결과는 2026년 고시 기준 참고용이며 최종 판정은 담당 기관 심사로 확정됩니다.</p>'
        f'<div class="grid">{"".join(cards)}</div>'
        "<h2>계산에 쓴 2026년 기준값</h2>"
        "<ul>"
        "<li>기준중위소득 — 3인 5,359,036원 · 4인 6,494,738원(2027년 4인 6,929,885원)</li>"
        "<li>기본재산액 — 대도시 1억 3,500만 원 · 중소도시 8,500만 원 · 농어촌 7,250만 원</li>"
        "<li>구직급여 — 상한 1일 68,100원 · 하한 최저임금 10,320원의 80%(8시간 기준 66,048원)</li>"
        "<li>근로장려금 — 최대 단독 165만 · 홑벌이 285만 · 맞벌이 330만 원(2025년 귀속)</li>"
        "</ul>"
        "<h2>계산기별로 알 수 있는 것</h2>"
        "<table><caption>세 계산기의 입력과 결과</caption>"
        "<thead><tr><th>계산기</th><th>입력</th><th>결과</th></tr></thead><tbody>"
        "<tr><td>기준중위소득</td><td>가구원 수·월 소득·재산·지역</td><td>중위 대비 %, 급여별 기준선 통과 여부</td></tr>"
        "<tr><td>실업급여</td><td>평균 월급·나이·가입기간·근로시간</td><td>1일 급여(상·하한 적용), 소정급여일수, 총액</td></tr>"
        "<tr><td>근로·자녀장려금</td><td>가구 유형·총급여·자녀 수·재산 구간</td><td>예상 지급액, 재산 감액, 기한 후 신청액</td></tr>"
        "</tbody></table>"
        f'<p class="note">{DISCLAIMER}</p>'
        '<div class="cta"><strong>계산 결과를 들고 공고를 확인하세요</strong>'
        '<p class="meta" style="color:#c8d3cf">조건을 한 번 넣으면 내가 받을 수 있는 공고만 일치율 순으로 보여 줍니다.</p>'
        '<a href="../index.html#/home">내 조건으로 공고 찾기</a></div>'
        '<h2>함께 보면 좋은 가이드</h2>'
        '<div class="hubnav">'
        '<a href="../guides/median-income.html">기준중위소득 계산법</a>'
        '<a href="../guides/unemployment-benefit.html">실업급여 조건·절차</a>'
        '<a href="../guides/earned-income-tax-credit.html">근로·자녀장려금 총정리</a>'
        '<a href="../guides/health-insurance-refund.html">본인부담상한제 환급</a>'
        '<a href="../categories/">분야·대상별 보조금</a>'
        "</div>"
    )
