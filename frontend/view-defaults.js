// Calendar-month defaults in Beijing time. No mutation of stored measurements.
var ViewDefaults = (() => {
  function range(now=Date.now()) {
    const end=new Date(now+28800000),day=end.getUTCDate(),start=new Date(end);
    start.setUTCDate(1);start.setUTCMonth(start.getUTCMonth()-1);
    const last=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate();
    start.setUTCDate(Math.min(day,last));start.setUTCHours(0,0,0,0);
    const format=d=>d.toISOString().slice(0,16).replace('T',' ');
    return {from:format(start),to:format(end)};
  }
  function today(now=Date.now()){const day=new Date(now+28800000);day.setUTCHours(0,0,0,0);const from=day.toISOString().slice(0,16);day.setUTCDate(day.getUTCDate()+1);return {from,to:day.toISOString().slice(0,16),exclusive:true};}
  function analysis(){const r=range();return {from:r.from.replace(' ','T'),to:r.to.replace(' ','T')};}
  function useOpeningRange(page,ready,update) {
    const R=Se(),previous=R.useRef(null);
    R.useEffect(()=>{if(!ready||previous.current===page)return;previous.current=page;if(['overview','trends','data','charts','lims','analysis','comparison'].includes(page))update(range());},[page,ready]);
  }
  return {range,analysis,today,useOpeningRange};
})();

if(typeof module!=='undefined'&&module.exports)module.exports=ViewDefaults;
