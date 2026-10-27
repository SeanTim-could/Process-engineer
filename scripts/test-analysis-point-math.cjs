const assert=require('node:assert/strict'),A=require('../frontend/analysis-point-math.js'),M=require('../frontend/analysis-math.js'),F=require('../frontend/formula-syntax.js');
const rows=[1,2,100,3,4].map((value,i)=>({unit:'a',time:1000+i,group:'P',values:{c_1:value,c_2:value+10}})),point=A.observation('ds_a',rows[2],'c_1');
const original=structuredClone(rows),masked=A.apply('ds_a',rows,A.normalize([point]));
assert.equal(masked[2].values.c_1,null);assert.equal(masked[2].values.c_2,110);assert.deepEqual(rows,original);assert.equal(M.movingRanges(masked,'c_1').length,2);assert.equal(M.summarize(masked.map(r=>r.values.c_1)).mean,2.5);
assert.deepEqual(A.apply('ds_other',rows,[point]),rows);assert.equal(A.apply('ds_a',[{...rows[2],values:{c_1:101}}],[point])[0].values.c_1,101);assert.equal(A.apply('ds_a',[{...rows[2],group:'Q'}],[point])[0].values.c_1,100);
for(const bad of [[point,point],[{...point,value:Infinity}],[{...point,sourceId:'../../other'}],[{...point,time:NaN}]])assert.throws(()=>A.normalize(bad));
assert.equal(F.normalize('（[流量（校正）] ＋ 2） × （3－1） ÷ 2'),'([流量（校正）] + 2) * (3-1) / 2');
assert.equal(F.normalize('IF（[项]]目（A）]>0，ABS（-2），0）'),'IF([项]]目（A）]>0,ABS(-2),0)');
console.log('Point exclusions passed: metric/source/group/value identities, immutable originals, MR breaks, stale values and punctuation-safe bracket normalization.');
// Display skips only manual exclusions, preserving real missing data and statistics.
const plotted=masked.map(row=>({time:row.time,value:row.values.c_1}));
assert.deepEqual(A.plotSeries(plotted,masked,{key:'c_1'},'raw').map(p=>p.value),[1,2,3,4]);
const mixed=masked.map((row,i)=>i===3?{...row,values:{...row.values,c_1:null}}:row);
assert.deepEqual(A.plotSeries(mixed.map(row=>({time:row.time,value:row.values.c_1})),mixed,{key:'c_1'},'raw').map(p=>p.value),[1,2,null,4]);
assert.equal(M.movingRanges(masked,'c_1').length,2,'display continuity must not change MR pairs');
const day=Date.parse('2026-10-01T00:00:00+08:00'),daily=[{...masked[2],time:day+60000},{...mixed[3],time:day+120000}];
assert.equal(A.plotSeries([{time:day,value:null}],daily.slice(0,1),{key:'c_1'},'day').length,0);
assert.equal(A.plotSeries([{time:day,value:null}],daily,{key:'c_1'},'day').length,1,'a bucket with genuine missing values must remain a gap');
console.log('Display continuity passed: excluded samples skipped; genuine gaps, bucket boundaries and MR statistics preserved.');
