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
  function request(req){
    if(req.method!=='GET')throw new Error('实时数据仅支持读取。');const state=$r().state,query=new URL(req.url).searchParams,unitId=query.get('unitId'),pairs=new Set(provenance(state).map(identity)),units=state.settings.units.filter(u=>!u.archived),entries=Object.values(state.datasets).filter(e=>e.dataset.status==='ready'&&e.dataset.role==='ledger'),catalog=units.map(u=>({id:u.id,name:u.name,groups:[...new Set(entries.flatMap(e=>e.points.filter(p=>p.unit===u.id&&pairs.has(identity({unitId:u.id,group:p.group}))).map(p=>p.group)))].sort()})).filter(u=>u.groups.length);
    if(!unitId)return Response.json({units:catalog});
    if(!units.some(u=>u.id===unitId))throw new Error('实时装置已不可用。');
    const entry=entries.find(e=>e.dataset.unitIds.includes(unitId));if(!entry)return Response.json({units:catalog,columns:[],points:[]});
    const points=PointExclusions.apply(entry.dataset.id,entry.points.filter(p=>p.unit===unitId&&pairs.has(identity({unitId,group:p.group})))),keys=new Set(points.flatMap(p=>Object.keys(p.values)));
    return Response.json({units:catalog,sourceId:entry.dataset.id,columns:entry.dataset.columns.filter(c=>c.enabled&&c.kind!=='limit'&&keys.has(c.key)),points});
  }
  async function api(unit){const r=await T0('/api/live-data'+(unit?'?unitId='+encodeURIComponent(unit):'')),v=await r.json();if(!r.ok)throw new Error(v.error);return v;}
  function Page({refreshKey}) {
    const [data,setData]=R.useState({units:[],columns:[],points:[]}),[unit,setUnit]=R.useState(''),[group,setGroup]=R.useState(''),[range,setRange]=R.useState(()=>ViewDefaults.analysis()),[error,setError]=R.useState(''),[loading,setLoading]=R.useState(false),version=PointExclusions.useVersion(),follow=R.useRef(true);
    R.useEffect(()=>{let live=true;setLoading(true);api(unit).then(v=>{if(!live)return;setData(v);if(!unit&&v.units.length)setUnit(v.units[0].id);if(unit){const choices=v.units.find(u=>u.id===unit)?.groups??[];setGroup(old=>choices.includes(old)?old:choices[0]??'');}}).catch(e=>live&&setError(e.message)).finally(()=>live&&setLoading(false));return()=>{live=false;};},[unit,refreshKey,version]);
    R.useEffect(()=>{if(follow.current)setRange(ViewDefaults.analysis());},[refreshKey]);
    R.useEffect(()=>{const timer=setInterval(()=>{if(follow.current)setRange(ViewDefaults.analysis());},60000);return()=>clearInterval(timer);},[]);
    let rows=[],failure='';try{rows=AnalysisMath.select(data.points??[],{...range,group,allGroups:false});}catch(e){failure=e.message;}
    const columns=(data.columns??[]).filter(c=>(data.points??[]).some(p=>p.group===group&&Object.hasOwn(p.values,c.key))),groups=data.units.find(u=>u.id===unit)?.groups??[],format=t=>new Date(t+28800000).toISOString().slice(0,19).replace('T',' ');
    function csv(){const quote=v=>'"'+String(typeof v==='string'&&/^[=+\-@\t\r]/.test(v)?"'"+v:v??'').replace(/"/g,'""')+'"';AnalysisPlots.download('\ufeff'+[['时间（北京时间）','分组',...columns.map(c=>c.label+(c.unit?' / '+c.unit:''))],...rows.map(p=>[format(p.time),p.group,...columns.map(c=>p.values[c.key]??'')])].map(r=>r.map(quote).join(',')).join('\r\n'),'PI实时数据.csv','text/csv;charset=utf-8');}
    return h('div',{className:'analysis-workbench'},h('section',{className:'panel analysis-controls'},h('h2',null,'PI实时数据'),h('p',{className:'muted'},'显示Excel同步导入的PI采样值和计算指标。日均值与历史汇总在运行总览查看；需要保持Excel同步窗口运行。'),h('div',{className:'analysis-fields'},
      h('label',{className:'analysis-field'},h('span',null,'实时数据装置'),h('select',{'aria-label':'实时数据装置',value:unit,onChange:e=>{setData(d=>({...d,points:[],columns:[]}));setUnit(e.target.value);follow.current=true;setRange(ViewDefaults.analysis());}},...data.units.map(u=>h('option',{key:u.id,value:u.id},u.name)))),
      h('label',{className:'analysis-field'},h('span',null,'PI采样分组'),h('select',{'aria-label':'PI采样分组',value:group,onChange:e=>setGroup(e.target.value)},...groups.map(g=>h('option',{key:g,value:g},g||'未分组')))),
      ...[['实时开始时间','from'],['实时结束时间','to']].map(([label,key])=>h('label',{className:'analysis-field',key},h('span',null,label),h('input',{'aria-label':label,type:'datetime-local',value:range[key],onChange:e=>{follow.current=false;setRange({...range,[key]:e.target.value});}})))),h('div',{className:'button-row'},h('button',{className:'button',onClick:()=>{follow.current=true;setRange(ViewDefaults.analysis());}},'最近一个月'),h('button',{className:'button',disabled:!rows.length,onClick:csv},'导出实时数据 CSV')),h('p',{className:'small muted'},`当前范围 ${rows.length} 个时间点。默认随同步推进最近一个月；手动改时间后暂停跟随，点击最近一个月恢复。`)),
      loading&&h('p',{role:'status'},'正在读取实时数据…'),[error,failure].filter(Boolean).map(m=>h('p',{key:m,role:'alert',className:'error-banner'},m)),!loading&&!data.units.length&&h('section',{className:'panel analysis-controls'},h('p',null,'尚无PI同步数据，请到“数据管理 → Excel自动同步”连接本机Excel。')),
      ...columns.map((col,index)=>{const config={...range,sourceId:data.sourceId,keys:[col.key],group,allGroups:false,type:'line',palette:['coast','sunset','aurora','island'][index%4],title:col.label+' · PI实时',normalized:false};const latest=[...rows].reverse().find(p=>AnalysisMath.finite(p.values[col.key]));return h('section',{className:'panel analysis-controls',key:col.key},h('p',{className:'small muted'},'最新有效值：'+(latest?AnalysisPlots.format(latest.values[col.key])+' '+col.unit+' · '+format(latest.time):'当前时段暂无有效值')),h(AnalysisPlots.Figure,{config,rows,columns:data.columns,subtitle:group||'未分组'}));}),
      !!rows.length&&h('section',{className:'panel analysis-controls'},h('h3',null,'实时数据明细'),h('p',{className:'small muted'},'显示最近200个时间点，CSV导出包含所选时段全部数据。'),h('div',{className:'table-wrap'},h('table',{className:'data-table','aria-label':'PI实时数据明细'},h('thead',null,h('tr',null,...['时间',...columns.map(c=>c.label)].map(c=>h('th',{key:c},c)))),h('tbody',null,...rows.slice(-200).reverse().map(p=>h('tr',{key:p.time},h('td',null,format(p.time)),...columns.map(c=>h('td',{key:c.key},p.values[c.key]??'—')))))))));
  }
  return {pages,groups,provenance,seed,summary,request,Page};
})();
