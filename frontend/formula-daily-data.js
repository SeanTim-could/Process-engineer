// Read-only data for analysis: only calculated metrics are grouped by Beijing day.
// Editing and point selection keep actual timestamps; raw metrics keep their sampling.
var FormulaDailyData=(()=>{
 const DAY=86400000,OFFSET=28800000,finite=Number.isFinite,key=p=>JSON.stringify([p.unit,p.group,p.time]);
 function observations(state,id,column,masked=true){
  if(IntervalFormulas.is(column))return IntervalFormulas.pointView(column,state,masked);
  const rows=state.datasets[id]?.points??[];
  return (masked?PointExclusions.apply(id,rows):rows).filter(p=>Object.hasOwn(p.values,column.key));
 }
 function daily(state,id,column){
  const bins=new Map();
  for(const p of observations(state,id,column)){
   const time=Math.floor((p.time+OFFSET)/DAY)*DAY-OFFSET,id=key({...p,time});
   if(!bins.has(id))bins.set(id,{unit:p.unit,group:p.group,time,value:null,count:0,missing:0,excluded:[]});
   const bin=bins.get(id),value=p.values[column.key];
   if(finite(p.excludedValues?.[column.key]))bin.excluded.push(p.excludedValues[column.key]);
   else if(!finite(value))bin.missing++;
   else {bin.count++;bin.value=bin.count===1?value:bin.value+(value-bin.value)/bin.count;}
  }
  const groups=new Map(),rows=[];
  for(const bin of [...bins.values()].sort((a,b)=>a.time-b.time)){
   const group=JSON.stringify([bin.unit,bin.group]),previous=groups.get(group);
   if(previous!==undefined&&bin.time-previous>DAY)rows.push({unit:bin.unit,group:bin.group,time:previous+DAY,values:{[column.key]:null},dailyFormulaKeys:[column.key],dailySampleCounts:{[column.key]:0}});
   const excluded=!bin.count&&!bin.missing&&bin.excluded.length?{[column.key]:bin.excluded.reduce((a,b)=>a+b,0)/bin.excluded.length}:undefined;
   rows.push({unit:bin.unit,group:bin.group,time:bin.time,values:{[column.key]:bin.value},dailyFormulaKeys:[column.key],dailySampleCounts:{[column.key]:bin.count},...(excluded?{excludedValues:excluded}:{})});groups.set(group,bin.time);
  }
  return AnalysisPointMath.apply(id,rows,state.analytics?.excludedPoints??[]);
 }
 function view(state,id,rows,{raw=false,columns}={}){
  const entry=state.datasets[id];if(!entry)return rows;
  const allKeys=new Set(entry.dataset.columns.filter(c=>c.formula).map(c=>c.key)),formulas=(columns??entry.dataset.columns).filter(c=>c.formula);
  if(!allKeys.size)return rows;
  const merged=new Map(),base=raw?rows:PointExclusions.apply(id,rows);
  function put(p){
   const id=key(p),old=merged.get(id);
   if(!old){merged.set(id,{...p,values:{...p.values}});return;}
   Object.assign(old.values,p.values);
   if(p.excludedValues)old.excludedValues={...old.excludedValues,...p.excludedValues};
   if(p.dailyFormulaKeys)old.dailyFormulaKeys=[...new Set([...(old.dailyFormulaKeys??[]),...p.dailyFormulaKeys])];
   if(p.dailySampleCounts)old.dailySampleCounts={...old.dailySampleCounts,...p.dailySampleCounts};
  }
  for(const p of base){
   const values=Object.fromEntries(Object.entries(p.values).filter(([k])=>!allKeys.has(k)));
   if(!Object.keys(values).length)continue;
   const row={...p,values};delete row.dailyFormulaKeys;delete row.dailySampleCounts;
   if(p.excludedValues){const values=Object.fromEntries(Object.entries(p.excludedValues).filter(([k])=>!allKeys.has(k)));if(Object.keys(values).length)row.excludedValues=values;else delete row.excludedValues;}
   put(row);
  }
  for(const column of formulas){
   const calculated=raw?observations(state,id,column,false).map(p=>({unit:p.unit,group:p.group,time:p.time,values:{[column.key]:p.values[column.key]}})):daily(state,id,column);
   for(const row of calculated)put(row);
  }
  return [...merged.values()].sort((a,b)=>a.time-b.time||a.unit.localeCompare(b.unit)||a.group.localeCompare(b.group));
 }
 return {view,daily,observations};
})();
