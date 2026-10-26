// Embedded into the standalone workbench by scripts/sync-cross-unit-calculations.py.
// Existing parser, unit conversion and local formula semantics remain shared.
var CrossUnit = (() => {
  const external = formula => Object.values(formula?.bindings ?? {}).some(b => b.datasetId);
  const identity = b => JSON.stringify([b.datasetId ?? "", b.unitId ?? "", b.key, b.group ?? null]);
  const rowKey = p => JSON.stringify([p.unit, p.time, p.group]);
  const nodeKey = (id, key) => JSON.stringify([id, key]);
  const active = (state, unit) => state.settings.units.some(u => u.id === unit && !u.archived);
  const ledgers = state => Object.values(state.datasets).filter(entry => entry.dataset.status === "ready" && entry.dataset.role === "ledger");
  const revision = state => vC(JSON.stringify({
    units: state.settings.units,
    datasets: ledgers(state).map(entry => [entry.dataset, entry.points])
  }));

  function catalog(state, currentId) {
    return ledgers(state).filter(entry => entry.dataset.id !== currentId).flatMap(entry => {
      const unitId = entry.dataset.unitIds[0];
      const unit = state.settings.units.find(u => u.id === unitId && !u.archived);
      if (!unit) return [];
      return DE(entry.dataset.columns.filter(c => c.enabled && c.kind !== "limit"), entry.points).map(ref => {
        const column = entry.dataset.columns.find(c => c.key === ref.key);
        const name = `${unit.name}（${unit.id}）｜${ref.source === "lims" ? "LIMS" : "生产"}｜${ref.group || "未分组"}｜${column.label}`;
        return {...ref, name, datasetId: entry.dataset.id, unitId};
      });
    });
  }

  async function getSources(request) {
    try {
      const state = $r().state;
      const id = new URL(request.url).searchParams.get("id");
      const entry = state.datasets[id];
      if (!entry || entry.dataset.role !== "ledger" || entry.dataset.status !== "ready") throw new Error("请选择装置完整数据集。");
      return Response.json({
        units: state.settings.units.filter(u => !u.archived).map(u => ({id:u.id, name:u.name})),
        references: catalog(state, id), revision: revision(state)
      });
    } catch (error) { return Lt(error); }
  }

  function validateLocation(binding) {
    if (binding.datasetId === undefined && binding.unitId === undefined) return {};
    if (typeof binding.datasetId !== "string" || !/^ds_[\w-]{1,190}$/.test(binding.datasetId) ||
        typeof binding.unitId !== "string" || !/^[a-zA-Z0-9_-]{1,40}$/.test(binding.unitId)) {
      throw new Error("跨装置引用的数据集或装置编号无效。");
    }
    return {datasetId: binding.datasetId, unitId: binding.unitId};
  }

  function oldBinding(formula, text, choices, reset) {
    const old = formula?.bindings?.[text];
    const choice = choices.find(ref => ao(ref.name) === ao(text));
    if (!old?.datasetId && !choice) return null;
    const ref = choice ?? old;
    const preserved = !reset && Object.values(formula?.bindings ?? {}).find(b => identity(b) === identity(ref));
    return {key:ref.key, unit:preserved?.unit ?? ref.unit,
      ...ref.group !== undefined ? {group:ref.group} : {}, ...validateLocation(ref)};
  }

  function graph(state) {
    const nodes = new Map();
    for (const entry of ledgers(state)) for (const column of entry.dataset.columns) {
      nodes.set(nodeKey(entry.dataset.id, column.key), {entry, column, affected:false});
    }
    const visiting = new Set(), visited = new Set(), order = [];
    function visit(node) {
      const id = nodeKey(node.entry.dataset.id, node.column.key);
      if (visited.has(id)) return;
      if (visiting.has(id)) throw new Error(`计算公式循环引用：${node.entry.dataset.name} / ${node.column.label}。`);
      visiting.add(id);
      if (node.column.formula) {
        node.affected = external(node.column.formula);
        for (const binding of Object.values(node.column.formula.bindings)) {
          const dep = nodes.get(nodeKey(binding.datasetId ?? node.entry.dataset.id, binding.key));
          if (!dep) continue; // Missing remote sources produce a visible missing-value issue.
          visit(dep); node.affected ||= dep.affected;
        }
      }
      visiting.delete(id); visited.add(id); order.push(node);
    }
    for (const node of nodes.values()) visit(node);
    return {nodes, order};
  }

  function isLimsClock(nodes, id, key, seen = new Set()) {
    const token = nodeKey(id, key);
    if (seen.has(token)) return false;
    seen.add(token);
    const node = nodes.get(token);
    if (!node) return false;
    if (!node.column.formula) return node.column.source === "lims";
    return eg(node.column.formula).timeline === "lims" && Object.values(node.column.formula.bindings)
      .some(b => isLimsClock(nodes, b.datasetId ?? id, b.key, new Set(seen)));
  }

  function series(state, id, targetUnit, binding) {
    const sourceId = binding.datasetId ?? id, unitId = binding.unitId ?? targetUnit;
    const entry = state.datasets[sourceId];
    const column = entry?.dataset.columns.find(c => c.key === binding.key);
    if (!entry || entry.dataset.role !== "ledger" || entry.dataset.status !== "ready" ||
        !entry.dataset.unitIds.includes(unitId) || !active(state, unitId) || !column) {
      return {error:"引用装置、数据集或指标已不可用", column, unitId, sourceId, rows:[]};
    }
    let rows = entry.points.filter(p => p.unit === unitId && Object.hasOwn(p.values, binding.key));
    const groups = [...new Set(rows.map(p => p.group))];
    const group = binding.group ?? (groups.length === 1 ? groups[0] : undefined);
    if (group === undefined && groups.length > 1) return {error:"存在多个分组，请选择具体采样点", column, unitId, sourceId, rows:[]};
    rows = rows.filter(p => p.group === group).sort((a,b) => a.time-b.time);
    return {column, unitId, sourceId, rows};
  }

  function nearest(rows, time) {
    let lo = 0, hi = rows.length;
    while (lo < hi) {const mid=(lo+hi)>>>1; if(rows[mid].time < time) lo=mid+1; else hi=mid;}
    const before=rows[lo-1], after=rows[lo];
    return before ? after ? time-before.time <= after.time-time ? before : after : before : after;
  }

  function context(state, entry, column, nodes) {
    const formula = column.formula, unitId=entry.dataset.unitIds[0];
    const refs = Object.entries(formula.bindings).map(([name,binding]) => {
      const lims=isLimsClock(nodes,binding.datasetId ?? entry.dataset.id,binding.key);
      // Unqualified local production references use the destination group,
      // including when another device supplies the LIMS sampling timeline.
      const query=!binding.datasetId && !lims && binding.group===undefined
        ? {...binding,group:eg(formula).targetGroup ?? ""} : binding;
      return {name,binding,...series(state,entry.dataset.id,unitId,query),lims};
    });
    const lims=refs.filter(ref=>ref.lims), matching=eg(formula);
    const anchor=lims.find(ref=>identity(ref.binding)===identity(matching.anchor ?? {})) ?? lims[0];
    let from=-Infinity, to=Infinity, error;
    for(const ref of lims) {
      if(ref.error || !ref.rows.length) {error=`“${ref.name}”${ref.error ?? "没有检验记录"}`;break;}
      const first=ref.rows[0].time, last=ref.rows.at(-1).time;
      const padding=first===last ? matching.maxGapMinutes*60000 : 0;
      from=Math.max(from,first-padding);to=Math.min(to,last+padding);
    }
    if(from>to)error="公式所需LIMS位点没有共同覆盖的时间段";
    return {refs,lims,matching,anchor,from,to,error,unitId};
  }

  function computeCross(state, entry, column, nodes) {
    const formula=column.formula, ctx=context(state,entry,column,nodes);
    const ast=TE(formula.expression,name=>formula.bindings[name]);
    const onLims=ctx.lims.length && ctx.matching.timeline==="lims";
    const targetGroup=ctx.matching.targetGroup ?? "";
    let rows;
    if(onLims) {
      rows=(ctx.anchor?.rows ?? []).map(p=>({unit:ctx.unitId,time:p.time,group:targetGroup,values:{}}));
    } else {
      // Use this device's actual production timestamps; remote rows never become
      // production records in the destination device.
      const rawKeys=new Set(entry.dataset.columns.filter(c=>!c.formula && c.source!=="lims").map(c=>c.key));
      rows=entry.points.filter(p=>p.group===targetGroup && Object.keys(p.values).some(k=>rawKeys.has(k)));
      if(!rows.length && !rawKeys.size) rows=entry.points.filter(p=>p.group===targetGroup);
    }
    const byKey=new Map(entry.points.map(p=>[rowKey(p),p]));
    for(const candidate of rows) {
      if(ctx.lims.length && ctx.matching.coverage==="overlap" && (ctx.error || candidate.time<ctx.from || candidate.time>ctx.to)) continue;
      let row=byKey.get(rowKey(candidate));
      if(!row) {row={...candidate,values:{}};entry.points.push(row);byKey.set(rowKey(row),row);}
      const matches={};
      const resolve=(name,binding)=>{
        const ref=ctx.refs.find(r=>r.name===name);
        if(ref.error)return ea(`“${name}”：${ref.error}`,"missing");
        let found;
        if(!binding.datasetId && !ref.lims && !onLims) {
          if(binding.group!==undefined && binding.group!==row.group)return ea(`“${name}”不属于当前生产分组`,"missing");
          found=row;
        }else found=nearest(ref.rows,row.time);
        if(!found)return ea(`“${name}”没有匹配记录`,"missing");
        const delta=(found.time-row.time)/60000;
        matches[name]={time:found.time,group:found.group,deltaMinutes:delta,unitId:ref.unitId,datasetId:ref.sourceId};
        if(Math.abs(delta)>ctx.matching.maxGapMinutes)return ea(`“${name}”最近记录相差${Math.abs(delta)}分钟，超过最大时间差${ctx.matching.maxGapMinutes}分钟`,"missing");
        const issue=found.calculationIssues?.[binding.key];
        if(issue)return ea(`“${name}”：${issue.message}`,issue.kind);
        const value=found.values[binding.key];
        if(value==null)return ea(`最近的“${name}”值缺失`,"missing");
        try{return Fr(o3(value,ref.column.unit,binding.unit,formula.percentageMode));}
        catch{return ea(`“${name}”引用单位已改变，请编辑公式重新采用当前单位`);}
      };
      let result=Jh(ast,row.values,row.calculationIssues ?? {},new Map(),resolve);
      if(!result.issue && result.value!==null) {
        try{result=Fr(ro(qK(result.value,formula.resultUnit,formula.percentageMode),formula.resultUnit,column.unit));}
        catch{result=ea("公式结果单位与显示单位不兼容，请编辑公式");}
      }
      row.values[column.key]=result.value;
      if(result.issue)(row.calculationIssues ??= {})[column.key]=result.issue;
      if(Object.keys(matches).length)(row.calculationMatches ??= {})[column.key]=matches;
    }
  }

  function recalculate(state) {
    if(!ledgers(state).some(e=>e.dataset.columns.some(c=>external(c.formula))))return state;
    const {nodes,order}=graph(state), changed=new Map();
    for(const entry of ledgers(state)) {
      if(!active(state,entry.dataset.unitIds[0]))continue;
      const affected=new Set(order.filter(n=>n.entry===entry && n.affected).map(n=>n.column.key));
      if(!affected.size)continue;
      changed.set(entry,JSON.stringify(entry.points));
      const rawKeys=new Set(entry.dataset.columns.filter(c=>!c.formula).map(c=>c.key));
      entry.points=entry.points.filter(p=>Object.keys(p.values).some(k=>rawKeys.has(k))).map(p=>{
        const row=structuredClone(p);
        for(const key of affected) {delete row.values[key];delete row.calculationIssues?.[key];delete row.calculationMatches?.[key];}
        return row;
      });
    }
    for(const node of order) {
      if(!node.column.formula || !node.affected || !changed.has(node.entry))continue;
      const {entry,column}=node;
      if(external(column.formula))computeCross(state,entry,column,nodes);
      else {
        const prior=new Map(entry.points.map(p=>[rowKey(p),p]));
        const columns=entry.dataset.columns.map(c=>c.key===column.key ? c : {
          ...c,formula:undefined,source:isLimsClock(nodes,entry.dataset.id,c.key)?"lims":"production"
        });
        entry.points=Ho(columns,entry.points).map(p=>{
          const previous=prior.get(rowKey(p));
          for(const field of ["calculationIssues","calculationMatches"]) {
            const values={...previous?.[field],...p[field]};
            if(Object.keys(values).length)p[field]=values;
          }
          return p;
        });
      }
    }
    for(const [entry,before]of changed) {
      entry.points.sort((a,b)=>a.time-b.time || a.group.localeCompare(b.group));
      if(entry.points.length>100000)throw new Error("跨装置计算后超过100000个时间点，请缩减数据范围。");
      if(JSON.stringify(entry.points)===before)continue;
      const times=entry.points.map(p=>p.time);
      entry.dataset={...entry.dataset,count:times.length,expectedCount:times.length,
        start:times.length?times.reduce((a,b)=>Math.min(a,b),Infinity):0,
        end:times.length?times.reduce((a,b)=>Math.max(a,b),-Infinity):0,
        groups:[...new Set(entry.points.map(p=>p.group))].sort(),updatedAt:new Date().toISOString()};
      if(!times.length){entry.dataset.start=0;entry.dataset.end=0;entry.dataset.groups=[""];}
    }
    return state;
  }

  function coverage(state,id,column) {
    if(!external(column.formula))return null;
    const entry=state.datasets[id], {nodes}=graph(state), ctx=context(state,entry,column,nodes);
    if(!ctx.lims.length)return [];
    return [{unit:ctx.unitId,from:Number.isFinite(ctx.from)?ctx.from:null,to:Number.isFinite(ctx.to)?ctx.to:null,
      primary:ctx.anchor?.name ?? "",...ctx.error?{error:ctx.error}:{}}];
  }

  return {external,identity,catalog,getSources,validateLocation,oldBinding,revision,recalculate,coverage};
})();
