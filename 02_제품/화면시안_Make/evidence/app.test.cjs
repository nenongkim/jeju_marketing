const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,f),'utf8');
const data=JSON.parse(read('case-data.json')),recent=JSON.parse(read('recent-data.json'));
// Test real monthly/customer proposal content and unsaved-draft isolation without a browser.
const ctx=vm.createContext({sessionStorage:{getItem:()=>null},window:{addEventListener:()=>{}},document:{getElementById:()=>null},FigmaUI:{icon:()=>'',titles:{}},evidence:data,updates:recent,number:(n,d=1)=>n.toFixed(d),escapeText:String});
let app=read('app.js').replace('const baseDrawWorkspace=drawWorkspace;', 'const baseDrawWorkspace=()=>{};').replace('const baseShowRecord=showRecord;', 'const baseShowRecord=()=>{};');
app=app.slice(0,app.lastIndexOf('showLogin();'));
vm.runInContext("let month=12,customer='内国';let editingId=null,drafts={};const dirtyPlans=new Set();function draftKey(){return month+':'+customer;}function selected(){return {m:evidence.months.find(m=>m.month===month)};}",ctx);
vm.runInContext(app,ctx);
for(const c of ['내국인 관광객','도민','외국인 관광객'])for(const m of data.months){vm.runInContext(`customer=${JSON.stringify(c)}`,ctx);const p=ctx.proposal(m);assert.equal(p.month,m.month);assert.equal(p.customer,c);assert.match(p.reason,new RegExp(m.stability.visits_daily_index.toFixed(3).replace('.','\\.')));assert.equal(p.date,`2026-${String(m.month).padStart(2,'0')}-15`);assert.ok(p.action.includes('검증되지 않았'));assert.ok(!/undefined|NaN/.test(JSON.stringify(p)));}
vm.runInContext("navigateApp=()=>{}; customer='도민';month=12;",ctx);
ctx.selectProposal(12);assert.ok(vm.runInContext("drafts[draftKey()].reason.includes('0.760')",ctx));
vm.runInContext("drafts[draftKey()].reason='사용자가 작성한 이유';dirtyPlans.add(draftKey());",ctx);ctx.selectProposal(12);assert.equal(vm.runInContext('drafts[draftKey()].reason',ctx),'사용자가 작성한 이유');
ctx.selectProposal(11);assert.equal(vm.runInContext('month',ctx),11);assert.ok(vm.runInContext("drafts[draftKey()].reason.includes('0.890')",ctx));
for(const label of ['실제 데이터 반영률 25%','2.1배','18% 증가','카페 A'])assert.ok(!read('app.js').includes(label));
console.log('PASS: 36 real proposals; correct month/date/customer; unsaved user text preserved and isolated; no legacy fabricated outcomes');
