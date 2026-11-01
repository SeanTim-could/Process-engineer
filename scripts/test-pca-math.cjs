const assert=require('node:assert/strict'),M=require('../frontend/pca-math.js'),r=require('./fixtures/pca-python-reference.json');
function close(a,b,label){assert(Number.isFinite(a)&&Math.abs(a-b)<=2e-8*Math.max(1,Math.abs(b)),`${label}: ${a} vs ${b}`);}
const model=M.train(r.training);assert.equal(model.n,r.n);M.validate(JSON.parse(JSON.stringify(model)));
for(const name of ['center','scale','eigenvalues','ratios'])model[name].forEach((v,i)=>close(v,r[name][i],name+i));for(const name of ['t2','spe'])close(model.limits[name],r.limits[name],name+' limit');
const report=M.analyze(model,r.analysis);
report.points.forEach((p,i)=>{for(const key of ['t2','spe'])close(p[key],r[key][i],key+i);for(const key of ['t2Contribution','speContribution'])p[key].forEach((v,j)=>close(v,r[key][i][j],key+i+','+j));close(p.t2Contribution.reduce((a,b)=>a+b,0),p.t2,'T² contribution sum');close(p.speContribution.reduce((a,b)=>a+b,0),100,'SPE contribution sum');});
const compact=M.analyze(model,r.analysis,{compact:true});assert.deepEqual(compact.t2Pareto,report.t2Pareto);assert.deepEqual(compact.spePareto,report.spePareto);assert.equal(compact.points[0].scores,undefined);assert.equal(compact.t2Count,report.t2Count);
for(const key of ['t2Pareto','spePareto']){close(report[key].at(-1).cumulative,100,key+' cumulative');const hit=report[key].findIndex(v=>v.cumulative>=80);assert(report[key].slice(0,hit+1).every(v=>v.important));assert(report[key].slice(hit+1).every(v=>!v.important));}
assert.throws(()=>M.train(r.training.map(row=>[row[0],1])),/恒定/);assert.throws(()=>M.train(r.training.slice(0,5)),/10/);assert.throws(()=>M.train([[NaN,2],...r.training.slice(0,20).map(r=>r.slice(0,2))]),/无效/);
const bad=structuredClone(model);bad.components[0][0]+=1;assert.throws(()=>M.validate(bad),/矩阵/);const badLimit=structuredClone(model);badLimit.limits.t2*=2;assert.throws(()=>M.validate(badLimit),/控制限/);
const rankOne=M.train(Array.from({length:60},(_,i)=>[i,2*i,-3*i]));assert.equal(rankOne.n,1);assert.equal(rankOne.limits.spe,null);assert.equal(M.project(rankOne,[1,2,-3]).speFlag,false);M.validate(rankOne);
const all=M.train(Array.from({length:100},(_,i)=>[Math.sin(i*.2),Math.cos(i*.7)]),{threshold:.9999});assert.equal(all.n,2);assert.equal(all.limits.spe,null);M.validate(all);
// Contribution decomposition remains correct for imported/nonzero PCA centers.
const centered=structuredClone(model);centered.mean=[.1,-.2,.05,.08,-.04];const p=M.project(centered,r.analysis[0]);close(p.t2Contribution.reduce((a,b)=>a+b,0),p.t2,'centered T²');close(p.speContribution.reduce((a,b)=>a+b,0),100,'centered SPE');
const untouched=JSON.stringify(model);M.analyze(model,r.analysis);assert.equal(JSON.stringify(model),untouched);
console.log('PCA: Python numeric parity, contribution identities, compact/full parity, fixed model, invalid and full-retention cases passed.');
