// Additive, administrator-only imports. No account or personal settings are imported.
var BackupMerge = (() => {
  const R=Se(),h=R.createElement;
  let pending=null;
  const wrap=state=>({format:"process-studio-offline",version:1,state});
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const empty=v=>v===null||v===undefined||v==="";
  async function hash(value){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,"0")).join("").slice(0,28);}
  function requireAdmin(){AccountAuth.assertWorkspace();if(!AccountAuth.isAdmin())throw new Error("仅管理员可以加入用户数据。");}
  async function plan(current,backup,source){
    source=String(source??"").normalize("NFKC").trim().toLowerCase();
    if(!/^[a-z0-9][a-z0-9_.-]{0,39}$/.test(source))throw new Error("请填写提交人的工号；同一人每次使用相同工号。");
    const incoming=DC(backup),next=structuredClone(current),ids=new Map(),units=new Map(),datasets=new Map(),metricIds=new Map();
    const stats={units:0,datasets:0,points:0,values:0,records:0,reports:0,notes:0,conflicts:0,duplicates:0,skipped:0};
    const conflicts=[];
    function conflict(message){stats.conflicts++;if(conflicts.length<12)conflicts.push(message);}
    for(const id of new Set([...incoming.settings.units.map(u=>u.id),...incoming.reports.map(r=>r.unit),...(incoming.metricReports??[]).map(r=>r.unitId)]))units.set(id,"share_"+await hash(source+":unit:"+id));
    // Ledger IDs must keep the canonical per-device shape used throughout the app.
    const datasetId=async id=>{
      if(datasets.has(id))return datasets.get(id);
      const old=id.startsWith("ds_unit_")?id.slice(8):null;
      const mapped=old&&units.has(old)?"ds_unit_"+units.get(old):"ds_share_"+await hash(source+":dataset:"+id);
      datasets.set(id,mapped);return mapped;
    };
    for(const id of Object.keys(incoming.datasets))await datasetId(id);
    for(const entry of [...Object.values(incoming.datasets),...(incoming.metricReports??[])])for(const col of entry.dataset.columns){
      for(const binding of Object.values(col.formula?.bindings??{}))if(binding.datasetId)await datasetId(binding.datasetId);
      const anchor=col.formula?.matching?.anchor;if(anchor?.datasetId)await datasetId(anchor.datasetId);
    }
    for(const report of incoming.metricReports??[]){await datasetId(report.sourceId);ids.set(report.id,"mr_share_"+await hash(source+":report:"+report.id));}
    for(const log of incoming.importLog??[])ids.set(log.id,"share_"+await hash(source+":log:"+log.id));
    const metrics=[...incoming.settings.customMetrics,...incoming.reports.flatMap(r=>r.metricDefs.filter(m=>m.id.startsWith("x_")))];
    for(const metric of metrics)if(!metricIds.has(metric.id))metricIds.set(metric.id,"x_share_"+await hash(source+":metric:"+metric.id));
    // Map structural IDs only. Human-written notes, names and formula expressions
    // stay literal. Local column keys remain stable inside each isolated source.
    function remap(value,key="",owner=null){
      if(Array.isArray(value))return value.map(v=>typeof v==="string"&&["unitIds","units","mergedInto","hiddenMetrics"].includes(key)?(key==="mergedInto"?datasets:key==="hiddenMetrics"?metricIds:units).get(v)??v:remap(v));
      if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([k,v])=>[
        ["targets","extras","metrics"].includes(key)?metricIds.get(k)??k:k,remap(v,k,value)]));
      if(typeof value!=="string")return value;
      if(key==="unitId"||key==="unit"&&owner&&(Object.hasOwn(owner,"date")||Object.hasOwn(owner,"time")&&Object.hasOwn(owner,"values")||Object.hasOwn(owner,"unitConfig")))return units.get(value)??value;
      if(key==="datasetId"||key==="sourceId")return datasets.get(value)??value;
      if(key==="field"||key==="metricId")return metricIds.get(value)??value;
      if(key==="id")return (owner?.columns?datasets:owner?.yieldBasis?units:owner?.field?metricIds:ids).get(value)??value;
      return value;
    }
    const sourceUnits=[];
    for(const unit of incoming.settings.units){
      const mapped=remap(unit);mapped.name=unit.name.slice(0,Math.max(1,57-source.length))+" · "+source;
      sourceUnits.push({name:mapped.name,existing:next.settings.units.some(u=>u.id===mapped.id)});
      if(!next.settings.units.some(u=>u.id===mapped.id)){next.settings.units.push(mapped);stats.units++;}
    }
    const blockedMetrics=new Set();
    for(const metric of incoming.settings.customMetrics){
      const mapped=remap(metric),old=next.settings.customMetrics.find(m=>m.id===mapped.id);
      if(!old)next.settings.customMetrics.push(mapped);
      else if(old.unit!==mapped.unit||old.mode!==mapped.mode){blockedMetrics.add(mapped.id);conflict("日报指标“"+mapped.label+"”单位或口径不同，保留现有定义及该指标数据");}
    }
    const sourceUnitIds=new Set(units.values()),sourceMetricIds=new Set(incoming.settings.customMetrics.map(m=>metricIds.get(m.id)));
    const oldMetricIds=new Set(current.settings.customMetrics.map(m=>m.id));
    for(const unit of next.settings.units){
      const hide=sourceUnitIds.has(unit.id)?next.settings.customMetrics.filter(m=>!sourceMetricIds.has(m.id)&&!current.settings.units.some(u=>u.id===unit.id)).map(m=>m.id):[...sourceMetricIds].filter(id=>!oldMetricIds.has(id));
      unit.hiddenMetrics=[...new Set([...(unit.hiddenMetrics??[]),...hide])];
    }
    if(next.settings.units.length>30)throw new Error("加入后装置将超过30个，请先整理装置或让提交人只导出需要汇总的数据。");
    if(next.settings.customMetrics.length>100)throw new Error("加入后日报自定义指标将超过100个，请先整理指标。");
    function fill(target,added,label){
      for(const [key,value] of Object.entries(added)){
        if(empty(value))continue;
        if(empty(target[key])){target[key]=value;stats.values++;}
        else if(!equal(target[key],value))conflict(label+"："+key+" 保留现有值");
      }
    }
    const records=new Map(next.records.map(r=>[qo(r),r]));
    for(const record of incoming.records){
      const mapped=remap(record);for(const id of blockedMetrics)delete mapped.extras?.[id];
      const key=qo(mapped),old=records.get(key);
      if(!old){next.records.push(mapped);records.set(key,mapped);stats.records++;}
      else{stats.duplicates++;const {extras,...fields}=mapped;fill(old,fields,"日报 "+mapped.date);old.extras??={};fill(old.extras,extras??{},"日报 "+mapped.date);}
    }
    for(const [id,entry] of Object.entries(incoming.datasets)){
      if(entry.dataset.status!=="ready"){stats.skipped++;continue;}
      const mapped=remap(entry),key=datasets.get(id),old=next.datasets[key];
      // Re-evaluate derived values after the full graph has been remapped.
      for(const point of mapped.points){delete point.calculationIssues;delete point.calculationMatches;}
      if(!old){next.datasets[key]=mapped;stats.datasets++;stats.points+=mapped.points.length;continue;}
      const columns=new Map(old.dataset.columns.map(c=>[c.key,c])),blocked=new Set();
      for(const col of mapped.dataset.columns){
        const existing=columns.get(col.key);
        if(!existing){old.dataset.columns.push(col);columns.set(col.key,col);}
        else if(!equal([existing.label,existing.unit,existing.source??"production",existing.formula??null],[col.label,col.unit,col.source??"production",col.formula??null])){
          blocked.add(col.key);conflict(mapped.dataset.name+"：指标“"+col.label+"”定义不同，保留现有定义及该列数据");
        }
      }
      const rowKey=p=>JSON.stringify([p.unit,p.time,p.group]),points=new Map(old.points.map(p=>[rowKey(p),p]));
      for(const point of mapped.points){
        const values=Object.fromEntries(Object.entries(point.values).filter(([k])=>!blocked.has(k)&&!columns.get(k)?.formula));
        const previous=points.get(rowKey(point));
        if(!previous){const added={...point,values};old.points.push(added);points.set(rowKey(point),added);stats.points++;}
        else{stats.duplicates++;fill(previous.values,values,mapped.dataset.name+" · "+new Date(point.time).toLocaleString("zh-CN"));}
      }
      old.points.sort((a,b)=>a.time-b.time||a.unit.localeCompare(b.unit)||a.group.localeCompare(b.group));
      Object.assign(old.dataset,{count:old.points.length,expectedCount:old.points.length,
        start:old.points.length?old.points[0].time:0,end:old.points.length?old.points.at(-1).time:0,
        unitIds:[...new Set([...old.dataset.unitIds,...mapped.dataset.unitIds,...old.points.map(p=>p.unit)])],groups:[...new Set([...old.dataset.groups,...old.points.map(p=>p.group)])]});
    }
    const reportIds=new Set(next.reports.map(r=>r.id));
    const existingReports=new Map(next.reports.map(r=>[r.id,r]));
    for(const report of incoming.reports){
      const mapped=remap(report);mapped.id=mapped.unit+":"+mapped.month;
      const old=existingReports.get(mapped.id);
      if(!reportIds.has(mapped.id)){next.reports.push(mapped);reportIds.add(mapped.id);stats.reports++;}else if(!equal(old,mapped))conflict("日报月报 "+mapped.month+" 保留现有快照");
    }
    const snapshots=new Map(next.metricReports.map(r=>[r.id,r]));
    for(const report of incoming.metricReports??[]){const mapped=remap(report),old=snapshots.get(mapped.id);if(!old){next.metricReports.push(mapped);snapshots.set(mapped.id,mapped);stats.reports++;}else if(!equal(old,mapped))conflict("指标月报 "+mapped.month+" 保留现有快照");}
    for(const [key,note] of Object.entries(incoming.focusNotes??{})){
      const split=key.lastIndexOf(":"),mapped=units.get(key.slice(0,split))+key.slice(split);
      if(!next.focusNotes[mapped]){next.focusNotes[mapped]=structuredClone(note);stats.notes++;}
      else if(next.focusNotes[mapped].text!==note.text)conflict("本月关注 "+key.slice(split+1)+" 保留现有内容");
    }
    const logIds=new Set(next.importLog.map(l=>l.id));
    for(const log of incoming.importLog??[]){const mapped=remap(log);if(!logIds.has(mapped.id)){next.importLog.push(mapped);logIds.add(mapped.id);}}
    // Validate all limits, references, formulas and snapshots before any write.
    // Personal details, preferences, local links and current filters come from
    // the administrator's workspace, never from the submitted backup.
    const state=DC(wrap(next));
    for(const [id,old] of Object.entries(current.datasets)){
      const entry=state.datasets[id];
      if(entry&&equal(entry.points,old.points)&&equal(entry.dataset.columns,old.dataset.columns)){
        if(old.dataset.updatedAt===undefined)delete entry.dataset.updatedAt;else entry.dataset.updatedAt=old.dataset.updatedAt;
      }
    }
    return {state,summary:{source,stats,units:sourceUnits,conflicts}};
  }
  async function handle(request,current,revision){
    requireAdmin();const body=await request.json();
    if(body.action==="cancel"){pending=null;return Response.json({ok:true});}
    if(body.action==="preview"){
      pending=null;
      const result=await plan(current,body.backup,body.source);
      const token=crypto.randomUUID();pending={...result,token,revision,workspace:AccountAuth.storageKey(),expires:Date.now()+15*60*1000};
      return Response.json({token,...result.summary});
    }
    if(body.action==="commit"){
      const review=pending;pending=null;
      if(!review||review.token!==body.token||review.workspace!==AccountAuth.storageKey()||review.expires<Date.now())throw new Error("预览已失效，请重新选择文件并预览。");
      if(review.revision!==revision)throw new Error("当前数据已变化，请重新预览后再加入，避免覆盖其他窗口的修改。");
      Object.assign(qt(),review.state);return Response.json({ok:true,...review.summary});
    }
    throw new Error("加入数据操作无效。");
  }
  function Control(){
    const [open,setOpen]=R.useState(false),[file,setFile]=R.useState(null),[source,setSource]=R.useState(""),[review,setReview]=R.useState(null),[busy,setBusy]=R.useState(false),[error,setError]=R.useState("");
    if(!AccountAuth.isAdmin())return null;
    async function call(body){const response=await T0("/api/offline/merge",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}),data=await response.json();if(!response.ok)throw new Error(data.error);return data;}
    async function choose(selected){setReview(null);setFile(null);setError("");try{
      if(!selected)return;if(selected.size>128*1024*1024)throw new Error("备份文件超过128 MB，请分批收集。");
      const backup=JSON.parse(await selected.text());setFile({name:selected.name,backup});setSource(String(backup.state?.profile?.employeeId??"").normalize("NFKC").trim().toLowerCase());
    }catch(e){setError(e instanceof SyntaxError?"文件不是有效的 JSON 备份。":e.message);}}
    async function preview(){setBusy(true);setError("");setReview(null);try{await Ei();setReview(await call({action:"preview",source,backup:file.backup}));}catch(e){setError(e.message);}finally{setBusy(false);}}
    async function commit(){setBusy(true);setError("");try{
      // Export the exact current workspace before making an additive change.
      N$(await M$(),"工程师工作台_加入数据前备份_"+D$()+".json");
      await call({action:"commit",token:review.token});location.reload();
    }catch(e){setError(e.message);setReview(null);}finally{setBusy(false);}}
    const summary=review?.stats;
    return h(R.Fragment,null,h("button",{onClick:()=>{setOpen(true);setError("");}},"加入数据"),open&&h("div",{className:"account-overlay",role:"dialog","aria-modal":true,"aria-label":"加入用户数据"},
      h("section",{className:"account-dialog backup-merge"},h("button",{className:"button account-close",disabled:busy,onClick:()=>{call({action:"cancel"}).catch(()=>{});setOpen(false);setReview(null);setFile(null);}},"关闭加入窗口"),
        h("h2",null,"加入用户数据"),h("p",{className:"muted"},"收集用户通过“另存为”导出的 JSON 文件，逐个加入自己的汇总。已有数据保留，姓名、工号和个人设置保持当前账号。"),
        h("label",{className:"form-label"},"选择用户 JSON 备份",h("input",{type:"file",accept:".json",disabled:busy,"aria-label":"选择用户 JSON 备份",onChange:e=>choose(e.target.files?.[0])})),
        file&&h("p",{className:"small"},file.name),h("label",{className:"form-label"},"提交人工号",h("input",{"aria-label":"提交人工号",value:source,maxLength:40,disabled:busy,onChange:e=>{setSource(e.target.value);setReview(null);}})),
        h("p",{className:"small muted"},"同一人每次使用相同工号，按来源区分装置。同一时间、分组的重复数据去重，冲突保留现有值；未完成导入的数据集跳过。"),
        error&&h("p",{role:"alert",className:"error-banner"},error),
        h("button",{className:"button",disabled:busy||!file||!source,onClick:preview},busy?"正在处理…":"预览加入内容"),
        review&&h("section",{className:"account-issued",role:"status"},h("b",null,"加入预览 · "+review.source),
          h("p",null,`新增 ${summary.units} 个装置、${summary.datasets} 个数据集、${summary.points} 条图表记录、${summary.records} 条日报、${summary.reports} 份月报、${summary.notes} 条关注记录；补充 ${summary.values} 个空缺值。`),
          h("p",null,`识别 ${summary.duplicates} 条重复记录，${summary.conflicts} 处冲突保留现有内容，跳过 ${summary.skipped} 个未完成数据集。`),
          h("ul",null,...review.units.map(u=>h("li",{key:u.name},u.name+(u.existing?"（追加到已有来源装置）":"（新增）")))),
          review.conflicts.length>0&&h("details",null,h("summary",null,"查看冲突示例（最多12条）"),h("ul",null,...review.conflicts.map((c,i)=>h("li",{key:i},c)))),
          h("p",{className:"small"},"确认后先下载当前汇总的备份，再保存加入结果并刷新工作台。"),h("button",{className:"button primary",disabled:busy,onClick:commit},"确认加入，保留已有数据")))));
  }
  return {handle,Control};
})();
