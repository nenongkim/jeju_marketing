'use strict';
function validateRecent(d){
 if(d.schema_version!=='1.0.0'||d.region!=='구좌읍'||JSON.stringify(d.common_months)!==JSON.stringify([1,2,3,4,5,6,7,8]))throw Error('동기간 범위 오류');
 for(const row of [d.ytd,...d.monthly]){
  for(const key of ['visits','spend','transactions']){const x=row[key];if(!x||![x.value_2025,x.value_2026,x.change_pct].every(Number.isFinite)||Math.abs(x.change_pct-(x.value_2026/x.value_2025-1)*100)>1e-7)throw Error('동기간 계산 오류');}
 }
 if(d.monthly.length!==8||new Set(d.monthly.map(m=>m.month)).size!==8||d.monthly.some(m=>!d.common_months.includes(m.month)))throw Error('월 누락');
 if(d.historical_bands.length!==12||d.recent_bands.length!==2)throw Error('시간 구간 누락');
 for(const set of [...d.historical_bands,...d.recent_bands])for(const name of ['도민','내국인 관광객','외국인 관광객']){
  const rows=set.bands.filter(r=>r.customer===name);if(rows.length!==6)throw Error('고객군 시간 구간 누락');
  for(const key of ['spend_share_pct','count_share_pct'])if(rows.some(r=>r[key]!==null&&(!Number.isFinite(r[key])||r[key]<0))||Math.abs(rows.reduce((s,r)=>s+(r[key]??0),0)-100)>1e-6)throw Error('시간 구간 비중 오류');
 }
 for(const r of d.rule_benchmark.rules)if(r.tp+r.fp!==r.flagged||r.tp+r.fn!==d.rule_benchmark.actual_low||r.tp+r.fp+r.fn+r.tn!==516)throw Error('규칙 대조 오류');
}
function delta(v){return v===null?'비교 불가':`${v>0?'+':''}${number(v,2)}%`;}
function recentPanels(d,month,customer){
 const y=d.ytd,selectedMonth=d.monthly.find(m=>m.month===month);
 const metricRows=(r)=>[['방문 집계',r.visits,'명'],['음식점 소비',r.spend,'원'],['카드 이용건수',r.transactions,'건']].map(([name,x,unit])=>`<tr><th>${name}</th><td>${number(x.value_2025,0)}${unit}</td><td>${number(x.value_2026,0)}${unit}</td><td>${delta(x.change_pct)}</td></tr>`).join('');
 const history=d.historical_bands.find(m=>m.month===month).bands.filter(r=>r.customer===customer);
 const past=d.recent_bands.find(r=>r.year===2025).bands.filter(r=>r.customer===customer),current=d.recent_bands.find(r=>r.year===2026).bands.filter(r=>r.customer===customer);
 return `<section aria-labelledby="recent-title"><span class="step">최근 상황 확인</span><h2 id="recent-title">2026년 1월부터 8월까지, 같은 기간과 비교합니다</h2><p class="muted">구좌읍 · 2025년과 2026년 각각 8개월 · 방문·음식점 소비·카드 이용건수의 공통 관측 기간</p><div class="table-wrap"><table><caption>소비는 명목금액, 이용건수는 고유 고객 수가 아님</caption><thead><tr><th>지표</th><th>2025년 동기간</th><th>2026년 동기간</th><th>증감률</th></tr></thead><tbody>${metricRows(y)}</tbody></table></div>
 <h3>고객군마다 최근 흐름이 다릅니다</h3><div class="table-wrap"><table><thead><tr><th>고객군</th><th>소비금액 증감</th><th>이용건수 증감</th></tr></thead><tbody>${y.segments.map(s=>`<tr class="${s.customer===customer?'selected-row':''}"><th>${escapeText(s.customer)}</th><td>${delta(s.spend.change_pct)}</td><td>${delta(s.transactions.change_pct)}</td></tr>`).join('')}</tbody></table></div><p class="hint">외국인 증가에는 상대적으로 작은 전년 규모가 영향을 줄 수 있습니다. 증가율만으로 광고 우선순위를 정하지 않습니다. 내국인 감소와 외국인 증가를 합친 전체 수치만 보고 고객군을 판단하지 마세요.</p>
 <details><summary>선택한 ${month}월의 2025·2026년 비교</summary>${selectedMonth?`<div class="table-wrap"><table><thead><tr><th>지표</th><th>2025년 ${month}월</th><th>2026년 ${month}월</th><th>증감률</th></tr></thead><tbody>${metricRows(selectedMonth)}</tbody></table></div>`:`<p class="warning">${month}월은 세 자료의 공통 비교 기간에 포함되지 않습니다. 특히 2026년 12월 실적은 아직 없습니다. 1월부터 8월까지의 변화율을 ${month}월 예측으로 대입하지 않습니다.</p>`}</details></section>
 <section><h2>시간 구간별 금액과 이용건수를 함께 봅니다</h2><p class="muted">${month}월 ${escapeText(customer)} · 2023년부터 2025년까지 같은 월 합산 비중 · 최적 할인·광고 시간은 아님</p><div class="table-wrap"><table><caption>구간 경계는 분석 편의를 위한 구분입니다. 비중은 관측된 합계 기준입니다.</caption><thead><tr><th>구간</th><th>소비금액 비중</th><th>이용건수 비중</th><th>관측 시간칸 / 예상칸</th></tr></thead><tbody>${history.map(r=>`<tr><th>${escapeText(r.band)} (${r.start}시부터 ${r.end}시)</th><td>${percent(r.spend_share_pct)}</td><td>${percent(r.count_share_pct)}</td><td>${r.observed_year_month_hours} / ${r.expected_year_month_hours}</td></tr>`).join('')}</tbody></table></div>
 <details><summary>최근 동기간 시간 구간 비중도 확인하기</summary><p class="hint">아래는 선택한 ${month}월이 아니라 1월부터 8월까지입니다. 2025년과 2026년의 ${escapeText(customer)} 소비 패턴을 비교합니다.</p><div class="table-wrap"><table><thead><tr><th>구간</th><th>금액 비중 2025</th><th>2026</th><th>건수 비중 2025</th><th>2026</th></tr></thead><tbody>${past.map(r=>{const n=current.find(x=>x.band===r.band);return `<tr><th>${escapeText(r.band)}</th><td>${percent(r.spend_share_pct)}</td><td>${percent(n.spend_share_pct)}</td><td>${percent(r.count_share_pct)}</td><td>${percent(n.count_share_pct)}</td></tr>`;}).join('')}</tbody></table></div></details><p class="hint">시간대 원천(regSn 39)과 지역별 원천(regSn 27)은 같은 기간·고객군 대조에서 금액 최대 ${d.reconciliation.max_amount_difference_won}원, 이용건수 최대 ${d.reconciliation.max_count_difference}건 차이가 있습니다. 이 차이의 원인을 확정하지 않았으며 원본을 수정하지 않았습니다.</p></section>
 <details class="panel"><summary>비수기 규칙은 얼마나 보수적인가요?</summary><p>2023·2024년까지의 자료로 2025년을 비교했습니다. 전체 516개 지역·월 중 실제 두 지수가 낮았던 경우는 ${d.rule_benchmark.actual_low}개입니다.</p><div class="table-wrap"><table><thead><tr><th>선정 기준</th><th>후보 수</th><th>실제 낮음</th><th>선정 후보 적중 비율</th><th>낮은 사례 발견 비율</th></tr></thead><tbody>${d.rule_benchmark.rules.map(r=>`<tr><th>${escapeText(r.label)}</th><td>${r.flagged}</td><td>${r.tp}</td><td>${percent(r.precision_pct)}</td><td>${percent(r.recall_pct)}</td></tr>`).join('')}</tbody></table></div><p class="hint">보수적으로 고른 후보의 적중 비율은 높아졌지만 더 많은 낮은 수요 사례를 놓칩니다. ${escapeText(d.rule_benchmark.note)}</p></details>`;
}
