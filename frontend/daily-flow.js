// Daily averages describe a whole calendar day; PI observations describe instants.
var DailyFlow=(()=>{
 const DAY=86400000,HOUR=3600000,OFFSET=28800000,finite=Number.isFinite,cache=new WeakMap();
 const day=t=>Math.floor((t+OFFSET)/DAY)*DAY-OFFSET,pair=p=>JSON.stringify([p.unit??p.unitId,p.group??'']);
 function basis(value){if(!['auto','daily','instant'].includes(value))throw new Error('流量采样口径无效。');return value;}
 function provenance(){
  const state=typeof $r==='function'?$r().state:null,sync=state?.excelSync;if(!sync)return {daily:new Set(),live:new Set()};
  if(cache.has(sync))return cache.get(sync);
  const result={daily:new Set([...(sync.dailyRows??[]),...(sync.sources??[]).filter(s=>s.daily?.enabled).map(s=>({unitId:s.unitId,group:s.daily.group}))].map(pair)),live:new Set(typeof LiveData!=='undefined'&&LiveData?LiveData.provenance(state).map(pair):[])};cache.set(sync,result);return result;
 }
 function split(rows,column){
  const known=provenance(),groups=new Map(),daily=[],instant=[];
  for(const row of rows){if(!Object.hasOwn(row.values,column.key))continue;const id=pair(row);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(row);}
  for(const [id,own] of groups){
   let useDaily=false;
   if(column.flowBasis!=='instant'&&(column.flowBasis==='daily'||!known.live.has(id))){
    const days=new Set();let once=true,midnight=true;
    for(const row of own){const date=day(row.time);if(days.has(date)){once=false;break;}days.add(date);midnight=midnight&&date===row.time;}
    const regular=once&&midnight&&days.size>=2&&[...days].some(d=>days.has(d-DAY));
    useDaily=once&&(column.flowBasis==='daily'||known.daily.has(id)||regular);
   }
   const target=useDaily?daily:instant;for(const row of own)target.push(row);
  }
  return {daily,instant};
 }
 function integral(rows,column,bounds,instantIntegral,records=false){
  const meta=xr(column.unit);if(!meta?.totalUnit||column.kind==='counter')return null;
  const parts=split(rows,column);if(!parts.daily.length)return null;
  let first=Infinity,last=-Infinity;for(const row of parts.daily){first=Math.min(first,day(row.time));last=Math.max(last,day(row.time)+DAY);}
  const from=bounds?.from??first,to=bounds?.to??last,now=Date.now(),blocks=new Map();
  for(const row of parts.daily){
   if(records&&(row.time<from||row.time>=to))continue;
   const start=day(row.time),a=records?start:Math.max(start,from),b=Math.min(start+DAY,now,records?Infinity:to);if(b<=a)continue;
   const id=JSON.stringify([row.unit,start]),previous=blocks.get(id);if(!previous||!finite(previous.value)&&finite(row.values[column.key]))blocks.set(id,{from:a,to:b,value:row.values[column.key]});
  }
  const intervals=[...blocks.values()].sort((a,b)=>a.from-b.from);let value=0,covered=0,missing=0,segments=0;
  for(const r of intervals){const hours=(r.to-r.from)/HOUR;if(finite(r.value)){value+=r.value*(r.to-r.from)/1000/(meta.seconds??3600);covered+=hours;segments++;}else missing+=hours;}
  // Daily intervals own their dates. Raw samples can only fill the other dates.
  let cursor=from,gap=0,maxGap=column.maxGapHours??24;
  const add=(a,b)=>{if(!parts.instant.length||b<=a)return;const result=instantIntegral(parts.instant,column,{from:a,to:b});if(finite(result.value)){value+=result.value;covered+=result.coveredHours;segments+=result.segments;}gap+=result.gapHours;missing+=result.missingHours;maxGap=Math.max(maxGap,result.maxGapHours);};
  for(const r of intervals){add(cursor,Math.min(to,r.from));cursor=Math.max(cursor,r.to);}add(cursor,to);
  const requestedFrom=records&&finite(from)?Math.ceil((from+OFFSET)/DAY)*DAY-OFFSET:from,requestedTo=records&&finite(to)?Math.ceil((to+OFFSET)/DAY)*DAY-OFFSET:to,requestedHours=Math.max(0,Math.min(now,finite(requestedTo)?requestedTo:last)-(finite(requestedFrom)?requestedFrom:first))/HOUR;
  return {value:segments?value:null,coveredHours:covered,requestedHours,gapHours:gap,missingHours:missing,segments,maxGapHours:maxGap,dailyMean:true,days:covered/24};
 }
 function summarize(result,rows,column,range,instantIntegral){
  if(!result.canTotal||!result.coverage)return result;
  const total=integral(rows,column,range,instantIntegral,true);if(!total)return result;
  const sourceUnit=xr(column.unit).totalUnit,display=k1([total.value],sourceUnit),value=total.value===null?null:display.convert(total.value),days=total.days.toLocaleString('zh-CN',{maximumFractionDigits:3});
  return {...result,value,unit:display.unit,totalValue:value,sourceValue:total.value,sourceUnit,coverage:total,label:'日均流量累计',detail:Surface.t('按所选每日均值×24小时累加；已计入')+' '+days+' '+Surface.t('天；缺测日不补零，当天暂存按已过时长计算。')};
 }
 function Settings({column,onChange}){
  if(!xr(column.unit)?.totalUnit||column.kind==='counter')return null;
  const R=Se(),h=R.createElement;
  return h('label',{className:'gap-setting'},'流量采样口径',h('select',{'aria-label':column.header+'流量采样口径',value:column.flowBasis??'auto',onChange:e=>onChange({flowBasis:e.target.value})},... [['auto','自动识别'],['daily','每日平均流量'],['instant','瞬时采样']].map(([value,label])=>h('option',{key:value,value},label))));
 }
 return {basis,integral,summarize,Settings};
})();
