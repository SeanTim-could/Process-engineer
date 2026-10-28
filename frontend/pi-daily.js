// Daily values are computed from unique retained Excel sample timestamps,
// never from the number of polling rounds. Raw PI and daily groups stay separate.
var PIDaily = (() => {
  const offset=28800000,day=time=>Math.floor((time+offset)/86400000)*86400000-offset;
  const id=r=>JSON.stringify([r.unitId,r.group,r.time]);
  function options(value={}) {
    if(!value||typeof value!=='object'||typeof (value.group??'PI日均值')!=='string'||(value.group??'PI日均值').length>80)throw new Error('日均汇总设置无效。');
    return {enabled:value.enabled===true,group:value.group??'PI日均值',overwrite:value.overwrite===true};
  }
  function normalize(rows=[]) {
    if(!Array.isArray(rows)||rows.length>100000)throw new Error('日均值写入记录无效。');
    const seen=new Set();
    return rows.map(row=>{
      if(!row||typeof row.unitId!=='string'||!/^[\w-]{1,40}$/.test(row.unitId)||typeof row.group!=='string'||row.group.length>80||typeof row.rawGroup!=='string'||row.rawGroup.length>80||!Number.isSafeInteger(row.time)||!row.values||typeof row.values!=='object'||Array.isArray(row.values)||Object.keys(row.values).length>100)throw new Error('日均值来源记录无效。');
      const key=id(row);if(seen.has(key))throw new Error('日均值来源记录重复。');seen.add(key);
      for(const [key,value]of Object.entries(row.values))if(!/^c_\d+$/.test(key)||!AnalysisMath.finite(value))throw new Error('日均值来源记录无效。');
      return {unitId:row.unitId,group:row.group,rawGroup:row.rawGroup,time:row.time,values:{...row.values}};
    });
  }
  function update(state,job,now) {
    const config=options(job.target.daily),record=state.excelSync??{},ownership=normalize(record.dailyRows),result={days:0,added:0,updated:0,conflicts:0};
    if(!config.enabled)return {result,ownership};
    if(config.group===job.target.group)throw new Error('日均汇总与PI实时数据必须选择不同分组。');
    if(job.target.source==='lims')throw new Error('PI日均汇总请使用生产指标来源；LIMS检验位点保持各自采样口径。');
    const entry=state.datasets['ds_unit_'+job.target.unitId],columns=entry.dataset.columns.filter(c=>!c.formula&&c.source!=='lims'&&job.columns.some(input=>dwe(c,input))),keys=new Set(columns.map(c=>c.key)),wanted=new Set(job.rows.map(r=>day(r.time))),today=day(Date.now()),buckets=new Map(),oldRows=new Map(),owned=new Map(ownership.map(row=>[id(row),row]));
    for(const row of entry.points){
      const date=day(row.time);if(!wanted.has(date)||date>today)continue;
      if(row.group===config.group){if(oldRows.has(date))throw new Error('所选历史分组在同一天有多行，请选择每天一行的历史表或新建日均分组。');oldRows.set(date,row);}
      if(row.group!==job.target.group)continue;
      const sums=buckets.get(date)??new Map();
      for(const [key,value]of Object.entries(row.values))if(keys.has(key)&&AnalysisMath.finite(value)){const s=sums.get(key)??{mean:0,count:0};s.count++;s.mean+=(value-s.mean)/s.count;sums.set(key,s);}
      buckets.set(date,sums);
    }
    for(const [date,sums]of buckets){
      if(!sums.size)continue;
      let row=oldRows.get(date),fresh=!row;if(!row)row={unit:job.target.unitId,time:date,group:config.group,values:{}};
      const token=id({unitId:row.unit,group:row.group,time:row.time}),previous=owned.get(token),tracked=previous??{unitId:row.unit,group:row.group,rawGroup:job.target.group,time:row.time,values:{}};
      if(previous&&previous.rawGroup!==job.target.group)throw new Error('此日均分组已用于另一PI采样分组，请分别建立汇总分组。');
      let wrote=false;
      for(const [key,s]of sums){
        if(!AnalysisMath.finite(s.mean))throw new Error('日均值超出数值范围，本轮未写入。');
        const current=row.values[key],own=Object.hasOwn(tracked.values,key)&&current===tracked.values[key];
        if(AnalysisMath.finite(current)&&!own&&!config.overwrite){if(current!==s.mean)result.conflicts++;continue;}
        if(current!==s.mean){row.values[key]=s.mean;if(!fresh)result.updated++;wrote=true;}
        tracked.values[key]=s.mean;
      }
      if(fresh&&wrote){entry.points.push(row);result.added++;}
      if(Object.keys(tracked.values).length)owned.set(token,tracked);
      result.days++;
    }
    entry.points=Ho(entry.dataset.columns,entry.points).sort((a,b)=>a.time-b.time||a.group.localeCompare(b.group));
    if(entry.points.length>100000)throw new Error('装置历史超过100000个时间点，请先备份并缩减范围。');
    const times=entry.points.map(p=>p.time);entry.dataset={...entry.dataset,count:times.length,expectedCount:times.length,start:Math.min(...times),end:Math.max(...times),groups:[...new Set(entry.points.map(p=>p.group))].sort(),updatedAt:now};
    return {result,ownership:[...owned.values()]};
  }
  function view(state,selected){
    const config=options(selected.daily),entry=state.datasets['ds_unit_'+selected.unitId],today=day(Date.now());
    if(!entry)return {groups:[],columns:[],rows:[]};
    const groups=[...new Set(entry.points.filter(p=>p.group!==selected.group).map(p=>p.group))].sort(),columns=entry.dataset.columns.filter(c=>c.enabled&&c.source!=='lims'&&c.kind!=='limit'),owners=new Map(normalize(state.excelSync?.dailyRows).map(row=>[id(row),row])),counts=new Map();
    for(const row of entry.points){const key=JSON.stringify([row.group,day(row.time)]);counts.set(key,(counts.get(key)??0)+1);}
    const rows=config.enabled?entry.points.filter(p=>p.group===config.group).sort((a,b)=>b.time-a.time).slice(0,366).map(p=>{
      const owner=owners.get(id({unitId:p.unit,group:p.group,time:p.time}));
      return {time:p.time,values:p.values,provisional:day(p.time)===today,rawGroup:owner?.rawGroup??null,samples:owner?(counts.get(JSON.stringify([owner.rawGroup,day(p.time)]))??0):null};
    }):[];
    return {groups,columns,rows};
  }
  return {options,normalize,update,view,day};
})();
