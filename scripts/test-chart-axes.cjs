const assert=require('node:assert/strict'),A=require('../frontend/chart-axes.js');
for(const [min,max] of [[97.8,98.2],[97.8,139],[98,98],[0,0],[-10,-2],[-4,6],[1e-15,7e-15],[1e10,1e10+.01]]){
 const d=A.numeric(min,max);assert(d.min<=min&&d.max>=max,JSON.stringify({min,max,d}));assert(d.max>d.min);assert(d.ticks.length>=2&&d.ticks.length<=12);assert.equal(new Set(d.ticks.map(t=>t.label)).size,d.ticks.length);
}
assert(A.numeric(97.8,98.2).max-A.numeric(97.8,98.2).min<2,'Small fluctuations retain a useful scale');
assert(A.numeric(97.8,139).max>=139,'Percent values above 100 remain visible');
assert(A.numeric(0,1,{zero:true,integer:true}).ticks.every(t=>Number.isInteger(t.value)));
assert.equal(A.numeric(0,1,{padding:0}).min,0);assert.equal(A.numeric(0,1,{padding:0}).max,1);
assert.equal(A.numeric(2,8,{zero:true}).min,0);assert.equal(A.numeric(-8,-2,{zero:true}).max,0);assert(A.numeric(-4,6,{zero:true}).min<=-4);
assert.deepEqual(A.ticks(0,10,5).map(t=>t.label),['0','2.5','5','7.5','10']);
assert.deepEqual(A.ticks(0,1,5).map(t=>t.label),['0','0.25','0.5','0.75','1']);
const at=s=>Date.parse(s+'+08:00');
assert(A.timeTicks(at('2026-10-01T00:00'),at('2026-10-01T00:01'),230,4).length<=3,'Minute-scale tick labels need room at both plot edges');
for(const [from,to,width] of [['2026-10-01T00:00','2026-10-31T00:00',280],['2026-10-29T00:00','2026-10-29T23:59',700],['2026-01-01T00:00','2026-12-31T23:59',700],['2026-10-29T23:59:59.000','2026-10-29T23:59:59.010',400]]){
 const ticks=A.timeTicks(at(from),at(to),width);assert(ticks.length);assert(ticks.every(t=>t.value>=at(from)&&t.value<=at(to)));assert.equal(new Set(ticks.map(t=>t.label)).size,ticks.length);assert(ticks.every((t,i)=>!i||t.value>ticks[i-1].value));
 if(to.startsWith('2026-10-31'))assert(ticks.every(t=>(t.value+28800000)%86400000===0),'Monthly chart ticks are Beijing midnights');
 if(to.startsWith('2026-12-31'))assert(ticks.every(t=>new Date(t.value+28800000).getUTCDate()===1),'Long ranges use real calendar month boundaries');
}
console.log('Chart axes: data bounds, constant/negative/tiny values, decimal precision and Beijing calendar ticks passed.');
