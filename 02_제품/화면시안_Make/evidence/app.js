'use strict';
const SESSION_KEY='jeju-real-demo-session-v1';
let appRole=null,loginRole='business',appView='login',dataReady=false,chartMetric='visits',quarter=10;
try{const r=sessionStorage.getItem(SESSION_KEY);if(['business','service'].includes(r))appRole=r;}catch{}
const node=id=>document.getElementById(id);
const icon=name=>FigmaUI.icon(name);
const sourceName=s=>({21:'읍면동 방문 집계',27:'지역별 음식점 소비·이용건수',39:'시간대별 음식점 소비·이용건수',48:'내비게이션 목적지 방문'}[s.regSn]||'공식 원천')+` (regSn ${s.regSn})`;
const titleBlock=(title,description)=>`<div class="page-heading"><div><div class="eyebrow">${icon('pin')}제주 구좌읍 · 음식점업 전체</div><h1>${title}</h1><p>${description}</p></div></div>`;
function parkContent(){const host=node('data-host');for(const id of ['loading','work-notice','case','workspace','screen']){const el=node(id);if(el)host.append(el);}}
function showLogin(){
 parkContent();node('app').innerHTML=FigmaUI.login(loginRole);appView='login';document.title='로그인 · 제주 마케팅 캘린더';
 node('login-form').onsubmit=e=>{e.preventDefault();const expected=loginRole==='business'?'cafe@example.com':'admin@example.com';
  if(node('login-email').value.trim().toLowerCase()!==expected||node('login-password').value!=='JejuDemo26!'){node('login-error').hidden=false;node('login-error').textContent='계정 정보 채우기를 이용해 시연용 계정으로 로그인해 주세요.';return;}
  appRole=loginRole;try{sessionStorage.setItem(SESSION_KEY,appRole);}catch{}navigateApp('overview');
 };
 node('app').querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>{loginRole=b.dataset.role;showLogin();});
 node('app').querySelector('[data-action="fill-demo"]').onclick=()=>{node('login-email').value=loginRole==='business'?'cafe@example.com':'admin@example.com';node('login-password').value='JejuDemo26!';node('login-error').hidden=true;};
 node('app').querySelector('[data-action="toggle-password"]').onclick=e=>{const show=node('login-password').type==='password';node('login-password').type=show?'text':'password';e.currentTarget.setAttribute('aria-label',show?'비밀번호 숨기기':'비밀번호 보기');e.currentTarget.setAttribute('aria-pressed',String(show));};
 node('app').querySelector('.brand').onclick=e=>{e.preventDefault();node('login-email').focus();};
}
function appDialog(title,body){const d=node('dialog');d.innerHTML=`<header class="dialog-header"><h2 id="dialog-title">${title}</h2><button class="icon-button" aria-label="닫기">${icon('close')}</button></header><div class="dialog-body">${body}</div>`;d.querySelector('button').onclick=()=>d.close();d.showModal();}
function sourceDialog(){appDialog('자료의 출처와 해석 기준',`<p class="notice">지역 방문은 가게 손님 수가 아니며 카드 소비는 특정 매장 매출이 아닙니다. 실제 사업 효과는 미측정입니다.</p><ul class="relation-list">${evidence.sources.map(s=>`<li><a href="${escapeText(s.url)}" target="_blank" rel="noopener">${escapeText(sourceName(s))}</a></li>`).join('')}</ul><p>수집 ${escapeText(evidence.snapshot)} · 계절성 2023년부터 2025년까지 · 최근 동기간 2025·2026년 1월부터 8월까지</p><p>${escapeText(evidence.stability_rule)}</p>`);}
function navigateApp(view,replace=false){
 const aliases={recommendation:'recommendations',dataAdmin:'data'};view=aliases[view]||view;
 if(!appRole)view='login';else if(!FigmaUI.titles[view]||view==='login')view='overview';
 if(view==='data'&&appRole!=='service')view='overview';
 if(node('reason')&&!node('case').hidden)capture();
 if(view==='login'){showLogin();if(location.hash!=='#login')history.replaceState(null,'','#login');return;}
 if(view==='calendar'&&appView==='plan')quarter=Math.floor((month-1)/3)*3+1;
 appView=view;parkContent();node('app').innerHTML=FigmaUI.shell(appRole,view,workspace.plans,'<div id="screen-slot"></div>');
 const slot=node('screen-slot');for(const id of ['loading','work-notice','case','workspace','screen'])slot.append(node(id));
 for(const id of ['case','workspace','screen'])node(id).hidden=true;
 node('loading').hidden=dataReady;node('work-notice').textContent=workError;
 if(dataReady){
  if(view==='analysis'||view==='plan'){node('case').hidden=false;render();syncCaseView();}
  else if(view==='calendar'||view==='records'){node('workspace').hidden=false;drawWorkspace(view);}
  else {node('screen').hidden=false;node('screen').innerHTML=view==='overview'?overviewPage():view==='recommendations'?recommendationPage():dataPage();bindScreen();}
 }
 bindShell();styleDataWidgets();document.title=`${FigmaUI.titles[view]} · 제주 마케팅 캘린더`;
 if(location.hash!=='#'+view)history[replace?'replaceState':'pushState'](null,'','#'+view);
 node('main').focus({preventScroll:true});window.scrollTo(0,0);
}
function syncCaseView(){
 const planning=node('planning');if(!planning)return;
 for(const child of node('case').children)child.hidden=appView==='plan'?(child!==planning&&!child.classList.contains('hero')):child===planning;
 if(appView==='analysis')node('case').insertAdjacentHTML('beforeend','<div class="analysis-cta"><button class="button primary" id="analysis-plan">이 근거로 계획 작성</button></div>');
 const button=node('analysis-plan');if(button)button.onclick=()=>freshPlan();styleDataWidgets();
}
function styleDataWidgets(){
 for(const root of [node('case'),node('workspace')])if(root){root.querySelectorAll('button').forEach(b=>b.classList.add('button',b.classList.contains('secondary')?'secondary':'primary'));root.querySelectorAll('input,textarea,select').forEach(e=>e.classList.add('field'));}
}
function bindShell(){
 node('app').querySelectorAll('a[href^="#"]').forEach(a=>a.onclick=e=>{e.preventDefault();navigateApp(a.hash.slice(1));});
 node('app').querySelectorAll('[data-action="help"]').forEach(b=>b.onclick=()=>appDialog('사용 안내','<ol class="relation-list"><li>한눈에 보기에서 실제 계절성·최근 흐름 확인</li><li>홍보 제안의 월·고객군·근거 확인 후 계획 작성</li><li>일정에서 저장한 계획 수정</li><li>실제 수행한 활동만 실행 결과에 기록</li><li>전체 계획·기록 JSON과 평가 양식을 평가 요청자에게 직접 전달</li></ol><p class="notice">시연용 로그인이며 서버 인증이 아닙니다. 두 역할은 같은 브라우저 저장 공간을 사용합니다. 개인정보를 입력하지 마세요. 미측정 값은 빈칸으로 유지하세요.</p>'));
 node('app').querySelectorAll('[data-action="logout"]').forEach(b=>b.onclick=()=>{appDialog('로그아웃할까요?',`<p>저장한 계획과 기록은 유지됩니다. 미저장 입력은 이 탭이 열린 동안만 유지됩니다.</p><button class="button primary" id="confirm-logout">로그아웃</button>`);node('confirm-logout').onclick=()=>{node('dialog').close();if(node('reason')&&!node('case').hidden)capture();appRole=null;try{sessionStorage.removeItem(SESSION_KEY);}catch{}navigateApp('login');};});
 const toggle=node('app').querySelector('[data-action="sidebar-toggle"]'),resize=node('sidebar-resizer');
 const layout=(collapsed,width)=>{document.documentElement.classList.toggle('sidebar-collapsed',collapsed);document.documentElement.style.setProperty('--sidebar-width',width+'px');toggle.setAttribute('aria-expanded',String(!collapsed));toggle.setAttribute('aria-label',collapsed?'메뉴 펼치기':'메뉴 접기');resize.setAttribute('aria-valuenow',width);resize.setAttribute('aria-valuemin',collapsed?'76':'216');};
 layout(document.documentElement.classList.contains('sidebar-collapsed'),parseInt(document.documentElement.style.getPropertyValue('--sidebar-width'))||248);
 toggle.onclick=()=>{const collapsed=!document.documentElement.classList.contains('sidebar-collapsed');layout(collapsed,collapsed?76:248);};
 node('app').querySelector('[data-action="sidebar-reset"]').onclick=()=>layout(false,248);
 resize.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const v=Number(resize.getAttribute('aria-valuenow'));layout(false,e.key==='Home'?216:e.key==='End'?360:Math.min(360,Math.max(216,v+(e.key==='ArrowRight'?10:-10))));};
 resize.onpointerdown=e=>{if(e.button!==0)return;resize.setPointerCapture(e.pointerId);};resize.onpointermove=e=>{if(resize.hasPointerCapture(e.pointerId))layout(false,Math.min(360,Math.max(216,e.clientX)));};resize.onpointerup=e=>{if(resize.hasPointerCapture(e.pointerId))resize.releasePointerCapture(e.pointerId);};
 const closeMenu=()=>{node('sidebar').classList.remove('open');node('app').querySelector('.mobile-scrim').classList.remove('open');node('app').querySelector('.workspace').inert=false;node('app').querySelector('.mobile-menu').setAttribute('aria-expanded','false');};
 node('app').querySelector('[data-action="menu"]').onclick=()=>{node('sidebar').classList.add('open');node('app').querySelector('.mobile-scrim').classList.add('open');node('app').querySelector('.workspace').inert=true;node('app').querySelector('.mobile-menu').setAttribute('aria-expanded','true');node('sidebar').querySelector('.nav-link').focus();};
 node('app').querySelector('[data-action="close-menu"]').onclick=closeMenu;node('sidebar').onkeydown=e=>{if(e.key==='Escape'){closeMenu();node('app').querySelector('.mobile-menu').focus();}};
}
function filters(){return `<div class="filter-strip"><span class="filter-pill">${icon('pin')}분석 지역 <b>구좌읍 · 음식점업</b></span><label class="filter-pill">대상 월<select id="screen-month" aria-label="대상 월">${evidence.months.map(m=>`<option value="${m.month}" ${m.month===month?'selected':''}>${m.month}월</option>`).join('')}</select></label><label class="filter-pill">고객군<select id="screen-customer" aria-label="고객군">${customers.map(c=>`<option ${c===customer?'selected':''}>${c}</option>`).join('')}</select></label><span class="filter-note">구좌 외 지역·다른 업종은 이 시연의 지원 범위가 아닙니다.</span></div>`;}
function trendChart(){
 const values=evidence.months.map(m=>m.stability[chartMetric==='visits'?'visits_daily_index':'spend_daily_index']);const max=Math.max(1.5,...values)*1.08;
 const pts=values.map((v,i)=>[36+i*50,186-v/max*162]);
 return `<svg class="chart" viewBox="0 0 620 221" role="img" aria-label="2023년부터 2025년까지 평균 일평균 계절지수. 수치는 아래 표에 제공">${[0,.5,1,1.5].map(v=>`<line class="gridline" x1="36" x2="600" y1="${186-v/max*162}" y2="${186-v/max*162}"/><text x="24" y="${190-v/max*162}" text-anchor="end">${v}</text>`).join('')}<path d="M36,186L${pts.map(p=>p.join(',')).join('L')}L586,186Z" fill="#eaf2e5"/><path d="M${pts.map(p=>p.join(',')).join('L')}" fill="none" stroke="#528451" stroke-width="2.8"/>${pts.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="4" fill="${i+1===month?'#eba849':'#528451'}"><title>${i+1}월 ${values[i].toFixed(3)}</title></circle><text x="${x}" y="213" text-anchor="middle">${i+1}월</text>`).join('')}</svg><details class="chart-table"><summary>월별 수치 표로 보기</summary><div class="table-wrap"><table><thead><tr>${values.map((_,i)=>`<th>${i+1}월</th>`).join('')}</tr></thead><tbody><tr>${values.map(v=>`<td>${v.toFixed(3)}</td>`).join('')}</tr></tbody></table></div></details>`;
}
function overviewPage(){const {m,g}=selected(),q=Math.floor((month-1)/3)*3+1;return titleBlock('이번 비수기, 무엇을 홍보할까요?','지역 흐름에서 근거를 확인하고, 우리 가게의 계획과 실행 기록으로 이어가세요.')+filters()+`<div class="overview-trend"><section class="panel"><div class="chart-box"><div class="panel-heading"><div><h2>우리 지역의 계절 흐름</h2><p>구좌읍 · 2023년부터 2025년까지 평균 · 각 연도 평균 = 1</p></div><div class="segmented" aria-label="차트 지표"><button data-chart="visits" class="${chartMetric==='visits'?'selected':''}">방문</button><button data-chart="spend" class="${chartMetric==='spend'?'selected':''}">소비</button></div></div><div class="chart-summary"><strong>${month}월 ${m.stability.stable_low?'세 해에 걸쳐 낮은 수요':'일관된 낮은 수요로 분류하지 않음'}</strong></div>${trendChart()}</div><div class="chart-foot">${icon('info')}일수 보정 계절지수 · 전년 증감률·미래 예측이 아님<button class="text-button" data-source>자료 기준 ${icon('chevron')}</button></div></section></div><section class="panel panel-padding timeline-panel"><div class="timeline-intro"><h2>우리 가게의 3개월</h2><p>2026년 ${q}월부터 ${q+2}월까지 · 저장한 계획만 표시</p></div><div class="timeline-months">${[q,q+1,q+2].map(m=>`<div class="timeline-item"><b>${m}월</b><span>${workspace.plans.filter(p=>p.month===m).length}개 계획</span></div>`).join('')}</div><button class="button" data-go="calendar">일정 보기 ${icon('arrow')}</button></section><section class="panel panel-padding recommendation-summary"><div><h3>${month}월 ${escapeText(customer)}을 살펴보세요</h3><p>2025년 같은 월 소비 비중 ${number(g.share_2025_pct,2)}% · 금액 비중이며 사람 수가 아닙니다.</p></div><button class="button primary" data-go="recommendations">홍보 제안 조회 ${icon('arrow')}</button></section><div class="real-stats">${[['방문 집계',updates.ytd.visits],['음식점 소비',updates.ytd.spend],['이용건수',updates.ytd.transactions]].map(([n,v])=>`<article class="panel panel-padding"><p>${n} · 동기간 증감</p><h2>${delta(v.change_pct)}</h2><p class="hint">2026년 1월부터 8월 / 2025년 동기간</p></article>`).join('')}</div><section class="panel panel-padding"><h2>실제 활용 사례와 창출 효과</h2><p>분석과 기능 검증을 마쳤습니다. 실제 사용자 평가·업무시간 절감·매출 증가는 아직 미측정입니다.</p><button class="text-button" data-go="records">내가 입력한 실행 기록 보기 ${icon('arrow')}</button></section><section class="panel panel-padding"><h2>실제 데이터 반영 현황</h2><ul class="status-list"><li>방문·음식점 소비·시간대·목적지 방문 <b>공식 집계 4종 연결</b></li><li>구좌 월·고객군 <b>12개월 × 3개 고객군</b></li><li>수집 기준일 <b>${escapeText(evidence.snapshot)}</b></li></ul><p class="hint">일부 시간대는 미관측입니다. 전체 기능 완성률이나 실제 사업 효과를 뜻하지 않습니다.</p></section>`;}
function proposal(m){const s=m.stability,g=m.segments.find(x=>x.customer===customer),bands=updates.historical_bands.find(x=>x.month===m.month).bands.filter(x=>x.customer===customer&&x.spend_share_pct!==null);const peak=bands.slice().sort((a,b)=>b.spend_share_pct-a.spend_share_pct)[0];return {month:m.month,customer,title:`${m.month}월 ${customer} 방문 안내 검토`,reason:`방문 일평균 지수 ${number(s.visits_daily_index,3)}, 음식점 소비 지수 ${number(s.spend_daily_index,3)}. 2025년 같은 월 ${customer} 소비 비중 ${number(g.share_2025_pct,2)}%. ${s.stable_low?'세 해 반복 낮은 수요에 해당':'반복 낮은 수요로 분류하지 않음'}.`,action:`${peak?`${peak.band}(${peak.start}시부터 ${peak.end}시)의 관측 소비 비중 ${number(peak.spend_share_pct,2)}%를 참고해 `:''}메뉴·영업시간 안내를 준비합니다. 광고 최적 시간이나 할인 효과는 검증되지 않았으므로 실제 영업·원가·혼잡 상황을 확인한 뒤 실행 여부를 결정합니다.`,date:`2026-${String(m.month).padStart(2,'0')}-15`,metric:'계획 작성 시간·실제 게시 여부·확인 가능한 반응 수 (미측정은 빈칸)'};}
function recommendationPage(){const q=Math.min(10,Math.floor((month-1)/3)*3+1);return titleBlock('우리 가게에 맞는 홍보 제안','공식 통계에서 만든 검토 초안입니다. 운영 조건을 확인하고 수정한 뒤 저장하세요.')+filters()+`<p class="notice">선택한 고객군의 ${q}월부터 ${q+2}월까지 제안입니다. 상품·할인·광고 효과를 보장하지 않으며 저장은 실행 완료가 아닙니다.</p><div class="calendar-grid">${evidence.months.filter(m=>m.month>=q&&m.month<q+3).map(m=>{const p=proposal(m);return `<section class="panel panel-padding recommendation"><span class="badge green">2026년 ${m.month}월</span><h2>${escapeText(p.title)}</h2><p>${escapeText(p.reason)}</p><dl class="proposal-fields"><dt>준비할 활동</dt><dd>${escapeText(p.action)}</dd><dt>출처</dt><dd>regSn 21·27·39 · 2023년부터 2025년까지</dd></dl><div class="row wrap"><button class="button" data-proposal-proof="${m.month}">근거 상세보기</button><button class="button primary" data-proposal="${m.month}">계획 작성</button></div></section>`;}).join('')}</div><button class="button" data-source>자료 기준</button>`;}
function selectProposal(n){if(node('reason')&&!node('case').hidden)capture();editingId=null;month=n;const p=proposal(selected().m);if(!dirtyPlans.has(draftKey()))drafts[draftKey()]={reason:p.reason,action:p.action,date:p.date,metric:p.metric};navigateApp('plan');}
function dataPage(){return titleBlock('자료·기준 확인','검증된 공개 집계와 분석 규칙을 확인합니다. 서버 관리 권한이나 CSV 등록 기능은 제공하지 않습니다.')+`<section class="panel panel-padding"><h2>현재 연결된 실제 데이터</h2><ul class="relation-list">${evidence.sources.map(s=>`<li><a href="${escapeText(s.url)}" target="_blank" rel="noopener">${escapeText(sourceName(s))}</a></li>`).join('')}</ul><p>수집 ${escapeText(evidence.snapshot)} · 구좌읍 · 음식점업 전체</p><p class="notice">원본 CSV와 신청서는 공개 사이트에 게시하지 않습니다. 집계 자료는 저장소의 검증된 빌드를 통해 갱신합니다.</p></section><section class="panel panel-padding"><h2>비수기 판단 기준</h2><p>${escapeText(evidence.stability_rule)}</p><p class="hint">기준값 0.95는 통계적 유의수준이 아닙니다. 규칙의 적중·발견 비율과 한계는 지역 분석에서 함께 확인하세요.</p><button class="button" data-go="analysis">분석과 비교 결과 보기</button></section><section class="panel panel-padding"><h2>자료의 한계</h2><ul class="relation-list">${evidence.warnings.map(w=>`<li>${escapeText(w)}</li>`).join('')}</ul><p>로그인 역할은 시연용이며 실제 접근 권한을 분리하지 않습니다.</p></section>`;}
function bindScreen(){
 node('screen').querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{if(b.dataset.go==='calendar')quarter=Math.floor((month-1)/3)*3+1;navigateApp(b.dataset.go);});node('screen').querySelectorAll('[data-source]').forEach(b=>b.onclick=sourceDialog);
 node('screen').querySelectorAll('[data-chart]').forEach(b=>b.onclick=()=>{chartMetric=b.dataset.chart;navigateApp('overview',true);});
 if(node('screen-month'))node('screen-month').onchange=e=>{editingId=null;month=Number(e.target.value);navigateApp(appView,true);};if(node('screen-customer'))node('screen-customer').onchange=e=>{editingId=null;customer=e.target.value;navigateApp(appView,true);};
 node('screen').querySelectorAll('[data-proposal]').forEach(b=>b.onclick=()=>selectProposal(Number(b.dataset.proposal)));
 node('screen').querySelectorAll('[data-proposal-proof]').forEach(b=>b.onclick=()=>{editingId=null;month=Number(b.dataset.proposalProof);navigateApp('analysis');});
}
function drawQuarter(){
 const box=node('workspace');box.querySelector('h1').textContent='3개월 홍보 일정표';
 box.querySelector('.actions').insertAdjacentHTML('afterend',`<div class="quarter-control"><label>확인할 분기 <select id="quarter" class="field">${[1,4,7,10].map(q=>`<option value="${q}" ${q===quarter?'selected':''}>2026년 ${q}월부터 ${q+2}월</option>`).join('')}</select></label></div><div class="calendar-grid quarter-grid">${[quarter,quarter+1,quarter+2].map(m=>`<section class="panel panel-padding month-column" data-calendar-month="${m}"><h2>${m}월</h2><p>${workspace.plans.filter(p=>p.month===m).length}개 계획</p><button class="button" data-month-plan="${m}">이 달 계획 작성</button>${workspace.plans.some(p=>p.month===m)?'':'<p class="hint">저장한 계획이 없습니다.</p>'}</section>`).join('')}</div>`);
 box.querySelectorAll('.plan-card').forEach(card=>{const id=card.querySelector('[data-edit]').dataset.edit;const p=workspace.plans.find(p=>p.id===id);const column=box.querySelector(`[data-calendar-month="${p.month}"]`);if(column){card.hidden=false;column.append(card);}else card.hidden=true;});
 node('quarter').onchange=e=>{quarter=Number(e.target.value);navigateApp('calendar',true);};box.querySelectorAll('[data-month-plan]').forEach(b=>b.onclick=()=>{editingId=null;month=Number(b.dataset.monthPlan);navigateApp('plan');});
}
function startApplication(){dataReady=true;navigateApp(location.hash.slice(1)||'overview',true);}
const baseDrawWorkspace=drawWorkspace;
drawWorkspace=function(view){baseDrawWorkspace(view);if(view==='calendar')drawQuarter();const count=document.querySelector('.nav-link[href="#calendar"] .count');if(count)count.textContent=workspace.plans.length;styleDataWidgets();};
const baseShowRecord=showRecord;
showRecord=function(id){baseShowRecord(id);styleDataWidgets();};
window.addEventListener('hashchange',()=>navigateApp(location.hash.slice(1),true));
window.addEventListener('resize',()=>{const shell=node('app');if(window.innerWidth>767&&shell.querySelector('.workspace')){shell.querySelector('.workspace').inert=false;node('sidebar').classList.remove('open');shell.querySelector('.mobile-scrim').classList.remove('open');shell.querySelector('.mobile-menu').setAttribute('aria-expanded','false');}});
window.addEventListener('beforeunload',e=>{if(hasUnsaved()){e.preventDefault();e.returnValue='';}});
showLogin();
document.querySelector('body>.skip').onclick=e=>{e.preventDefault();node('main').focus();};
