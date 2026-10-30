// Bounded drawing data. Extrema survive sampling; missing readings still split paths.
var LiveSeries = (() => {
  function sample(rows,key,limit=1000) {
    let segment=0,valid=0,missing=0,latest=null,min=Infinity,max=-Infinity;
    const tagged=[];
    for(const row of rows){
      if(Number.isFinite(row.excludedValues?.[key]))continue;
      if(!Object.hasOwn(row.values,key))continue;
      const value=row.values[key];
      if(!Number.isFinite(value)){segment++;missing++;continue;}
      const point={time:row.time,value,segment};tagged.push(point);valid++;latest=point;min=Math.min(min,value);max=Math.max(max,value);
    }
    const points=[],width=Math.max(1,Math.ceil(tagged.length/Math.max(1,Math.floor(limit/4))));
    for(let i=0;i<tagged.length;i+=width){
      const end=Math.min(i+width,tagged.length);let lo=tagged[i],hi=lo;
      for(let j=i+1;j<end;j++){if(tagged[j].value<lo.value)lo=tagged[j];if(tagged[j].value>hi.value)hi=tagged[j];}
      points.push(...[...new Set([tagged[i],lo,hi,tagged[end-1]])].sort((a,b)=>a.time-b.time));
    }
    return {points,valid,missing,latest,min:valid?min:null,max:valid?max:null};
  }
  function nearest(points,time){let lo=0,hi=points.length;while(lo<hi){const mid=(lo+hi)>>>1;if(points[mid].time<time)lo=mid+1;else hi=mid;}const a=points[lo-1],b=points[lo];return a?b?time-a.time<=b.time-time?a:b:a:b;}
  return {sample,nearest};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=LiveSeries;
