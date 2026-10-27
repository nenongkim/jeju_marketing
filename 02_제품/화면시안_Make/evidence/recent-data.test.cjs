const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const d=JSON.parse(fs.readFileSync(path.join(__dirname,'recent-data.json'),'utf8'));
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'recent.js'),'utf8'),ctx);ctx.validateRecent(d);
for(const mutate of [x=>x.common_months.pop(),x=>x.ytd.visits.change_pct=42,x=>x.monthly[0].month=8,x=>x.historical_bands[0].bands.pop(),x=>x.rule_benchmark.rules[0].tp=999]){let b=structuredClone(d);mutate(b);assert.throws(()=>ctx.validateRecent(b));}
assert.equal(d.ytd.visits.value_2026,4573686);assert.equal(d.ytd.transactions.value_2026,1313471);
for(const y of [2025,2026])for(const k of ['visits','spend','transactions'])assert.equal(d.monthly.reduce((s,m)=>s+m[k]['value_'+y],0),d.ytd[k]['value_'+y]);
for(const r of [d.ytd,...d.monthly])for(const y of [2025,2026])for(const k of ['spend','transactions'])assert.equal(r.segments.reduce((s,g)=>s+g[k]['value_'+y],0),r[k]['value_'+y]);
for(const x of d.rule_benchmark.rules){assert.ok(Math.abs(x.precision_pct-100*x.tp/x.flagged)<1e-9);assert.ok(Math.abs(x.recall_pct-100*x.tp/d.rule_benchmark.actual_low)<1e-9);}
assert.equal(d.monthly.find(m=>m.month===12),undefined);
console.log('PASS: matched periods, sum reconciliation, benchmark arithmetic, unavailable December, malformed data rejection');
