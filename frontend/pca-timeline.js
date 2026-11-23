// Display coordinates only: missing timestamps never become stored PCA samples.
var PCATimeline=(()=>{
 function create(points,seconds){
  const rows=points.map((point,index)=>({point,index})).sort((a,b)=>a.point.time-b.point.time||a.index-b.index),groups=new Map(),deltas=new Map();
  for(const row of rows){const key=row.point.group??'';if(!groups.has(key))groups.set(key,[]);const own=groups.get(key),previous=own.at(-1);if(previous&&row.point.time>previous.point.time){const dt=row.point.time-previous.point.time;deltas.set(dt,(deltas.get(dt)??0)+1);}own.push(row);}
  const inferred=[...deltas].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0]?.[0]??60000,interval=Number.isFinite(Number(seconds)*1000)&&Number(seconds)>0?Number(seconds)*1000:inferred,first=rows[0].point.time,last=rows.at(-1).point.time,start=first===last?first-interval/2:first,end=first===last?last+interval/2:last;
  return {rows,groups,interval,inferred,start,end,span:end-start};
 }
 function nearest(axis,time){
  const rows=axis.rows;let a=0,b=rows.length-1;while(a<b){const mid=Math.floor((a+b)/2);if(rows[mid].point.time<time)a=mid+1;else b=mid;}
  return a>0&&Math.abs(rows[a-1].point.time-time)<Math.abs(rows[a].point.time-time)?a-1:a;
 }
 function hover(axis,time){
  const i=nearest(axis,time),row=axis.rows[i],tolerance=Math.min(axis.interval*.45,axis.span*8/900);
  // A cursor inside a gap reports that time, never a distant neighbor's value.
  if(Math.abs(row.point.time-time)>Math.max(.5,tolerance))return {time,rows:[]};
  let a=i,b=i;while(a>0&&axis.rows[a-1].point.time===row.point.time)a--;while(b+1<axis.rows.length&&axis.rows[b+1].point.time===row.point.time)b++;
  return {time:row.point.time,rows:axis.rows.slice(a,b+1)};
 }
 function brush(axis,selection,from,to,mode){
  const a=hover(axis,from),b=hover(axis,to),low=Math.min(a.time,b.time),high=Math.max(a.time,b.time),epsilon=axis.span*1e-7,ids=axis.rows.filter(r=>r.point.time>=low-epsilon&&r.point.time<=high+epsilon).map(r=>r.index);
  if(!ids.length)return null;
  const excluded=new Set(selection.excluded);
  if(mode==='keep'){
   let a=Infinity,b=-Infinity;for(const i of ids){a=Math.min(a,i);b=Math.max(b,i);}const included=new Set(ids);for(let i=a;i<=b;i++)if(!included.has(i))excluded.add(i);
   return {from:a,to:b,excluded:[...excluded].sort((a,b)=>a-b)};
  }
  for(const i of ids)mode==='exclude'?excluded.add(i):excluded.delete(i);
  return {...selection,excluded:[...excluded].sort((a,b)=>a-b)};
 }
 function series(axis,key){
  const segments=[],stride=Math.max(1,Math.ceil(axis.rows.length/450));
  // Split before thinning so neither omitted timestamps nor null readings get bridged.
  for(const rows of axis.groups.values()){
   let current=[],previous=null;
   const flush=()=>{if(!current.length)return;const sampled=[];for(let a=0;a<current.length;a+=stride){const end=Math.min(current.length,a+stride);let low=a,high=a;for(let i=a+1;i<end;i++){if(current[i].point.values[key]<current[low].point.values[key])low=i;if(current[i].point.values[key]>current[high].point.values[key])high=i;}for(const i of [...new Set([a,low,high,end-1])].sort((a,b)=>a-b))sampled.push(current[i]);}segments.push(sampled);current=[];};
   for(const row of rows){if(!Number.isFinite(row.point.values[key])){flush();previous=null;continue;}if(previous&&row.point.time-previous.point.time>axis.interval*1.5)flush();current.push(row);previous=row;}
   flush();
  }
  return segments;
 }
 function excludedRanges(axis,selection){
  const excluded=new Set(selection.excluded),ranges=[];
  for(const rows of axis.groups.values())for(let i=0;i<rows.length;i++){
   const row=rows[i];if(row.index>=selection.from&&row.index<=selection.to&&!excluded.has(row.index))continue;
   const time=row.point.time,a=Math.max(axis.start,time-axis.interval/2,i? (rows[i-1].point.time+time)/2:-Infinity),b=Math.min(axis.end,time+axis.interval/2,i+1<rows.length?(rows[i+1].point.time+time)/2:Infinity);ranges.push([a,b]);
  }
  ranges.sort((a,b)=>a[0]-b[0]);const merged=[];for(const range of ranges){const last=merged.at(-1);if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else merged.push(range);}return merged;
 }
 return {create,nearest,hover,brush,series,excludedRanges};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=PCATimeline;
