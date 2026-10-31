// PI is identified by persisted import provenance, never by guessing group names.
var LiveData = (() => {
  const R=Se(),h=R.createElement,identity=p=>JSON.stringify([p.unitId,p.group]);let seeded={scope:null,groups:[]};
  const pages=[{id:'live-data',label:'实时数据',en:'PI LIVE DATA',icon:Pm}];
  function groups(value=[]) {
    if(!Array.isArray(value)||value.length>2048)throw new Error('实时分组记录无效。');
    const map=new Map();for(const pair of value){if(!pair||!/^[-\w]{1,40}$/.test(pair.unitId??'')||typeof pair.group!=='string'||pair.group.length>80)throw new Error('实时分组记录无效。');map.set(identity(pair),{unitId:pair.unitId,group:pair.group});}if(map.size>1000)throw new Error('实时分组超过1000个。');return [...map.values()];
  }
  function provenance(state){const summary=new Set([...(state.excelSync?.dailyRows??[]),...(state.excelSync?.sources??[]).filter(s=>s.daily?.enabled).map(s=>({unitId:s.unitId,group:s.daily.group}))].map(identity));return groups([...(state.excelSync?.liveGroups??[]),...new Map((state.excelSync?.dailyRows??[]).map(r=>{const p={unitId:r.unitId,group:r.rawGroup};return [identity(p),p];})).values(),...(state.excelSync?.sources??[]).map(s=>({unitId:s.unitId,group:s.group}))]).filter(p=>!summary.has(identity(p)));}
  function seed(state){seeded={scope:AccountAuth.storageKey(),groups:provenance(state)};}
  function summary(workspace){
    if(seeded.scope!==AccountAuth.storageKey())return workspace;
    const pairs=new Set(seeded.groups.map(identity)),points=workspace.points.filter(p=>!pairs.has(identity({unitId:p.unit,group:p.group}))),allPoints=workspace.allPoints.filter(p=>!pairs.has(identity({unitId:p.unit,group:p.group}))),available=new Set(points.flatMap(p=>Object.keys(p.values)));
    return {...workspace,points,allPoints,dataset:workspace.dataset?{...workspace.dataset,columns:workspace.dataset.columns.filter(c=>available.has(c.key)),groups:[...new Set(points.map(p=>p.group))]}:null};
  }
  function catalog(state,pairs){
    const units=state.settings.units.filter(u=>!u.archived),byUnit=new Map(units.map(u=>[u.id,new Set()]));
    for(const entry of Object.values(state.datasets))if(entry.dataset.status==='ready'&&entry.dataset.role==='ledger'){
      const raw=new Set(entry.dataset.columns.filter(c=>!c.formula).map(c=>c.key));
      for(const p of entry.points)if(byUnit.has(p.unit)&&pairs.has(identity({unitId:p.unit,group:p.group}))&&Object.keys(p.values).some(k=>raw.has(k)))byUnit.get(p.unit).add(p.group);
    }
    return units.map(u=>({id:u.id,name:u.name,groups:[...byUnit.get(u.id)].sort()}));
  }
  function bounds(value){
    const from=AnalysisMath.time((value.from??'').replace(' ','T')),to=AnalysisMath.time((value.to??'').replace(' ','T'));
    if(from!==null&&to!==null&&from>to)throw new Error('开始时间不能晚于结束时间。');
    return {from:from??-Infinity,to:to===null?Infinity:to+(value.exclusive===true?0:value.exact===true?1:60000)};
  }
  function selection(state,value){
    const unitId=value.unitId,group=value.group;if(!state.settings.units.some(u=>u.id===unitId&&!u.archived)||!provenance(state).some(p=>p.unitId===unitId&&p.group===group))throw new Error('请选择已有PI采样分组。');
    if(!['range','all'].includes(value.mode))throw new Error('请选择删除当前时段或当前PI分组全部采样。');
    const range=value.mode==='all'?{from:-Infinity,to:Infinity}:bounds(value);
    if(value.mode==='range'&&(!value.from||!value.to))throw new Error('请明确要删除的起止时间。');
    const entry=state.datasets['ds_unit_'+unitId];if(!entry)throw new Error('PI数据已不存在。');
    const match=p=>p.unit===unitId&&p.group===group&&p.time>=range.from&&p.time<range.to;
    const raw=new Set(entry.dataset.columns.filter(c=>!c.formula).map(c=>c.key)),rows=entry.points.filter(p=>match(p)&&Object.keys(p.values).some(k=>raw.has(k)));
    const token=vC(JSON.stringify([unitId,group,value.mode,value.from,value.to,value.exact,entry.dataset.updatedAt,rows]));
    return {unitId,group,entry,rows,match,token};
  }
  async function remove(req){
    const state=$r().state,body=await Ha(req),selected=selection(state,body);
    if(!selected.rows.length)throw new Error('所选范围没有可删除的PI采样。');
    if(body.action==='review-delete')return Response.json({token:selected.token,count:selected.rows.length,unitName:state.settings.units.find(u=>u.id===selected.unitId).name});
    if(body.action!=='delete'||body.token!==selected.token)throw new Error('数据已变化，请重新预览删除范围后确认。');
    const staged=structuredClone(state),now=new Date().toISOString();
    for(const [id,entry]of Object.entries(staged.datasets)){
      if(entry.dataset.status!=='ready')continue;
      const points=entry.points.filter(p=>!selected.match(p));if(points.length===entry.points.length)continue;
      if(!points.length&&entry.dataset.role!=='ledger'){delete staged.datasets[id];continue;}
      entry.points=points;const times=points.map(p=>p.time);
      entry.dataset={...entry.dataset,count:points.length,expectedCount:points.length,start:times.length?Math.min(...times):0,end:times.length?Math.max(...times):0,groups:points.length?[...new Set(points.map(p=>p.group))].sort():[''],updatedAt:now};
    }
    FormulaHealth.recalculate(staged);
    const validated=DC({format:'process-studio-offline',version:1,state:staged});
    ExcelSync.stopTarget(selected.unitId,selected.group);
    Object.assign(qt(),validated);
    return Response.json({deleted:selected.rows.length,unitId:selected.unitId,group:selected.group});
  }
  async function request(req){
    if(req.method==='POST')return remove(req);if(req.method!=='GET')throw new Error('实时数据操作无效。');
    const state=$r().state,query=new URL(req.url).searchParams,pairs=new Set(provenance(state).map(identity)),units=catalog(state,pairs),unitId=query.get('unitId');
    if(!unitId)return Response.json({units});
    if(!units.some(u=>u.id===unitId))return Response.json({units,unavailable:true,columns:[],series:[],count:0});
    const entry=state.datasets['ds_unit_'+unitId],group=query.get('group')??units.find(u=>u.id===unitId).groups[0]??'',range=bounds({from:query.get('from')??'',to:query.get('to')??'',exact:query.get('exact')==='1',exclusive:query.get('exclusive')==='1'});
    if(!entry||!pairs.has(identity({unitId,group})))return Response.json({units,unitId,group,columns:[],series:[],count:0});
    const rawKeys=new Set(entry.dataset.columns.filter(c=>!c.formula).map(c=>c.key));
    const source=entry.points.filter(p=>p.unit===unitId&&p.group===group&&p.time>=range.from&&p.time<range.to&&Object.keys(p.values).some(k=>rawKeys.has(k))).sort((a,b)=>a.time-b.time);
    const keys=new Set();for(const row of source)for(const key of Object.keys(row.values))keys.add(key);const columns=entry.dataset.columns.filter(c=>c.enabled&&c.kind!=='limit'&&keys.has(c.key));
    if(query.get('mode')==='export')return Response.json({sourceId:entry.dataset.id,unitId,group,columns,points:source});
    const count=Number(query.get('limit')??6);if(!Number.isInteger(count)||count<1||count>100)throw new Error('指标数量无效。');
    const rows=PointExclusions.apply(entry.dataset.id,source),series=columns.slice(0,count).map(column=>({column,...LiveSeries.sample(rows,column.key)}));
    return Response.json({units,unitId,group,sourceId:entry.dataset.id,columns,series,count:source.length});
  }
  return {pages,groups,provenance,seed,summary,request,Page:LivePage.Page};
})();
