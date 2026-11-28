#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""정적 모의계산기 페이지(허브 + 4종)의 본문·스크립트.

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
.out ul li.act{display:block;padding:9px 10px}
.out ul li.act .acth{display:flex;align-items:baseline;gap:8px}
.out ul li.act .acth .n{font-size:10.5px;font-weight:800;color:#0a6b55;min-width:12px}
.out ul li.act .acth .t{flex:1;min-width:0;font-size:12px;font-weight:700;line-height:1.45;color:#33413c}
.out ul li.act .acth b{font-size:11.5px;font-weight:800;color:#0a4a3a;white-space:nowrap}
.out ul li.act p{margin:4px 0 0 20px;font-size:10.5px;line-height:1.55;color:#87958f;font-weight:600}
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
    var limit=Math.round(m26*item[1]/100);
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

RENT_JS = """
(function(){
var LIMIT=10000000, HIGH=55000000, CAP=80000000, STANDARD=130000;
function run(){
  var salary=calcNum('mr-salary');
  var rent=calcNum('mr-rent');
  var months=Math.min(12,Math.max(0,calcNum('mr-months')));
  var other=document.getElementById('mr-other').checked;
  var paid=rent*months;
  var base=Math.min(paid,LIMIT);
  var over=salary>CAP;
  var rate=over?0:(salary<=HIGH&&!other?0.17:0.15);
  var credit=Math.round(base*rate);
  var withLocal=Math.round(credit*1.1);
  var rateTxt=over?'대상 아님':(rate===0.17?'17%':'15%');
  var rows='';
  rows+='<li><span class="lb">공제 대상 월세 <em>연 1,000만 원 한도</em></span><b>'+calcWon(base)+'</b><span class="df">납부 '+calcWon(paid).replace('원','')+'</span></li>';
  rows+='<li><span class="lb">세액공제액 <em>월세의 '+rateTxt+'</em></span><b>'+calcWon(credit)+'</b><span class="df"></span></li>';
  rows+='<li><span class="lb">지방소득세 포함 <em>소득세의 10%</em></span><b>'+calcWon(withLocal)+'</b><span class="df"></span></li>';
  rows+='<li><span class="'+(credit>STANDARD?'ok':'no')+'">'+(credit>STANDARD?'유리':'비교')+'</span><span class="lb">표준세액공제 <em>13만 원</em></span><b>'+calcWon(STANDARD)+'</b><span class="df">'+(credit>STANDARD?'+'+calcWon(credit-STANDARD).replace('원',''):'')+'</span></li>';
  var sum = over
    ? '총급여가 8,000만 원을 넘어 월세 세액공제 대상이 아닙니다. 부양가족 공제와 신용카드 소득공제를 먼저 확인해 보세요.'
    : (credit>STANDARD
      ? '표준세액공제(13만 원)보다 '+calcWon(credit-STANDARD)+' 유리합니다. 다만 결정세액이 '+calcWon(credit)+'보다 적으면 그만큼만 공제됩니다.'
      : '공제액이 표준세액공제 13만 원보다 적습니다. 특별세액공제를 포기하고 표준세액공제를 받는 편이 유리할 수 있습니다.');
  document.getElementById('mr-out').innerHTML=
    '<div class="head"><span>2026년 귀속 예상 세액공제</span><strong class="big">'+calcWon(credit)+'</strong>'+
    '<span class="sub">월세의 '+rateTxt+' · 지방소득세 포함 '+calcWon(withLocal)+'</span></div>'+
    '<ul>'+rows+'</ul><p class="sum">'+sum+'</p>';
}
calcBind(['mr-salary','mr-rent','mr-months','mr-other'],run);
})();
"""

JS_BY_SLUG = {
    "median-income": MEDIAN_JS,
    "unemployment-benefit": UNEMPLOYMENT_JS,
    "eitc": EITC_JS,
    "monthly-rent": RENT_JS,
}

YEAR_END_JS = """
(function(){
// 2026년 귀속(2027년 1~2월 연말정산) 기준 — src/lib/calculators.ts 와 같은 값·같은 계산 순서.
var Y={earnedCap:20000000,personal:1500000,standard:130000,local:0.1,insRate:0.094,
  card:{thr:0.25,credit:0.15,check:0.30,market:0.40,transit:0.40,baseLow:3000000,baseHigh:2500000,
        childUnit:500000,addLow:3000000,addHigh:2000000,high:70000000},
  pension:{savingsLimit:6000000,totalLimit:9000000,rateLow:0.165,rateHigh:0.132,salaryCap:55000000},
  medical:{thr:0.03,rate:0.15,limit:7000000}};
var BR=[[14000000,0.06,0],[50000000,0.15,1260000],[88000000,0.24,5760000],[150000000,0.35,15440000],
        [300000000,0.38,19940000],[500000000,0.40,25940000],[1000000000,0.42,35940000],[Infinity,0.45,65940000]];
function eb(g){
  var v;
  if(g<=5000000)v=g*0.7;
  else if(g<=15000000)v=3500000+(g-5000000)*0.4;
  else if(g<=45000000)v=7500000+(g-15000000)*0.15;
  else if(g<=100000000)v=12000000+(g-45000000)*0.05;
  else v=14750000+(g-100000000)*0.02;
  return Math.min(Math.round(v),Y.earnedCap,Math.round(g));
}
function brk(b){
  for(var i=0;i<BR.length;i++){if(b<=BR[i][0])return BR[i];}
  return BR[BR.length-1];
}
function gtax(b){
  var k=brk(b),v=Math.round(b*k[1]-k[2]);
  return v>0?v:0;
}
function lcredit(g,t){
  if(t<=0)return 0;
  var raw=(t<=1300000)?t*0.55:715000+(t-1300000)*0.30,cap;
  if(g<=33000000)cap=740000;
  else if(g<=70000000)cap=Math.max(660000,740000-(g-33000000)*0.008);
  else if(g<=120000000)cap=Math.max(500000,660000-(g-70000000)*0.5);
  else cap=Math.max(200000,500000-(g-120000000)*0.5);
  return Math.min(Math.round(raw),Math.round(cap),t);
}
function ccredit(n){
  if(n<=0)return 0;
  if(n===1)return 250000;
  if(n===2)return 550000;
  return 950000+400000*(n-3);
}
function cardCalc(g,kids,s,c,m,t){
  var used=s+c+m+t,thr=Math.round(g*Y.card.thr);
  var raw=s*Y.card.credit+c*Y.card.check+m*Y.card.market+t*Y.card.transit,minus=raw;
  if(used>thr){
    if(s>=thr)minus=thr*Y.card.credit;
    else if(s+c>=thr)minus=s*Y.card.credit+(thr-s)*Y.card.check;
    else minus=s*Y.card.credit+c*Y.card.check+(thr-s-c)*Y.card.market;
  }
  var pre=Math.max(0,Math.round(raw-minus));
  var high=g>Y.card.high;
  var baseLimit=(high?Y.card.baseHigh:Y.card.baseLow)+(kids>=2?Y.card.childUnit*2:(kids===1?Y.card.childUnit:0));
  var addLimit=high?Y.card.addHigh:Y.card.addLow;
  var baseUsed=Math.min(pre,baseLimit),excess=Math.max(0,pre-baseLimit);
  var pref=Math.round(m*Y.card.market+t*Y.card.transit);
  var addUsed=Math.min(excess,pref,addLimit);
  return {threshold:thr,used:used,thresholdLeft:Math.max(0,thr-used),raw:Math.round(raw),
    baseLimit:baseLimit,addLimit:addLimit,baseUsed:baseUsed,addUsed:addUsed,deduction:baseUsed+addUsed,
    limitLeft:Math.max(0,baseLimit+addLimit-(baseUsed+addUsed)),excess:excess};
}
function pensionCalc(g,s,irp){
  var base=Math.min(Math.min(Math.max(0,Math.round(s)),Y.pension.savingsLimit)+Math.max(0,Math.round(irp)),Y.pension.totalLimit);
  var rate=g<=Y.pension.salaryCap?Y.pension.rateLow:Y.pension.rateHigh;
  return {base:base,cap:Y.pension.totalLimit,left:Math.max(0,Y.pension.totalLimit-base),rate:rate,credit:Math.round(base*rate)};
}
function hometownCredit(d){
  d=Math.max(0,Math.round(d));
  if(d<=0)return 0;
  if(d<=100000)return d;
  if(d<=200000)return Math.round(100000+(d-100000)*0.44);
  return Math.round(100000+44000+(d-200000)*0.165);
}
function rentCredit(g,monthly,months){
  var paid=Math.max(0,Math.round(monthly))*Math.min(12,Math.max(0,Math.round(months)));
  var base=Math.min(paid,10000000);
  var over=g>80000000;
  var rate=over?0:(g<=55000000?0.17:0.15);
  return {over:over,base:base,credit:Math.round(base*rate)};
}
function compute(i){
  var g=Math.max(0,Math.round(i.gross)),deps=Math.max(0,Math.floor(i.dependents)),kids=Math.max(0,Math.floor(i.children));
  var earned=eb(g),earnedIncome=Math.max(0,g-earned);
  var personal=Y.personal*(1+deps);
  var estimated=!(i.insurance>0);
  var ins=Math.min(earnedIncome,Math.round(i.insurance>0?i.insurance:g*Y.insRate));
  var cd=cardCalc(g,kids,i.cardCredit,i.cardCheck,i.cardMarket,i.cardTransit);
  var taxable=Math.max(0,earnedIncome-personal-ins-cd.deduction);
  var gt=gtax(taxable);
  var labor=lcredit(g,gt),child=ccredit(kids);
  var pen=pensionCalc(g,i.pensionSavings,i.pensionIrp);
  var medBase=Math.min(Math.max(0,Math.round(i.medical-g*Y.medical.thr)),Y.medical.limit);
  var med=Math.round(medBase*Y.medical.rate);
  var edu=Math.round(Math.max(0,i.education)*0.15);
  var home=hometownCredit(i.hometown);
  var rent=rentCredit(g,i.rentMonthly,i.rentMonths);
  var rentCr=rent.over?0:rent.credit;
  var special=med+edu+home+rentCr;
  var standardApplied=special<Y.standard;
  var standardCredit=standardApplied?Y.standard:0;
  var credits=labor+child+pen.credit+special+standardCredit;
  var decision=Math.max(0,Math.max(0,gt-labor)-(child+pen.credit+special+standardCredit));
  var local=Math.round(decision*Y.local);
  return {gross:g,earned:earned,earnedIncome:earnedIncome,personal:personal,ins:ins,estimated:estimated,
    card:cd,taxable:taxable,gt:gt,labor:labor,child:child,pen:pen,med:med,edu:edu,home:home,rent:rentCr,
    special:special,standardApplied:standardApplied,standardCredit:standardCredit,credits:credits,
    decision:decision,local:local,total:decision+local,
    headroom:Math.max(0,gt-labor-child-pen.credit-special-standardCredit)};
}
function run(){
  var i={gross:calcNum('ye-gross'),dependents:calcNum('ye-dependents'),children:calcNum('ye-children'),
    insurance:calcNum('ye-insurance'),cardCredit:calcNum('ye-card-credit'),cardCheck:calcNum('ye-card-check'),
    cardMarket:calcNum('ye-card-market'),cardTransit:calcNum('ye-card-transit'),remaining:calcNum('ye-remaining'),
    pensionSavings:calcNum('ye-pension-savings'),pensionIrp:calcNum('ye-pension-irp'),hometown:calcNum('ye-hometown'),
    rentMonthly:calcNum('ye-rent'),rentMonths:calcNum('ye-months'),medical:calcNum('ye-medical'),
    education:calcNum('ye-education'),paid:calcNum('ye-paid')};
  var c=compute(i);
  var bare=compute({gross:i.gross,dependents:i.dependents,children:i.children,insurance:i.insurance,
    cardCredit:0,cardCheck:0,cardMarket:0,cardTransit:0,pensionSavings:0,pensionIrp:0,hometown:0,
    rentMonthly:0,rentMonths:0,medical:0,education:0});
  var saving=Math.max(0,bare.total-c.total);
  var diff=function(x){return Math.max(0,c.total-x.total);};

  // 막판 절세 액션
  var acts=[];
  if(c.pen.left>0){
    var filled=compute(Object.assign({},i,{pensionIrp:Y.pension.totalLimit}));
    acts.push({t:'연금저축·IRP 남은 한도 채우기',
      d:'남은 한도 '+calcWon(c.pen.left)+' · 한도 900만 원 중 '+calcWon(c.pen.base)+' 납입 · '+(c.pen.rate*100).toFixed(1)+'% 세액공제',
      v:diff(filled)});
  } else {
    acts.push({t:'연금저축·IRP 한도 900만 원 소진',d:'이미 한도를 채웠습니다. 더 넣어도 세액공제는 늘지 않습니다.',v:0});
  }
  if(i.remaining>0){
    var asCredit=compute(Object.assign({},i,{cardCredit:i.cardCredit+i.remaining}));
    var asCheck=compute(Object.assign({},i,{cardCheck:i.cardCheck+i.remaining}));
    var gain=Math.max(0,asCredit.total-asCheck.total),why;
    if(c.card.used+i.remaining<=c.card.threshold)why='아직 총급여 25% 문턱을 넘지 않아 어느 카드로 써도 공제가 같습니다. 문턱을 넘긴 뒤부터 체크카드가 유리합니다.';
    else if(c.card.limitLeft<=0)why='카드 소득공제 한도를 이미 채워 추가 공제가 없습니다. 전통시장·대중교통 지출만 추가 한도에 들어갑니다.';
    else why='체크카드·현금영수증 30% − 신용카드 15% = 차액 15%가 소득공제로 늘어납니다.';
    acts.push({t:'12월 남은 지출 '+calcWon(i.remaining)+'을 체크카드로',d:why,v:gain});
  }
  if(i.hometown<200000){
    var target=Math.max(100000,Math.min(200000,Math.round(i.hometown)||0));
    var withHome=compute(Object.assign({},i,{hometown:target}));
    acts.push({t:'고향사랑기부 '+calcWon(target)+' (12월 31일까지)',
      d:'세액공제 '+calcWon(hometownCredit(target))+' + 답례품 '+calcWon(target*0.3)+' 상당 · 결정세액이 0원이면 공제 효과가 없습니다.',
      v:diff(withHome)});
  }
  if(i.dependents<10){
    var withDep=compute(Object.assign({},i,{dependents:i.dependents+1}));
    acts.push({t:'부양가족 1명 추가 등록',
      d:'기본공제 150만 원이 늘어납니다. 나이·소득 요건(연 소득금액 100만 원 이하)을 확인하세요.',v:diff(withDep)});
  }
  if(c.rent>0){
    acts.push({t:'월세 세액공제 서류 챙기기',
      d:'주민등록표등본·임대차계약서·계좌이체 내역을 회사에 제출하면 결정세액에서 빠집니다.',
      v:Math.round(c.rent*1.1)});
  }
  if(c.med>0||c.edu>0){
    acts.push({t:'연말정산 간소화에서 의료비·교육비 누락 확인',
      d:'지금 반영된 세액공제 — 의료비 '+calcWon(c.med)+' · 교육비 '+calcWon(c.edu),
      v:Math.round((c.med+c.edu)*1.1)});
  }
  acts.sort(function(a,b){return b.v-a.v;});

  var rows='';
  rows+='<li><span class="lb">근로소득공제</span><b>'+calcWon(c.earned)+'</b><span class="df"></span></li>';
  rows+='<li><span class="lb">인적공제 <em>본인 포함 '+(1+i.dependents)+'명</em></span><b>'+calcWon(c.personal)+'</b><span class="df"></span></li>';
  rows+='<li><span class="lb">4대보험료'+(c.estimated?' <em>총급여 9.4% 추정</em>':'')+'</span><b>'+calcWon(c.ins)+'</b><span class="df"></span></li>';
  rows+='<li><span class="lb">카드 등 소득공제</span><b>'+calcWon(c.card.deduction)+'</b><span class="df"></span></li>';
  rows+='<li><span class="lb">과세표준</span><b>'+calcWon(c.taxable)+'</b><span class="df"></span></li>';
  rows+='<li><span class="lb">산출세액</span><b>'+calcWon(c.gt)+'</b><span class="df"></span></li>';
  rows+='<li><span class="lb">세액공제 합계</span><b>−'+calcWon(c.credits)+'</b><span class="df"></span></li>';
  rows+='<li><span class="lb"><b>결정세액 (소득세)</b></span><b>'+calcWon(c.decision)+'</b><span class="df">지방세 '+calcWon(c.local)+'</span></li>';

  var actsHtml='';
  acts.slice(0,5).forEach(function(a,idx){
    actsHtml+='<li class="act"><div class="acth"><span class="n">'+(idx+1)+'</span><span class="t">'+a.t+'</span><b>'+(a.v>0?'+'+calcWon(a.v):'—')+'</b></div><p>'+a.d+'</p></li>';
  });

  var pct=calcCard_pct(c.card);
  var refund=i.paid>0?(i.paid-c.decision):null;
  var html='';
  html+='<div class="head"><span>지금 챙기면 세금이</span><strong class="big">'+calcWon(saving)+'</strong>'+
    '<span class="sub">줄어듭니다 (지방소득세 포함)</span></div>';
  html+='<div class="kv">'+
    '<div><em>예상 결정세액 (소득세)</em><b>'+calcWon(c.decision)+'</b><i>지방세 포함 '+calcWon(c.total)+'</i></div>'+
    (refund===null
      ? '<div><em>공제 미적용 시 세금</em><b>'+calcWon(bare.total)+'</b><i>소득세 + 지방소득세</i></div>'
      : '<div><em>'+(refund>=0?'예상 환급액':'추가 납부 예상')+'</em><b>'+calcWon(Math.abs(refund))+'</b><i>기납부 − 결정세액</i></div>')+
    '</div>';
  html+='<ul>'+rows+'</ul>';
  html+='<p class="sum"><b>카드 소득공제 현황</b> — 총급여 25% 문턱 '+calcWon(c.card.threshold)+' 중 '+calcWon(c.card.used)+
    ' 사용('+pct+'%), 공제 '+calcWon(c.card.deduction)+', 남은 한도 '+calcWon(c.card.limitLeft)+
    (c.card.thresholdLeft>0?' · 문턱까지 '+calcWon(c.card.thresholdLeft) : ' · 문턱 통과')+
    ' · 기본 한도 '+calcWon(c.card.baseLimit)+' (자녀 '+i.children+'명 반영)</p>';
  html+='<p class="sum"><b>연금계좌</b> — '+calcWon(c.pen.base)+' / 900만 원 · '+(c.pen.rate*100).toFixed(1)+'% 세액공제 '+calcWon(c.pen.credit)+
    (c.pen.left>0?' · 남은 한도 '+calcWon(c.pen.left):' · 한도 소진')+'</p>';
  html+='<p class="sum"><b>월세</b> '+calcWon(c.rent)+' · <b>의료비</b> '+calcWon(c.med)+' · <b>교육비</b> '+calcWon(c.edu)+
    ' · <b>고향사랑기부</b> '+calcWon(c.home)+(c.standardApplied?' · 표준세액공제 13만 원 적용':'')+'</p>';
  html+='<p style="margin:12px 0 0;font-size:12px;font-weight:800;color:#0a5b48">12월 31일 전에 챙기면 이득인 막판 절세 TOP 액션</p>';
  html+='<ul>'+actsHtml+'</ul>';
  if(c.headroom===0){
    html+='<p class="sum" style="color:#b3261e">결정세액이 이미 0원입니다. 이 상태에서 공제를 더 챙겨도 환급액은 늘지 않으니 연금 납입은 노후 목적으로만 판단하세요.</p>';
  }
  html+='<p class="sum" style="font-size:11px;color:#6b7a75">절세액은 이 공제들을 하나도 챙기지 않았을 때와 비교한 소득세 + 지방소득세 감소분입니다. 실제 환급액은 회사가 원천징수한 세액과 최종 결정세액의 차이로 확정됩니다.</p>';
  document.getElementById('ye-out').innerHTML=html;
}
function calcCard_pct(c){return c.threshold>0?Math.min(100,Math.round(c.used/c.threshold*100)):0;}
calcBind(['ye-gross','ye-dependents','ye-children','ye-insurance','ye-card-credit','ye-card-check',
  'ye-card-market','ye-card-transit','ye-remaining','ye-pension-savings','ye-pension-irp','ye-hometown',
  'ye-rent','ye-months','ye-medical','ye-education','ye-paid'],run);
})();
"""

JS_BY_SLUG["year-end-tax"] = YEAR_END_JS

# 계산기 페이지에서 연결하는 가이드 제목(정적 링크 텍스트용)
GUIDE_TITLES = {
    "median-income": "기준중위소득·소득분위 계산법 (2026~2027)",
    "housing-benefits": "주거급여·청년월세·전세자금 비교",
    "unemployment-benefit": "2026 실업급여 조건·수령액·신청 절차",
    "national-employment-support": "2026 국민취업지원제도 구직촉진수당",
    "earned-income-tax-credit": "2026 근로장려금·자녀장려금 총정리",
    "rejection-reasons": "지원금 신청이 탈락하는 10가지 이유",
    "monthly-rent-tax-credit": "월세 세액공제 17%·15% 조건과 최대 170만 원",
    "year-end-tax-refund": "연말정산 환급금, 언제·얼마 들어오나",
    "year-end-tax-checklist": "12월 막판 절세 체크리스트 — 12월 31일까지 챙길 것",
    "card-deduction-guide": "신용카드 vs 체크카드 공제 황금비율",
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

# ------------------------------------------------------------------ 연말정산 기준 표
EARNED_TABLE = """
<table><caption>2026년 귀속 근로소득공제 (소득세법 제47조, 한도 2,000만 원)</caption>
<thead><tr><th>총급여</th><th>공제액</th></tr></thead>
<tbody>
<tr><td>500만 원 이하</td><td>총급여 × 70%</td></tr>
<tr><td>500만 원 초과 ~ 1,500만 원 이하</td><td>350만 원 + (500만 원 초과분 × 40%)</td></tr>
<tr><td>1,500만 원 초과 ~ 4,500만 원 이하</td><td>750만 원 + (1,500만 원 초과분 × 15%)</td></tr>
<tr><td>4,500만 원 초과 ~ 1억 원 이하</td><td>1,200만 원 + (4,500만 원 초과분 × 5%)</td></tr>
<tr><td>1억 원 초과</td><td>1,475만 원 + (1억 원 초과분 × 2%)</td></tr>
</tbody></table>
<p class="note">총급여 4,800만 원이면 1,200만 원 + (300만 원 × 5%) = 1,215만 원이 공제됩니다. 근로소득공제를 뺀 금액이 근로소득금액이고, 여기서 인적공제·4대보험료·카드 소득공제를 다시 뺀 금액이 과세표준입니다.</p>
"""

RATE_TABLE = """
<table><caption>2026년 귀속 기본세율 (소득세법 제55조)</caption>
<thead><tr><th>과세표준</th><th>세율</th><th>누진공제</th></tr></thead>
<tbody>
<tr><td>1,400만 원 이하</td><td>6%</td><td>—</td></tr>
<tr><td>1,400만 ~ 5,000만 원</td><td>15%</td><td>126만 원</td></tr>
<tr><td>5,000만 ~ 8,800만 원</td><td>24%</td><td>576만 원</td></tr>
<tr><td>8,800만 ~ 1억 5,000만 원</td><td>35%</td><td>1,544만 원</td></tr>
<tr><td>1억 5,000만 ~ 3억 원</td><td>38%</td><td>1,994만 원</td></tr>
<tr><td>3억 ~ 5억 원</td><td>40%</td><td>2,594만 원</td></tr>
<tr><td>5억 ~ 10억 원</td><td>42%</td><td>3,594만 원</td></tr>
<tr><td>10억 원 초과</td><td>45%</td><td>6,594만 원</td></tr>
</tbody></table>
"""

CARD_TABLE = """
<table><caption>2026년 사용분 신용카드 등 소득공제 (조세특례제한법 제126조의2)</caption>
<thead><tr><th>구분</th><th>공제율</th><th>한도</th></tr></thead>
<tbody>
<tr><td>신용카드</td><td>15%</td><td rowspan="2">기본 한도 — 총급여 7,000만 원 이하 300만 원, 7,000만 원 초과 250만 원 (자녀 등 1명 +50만·2명 이상 +100만 원)</td></tr>
<tr><td>체크카드·현금영수증</td><td>30%</td></tr>
<tr><td>전통시장</td><td>40%</td><td rowspan="2">추가 한도 — 7,000만 원 이하 300만 원, 7,000만 원 초과 200만 원</td></tr>
<tr><td>대중교통</td><td>40%</td></tr>
</tbody></table>
<p class="note">모든 사용액을 합해 총급여의 25%를 넘긴 금액부터 공제됩니다. 문턱은 공제율이 낮은 신용카드 사용분부터 채워지므로, 신용카드만으로 25%를 넘겼다면 그 뒤 결제는 체크카드·현금영수증이 두 배 유리합니다.</p>
"""

PENSION_TABLE = """
<table><caption>2026년 귀속 연금계좌 세액공제 (지방소득세 포함)</caption>
<thead><tr><th>총급여</th><th>공제율</th><th>600만 원 납입</th><th>900만 원 납입</th></tr></thead>
<tbody>
<tr><td>5,500만 원 이하</td><td>16.5%</td><td>99만 원</td><td>148만 5,000원</td></tr>
<tr><td>5,500만 원 초과</td><td>13.2%</td><td>79만 2,000원</td><td>118만 8,000원</td></tr>
</tbody></table>
<p class="note">연금저축은 600만 원까지, IRP(개인형 퇴직연금)를 더하면 합산 900만 원까지 세액공제됩니다. IRP에만 900만 원을 넣어도 됩니다. 12월 31일까지 본인 명의 계좌에 입금이 완료되어야 그해 공제가 인정되고, 연금 외로 중도 인출하면 공제받은 세금이 다시 부과됩니다.</p>
"""

HOMETOWN_TABLE = """
<table><caption>2026년 고향사랑기부금 세액공제 (조세특례제한법 제58조)</caption>
<thead><tr><th>기부 금액</th><th>소득세 공제</th><th>지방소득세 포함</th></tr></thead>
<tbody>
<tr><td>10만 원 이하</td><td>기부금 × 100/110</td><td>기부한 금액과 거의 같음(약 100%)</td></tr>
<tr><td>10만 원 초과 ~ 20만 원 이하</td><td>10만 원 + 초과분 × 40%</td><td>약 44%</td></tr>
<tr><td>20만 원 초과 ~ 2,000만 원</td><td>위 금액 + 초과분 × 15%</td><td>약 16.5% (특별재난지역 33%)</td></tr>
</tbody></table>
<p class="note">20만 원을 기부하면 세액공제 14만 4,000원에 지자체가 기부금의 30% 이내(최대 6만 원 상당) 답례품을 줍니다. 주민등록상 사는 시·도와 시·군·구에는 기부할 수 없고, 1인 연간 한도는 2,000만 원입니다.</p>
"""

CHECKLIST_TABLE = """
<table><caption>12월 31일 전에 끝내야 하는 연말정산 항목</caption>
<thead><tr><th>항목</th><th>마감</th><th>준비물·요령</th></tr></thead>
<tbody>
<tr><td>연금저축·IRP 추가 납입</td><td>12월 31일 입금 완료</td><td>금융사별 마감 시간이 달라 12월 30일까지 이체 권장</td></tr>
<tr><td>고향사랑기부</td><td>12월 31일</td><td>고향사랑e음·농협 창구, 본인 명의 결제수단</td></tr>
<tr><td>카드 결제수단 전환</td><td>12월 31일 사용분</td><td>총급여 25% 문턱을 넘겼는지 먼저 확인</td></tr>
<tr><td>의료비·교육비 결제</td><td>12월 31일 지출분</td><td>연내 결제해야 그해 공제, 실손보험 수령액은 차감</td></tr>
<tr><td>월세 이체 증빙</td><td>12월분 이체</td><td>임대차계약서·계좌이체 내역, 전입신고 주소 일치</td></tr>
<tr><td>부양가족 등록</td><td>회사 제출 전</td><td>부모님·자녀 나이와 연 소득금액 100만 원 이하 확인</td></tr>
<tr><td>연말정산 간소화 확인</td><td>2027년 1월</td><td>홈택스에서 누락 자료 확인 후 회사에 제출</td></tr>
</tbody></table>
"""

RENT_TABLE = """
<table><caption>월세별 예상 세액공제액 (12개월 납부·요건 충족 가정)</caption>
<thead><tr><th>월세</th><th>연간 월세</th><th>17% 적용</th><th>15% 적용</th></tr></thead>
<tbody>
<tr><td>40만 원</td><td>480만 원</td><td>81만 6,000원</td><td>72만 원</td></tr>
<tr><td>50만 원</td><td>600만 원</td><td>102만 원</td><td>90만 원</td></tr>
<tr><td>70만 원</td><td>840만 원</td><td>142만 8,000원</td><td>126만 원</td></tr>
<tr><td>80만 원</td><td>960만 원</td><td>163만 2,000원</td><td>144만 원</td></tr>
<tr><td>100만 원</td><td>1,200만 원 → 1,000만 원</td><td>170만 원</td><td>150만 원</td></tr>
</tbody></table>
<p class="note">공제 대상 월세는 연 1,000만 원까지입니다. 관리비·보증금은 월세액에 포함되지 않으며, 중간에 이사했다면 집마다 실제로 낸 월세를 합산합니다.</p>
"""

# ------------------------------------------------------------------ 페이지 정의
CALC_META: dict[str, dict] = {
    "year-end-tax": {
        "slug": "year-end-tax",
        "title": "2026 연말정산 절세 계산기 — 예상 환급액·12월 막판 절세 액션 | 보조금 레이더",
        "h1": "2026 연말정산 절세 시뮬레이터 — 예상 환급액과 12월 막판 절세",
        "description": "총급여와 카드·연금저축·IRP·고향사랑기부·월세·의료비·교육비를 넣으면 2026년 귀속 예상 결정세액과 환급액, 12월 31일까지 챙길 막판 절세 액션을 금액으로 계산합니다. 회원가입 없이 무료.",
        "keyword": "2026 연말정산 계산기, 연말정산 환급금 계산, 연금저축 IRP 세액공제 900만원, 체크카드 소득공제 30%, 고향사랑기부 세액공제",
        "short": "연말정산 절세",
        "related_guides": ["year-end-tax-checklist", "card-deduction-guide", "monthly-rent-tax-credit"],
        "related_hubs": [("finance", "생활·금융·긴급복지"), ("housing", "주거 보조금 모음")],
        "app": "#/calculators/year-end-tax",
        "updated": "2026-11-28",
        "features": [
            "총급여·부양가족·카드 사용액 입력",
            "2026년 귀속 소득세법·조세특례제한법 기준",
            "예상 결정세액·환급액과 12월 막판 절세 액션",
        ],
    },
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
    "monthly-rent": {
        "slug": "monthly-rent",
        "title": "월세 세액공제 계산기 2026 — 17%·15% 예상 공제액 | 보조금 레이더",
        "h1": "월세 세액공제 계산기 — 내 월세로 연말정산 공제액 계산",
        "description": "총급여와 월세·납부 개월을 넣으면 2026년 귀속 월세 세액공제액을 17%·15%로 계산합니다. 연 1,000만 원 한도와 표준세액공제 13만 원 비교까지 한 번에 확인하세요.",
        "keyword": "월세 세액공제 계산기, 월세 17% 15%, 연말정산 월세 공제, 월세 1000만원 한도",
        "short": "월세 세액공제",
        "related_guides": ["monthly-rent-tax-credit", "year-end-tax-refund"],
        "related_hubs": [("housing", "주거 보조금 모음"), ("finance", "생활·금융·긴급복지")],
        "app": "#/calculators/monthly-rent",
    },
}

CALC_FAQS: dict[str, list[dict]] = {
    "year-end-tax": [
        {
            "q": "연말정산 때 받는 돈은 환급금인가요, 절세액인가요?",
            "a": "둘은 다릅니다. 이 계산기의 '줄어드는 세금'은 공제를 하나도 챙기지 않았을 때와 비교한 소득세·지방소득세 감소분입니다. 실제 환급금은 1년 동안 회사가 원천징수한 세액에서 최종 결정세액을 뺀 금액이므로, 기납부세액을 입력하면 예상 환급액을 따로 보여 줍니다. 원천징수영수증의 기납부세액 칸을 보면 됩니다.",
        },
        {
            "q": "12월에 체크카드로 바꾸면 정말 유리한가요?",
            "a": "총급여의 25%(최저사용금액)를 신용카드만으로 이미 넘겼고 공제 한도가 남아 있다면 유리합니다. 체크카드·현금영수증은 30%로 신용카드 15%의 두 배인데, 문턱은 공제율이 낮은 신용카드 사용분부터 채워지기 때문입니다. 반대로 아직 25%를 못 넘었다면 신용카드 한도는 물론 체크카드로 더 써도 늘어나는 공제액은 같습니다(문턱 × 15%). 1년에 쓴 순서와 관계없이 연간 합계로 계산합니다.",
        },
        {
            "q": "연금저축과 IRP는 12월 31일에 넣어도 되나요?",
            "a": "법으로는 12월 31일까지 납입하면 그해 세액공제 대상입니다. 다만 금융사별 이체 마감 시간이 달라 12월 마지막 주에는 처리가 밀립니다. 늦어도 12월 30일까지 이체를 끝내고, 납입확인서나 계좌 거래 내역으로 입금일을 확인해 두는 편이 안전합니다. 연금저축만으로는 600만 원, IRP를 더하면 900만 원까지 공제됩니다.",
        },
        {
            "q": "고향사랑기부금은 10만 원만 내면 공짜인가요?",
            "a": "10만 원을 기부하면 소득세 9만 909원과 지방소득세 9,091원을 합해 10만 원이 세액공제되고, 지자체가 기부금의 30% 이내(최대 3만 원 상당) 답례품을 줍니다. 다만 세액공제는 낼 세금이 있어야 효과가 있고, 결정세액이 0원이면 돌려받을 세금이 없습니다.",
        },
        {
            "q": "계산 결과와 회사 연말정산 결과가 다른 이유는 무엇인가요?",
            "a": "이 계산기는 근로소득공제·인적공제·4대보험료·카드 소득공제와 주요 세액공제만 반영합니다. 보장성 보험료, 주택자금 공제, 기부금, 신용카드 가족 사용분, 맞벌이 배우자와의 공제 배분, 결정세액 한도에 걸린 공제 등은 빠져 있습니다. 4대보험료를 비우면 총급여의 9.4%로 추정하므로 실제 원천징수영수증의 공제액과 차이가 날 수 있습니다.",
        },
    ],
    "median-income": [
        {
            "q": "기준중위소득 60% 이하라는 말은 무슨 뜻인가요?",
            "a": "그 해 기준중위소득 금액에 0.6을 곱한 금액 이하라는 뜻입니다. 2026년 3인 가구라면 5,359,036원의 60%인 3,215,422원이 기준선이 됩니다. 공고의 기준은 대개 소득인정액과 비교하며, 통장에 찍히는 소득만 보지 않습니다.",
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
    "monthly-rent": [
        {
            "q": "월세 1,000만 원을 다 돌려받는 건가요?",
            "a": "아닙니다. 1,000만 원은 공제 대상 월세의 상한일 뿐이고, 실제로 돌려받는 금액은 공제 대상 월세에 공제율을 곱한 값입니다. 월세 1,000만 원에 17%를 적용하면 170만 원, 15%면 150만 원이 최대 공제액입니다.",
        },
        {
            "q": "공제율 17%와 15%는 무엇으로 갈리나요?",
            "a": "본인의 총급여와 종합소득금액으로 갈립니다. 총급여 5,500만 원 이하이면서 종합소득금액이 4,500만 원 이하이면 17%, 총급여 8,000만 원 이하(종합소득금액 7,000만 원 이하)이면 15%입니다. 총급여 8,000만 원을 넘거나 종합소득금액이 7,000만 원을 넘으면 대상이 아닙니다. 배우자 소득은 합산하지 않습니다.",
        },
        {
            "q": "결정세액이 적으면 어떻게 되나요?",
            "a": "세액공제는 낼 세금에서 빼 주는 제도라, 결정세액이 공제액보다 적으면 남는 금액은 사라집니다. 현금으로 돌려받는 것이 아니므로, 원천징수영수증의 결정세액이 0원이라면 공제를 더 챙겨도 환급은 늘지 않습니다.",
        },
        {
            "q": "관리비와 보증금도 공제 대상인가요?",
            "a": "아닙니다. 임대인에게 실제로 지급한 월세만 대상이고, 관리비·공과금·임차보증금은 포함되지 않습니다. 계약서에 월세와 관리비가 구분돼 있으면 월세로 적힌 금액만 계산합니다.",
        },
    ],
}


def _calculator_form(slug: str) -> str:
    if slug == "year-end-tax":
        return f"""
<form class="calc" id="ye-form" onsubmit="return false">
  <h2>🎄 내 총급여로 계산하기</h2>
  <h3 style="margin:12px 0 0;font-size:12.5px;color:#0a5b48">1. 소득과 가족</h3>
  <div class="calcrow">
    <label>총급여 (연, 원)<span class="hint">비과세(식대 등)를 뺀 금액 — 원천징수영수증의 총급여</span>
      <input type="number" id="ye-gross" value="48000000" min="0" step="1000000" inputmode="numeric" /></label>
    <label>부양가족 수 (본인 제외)<span class="hint">기본공제 1인당 150만 원</span>
      <input type="number" id="ye-dependents" value="0" min="0" max="10" step="1" inputmode="numeric" /></label>
    <label>그중 9세 이상 자녀 수<span class="hint">2026년 귀속은 9세 이상(2017년생 제외) · 1명 25만·2명 55만·3명 이상 95만 원</span>
      <input type="number" id="ye-children" value="0" min="0" max="10" step="1" inputmode="numeric" /></label>
    <label>4대보험료 (연, 원)<span class="hint">비우면 총급여의 9.4%로 추정</span>
      <input type="number" id="ye-insurance" value="" min="0" step="100000" inputmode="numeric" placeholder="자동 추정" /></label>
  </div>
  <h3 style="margin:14px 0 0;font-size:12.5px;color:#0a5b48">2. 카드 사용액 (1~12월)</h3>
  <div class="calcrow">
    <label>신용카드<span class="hint">전통시장·대중교통 사용분은 아래에 따로 입력</span>
      <input type="number" id="ye-card-credit" value="12000000" min="0" step="100000" inputmode="numeric" /></label>
    <label>체크카드·현금영수증<span class="hint">공제율 30%</span>
      <input type="number" id="ye-card-check" value="3000000" min="0" step="100000" inputmode="numeric" /></label>
    <label>전통시장<span class="hint">카드 종류와 관계없이 40%</span>
      <input type="number" id="ye-card-market" value="0" min="0" step="100000" inputmode="numeric" /></label>
    <label>대중교통<span class="hint">버스·지하철·기차 40%</span>
      <input type="number" id="ye-card-transit" value="600000" min="0" step="100000" inputmode="numeric" /></label>
    <label>12월 남은 지출 예상액<span class="hint">신용카드 대신 체크카드로 돌릴 금액</span>
      <input type="number" id="ye-remaining" value="1000000" min="0" step="100000" inputmode="numeric" /></label>
  </div>
  <h3 style="margin:14px 0 0;font-size:12.5px;color:#0a5b48">3. 연금저축·IRP·고향사랑기부</h3>
  <div class="calcrow">
    <label>연금저축 납입액 (연, 원)<span class="hint">한도 600만 원</span>
      <input type="number" id="ye-pension-savings" value="2000000" min="0" step="100000" inputmode="numeric" /></label>
    <label>IRP 납입액 (연, 원)<span class="hint">연금저축과 합산 900만 원 한도</span>
      <input type="number" id="ye-pension-irp" value="0" min="0" step="100000" inputmode="numeric" /></label>
    <label>고향사랑기부금 (연, 원)<span class="hint">10만 원까지 100% 세액공제 + 답례품 30%</span>
      <input type="number" id="ye-hometown" value="0" min="0" step="100000" inputmode="numeric" /></label>
  </div>
  <h3 style="margin:14px 0 0;font-size:12.5px;color:#0a5b48">4. 월세·의료비·교육비</h3>
  <div class="calcrow">
    <label>월세 (월, 원)<span class="hint">무주택 세대주·세대원, 관리비 제외</span>
      <input type="number" id="ye-rent" value="0" min="0" step="10000" inputmode="numeric" /></label>
    <label>월세 납부 개월 수<span class="hint">최대 12개월</span>
      <input type="number" id="ye-months" value="12" min="0" max="12" step="1" inputmode="numeric" /></label>
    <label>의료비 지출액 (연, 원)<span class="hint">총급여 3% 초과분의 15%, 일반 부양가족 700만 원 한도</span>
      <input type="number" id="ye-medical" value="0" min="0" step="100000" inputmode="numeric" /></label>
    <label>교육비 지출액 (연, 원)<span class="hint">15% · 취학전·초중고 1인 300만 · 대학생 1인 900만 원</span>
      <input type="number" id="ye-education" value="0" min="0" step="100000" inputmode="numeric" /></label>
    <label>기납부 소득세 (연, 원, 선택)<span class="hint">원천징수영수증의 기납부세액 — 넣으면 환급액 계산</span>
      <input type="number" id="ye-paid" value="" min="0" step="100000" inputmode="numeric" placeholder="모르면 비워 두세요" /></label>
  </div>
  <div class="out" id="ye-out"></div>
  <p class="calcnote">{DISCLAIMER}<br />
  2026년 귀속(2027년 1~2월 연말정산) 기준입니다. 4대보험료를 비우면 총급여의 9.4%로 추정하며, 보장성 보험료(연 100만 원 한도·12%),
  기부금, 주택자금 공제는 반영하지 않았습니다. 실제 환급액은 회사가 원천징수한 세액과 최종 결정세액의 차이로 확정됩니다.</p>
</form>
{_script(slug)}
"""
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
    if slug == "monthly-rent":
        return f"""
<form class="calc" id="mr-form" onsubmit="return false">
  <h2>🏠 내 월세로 계산하기</h2>
  <div class="calcrow">
    <label>총급여 (연, 원)<span class="hint">비과세 소득 제외 · 5,500만 원 이하면 17%</span>
      <input type="number" id="mr-salary" value="48000000" min="0" step="1000000" inputmode="numeric" /></label>
    <label>월세 (월, 원)<span class="hint">관리비·보증금 제외, 실제 지급한 월세</span>
      <input type="number" id="mr-rent" value="700000" min="0" step="10000" inputmode="numeric" /></label>
    <label>납부 개월 수<span class="hint">그해 실제로 월세를 낸 달만 (최대 12개월)</span>
      <input type="number" id="mr-months" value="12" min="1" max="12" step="1" inputmode="numeric" /></label>
  </div>
  <label class="chk"><input type="checkbox" id="mr-other" /> 종합소득금액 4,500만 원 초과 (17% 구간에서 제외)</label>
  <div class="out" id="mr-out"></div>
  <p class="calcnote">{DISCLAIMER}<br />
  무주택 세대주(요건을 갖춘 세대원·배우자 포함)만 대상이며, 12월 31일 기준 무주택이어야 합니다. 공제 대상 주택은 국민주택규모
  85㎡ 이하 또는 기준시가 4억 원 이하이고, 주민등록표 주소와 임대차계약서 주소가 같아야 합니다.</p>
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
        '<p><a href="./">← 계산기 5종</a></p>'
        '<p><span class="cat">모의계산기</span></p>'
        f"<h1>{meta['h1']}</h1>"
        f'<p class="lead">{meta["description"]}</p>'
        f'<p class="meta">기준 확인일 {meta.get("updated", "2026-11-21")} · 보조금 레이더 편집 · 회원가입 없이 무료</p>'
    )
    form = _calculator_form(slug)
    tail = f'<section class="card faqbox"><h2>자주 묻는 질문</h2><dl class="dl">{dl}</dl></section>'
    tail += _related_html(meta)
    tail += (
        '<div class="cta"><strong>계산이 끝났다면, 받을 수 있는 공고를 확인하세요</strong>'
        '<p class="meta" style="color:#c8d3cf">나이·직군·가구 상황·지역을 넣으면 일치율 순으로 정리됩니다. 로그인 없이 이용할 수 있습니다.</p>'
        '<a href="../index.html#/onboarding">내 조건으로 공고 찾기</a></div>'
    )

    if slug == "year-end-tax":
        mid = (
            "<h2>2026년 귀속 연말정산은 5단계로 계산된다</h2>"
            "<ul>"
            "<li>1단계 — 총급여를 확정합니다. 연봉 계약서 금액이 아니라 비과세 소득(식대 월 20만 원 등)을 뺀 금액입니다.</li>"
            "<li>2단계 — 근로소득공제를 뺉니다. 총급여 구간별 70%~2%가 자동 적용되고 한도는 2,000만 원입니다.</li>"
            "<li>3단계 — 인적공제(1인당 150만 원), 4대보험료, 카드 소득공제를 뺀 금액이 과세표준입니다.</li>"
            "<li>4단계 — 과세표준에 기본세율(6~45%)을 곱하고 누진공제를 뺀 뒤 근로소득세액공제를 빼 산출세액을 구합니다.</li>"
            "<li>5단계 — 연금계좌·의료비·교육비·월세·기부금 같은 세액공제를 산출세액에서 뺀 금액이 결정세액입니다.</li>"
            "</ul>"
            '<p class="note">세액공제는 산출세액을 넘을 수 없습니다. 공제 합계가 산출세액보다 커지면 결정세액은 0원이 되고 남은 공제는 사라지므로, 낼 세금이 적은 사람은 연금 추가 납입보다 카드·인적공제를 먼저 확인하는 편이 좋습니다.</p>'
            "<h2>근로소득공제와 기본세율</h2>"
            + EARNED_TABLE
            + RATE_TABLE
            + "<h2>신용카드 vs 체크카드 — 총급여 25% 문턱이 갈림길</h2>"
            + CARD_TABLE
            + "<p>카드 소득공제는 '쓴 금액의 일부를 돌려주는' 제도가 아니라 과세표준을 줄여 주는 소득공제입니다. 공제 100만 원이 세금 100만 원 감소를 뜻하지 않고, 내 과세표준 구간의 세율만큼(15% 구간이면 15만 원) 세금이 줄어듭니다.</p>"
            "<p>총급여 4,800만 원이라면 문턱은 1,200만 원입니다. 신용카드 1,200만 원으로 이미 문턱을 채웠다면 그 뒤 결제는 체크카드·현금영수증(30%)이 신용카드(15%)보다 두 배 많은 공제를 만듭니다. 12월에 100만 원을 체크카드로 돌리면 공제가 15만 원 늘고, 세금은 15% 구간에서 2만 2,500원(지방소득세 포함 2만 4,750원) 줄어듭니다.</p>"
            '<p class="note">전통시장·대중교통은 결제수단과 관계없이 40%가 적용되고 별도 추가 한도(총급여 7,000만 원 이하 300만 원)까지 쓸 수 있습니다. 2026년 사용분은 이 기준이 그대로 적용되지만, 2027년 사용분부터는 대중교통 40% 우대를 없애는 세제개편안이 추진 중입니다.</p>'
            "<h2>연금저축·IRP 900만 원, 12월 31일이 마감</h2>"
            + PENSION_TABLE
            + "<p>총급여 5,500만 원 이하라면 900만 원을 채웠을 때 148만 5,000원, 5,500만 원을 넘으면 118만 8,000원이 세금에서 빠집니다. 다만 결정세액이 그보다 적으면 실제 절세액은 결정세액까지만입니다.</p>"
            "<h2>고향사랑기부금 10만 원의 가치</h2>"
            + HOMETOWN_TABLE
            + "<p>10만 원 이하는 기부한 금액이 거의 그대로 세액공제되고 답례품까지 받습니다. 20만 원 구간까지는 44%가 공제되어 효율이 좋고, 20만 원을 넘으면 16.5%로 떨어집니다. 낼 소득세가 있는 사람에게만 효과가 있습니다.</p>"
            "<h2>월세·의료비·교육비·부양가족</h2>"
            "<ul>"
            "<li>월세 — 무주택 세대주(요건을 갖춘 세대원·배우자 포함)가 연 1,000만 원 한도로 17%(총급여 5,500만 원 이하) 또는 15%를 공제받습니다. 월세만 따로 보려면 <a href='./monthly-rent.html'>월세 세액공제 계산기</a>를 쓰세요.</li>"
            "<li>의료비 — 총급여 3%를 넘는 금액의 15%. 본인·6세 이하·65세 이상·장애인은 한도가 없고, 일반 부양가족은 연 700만 원까지입니다. 실손보험으로 돌려받은 금액은 빼야 합니다.</li>"
            "<li>교육비 — 15%. 취학 전·초중고는 1인당 연 300만 원, 대학생은 900만 원까지입니다. 2026년 지출분부터 9세 미만·초등 2학년 이하 자녀의 예체능 학원비도 대상입니다.</li>"
            "<li>자녀세액공제 — 9세 이상 기본공제 자녀가 1명이면 25만, 2명 55만, 3명 이상은 95만 원에 1명당 40만 원을 더합니다.</li>"
            "</ul>"
            "<h2>12월 막판 절세 체크리스트</h2>"
            + CHECKLIST_TABLE
            + "<h2>환급금은 이렇게 정해진다</h2>"
            "<p>회사는 매달 간이세액표로 세금을 미리 떼고, 이듬해 1∼2월 연말정산에서 1년치를 다시 계산합니다. 결정세액이 기납부세액보다 적으면 차액이 2월 급여에 더해지고(환급), 많으면 급여에서 더 빠집니다(추납). 그래서 같은 공제라도 원천징수된 세금이 많았던 사람이 환급액이 커집니다.</p>"
            "<p>놓친 공제가 있다면 5년 안에 돌려받을 수 있습니다. 홈택스 '종합소득세 신고 → 경정청구'에서 신청하면 되고, 이때도 월세 계약서·이체 내역 같은 증빙은 직접 챙겨야 합니다.</p>"
            '<p class="note">2026년 8월 정부 세제개편안에는 2027년 사용분부터 대중교통 40% 우대를 없애고 추가 한도를 100만 원씩 줄이는 내용이 담겼습니다. 국회 심의 중이므로 2026년 귀속 연말정산에는 현행 기준이 적용됩니다.</p>'
        )
    elif slug == "median-income":
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
    elif slug == "monthly-rent":
        mid = (
            "<h2>2026년 귀속 월세 세액공제 기준</h2>"
            + RENT_TABLE
            + "<h2>요건은 소득·세대·주택 세 가지를 함께 본다</h2>"
            "<ul>"
            "<li>소득 — 총급여 8,000만 원 이하(종합소득금액 7,000만 원 초과자 제외). 17%는 총급여 5,500만 원 이하이면서 종합소득금액 4,500만 원 이하</li>"
            "<li>세대 — 12월 31일 현재 무주택 세대의 세대주. 세대주가 주택 관련 공제를 받지 않으면 세대원도 가능</li>"
            "<li>주택 — 국민주택규모(85㎡, 수도권·도시지역 외 100㎡) 이하 또는 기준시가 4억 원 이하. 주거용 오피스텔·고시원 포함</li>"
            "<li>거주 — 본인 또는 기본공제 대상자 명의로 임차하고, 임대차계약서 주소와 주민등록표 주소가 같아야(전입신고 필요)</li>"
            "</ul>"
            "<h2>표준세액공제와 비교해야 하는 이유</h2>"
            "<p>특별세액공제·월세 세액공제를 하나도 신청하지 않은 근로자에게는 표준세액공제 13만 원이 자동으로 적용됩니다. 계산된 월세 세액공제가 13만 원보다 적다면, 월세 공제를 신청하는 대신 표준세액공제를 받는 편이 유리합니다. 이 계산기는 두 금액을 함께 보여 줍니다.</p>"
            "<h2>놓쳤다면 5년 안에 돌려받을 수 있다</h2>"
            "<p>연말정산 때 서류를 내지 못했더라도 5월 종합소득세 신고 기간에 경정청구하거나, 홈택스 '종합소득세 신고 → 경정청구'에서 신청할 수 있습니다. 주민등록표등본, 임대차계약증서 사본, 계좌이체 영수증 같은 지급 증빙을 준비하세요.</p>"
            '<p class="note">2026년 8월 세제개편안에는 공제 대상 월세 한도를 1,200만 원으로 올리고 청년에게 17%를 적용하는 안이 담겼지만, 국회 심의 중인 개정안이므로 이 계산기에는 반영하지 않았습니다.</p>'
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
        "<h1>보조금 모의계산기 5종</h1>"
        '<p class="lead">내 숫자를 넣으면 얼마를 받을 수 있는지, 세금이 얼마나 줄어드는지 바로 확인하는 계산기입니다. 로그인·회원가입 없이 쓸 수 있고, '
        '입력값은 서버로 전송되지 않습니다. 모든 결과는 2026년 고시·법정 기준 참고용이며 최종 판정은 담당 기관 심사와 국세청 신고로 확정됩니다.</p>'
        '<section class="card" style="background:linear-gradient(135deg,#fff8ec,#ffffff);border-color:#f3ddb7">'
        '<p class="meta" style="color:#a16207;font-weight:800;letter-spacing:.1em">2026 연말정산 시즌</p>'
        '<p style="margin:4px 0 0;font-size:15px;font-weight:800">🎄 연말정산 절세 시뮬레이터 &amp; 12월 막판 체크리스트</p>'
        '<p style="margin:6px 0 0;font-size:12.5px;color:#4b5a55">12월 31일이 마감인 연금저축·IRP 납입, 고향사랑기부, 카드 결제수단 전환을 내 총급여로 계산해 보세요.</p>'
        '<p style="margin:10px 0 0"><a href="./year-end-tax.html" style="font-weight:800">절세 시뮬레이터 열기 →</a> · '
        '<a href="../guides/year-end-tax-checklist.html">12월 체크리스트</a> · '
        '<a href="../guides/card-deduction-guide.html">카드 공제 황금비율</a></p>'
        '</section>'
        f'<div class="grid">{"".join(cards)}</div>'
        "<h2>계산에 쓴 2026년 기준값</h2>"
        "<ul>"
        "<li>기준중위소득 — 3인 5,359,036원 · 4인 6,494,738원(2027년 4인 6,929,885원)</li>"
        "<li>기본재산액 — 대도시 1억 3,500만 원 · 중소도시 8,500만 원 · 농어촌 7,250만 원</li>"
        "<li>구직급여 — 상한 1일 68,100원 · 하한 최저임금 10,320원의 80%(8시간 기준 66,048원)</li>"
        "<li>근로장려금 — 최대 단독 165만 · 홑벌이 285만 · 맞벌이 330만 원(2025년 귀속)</li>"
        "<li>월세 세액공제 — 한도 연 1,000만 원 · 17%(총급여 5,500만 원 이하) 또는 15%</li>"
        "<li>연말정산 — 연금계좌 900만 원·16.5%·13.2%, 카드 소득공제 신용 15%·체크 30%·전통시장·대중교통 40%, 연봉 25% 문턱</li>"
        "</ul>"
        "<h2>계산기별로 알 수 있는 것</h2>"
        "<table><caption>다섯 계산기의 입력과 결과</caption>"
        "<thead><tr><th>계산기</th><th>입력</th><th>결과</th></tr></thead><tbody>"
        "<tr><td>연말정산 절세</td><td>총급여·부양가족·카드·연금·월세·의료비</td><td>예상 결정세액·환급액, 12월 막판 절세 액션</td></tr>"
        "<tr><td>기준중위소득</td><td>가구원 수·월 소득·재산·지역</td><td>중위 대비 %, 급여별 기준선 통과 여부</td></tr>"
        "<tr><td>실업급여</td><td>평균 월급·나이·가입기간·근로시간</td><td>1일 급여(상·하한 적용), 소정급여일수, 총액</td></tr>"
        "<tr><td>근로·자녀장려금</td><td>가구 유형·총급여·자녀 수·재산 구간</td><td>예상 지급액, 재산 감액, 기한 후 신청액</td></tr>"
        "<tr><td>월세 세액공제</td><td>총급여·월세·납부 개월</td><td>17%·15% 공제액, 표준세액공제 비교</td></tr>"
        "</tbody></table>"
        f'<p class="note">{DISCLAIMER}</p>'
        '<div class="cta"><strong>계산 결과를 들고 공고를 확인하세요</strong>'
        '<p class="meta" style="color:#c8d3cf">조건을 한 번 넣으면 내가 받을 수 있는 공고만 일치율 순으로 보여 줍니다.</p>'
        '<a href="../index.html#/onboarding">내 조건으로 공고 찾기</a></div>'
        '<h2>함께 보면 좋은 가이드</h2>'
        '<div class="hubnav">'
        '<a href="../guides/year-end-tax-checklist.html">12월 막판 절세 체크리스트</a>'
        '<a href="../guides/card-deduction-guide.html">신용카드 vs 체크카드 공제 비율</a>'
        '<a href="../guides/monthly-rent-tax-credit.html">월세 세액공제 17%·15%</a>'
        '<a href="../guides/median-income.html">기준중위소득 계산법</a>'
        '<a href="../guides/unemployment-benefit.html">실업급여 조건·절차</a>'
        '<a href="../guides/earned-income-tax-credit.html">근로·자녀장려금 총정리</a>'
        '<a href="../categories/">분야·대상별 보조금</a>'
        "</div>"
    )
