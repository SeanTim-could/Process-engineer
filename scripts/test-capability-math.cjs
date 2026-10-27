const assert=require('node:assert/strict'),M=require('../frontend/analysis-math.js'),C=require('../frontend/capability-math.js');
const near=(actual,expected,tol=1e-9)=>assert(M.finite(actual)&&Math.abs(actual-expected)<tol,`${actual} != ${expected}`);
const rows=values=>values.map((v,i)=>({time:i*60000,group:'A',values:{x:v}}));
// Independent references: scipy 1.17.0 ttest_ind(equal_var=False),
// levene(center='median'), anderson(dist='norm'); not implementation snapshots.
const refs=[
 {a:[1,2,3,4,5,6,7,8,9,10],b:[2,2,3,3,4,4,5,5,6,6],t:.1830877495523039,l:.02539022417172276,adA:.14110924785979329,adB:.31379196507036333},
 {a:[3,3,4,5,9,10,10,12,30,31],b:[5,5,6,7,8,9,10,11,12,13],t:.38482258698997246,l:.08937589246037704,adA:1.0193818494033522,adB:.21640245630851673},
 {a:[-1.6,-1.1,-.8,-.5,-.2,.1,.4,.7,1,1.5],b:[0,1,0,1,0,1,0,1,0,1],t:.13966122858120425,l:.08914064365831066,adA:.09649325203118586,adB:1.6391438291545821}
];
for(const r of refs){const a=C.prepare(rows(r.a),'x',2),b=C.prepare(rows(r.b),'x',2),t=C.compare(a,b);near(t.mean.p,r.t);near(t.variance.p,r.l);near(a.normality.A2,r.adA);near(b.normality.A2,r.adB);}
near(C.cdf(-3),.0013498980316300933,1e-15);near(C.upper(12),1.776482112077653e-33,1e-45);near(C.inverseNormal(.025),-1.959963984540054,1e-12);near(C.inverseNormal(1e-6),-4.753424308822899,1e-12);near(C.c4(10),.9726592741215883,1e-13);
// 636 observations -> 63 groups of 10 plus one group of 6, pooled df=572.
const values=Array.from({length:636},(_,i)=>10000+(i%10)*100+Math.floor(i/10)*8),p=C.prepare(rows(values),'x',10),e=C.evaluate(p,10000,null);
assert.equal(p.groups.length,64);assert.equal(p.groups.at(-1).n,6);assert.equal(p.df,572);near(p.stats.mean,10698.528301886792,1e-8);near(p.stats.sd,321.1718662985268,1e-8);near(p.within,302.0779016909567,1e-7);near(e.estimatedPPM,14817.450788266948,1e-6);near(e.Zoverall,2.1749361484779475,1e-10);
assert.equal(e.Pp,null);assert.equal(e.Cp,null);assert.equal(e.observedPercent,0);assert(e.overallPercent>0);near(p.xChart[0].upper,p.xChart[0].center+3*p.within/Math.sqrt(10));assert(p.xChart.at(-1).upper>p.xChart[0].upper);
const twoSided=C.evaluate(p,10000,11000);assert(Math.abs(twoSided.Zoverall-3*twoSided.Ppk)>.01,'Zbench uses total tail probability, not 3*Ppk');
const broken=C.prepare(rows([1,2,null,4,5,6,7]),'x',3);assert.equal(broken.invalidGroups,2);assert.equal(broken.unassigned,3);assert.equal(broken.groups.length,1);assert.equal(broken.stats.n,6);
const sparse=rows([1,2,3,4]);sparse.splice(1,0,{time:30000,group:'A',values:{other:90}});assert.equal(C.prepare(sparse,'x',2).groups.length,2);
const interleaved=rows([1,10,2,20,3,30,4,40]).map((r,i)=>({...r,group:i%2?'B':'A'}));assert.deepEqual(C.prepare(interleaved,'x',2).groups.map(g=>g.mean),[1.5,3.5,15,35]);
const individual=C.prepare(rows([1,null,3,5]),'x',1);near(individual.within,2/1.128);assert.equal(individual.sChart.length,1);
assert.equal(C.normality([1,2,3]).p,null);assert.equal(C.normality(Array(20).fill(1)).p,null);assert.equal(C.evaluate(C.prepare(rows([2,2,2]),'x',1),0,4).Cpk,null);assert.equal(C.compare(C.prepare(rows([1]),'x',1),C.prepare(rows([2]),'x',1)).mean.p,null);
assert.throws(()=>C.prepare(rows([1,2]),'x',0));assert.throws(()=>C.prepare(rows([1,2]),'x',1.5));assert.throws(()=>C.evaluate(p,10,0));
const split=C.splitSequence(rows([1,2,3,100,101,102]),'x',180000);assert.deepEqual(split.stats.map(s=>s.n),[3,3]);assert.deepEqual(split.ranges.filter(r=>r.value!==null).map(r=>r.value),[1,1,1,1]);near(split.stats[0].within,1/1.128);near(split.stats[1].within,1/1.128);
const splitGap=C.splitSequence(rows([1,2,null,4,5,6]),'x',240000);assert.deepEqual(splitGap.ranges.filter(r=>r.value!==null).map(r=>r.value),[1,1]);
assert.equal(M.time(M.exactLocal(Date.UTC(2026,9,1,0,0,0,250))),Date.UTC(2026,9,1,0,0,0,250));assert.throws(()=>M.time('2026-02-30T08:00:00.25'));
console.log('Capability numerics passed: SciPy-referenced Welch/Levene/AD, stable normal tails and inverse Z, pooled c4 correction, 636/10 variable-size subgroups, exact 3-sigma limits, missing/group boundaries, one-sided specs and degenerate data.');
