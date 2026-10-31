// Repair stale derived values without changing formulas or copying recipes between devices.
var FormulaHealth = (() => {
  const R=Se(),h=R.createElement,checked=new Map();
  function recalculate(state) {
    if(!Object.values(state.datasets).some(e=>e.dataset.status==='ready'&&e.dataset.role==='ledger'&&e.dataset.columns.some(c=>c.formula)))return [];
    const before=new Map(Object.values(state.datasets).filter(e=>e.dataset.status==='ready'&&e.dataset.role==='ledger').map(e=>[e.dataset.id,JSON.stringify(e.points)]));
    for(const entry of Object.values(state.datasets))if(entry.dataset.status==='ready'&&entry.dataset.role==='ledger'&&entry.dataset.columns.some(c=>c.formula))entry.points=Ho(entry.dataset.columns,entry.points);
    CrossUnit.recalculate(state);
    const changed=[];
    for(const [id,old]of before){const entry=state.datasets[id];if(JSON.stringify(entry.points)!==old){entry.dataset.updatedAt=new Date().toISOString();changed.push(id);}}
    return changed;
  }
  function ensure(revision) {
    const scope=AccountAuth.storageKey();if(checked.get(scope)===revision)return;
    if(!Object.values($r().state.datasets).some(e=>e.dataset.status==='ready'&&e.dataset.role==='ledger'&&e.dataset.columns.some(c=>c.formula))){checked.set(scope,revision);return;}
    const state=structuredClone($r().state),changed=recalculate(state);if(changed.length)Object.assign(qt(),state);
    checked.set(scope,changed.length?revision+1:revision);
  }
  function diagnostic(state,unitId,range={}) {
    const entry=Object.values(state.datasets).find(e=>e.dataset.role==='ledger'&&e.dataset.status==='ready'&&e.dataset.unitIds.includes(unitId));
    if(!entry)return [];
    const from=AnalysisMath.time(range.from?.replace(' ','T')),to=AnalysisMath.time(range.to?.replace(' ','T')),selected=p=>(from===null||p.time>=from)&&(to===null||p.time<=to+59999)&&(range.group===undefined||p.group===range.group);
    return entry.dataset.columns.filter(c=>c.formula).map(column=>{
      const rows=entry.points.filter(p=>Object.hasOwn(p.values,column.key)),valid=rows.filter(p=>AnalysisMath.finite(p.values[column.key])),visible=valid.filter(selected),issues=new Map();
      for(const row of entry.points){const issue=row.calculationIssues?.[column.key];if(issue)issues.set(issue.message,(issues.get(issue.message)??0)+1);}
      const reasons=[...issues].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([reason,count])=>reason+'（'+count+'条）');
      for(const [name,binding]of Object.entries(column.formula.bindings)){
        const source=state.datasets[binding.datasetId??entry.dataset.id],input=source?.dataset.columns.find(c=>c.key===binding.key);
        if(!input)reasons.push('引用“'+name+'”对应的指标不存在；请编辑公式重新选择。');
        else if(!source.points.some(p=>Object.hasOwn(p.values,binding.key)&&AnalysisMath.finite(p.values[binding.key])))reasons.push('输入“'+name+'”没有有效数值。');
      }
      if(!valid.length&&!reasons.length)reasons.push('没有满足条件的输入组合；请检查公式引用分组、LIMS时间轴、覆盖范围和匹配时间差。');
      if(valid.length&&!visible.length)reasons.unshift('已有计算结果，当前时间或分组筛选未覆盖。');
      if(!column.enabled)reasons.unshift('此计算指标已隐藏，请在指标设置中启用。');
      return {key:column.key,label:column.label,unit:column.unit,source:column.source??'production',valid:valid.length,inRange:visible.length,missing:rows.length-valid.length,reasons,status:!column.enabled?'已隐藏':valid.length?visible.length?'已计算':'筛选外有结果':'暂无有效结果'};
    });
  }
  async function request(req) {
    const state=$r().state,query=new URL(req.url).searchParams;
    if(req.method==='POST'){
      const body=await Ha(req);if(body.action!=='recalculate'||!state.settings.units.some(u=>!u.archived&&u.id===body.unitId))throw new Error('请选择有效装置。');
      const staged=structuredClone(state),changed=recalculate(staged);if(changed.length)Object.assign(qt(),staged);return Response.json({changed:changed.length,rows:diagnostic(staged,body.unitId)});
    }
    if(req.method!=='GET')throw new Error('公式检查操作无效。');
    const unitId=query.get('unitId')??'',units=state.settings.units.filter(u=>!u.archived);
    return Response.json({units:units.map(u=>({id:u.id,name:u.name,formulas:diagnostic(state,u.id).length})),rows:diagnostic(state,unitId,{from:query.get('from')??'',to:query.get('to')??'',...query.has('group')?{group:query.get('group')}:{} })});
  }
  function Panel({unitId,from='',to='',group,refreshKey,onChanged}) {
    const [result,setResult]=R.useState({units:[],rows:[]}),[error,setError]=R.useState(''),[notice,setNotice]=R.useState(''),[busy,setBusy]=R.useState(false);
    async function load(){const q=new URLSearchParams({unitId,from,to,...group!==undefined?{group}:{}}),r=await T0('/api/formula-health?'+q),data=await r.json();if(!r.ok)throw new Error(data.error);setResult(data);}
    R.useEffect(()=>{let live=true;load().catch(e=>live&&setError(e.message));return()=>{live=false;};},[unitId,from,to,group,refreshKey]);
    async function calculate(){setBusy(true);setError('');try{const r=await T0('/api/formula-health',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'recalculate',unitId})}),v=await r.json();if(!r.ok)throw new Error(v.error);await load();setNotice(v.changed?'已按各装置已有公式重新计算，并更新相关引用结果。':'已检查，保存的计算结果与当前输入一致。');onChanged?.();}catch(e){setError(e.message);}finally{setBusy(false);}}
    return h('section',{className:'panel analysis-controls'},h('h3',null,'公式运行检查'),h('p',{className:'muted'},'各装置使用各自创建的公式。输入更新和打开数据时会检查重算；无结果时查看引用、分组和时间条件。'),h('p',{className:'small muted'},result.units.map(u=>u.name+'：'+u.formulas+'条公式').join('；')),h('button',{className:'button',disabled:busy,onClick:calculate},busy?'正在检查公式…':'重新计算本装置公式'),error&&h('p',{className:'error-banner',role:'alert'},error),notice&&h('p',{role:'status'},notice),!result.rows.length?h('p',{className:'muted'},'当前装置没有已保存的计算公式。'):h('div',{className:'table-wrap'},h('table',{className:'data-table','aria-label':'公式运行状态'},h('thead',null,h('tr',null,...['计算指标','状态 / 来源','全部有效结果','当前范围有效结果','原因 / 提示'].map(s=>h('th',{key:s},s)))),h('tbody',null,...result.rows.map(row=>h('tr',{key:row.key},h('td',null,row.label),h('td',null,row.status+' / '+(row.source==='lims'?'LIMS检验':'生产')),h('td',null,row.valid),h('td',null,row.inRange),h('td',null,row.reasons.join('；')||'计算正常。')))))));
  }
  return {recalculate,ensure,diagnostic,request,Panel,confirm:revision=>checked.set(AccountAuth.storageKey(),revision)};
})();
