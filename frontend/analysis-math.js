// Pure statistics shared by the browser and independent numerical checks.
var AnalysisMath = (() => {
  const finite=v=>typeof v==="number"&&Number.isFinite(v);
  const excluded=(row,key)=>!finite(row.values[key])&&finite(row.excludedValues?.[key]);
  const safe=v=>Number.isFinite(v)?v:null;
  const quantile=(sorted,p)=>{if(!sorted.length)return null;const x=(sorted.length-1)*p,i=Math.floor(x);return sorted[i]+(sorted[Math.min(i+1,sorted.length-1)]-sorted[i])*(x-i);};
  function summarize(values){
    const data=values.filter(finite),sorted=[...data].sort((a,b)=>a-b);let mean=0,m2=0,n=0;
    for(const x of data){n++;const d=x-mean;mean+=d/n;m2+=d*(x-mean);}
    return {n,missing:values.length-n,mean:n?safe(mean):null,sd:n>1?safe(Math.sqrt(Math.max(0,m2/(n-1)))):null,
      min:sorted[0]??null,max:sorted.at(-1)??null,q1:quantile(sorted,.25),median:quantile(sorted,.5),q3:quantile(sorted,.75)};
  }
  function movingRanges(rows,key){
    const previous=new Map(),result=[];
    for(const row of [...rows].sort((a,b)=>a.time-b.time)){
      if(!Object.hasOwn(row.values,key))continue; // Another metric's timestamp is not a missing sample.
      const group=row.group??"",old=previous.get(group),v=row.values[key];
      if(finite(v)&&old&&finite(old.values[key]))result.push({time:row.time,group,values:{range:Math.abs(v-old.values[key])}});
      previous.set(group,row); // A missing reading breaks the moving range.
    }
    return result;
  }
  function normalCDF(z){
    const x=Math.abs(z)/Math.SQRT2,t=1/(1+.3275911*x);
    const erf=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x);
    return (1+(z<0?-erf:erf))/2;
  }
  function limits(low,high){
    const parse=v=>v===null||v===undefined||v===""?null:Number(v);
    const lsl=parse(low),usl=parse(high);
    if(lsl!==null&&!finite(lsl)||usl!==null&&!finite(usl))throw new Error("规格限必须是有效数字。");
    if(lsl!==null&&usl!==null&&lsl>=usl)throw new Error("规格下限必须小于规格上限。");
    return {lsl,usl};
  }
  function capability(rows,key,low=null,high=null){
    const {lsl,usl}=limits(low,high),values=rows.filter(r=>Object.hasOwn(r.values,key)).map(r=>r.values[key]),s=summarize(values),ranges=movingRanges(rows,key),mr=summarize(ranges.map(r=>r.values.range));
    const within=mr.n?safe(mr.mean/1.128):null,both=lsl!==null&&usl!==null,hasSpec=lsl!==null||usl!==null;
    const index=(sigma,span=false)=>{
      if(s.n<2||!finite(sigma)||sigma<=0||!hasSpec||span&&!both)return null;
      return safe(span?(usl-lsl)/(6*sigma):Math.min(...[lsl!==null?(s.mean-lsl)/(3*sigma):Infinity,usl!==null?(usl-s.mean)/(3*sigma):Infinity]));
    };
    const outside=values.filter(v=>finite(v)&&(lsl!==null&&v<lsl||usl!==null&&v>usl)).length;
    const estimatedPPM=hasSpec&&s.n>1&&s.sd>0?safe(((lsl!==null?normalCDF((lsl-s.mean)/s.sd):0)+(usl!==null?1-normalCDF((usl-s.mean)/s.sd):0))*1e6):null;
    return {...s,lsl,usl,within,movingRangeCount:mr.n,mrbar:mr.mean,Cp:index(within,true),Cpk:index(within),Pp:index(s.sd,true),Ppk:index(s.sd),
      outside:hasSpec?outside:null,passRate:hasSpec&&s.n?(s.n-outside)/s.n*100:null,estimatedPPM,
      lowerControl:within>0?safe(s.mean-3*within):null,upperControl:within>0?safe(s.mean+3*within):null,
      controlSignals:within>0?values.filter(v=>finite(v)&&Math.abs(v-s.mean)>3*within).length:null};
  }
  function histogram(values,count=0){
    const sorted=values.filter(finite).sort((a,b)=>a-b);if(!sorted.length)return [];
    const min=sorted[0],max=sorted.at(-1),iqr=quantile(sorted,.75)-quantile(sorted,.25),width=2*iqr/Math.cbrt(sorted.length);
    const n=count?Math.max(1,Math.min(100,Math.round(count))):Math.max(5,Math.min(60,width>0?Math.ceil((max-min)/width):Math.ceil(Math.sqrt(sorted.length))));
    const padding=min===max?Math.max(.5,Math.abs(min)*.01):0,from=min-padding,to=max+padding,step=(to-from)/n;
    if(!finite(step)||step<=0)return [];
    const bins=Array.from({length:n},(_,i)=>({from:from+i*step,to:from+(i+1)*step,count:0}));
    for(const v of sorted)bins[Math.min(n-1,Math.max(0,Math.floor((v-from)/step)))].count++;
    return bins;
  }
  function time(value){
    if(!value)return null;
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(value))throw new Error("请填写有效的日期和时间。");
    const withSeconds=value.length===16?value+":00":value,result=Date.parse(withSeconds+"+08:00"),canonical=new Date(result+28800000);
    if(!Number.isFinite(result)||canonical.toISOString().slice(0,19)!==withSeconds.slice(0,19))throw new Error("日期或时间无效。");
    return result;
  }
  const local=time=>new Date(time+28800000).toISOString().slice(0,16);
  const exactLocal=time=>new Date(time+28800000).toISOString().slice(0,23).replace(/(\.\d*?)0+$/,"$1").replace(/\.$/,"").replace(/:00$/,"");
  function select(rows,config){
    const from=time(config.from),to=time(config.to);if(from!==null&&to!==null&&from>to)throw new Error("开始时间不能晚于结束时间。");
    return rows.filter(r=>(config.allGroups===true||config.allGroups===undefined&&config.group==="*"||r.group===config.group)&&(from===null||r.time>=from)&&(to===null||r.time<to+60000)).sort((a,b)=>a.time-b.time);
  }
  function periods(rows,config){
    if(config.mode==="periods"){
      const a=time(config.beforeFrom),b=time(config.beforeTo),c=time(config.afterFrom),d=time(config.afterTo);
      if([a,b,c,d].some(v=>v===null))throw new Error("请完整填写之前和之后两个时段。");
      if(a>b||c>d||b+60000>c)throw new Error("两个时段应按先后排列，且不能重叠（结束分钟包含整分钟）。");
      return {before:rows.filter(r=>r.time>=a&&r.time<b+60000),after:rows.filter(r=>r.time>=c&&r.time<d+60000)};
    }
    const at=time(config.split);if(at===null)throw new Error("请选择调整时间。");
    return {before:rows.filter(r=>r.time<at),after:rows.filter(r=>r.time>=at)};
  }
  function boxes(values){
    const s=summarize(values);if(!s.n)return s;
    const sorted=values.filter(finite).sort((a,b)=>a-b),iqr=s.q3-s.q1;
    const inner=sorted.filter(v=>v>=s.q1-1.5*iqr&&v<=s.q3+1.5*iqr);
    return {...s,low:inner[0]??s.min,high:inner.at(-1)??s.max,outliers:sorted.filter(v=>v<s.q1-1.5*iqr||v>s.q3+1.5*iqr)};
  }
  function aggregate(rows,keys,period="day",method="mean"){
    const groups=new Map();
    for(const row of rows){
      const stamp=local(row.time),day=stamp.slice(0,10);let label=period==="month"?stamp.slice(0,7):day;
      if(period==="week"){const t=Date.parse(day+"T00:00:00+08:00"),weekday=new Date(t+28800000).getUTCDay();label=local(t-((weekday+6)%7)*86400000).slice(0,10)+" 周";}
      if(period==="all")label=row.group||"未分组";
      const id=JSON.stringify([label,period==="all"?"":row.group]);
      if(!groups.has(id))groups.set(id,{label,group:period==="all"?"":row.group,time:row.time,values:Object.fromEntries(keys.map(k=>[k,[]]))});
      for(const key of keys)if(finite(row.values[key]))groups.get(id).values[key].push(row.values[key]);
    }
    return [...groups.values()].map(g=>({...g,values:Object.fromEntries(keys.map(key=>{const values=g.values[key],s=summarize(values);return [key,method==="sum"&&values.length?safe(values.reduce((a,b)=>a+b,0)):s.mean];}))}));
  }
  return {finite,excluded,safe,summarize,quantile,movingRanges,normalCDF,limits,capability,histogram,time,local,select,periods,boxes,aggregate,exactLocal};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=AnalysisMath;
