// Account-local chart references and layout; saving never copies or deletes data.
var Dashboard = (() => {
  const R=Se(),h=R.createElement,M=AnalysisMath,P=AnalysisPlots,eventName='workbench-dashboard-change';
  const pages=[{id:'dashboard',label:'Dashboard',en:'MY DASHBOARD',icon:Mn}];
  const string=(v,max,label)=>{if(typeof v!=='string'||v.length>max)throw new Error(label+'无效。');return v;};
  function card(value){
    if(!value||!['live','chart'].includes(value.kind))throw new Error('看板图表类型无效。');
    const config=DataAnalysis.chartConfig(value.config),unitId=string(value.unitId??'',40,'装置');if(unitId&&!/^[-\w]+$/.test(unitId))throw new Error('看板装置无效。');
    if(value.kind==='live'&&(config.type!=='line'||config.keys.length!==1||config.allGroups||!unitId))throw new Error('PI看板请选择一个装置、分组和指标。');
    const rangeMode=value.rangeMode??'month';if(!['today','month','fixed'].includes(rangeMode))throw new Error('看板时间范围无效。');
    return {kind:value.kind,unitId,config,rangeMode,wide:value.wide===true,exact:value.exact===true,exclusive:value.exclusive===true,control:value.control===true};
  }
  function normalize(value){
    if(value===undefined)return {version:1,revision:0,columns:2,rangeMode:'cards',from:'',to:'',cards:[]};
    if(!value||value.version!==1||!Number.isSafeInteger(value.revision)||value.revision<0||![1,2,3].includes(value.columns)||!Array.isArray(value.cards)||value.cards.length>24)throw new Error('Dashboard备份无效，最多24张图表。');
    if(!['cards','today','month','fixed'].includes(value.rangeMode))throw new Error('看板时间设置无效。');
    const from=string(value.from??'',23,'开始时间'),to=string(value.to??'',23,'结束时间'),a=M.time(from),b=M.time(to);if(a!==null&&b!==null&&a>b)throw new Error('开始时间不能晚于结束时间。');
    const ids=new Set();return {version:1,revision:value.revision,columns:value.columns,rangeMode:value.rangeMode,from,to,cards:value.cards.map(item=>{
      if(!/^dash_[\w-]{1,80}$/.test(item?.id??'')||ids.has(item.id))throw new Error('看板卡片编号无效或重复。');ids.add(item.id);return {...card(item),id:item.id};})};
  }
  const identity=p=>JSON.stringify([p.unitId,p.group]);
  function catalog(state){
    const pairs=new Set(LiveData.provenance(state).map(identity)),units=state.settings.units.filter(u=>!u.archived),sources=DataAnalysis.sources(state).map(source=>({...source,unitId:source.id.startsWith('raw:')?source.id.slice(4):state.datasets[source.id]?.dataset.unitIds[0]??'',piGroups:source.groups.filter(group=>pairs.has(identity({unitId:state.datasets[source.id]?.dataset.unitIds[0],group})))}));
    return {units:units.map(u=>({id:u.id,name:u.name})),sources,recipes:DataAnalysis.normalize(state.analytics).charts};
  }
  function validate(state,item){
    const source=DataAnalysis.sources(state).find(s=>s.id===item.config.sourceId);if(!source)throw new Error('图表来源已停用或不可用，请重新选择。');
    const unitId=item.config.sourceId.startsWith('raw:')?item.config.sourceId.slice(4):state.datasets[item.config.sourceId]?.dataset.unitIds[0];
    if(item.unitId&&item.unitId!==unitId)throw new Error('图表来源与装置不一致。');
    const keys=[...item.config.keys,...item.config.type==='scatter'?[item.config.xKey]:[]];if(keys.some(key=>!source.columns.some(c=>c.key===key)))throw new Error('图表指标已隐藏或不存在，请重新选择。');
    if(!item.config.allGroups&&!source.groups.includes(item.config.group))throw new Error('图表分组已不可用，请重新选择。');
    if(item.kind==='live'&&!LiveData.provenance(state).some(p=>p.unitId===item.unitId&&p.group===item.config.group))throw new Error('请选择有PI同步来源的分组。');
    return {source,unitId};
  }
  function range(board,item){
    const mode=board.rangeMode==='cards'?item.rangeMode:board.rangeMode;
    if(mode==='today')return ViewDefaults.today();if(mode==='month')return {...ViewDefaults.analysis(),exact:false,exclusive:false};
    return board.rangeMode==='fixed'?{from:board.from,to:board.to,exact:false,exclusive:false}:{from:item.config.from,to:item.config.to,exact:item.exact,exclusive:item.exclusive};
  }
  function frame(state,board,item,budget){
    const {source,unitId}=validate(state,item),selected=range(board,item),from=M.time(selected.from),to=M.time(selected.to),end=to===null?Infinity:to+(selected.exclusive?0:selected.exact?1:60000);
    const original=source.id.startsWith('raw:')?DataAnalysis.series(state,source.id).points:state.datasets[source.id].points;
    const wanted=new Set([...item.config.keys,...item.config.type==='scatter'?[item.config.xKey]:[]]);
    const filtered=original.filter(p=>Object.keys(p.values).some(k=>wanted.has(k))&&p.unit===unitId&&(item.config.allGroups||p.group===item.config.group)&&(from===null||p.time>=from)&&p.time<end).sort((a,b)=>a.time-b.time);
    const rows=PointExclusions.apply(source.id,filtered),config={...item.config,...selected},columns=source.columns.filter(c=>config.keys.includes(c.key)||config.type==='scatter'&&c.key===config.xKey),name=state.settings.units.find(u=>u.id===unitId).name;
    const references=[{label:'规格下限',value:config.lsl,color:'#d36a5b'},{label:'规格上限',value:config.usl,color:'#d36a5b'}].filter(r=>M.finite(r.value));
    if(item.control&&config.type==='line'&&config.keys.length===1&&!config.normalized){const stats=M.capability(rows,config.keys[0]);references.push(...[{label:'均值',value:stats.mean,color:'#477be3'},{label:'I图上控制限',value:stats.upperControl,color:'#b08b48'},{label:'I图下控制限',value:stats.lowerControl,color:'#b08b48'}].filter(r=>M.finite(r.value)));}
    if(config.type==='line'&&config.keys.length===1&&!config.allGroups&&!config.normalized){const column=columns[0];return {kind:'series',series:{column,...LiveSeries.sample(rows,column.key)},sourceName:source.name,unitName:name,config,references,count:rows.length};}
    if(rows.length>5000||rows.length>budget.left)throw new Error('当前图表时段数据较多，请编辑卡片缩短范围，或把指标分别添加为折线卡片。统计图不会用抽样代替完整数据。');
    budget.left-=rows.length;
    return {kind:'figure',rows:rows.map(p=>({unit:p.unit,time:p.time,group:p.group,values:Object.fromEntries(Object.entries(p.values).filter(([key])=>wanted.has(key))),...(p.excludedValues?{excludedValues:Object.fromEntries(Object.entries(p.excludedValues).filter(([key])=>wanted.has(key)))}:{})})),columns,sourceName:source.name,unitName:name,config,references,count:rows.length};
  }
  async function request(req){
    const state=$r().state,analytics=DataAnalysis.normalize(state.analytics),board=normalize(analytics.dashboard),query=new URL(req.url).searchParams;
    if(req.method==='GET'){
      if(query.has('focus')){const stored=board.cards.find(c=>c.id===query.get('focus'));if(!stored)throw new Error('看板卡片已不存在。');const focused=card({...stored,rangeMode:'fixed',exact:query.get('exact')==='1',exclusive:false,config:{...stored.config,from:query.get('from')??'',to:query.get('to')??''}});try{return Response.json({frame:frame(state,{...board,rangeMode:'cards'},focused,{left:20000})});}catch(e){return Response.json({frame:{error:e.message}});}}
      const out={board};if(query.get('catalog')==='1')out.catalog=catalog(state);
      if(query.get('render')==='1'){const limit=Number(query.get('limit')??6);if(!Number.isInteger(limit)||limit<1||limit>24)throw new Error('看板展示数量无效。');const budget={left:20000};out.frames=Object.fromEntries(board.cards.slice(0,limit).map(item=>{try{return [item.id,frame(state,board,item,budget)];}catch(e){return [item.id,{error:e.message}];}}));}
      return Response.json(out);
    }
    if(req.method!=='POST')throw new Error('看板操作无效。');const body=await Ha(req);if(body.expectedRevision!==board.revision)throw new Error('Dashboard已在其他窗口更新，请刷新后重试。');
    let next={...board,cards:[...board.cards]};
    if(body.action==='add'){
      const item=card(body.card);item.unitId=validate(state,item).unitId;
      const signature=c=>JSON.stringify({...c,id:undefined});if(next.cards.some(c=>signature(c)===signature(item)))return Response.json({board,duplicate:true});
      next.cards.push({...item,id:'dash_'+crypto.randomUUID()});
    }else if(body.action==='settings'){
      next={...next,columns:body.columns,rangeMode:body.rangeMode,from:body.from??'',to:body.to??''};
    }else {
      const index=next.cards.findIndex(c=>c.id===body.id);if(index<0)throw new Error('看板卡片已不存在，请刷新。');
      if(body.action==='remove')next.cards.splice(index,1);
      else if(body.action==='move'){if(!Number.isInteger(body.index)||body.index<0||body.index>=next.cards.length)throw new Error('卡片位置无效。');next.cards.splice(body.index,0,next.cards.splice(index,1)[0]);}
      else if(body.action==='edit'){const item=card(body.card);item.unitId=validate(state,item).unitId;next.cards[index]={...item,id:body.id};}
      else if(body.action==='width')next.cards[index]={...next.cards[index],wide:body.wide===true};
      else throw new Error('看板操作无效。');
    }
    next=normalize({...next,revision:board.revision+1});qt().analytics={...analytics,dashboard:next};return Response.json({board:next});
  }
  async function api(params={},body){const response=await T0('/api/dashboard'+(body?'':'?'+new URLSearchParams(params)),{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined}),data=await response.json();if(!response.ok)throw new Error(data.error);return data;}
  function notify(){window.dispatchEvent(new CustomEvent(eventName,{detail:{scope:AccountAuth.storageKey()}}));}
  function Pin({kind='chart',config,unitId='',rangeMode,control=false}){
    const [busy,setBusy]=R.useState(false),[notice,setNotice]=R.useState('');
    async function pin(){setBusy(true);setNotice('');try{const scope=AccountAuth.storageKey(),{board}=await api();AccountAuth.assertWorkspace(scope);const result=await api({}, {action:'add',expectedRevision:board.revision,card:{kind,unitId,config,rangeMode:rangeMode??(config.from||config.to?'fixed':'month'),exact:config.exact,exclusive:config.exclusive,control}});AccountAuth.assertWorkspace(scope);setNotice(result.duplicate?'已在Dashboard中':'已加入Dashboard');notify();}catch(e){setNotice(e.message);}finally{setBusy(false);}}
    return h('span',{className:'dashboard-pin'},h('button',{className:'button small-button',disabled:busy,onClick:pin},busy?'正在加入…':'加入Dashboard'),notice&&h('span',{role:'status',className:'small'},notice));
  }
  function LegacyPin({url,title}){try{const q=new URL(url,'http://offline.local').searchParams,id=q.get('id'),key=q.get('column');if(!id?.startsWith('ds_')||!key||id==='demo')return null;return h(Pin,{config:{sourceId:id,keys:[key],title,type:'line',group:q.get('group')??'',allGroups:q.get('allGroups')==='1',from:(q.get('from')??'').replace(' ','T'),to:(q.get('to')??'').replace(' ','T'),palette:'coast'}});}catch{return null;}}
  return {pages,normalize,range,request,api,notify,eventName,Pin,LegacyPin,Page:props=>h(DashboardPage.Page,props)};
})();
