const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'case-data.json'),'utf8'));
const code=fs.readFileSync(path.join(__dirname,'case.js'),'utf8').split('function selected()')[0];
const context=vm.createContext({localStorage:{getItem:()=>null}});
vm.runInContext(code,context);
context.validate(data);
const clone=()=>JSON.parse(JSON.stringify(data));
let broken=clone();broken.months[0].month=12;assert.throws(()=>context.validate(broken));
broken=clone();broken.months[0].segments[0].hours[0].share_pct=999;assert.throws(()=>context.validate(broken));
broken=clone();broken.months[0].segments[0].hours[0].hour=1;assert.throws(()=>context.validate(broken));
broken=clone();broken.schema_version='unknown';assert.throws(()=>context.validate(broken));
const december=data.months.find(m=>m.month===12),august=data.months.find(m=>m.month===8);
assert.equal(december.stability.stable_low,true);assert.equal(august.stability.stable_low,false);
assert.equal(december.stability.both_below_mean_years,3);
assert.ok(Math.abs(december.stability.visits_daily_index-0.7596376588850685)<1e-10);
assert.ok(data.months.some(m=>m.segments.some(g=>g.hours.some(h=>h.share_pct===null))));
for(const m of data.months){assert.equal(m.stability.month,m.month);for(const p of m.places){assert.equal(p.month,m.month);assert.equal(p.years_observed,3);}}
console.log('PASS: schema failure cases, hour identities and shares, December/August contrast, missing-hour preservation, month-aligned places');

// Startup failure must show an error without inventing sample observations.
(async()=>{
 const nodes={'#loading':{textContent:'',setAttribute(k,v){this[k]=v;}},'#case':{hidden:true}};
 const ctx=vm.createContext({localStorage:{getItem:()=>null},document:{querySelector:s=>nodes[s]},fetch:()=>Promise.resolve({ok:false,status:404})});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'case.js'),'utf8'),ctx);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(nodes['#loading'].role,'alert');assert.ok(nodes['#loading'].textContent.includes('예시 수치로 대체하지 않았습니다'));
 assert.equal(nodes['#case'].hidden,true);
 console.log('PASS: failed data load remains an explicit error, no synthetic fallback');
})().catch(e=>{console.error(e);process.exitCode=1;});
