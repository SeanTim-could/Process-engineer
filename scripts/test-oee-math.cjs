const assert=require('node:assert/strict'),O=require('../frontend/oee-math.js'),at=s=>Date.parse(s+'+08:00'),near=(a,b)=>assert(Math.abs(a-b)<1e-10,a+' != '+b);
const now=at('2026-11-03T12:00:00'),bounds=O.monthRange('2026-11',now);near(bounds.days,2.5);assert.equal(bounds.from,at('2026-11-01T00:00:00'));assert.equal(bounds.to,now);assert.equal(bounds.end,at('2026-12-01T00:00:00'));assert(!bounds.complete);
near(O.monthRange('2024-02',at('2024-03-02T00:00:00')).days,29);near(O.monthRange('2025-02',at('2025-03-02T00:00:00')).days,28);near(O.monthRange('2026-12',at('2027-01-01T00:00:00')).days,31);near(O.monthRange('2026-11',at('2026-11-02T00:00:00')).days,1);near(O.monthRange('2026-12',now).days,0);
for(const value of ['2026-00','2026-13','2026-1','1899-01','bad'])assert.throws(()=>O.monthRange(value));
const loss={id:'loss_one',name:'跳车',kind:'range',counted:true,from:at('2026-11-02T00:00:00'),to:at('2026-11-03T00:00:00')},integrate=range=>({value:range===bounds?175:50,coveredHours:(range.to-range.from)/3600000,segments:1});
// The user counts only marked losses, rather than all monthly underproduction.
let result=O.summarize({mdc:100,bounds,losses:[loss],integrate});near(result.target,250);near(result.actual,175);near(result.countedLoss,50);near(result.oee,80);
result=O.summarize({mdc:100,bounds,losses:[{...loss,counted:false}],integrate});near(result.countedLoss,0);near(result.oee,100);near(result.target,250);
result=O.summarize({mdc:100,bounds,losses:[],integrate:range=>({...integrate(range),value:0})});near(result.oee,100);near(result.actual,0);
result=O.summarize({mdc:100,bounds,losses:[loss],integrate:range=>({...integrate(range),value:2000})});near(result.losses[0].tonnes,0);near(result.oee,100);
result=O.summarize({mdc:100,bounds,losses:[loss],integrate:range=>({...integrate(range),coveredHours:1})});assert.equal(result.losses[0].tonnes,null);assert.equal(result.oee,null,'Missing coverage is not a recorded shutdown loss');
result=O.summarize({mdc:100,bounds,losses:[{...loss,counted:false}],integrate:range=>({...integrate(range),coveredHours:1})});near(result.oee,100);
result=O.summarize({mdc:100,bounds,integrate:()=>({value:null,coveredHours:0})});assert.equal(result.oee,null);assert.equal(result.actual,null);
result=O.summarize({mdc:100,bounds:O.monthRange('2026-12',now),integrate:()=>{throw Error('No future integration');}});assert.equal(result.oee,null);
result=O.summarize({mdc:1.1,bounds,losses:Array.from({length:60},(_,i)=>({...loss,from:bounds.from+i*3600000,to:bounds.from+(i+1)*3600000})),integrate:range=>({value:0,coveredHours:(range.to-range.from)/3600000})});assert.equal(result.oee,0,'Floating point roundoff cannot turn complete loss into negative OEE');
assert.deepEqual(O.union([{from:10,to:20},{from:0,to:10}]),[{from:0,to:20}]);assert.throws(()=>O.union([{from:1,to:1}]));assert.throws(()=>O.union([{from:0,to:Infinity}]));
console.log(JSON.stringify({passed:true,checks:['Beijing calendar months, leap days, year rollover and elapsed partial months','OEE deducts only checked interval losses; monthly actual output does not silently deduct other losses','Zero output, above-MDC output, missing coverage, unchecked losses and future months remain distinct']},null,2));
