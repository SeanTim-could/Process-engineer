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
  return {identity,observation,normalize,apply};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=AnalysisPointMath;
