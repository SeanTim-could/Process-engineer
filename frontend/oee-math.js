// Calendar/time selection math for OEE. All intervals are half-open [from,to).
var OEEMath=(()=>{
 const DAY=86400000,finite=Number.isFinite;
 function monthRange(month,now=Date.now()){
  if(typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||Number(month.slice(0,4))<1900)throw new Error('OEE统计月份无效。');
  const from=Date.parse(month+'-01T00:00:00+08:00'),next=new Date(from+28800000);next.setUTCMonth(next.getUTCMonth()+1);
  const end=next.getTime()-28800000,to=Math.max(from,Math.min(end,now));return {month,from,to,end,days:(to-from)/DAY,complete:now>=end};
 }
 function union(ranges){
  if(!Array.isArray(ranges)||ranges.length>128)throw new Error('OEE时段最多128段。');
  const sorted=ranges.map(r=>{if(!r||!Number.isSafeInteger(r.from)||!Number.isSafeInteger(r.to)||r.to<=r.from||Math.abs(r.from)>8640000000000000||Math.abs(r.to)>8640000000000000)throw new Error('OEE时段起止时间无效。');return {from:r.from,to:r.to};}).sort((a,b)=>a.from-b.from),result=[];
  for(const r of sorted){const last=result.at(-1);if(last&&r.from<=last.to)last.to=Math.max(last.to,r.to);else result.push(r);}return result;
 }
 const clip=(ranges,bounds)=>union(ranges).map(r=>({from:Math.max(r.from,bounds.from),to:Math.min(r.to,bounds.to)})).filter(r=>r.to>r.from);
 function summarize({mdc,bounds,losses=[],integrate}){
  const part=bounds.days>0?integrate(bounds):{value:null,coveredHours:0},actual=finite(part.value)?part.value:null,coveredHours=part.coveredHours,hours=(bounds.to-bounds.from)/3600000,target=finite(mdc)&&mdc>0?mdc*bounds.days:null;
  const items=losses.map(loss=>{
   const [range]=clip([loss],bounds);if(!range)return {...loss,tonnes:null,coverage:0};
   const data=integrate(range),durationHours=(range.to-range.from)/3600000,coverage=Math.min(1,data.coveredHours/durationHours),tonnes=coverage>=.999999&&finite(data.value)?Math.max(0,mdc*durationHours/24-data.value):null;
   return {...loss,tonnes,coverage};
  });
  const checked=items.filter(loss=>loss.counted),countedLoss=checked.some(loss=>!finite(loss.tonnes))?null:checked.reduce((sum,loss)=>sum+loss.tonnes,0),excludedLoss=items.filter(loss=>!loss.counted&&finite(loss.tonnes)).reduce((sum,loss)=>sum+loss.tonnes,0);
  const net=target===null||countedLoss===null?null:target-countedLoss,tolerance=Math.max(Math.abs(target??0),Math.abs(countedLoss??0))*Number.EPSILON*16;
  return {days:bounds.days,actual,target,coveredHours,requestedHours:hours,coverage:hours?Math.min(1,coveredHours/hours):null,losses:items,countedLoss,excludedLoss,oee:actual!==null&&target>0&&net!==null?(Math.abs(net)<=tolerance?0:net)/target*100:null};
 }
 return {DAY,monthRange,union,clip,summarize};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=OEEMath;
