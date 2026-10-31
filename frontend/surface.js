// Local bilingual display and presentation. Never rewrites user data or labels.
var Surface=(()=>{
 const R=Se(),h=R.createElement,logo=/*COMPANY_LOGO*/'',lex=/*ENGLISH_UI*/{},han=/[\u3400-\u9fff]/,terms=Object.keys(lex).sort((a,b)=>b.length-a.length),englishCache=new Map();let page='overview';
 function en(value){const s=String(value??'').trim();if(!han.test(s))return s;if(englishCache.has(s))return englishCache.get(s);let out=lex[s];if(!out){let left=s,result='';while(left){const token=terms.find(t=>left.startsWith(t));if(token){result+=' '+lex[token]+' ';left=left.slice(token.length);}else{result+=left[0];left=left.slice(1);}}out=han.test(result)?result.replace(/[\u3400-\u9fff]+/g,part=>TinyPinyin.convertToPinyin(part,' ',true)):result;out=out.replace(/\s+/g,' ').trim();}if(englishCache.size>3000)englishCache.clear();englishCache.set(s,out);return out;}
 const titles={overview:'运行总览',dashboard:'Dashboard',trends:'趋势分析',lims:'LIMS检验',comparison:'多指标对比',analysis:'关系分析',timeseries:'时序分析',capability:'前后能力分析',plotting:'自由作图',charts:'自动图表',data:'数据中心','excel-sync':'Excel自动同步','live-data':'实时数据',documents:'文档检索',files:'文件索引',profile:'个人中心',settings:'指标设置'};
 function pageTitle(id){return titles[id]??'工作台';}
 function chartTitle(config={},columns=[],fallback=''){
  let state;try{state=$r().state;}catch{return fallback;}
  const source=state.datasets?.[config.sourceId],unitId=config.unitId??(config.sourceId?.startsWith('raw:')?config.sourceId.slice(4):source?.dataset.unitIds[0]),name=state.settings?.units.find(u=>u.id===unitId)?.name,used=config.keys?.length?columns.filter(c=>config.keys.includes(c.key)):columns,labels=used.map(c=>c.label).filter(Boolean),metric=labels.join(' / ')||fallback||config.title||'数据图表';return name?name+' · '+metric:metric;
 }
 function comparisonTitle(lines){let state;try{state=$r().state;}catch{return '多指标对比';}return [...new Set(lines.map(l=>{const id=l.datasetId??l.id;return chartTitle({sourceId:id,unitId:l.unitId,keys:[l.key]},state.datasets?.[id]?.dataset.columns??[]);} ))].join(' + ')||'多指标对比';}
 function Logo(){return h('img',{className:'company-logo',src:logo,alt:'ADISSEO · A Sinochem Company',width:210,height:74,decoding:'async'});}
 function svgText(x,y,value,props={}){const text=String(value),size=Number(props.fontSize??12),translated=en(text),english=size>=18?8:6;return h('text',{x,y,...props},h('tspan',{x},text),han.test(text)&&h('tspan',{x,dy:size>=18?10:7,fontSize:english,fontWeight:400,opacity:.75},translated));}
 function exportSvg(source,title){
  const doc=new DOMParser().parseFromString(source,'image/svg+xml'),svg=doc.documentElement;if(svg.tagName!=='svg')return source;
  const box=(svg.getAttribute('viewBox')??'0 0 '+(svg.getAttribute('width')??900)+' '+(svg.getAttribute('height')??360)).split(/[ ,]+/).map(Number),W=box[2],H=box[3];
  for(const text of svg.querySelectorAll('text')){const y=Number(text.getAttribute('y')),label=text.textContent;if(han.test(label)&&y<45&&!text.closest('[transform]')||/各曲线保留|空白不补零|缺失值不补|统计使用全部|已跨过缺失|个有效点|均值使用全部有效/.test(label)){text.remove();continue;}if(y>H*.78&&/有效|缺失|覆盖|基于|绘制|抽样|积分/.test(label)){const at=label.search(/有效|缺失|覆盖|基于|绘制|抽样|积分/),prefix=label.slice(0,at).replace(/[·；;，,\s]+$/,'');if(at>0&&/·/.test(prefix))text.textContent=prefix;else text.remove();}}
  for(const text of svg.querySelectorAll('text')){if(!han.test(text.textContent))continue;const english=doc.createElementNS(svg.namespaceURI,'tspan');english.setAttribute('x',text.getAttribute('x')??'0');english.setAttribute('dy','7');english.setAttribute('font-size','6');english.setAttribute('opacity','.75');english.textContent=en(text.textContent);text.appendChild(english);}
  const group=doc.createElementNS(svg.namespaceURI,'g');group.setAttribute('transform','translate(0,30)');while(svg.firstChild)group.appendChild(svg.firstChild);svg.appendChild(group);svg.setAttribute('height',String(H+34));svg.setAttribute('viewBox',`0 0 ${W} ${H+34}`);
  const background=doc.createElementNS(svg.namespaceURI,'rect');background.setAttribute('width',String(W));background.setAttribute('height',String(H+34));background.setAttribute('fill','white');svg.insertBefore(background,group);
  for(const [label,y,size]of [[title,22,16],[en(title),37,10]]){const text=doc.createElementNS(svg.namespaceURI,'text');text.setAttribute('x','24');text.setAttribute('y',String(y));text.setAttribute('font-size',String(size));text.setAttribute('fill','#243b31');text.textContent=label;svg.appendChild(text);}return new XMLSerializer().serializeToString(svg);
 }
 function scan(root){
  const nodes=root.nodeType===1?[root,...root.querySelectorAll('h1,h2,h3,h4,button,a,label,span,small,b,strong,p,th,td,legend,summary,option,input,textarea')]:[];
  for(const el of nodes){if(el.closest('svg,canvas,pre,code,script,style,[data-no-translate]'))continue;
   el.removeAttribute('data-ui-note');
   const text=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.nodeValue).join('').trim();
   const keepHelp=['documents','excel-sync'].includes(page),isMessage=el.matches('[role="alert"],[role="status"],.error-banner,.analysis-empty,.empty-panel,.analysis-notice,.latest-reading,[data-process-normality]');
   if(!keepHelp&&!isMessage&&(el.matches('.page-description,.data-guide,.analysis-method,.analysis-mobile-hint,.chart-foot,.auto-chart-note,.shared-file-caption,.shared-source-caption,.calendar-hint')||el.tagName==='P'&&text.length>25&&!el.closest('.capability-comparison')&&!el.querySelector('button,a,input'))){el.setAttribute('data-ui-note','true');continue;}
   if(el.matches('button,a')&&/月报/.test(text)){el.setAttribute('data-ui-note','true');continue;}
   if(han.test(text)&&!el.matches('option,input,textarea')){const translated=en(text);if(translated&&translated!==text){el.dataset.en=translated;el.setAttribute('aria-description',translated);
     for(const target of [el,el.closest('button,a,h1,h2,h3,h4,summary')].filter(Boolean)){if(target.matches('button,a,h1,h2,h3,h4,summary')&&(!target.hasAttribute('aria-label')||target.dataset.autoAria)){const walker=document.createTreeWalker(target,NodeFilter.SHOW_TEXT);let n,label='';while(n=walker.nextNode())if(!n.parentElement.closest('svg,[aria-hidden="true"]'))label+=n.nodeValue;target.setAttribute('aria-label',label.trim());target.dataset.autoAria='true';}}}}
   else if(el.hasAttribute('data-en')){el.removeAttribute('data-en');el.removeAttribute('aria-description');}
   if(el.matches('option')&&han.test(el.textContent)){el.label=el.textContent+' / '+en(el.textContent);el.setAttribute('aria-label',el.textContent);}
   if(el.matches('input,textarea')&&el.placeholder&&han.test(el.placeholder)&&!el.dataset.enPlaceholder){el.dataset.enPlaceholder='1';el.placeholder+=' / '+en(el.placeholder);}
  }
 }
 function use(current){
  R.useLayoutEffect(()=>{page=current;document.documentElement.dataset.workbenchPage=current;scan(document.getElementById('root'));},[current]);
  R.useEffect(()=>{let frame=null,roots=new Set();const observer=new MutationObserver(records=>{for(const item of records){const node=item.target.nodeType===1?item.target:item.target.parentElement;if(node&&!node.closest('svg,script,style'))roots.add(node);}if(!frame&&roots.size)frame=requestAnimationFrame(()=>{frame=null;for(const node of roots)scan(node);roots.clear();});});observer.observe(document.getElementById('root'),{childList:true,subtree:true,characterData:true});return()=>{observer.disconnect();if(frame)cancelAnimationFrame(frame);};},[]);
 }
 return {en,Logo,chartTitle,comparisonTitle,pageTitle,use,svgText,exportSvg};
})();
