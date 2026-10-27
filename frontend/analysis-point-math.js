// Observation identities include the original value: an amended reading is a new observation.
var AnalysisPointMath = (() => {
  const identity = p => JSON.stringify([p.sourceId,p.unit,p.time,p.group,p.key,p.value]);
  function normalize(points) {
    if(points===undefined)return [];
    if(!Array.isArray(points)||points.length>10000)throw new Error("最多排除10000个指标读数。");
    const seen=new Set();
    return points.map(p=>{
      if(!p||typeof p.sourceId!=="string"||! /^(ds_[\w-]+|raw:[a-zA-Z0-9_-]{1,40})$/.test(p.sourceId)||p.sourceId.length>200||typeof p.unit!=="string"||! /^[\w-]{1,40}$/.test(p.unit)||!Number.isSafeInteger(p.time)||Math.abs(p.time)>8640000000000000||typeof p.group!=="string"||p.group.length>100||typeof p.key!=="string"||! /^\w{1,100}$/.test(p.key)||!Number.isFinite(p.value))throw new Error("异常点记录格式无效。");
      const out={sourceId:p.sourceId,unit:p.unit,time:p.time,group:p.group,key:p.key,value:p.value},id=identity(out);
      if(seen.has(id))throw new Error("异常点记录重复。");seen.add(id);return out;
    });
  }
  const observation=(sourceId,row,key)=>({sourceId,unit:row.unit,time:row.time,group:row.group??"",key,value:row.values[key]});
  function apply(sourceId,rows,points) {
    const selected=new Set(points.filter(p=>p.sourceId===sourceId).map(identity));
    if(!selected.size)return rows;
    return rows.map(row=>{
      let values=null,excluded=null;
      for(const [key,value]of Object.entries(row.values))if(Number.isFinite(value)&&selected.has(identity(observation(sourceId,row,key)))){
        values??={...row.values};excluded??={};values[key]=null;excluded[key]=value;
      }
      return values?{...row,values,excludedValues:excluded}:row;
    });
  }
  // Rendering only: omit empty display buckets caused solely by manual exclusions.
  // Missing source readings remain in the series to break the line as before.
  function plotSeries(data,rows,column,period="raw",range) {
    const bucket=time=>period==="raw"||column.aggregation==="none"?time:new Date(time+28800000).toISOString().slice(0,period==="month"?7:10),groups=new Map();
    for(const row of rows){
      if(!Object.hasOwn(row.values,column.key)||range&&(row.time<range.from||row.time>=range.to))continue;
      const id=bucket(row.time),state=groups.get(id)??{excluded:false,missing:false};
      if(!Number.isFinite(row.values[column.key])){
        if(Number.isFinite(row.excludedValues?.[column.key]))state.excluded=true;
        else state.missing=true;
      }
      groups.set(id,state);
    }
    return data.filter(point=>{const state=groups.get(bucket(point.time));return point.value!==null||!state?.excluded||state.missing;});
  }
  return {identity,observation,normalize,apply,plotSeries};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=AnalysisPointMath;
