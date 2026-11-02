// Read-only arithmetic means over adjacent, non-overlapping periods.
var PeriodMath=(()=>{
  const finite=v=>typeof v==='number'&&Number.isFinite(v),offset=28800000;
  function previous(range){
    const from=range?.from,to=range?.to;if(!finite(from)||!finite(to)||to<=from)return null;
    const a=new Date(from+offset),b=new Date(to+offset),midnight=d=>d.getUTCDate()===1&&d.getUTCHours()===0&&d.getUTCMinutes()===0&&d.getUTCSeconds()===0&&d.getUTCMilliseconds()===0;
    const months=(b.getUTCFullYear()-a.getUTCFullYear())*12+b.getUTCMonth()-a.getUTCMonth();
    const calendar=midnight(a)&&midnight(b)&&months>0,start=calendar?Date.UTC(a.getUTCFullYear(),a.getUTCMonth()-months,1)-offset:from-(to-from);
    return finite(start)&&start<from?{from:start,to:from,kind:calendar?'calendar':'duration'}:null;
  }
  function compare(rows,key,range,selection={}){
    const prior=previous(range),current={count:0,mean:null},previousStats={count:0,mean:null};
    const add=(stats,value)=>{stats.count++;stats.mean=stats.count===1?value:stats.mean+(value-stats.mean)/stats.count;};
    for(const row of rows){
      if(selection.unitId&&row.unit!==selection.unitId||selection.allGroups!==true&&selection.group!==undefined&&row.group!==selection.group)continue;
      const value=row.values?.[key];if(!finite(value)||!finite(row.time))continue;
      if((!range||row.time>=range.from&&row.time<range.to))add(current,value);
      else if(prior&&row.time>=prior.from&&row.time<prior.to)add(previousStats,value);
    }
    if(!finite(current.mean))current.mean=null;if(!finite(previousStats.mean))previousStats.mean=null;
    const difference=current.mean!==null&&previousStats.mean!==null?current.mean-previousStats.mean:null,tolerance=Math.max(Math.abs(current.mean??0),Math.abs(previousStats.mean??0))*Number.EPSILON*16;
    const delta=finite(difference)?Math.abs(difference)<=tolerance?0:difference:null;
    return {range:prior?range:null,previousRange:prior,current,previous:previousStats,delta,direction:delta===null?null:delta>0?'up':delta<0?'down':'flat',status:!prior?'no-range':current.mean===null?'no-current':previousStats.mean===null?'no-previous':'ok'};
  }
  return {previous,compare};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=PeriodMath;
