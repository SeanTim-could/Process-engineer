// Presentation and language preferences. Rendering translates labels, never model values.
var Surface=(()=>{
 const R=Se(),h=R.createElement,logo=/*COMPANY_LOGO*/'',lex=/*ENGLISH_UI*/{},han=/[\u3400-\u9fff]/,terms=Object.keys(lex).sort((a,b)=>b.length-a.length),englishCache=new Map(),untranslated=new Set();
 const starts=new Map();for(const term of terms){const list=starts.get(term[0])??[];list.push(term);starts.set(term[0],list);}
 let active='zh-CN',page='overview',scope='',names=new Set();const listeners=new Set();
 try{const last=localStorage.getItem('workbench-last-language');if(last==='en')active='en';}catch{}
 function en(value){const s=String(value??'').trim();if(!han.test(s))return s;if(englishCache.has(s))return englishCache.get(s);if(englishCache.size>3000){englishCache.clear();untranslated.clear();}let out=lex[s];if(!out){let left=s,result='';while(left){const token=(starts.get(left[0])??[]).find(t=>left.startsWith(t));if(token){result+=' '+lex[token]+' ';left=left.slice(token.length);}else{result+=left[0];left=left.slice(1);}}if(han.test(result))untranslated.add(s);out=han.test(result)?result.replace(/[\u3400-\u9fff]+/g,part=>TinyPinyin.convertToPinyin(part,' ',true)):result;out=out.replace(/\s+/g,' ').trim();}englishCache.set(s,out);return out;}
 const titles={overview:'运行总览',dashboard:'Dashboard',trends:'趋势分析',lims:'LIMS检验',comparison:'多指标对比',analysis:'关系分析',timeseries:'时序分析',capability:'前后能力分析',plotting:'自由作图',charts:'自动图表',data:'数据中心','excel-sync':'Excel自动同步','live-data':'实时数据',documents:'文档检索',files:'文件索引',profile:'个人中心',settings:'指标设置'};
 function pageTitle(id){return titles[id]??'工作台';}
 function chartTitle(config={},columns=[],fallback=''){
  let state;try{state=$r().state;}catch{return fallback;}
  const source=state.datasets?.[config.sourceId],unitId=config.unitId??(config.sourceId?.startsWith('raw:')?config.sourceId.slice(4):source?.dataset.unitIds[0]),name=state.settings?.units.find(u=>u.id===unitId)?.name,used=config.keys?.length?columns.filter(c=>config.keys.includes(c.key)):columns,labels=used.map(c=>c.label).filter(Boolean),metric=labels.join(' / ')||fallback||config.title||'数据图表';return name?name+' · '+metric:metric;
 }
 function comparisonTitle(lines){let state;try{state=$r().state;}catch{return '多指标对比';}return [...new Set(lines.map(l=>{const id=l.datasetId??l.id;return chartTitle({sourceId:id,unitId:l.unitId,keys:[l.key]},state.datasets?.[id]?.dataset.columns??[]);} ))].join(' + ')||'多指标对比';}

 function language(){return active;}
 function validLanguage(value){if(value!==undefined&&!['zh-CN','en'].includes(value))throw new Error('请选择有效的界面语言。');return value??'zh-CN';}
 function t(value){if(typeof value!=='string'||active!=='en'||!han.test(value)||names.has(value.trim())||[...value.trim()].length===1&&[...names].some(name=>name.startsWith(value.trim())))return value;const lead=value.match(/^\s*/)[0],tail=value.match(/\s*$/)[0];const translated=en(value.trim()).replace(/[，。；：（）]/g,char=>({'，':',','。':'.','；':';','：':':','（':'(','）':')'}[char])).replace(/\s+([,.;:])/g,'$1');return untranslated.has(value.trim())?value:lead+translated+tail;}
 function localize(type,props){
  if(active!=='en'||typeof type!=='string'||!props||props['data-no-localize'])return props;
  let out=props;const set=(key,value)=>{if(value!==props[key]){if(out===props)out={...props};out[key]=value;}},compact=/(^|\s)(avatar|profile-preview-avatar)(\s|$)/.test(props.className??''),choice=type==='option'&&['zh-CN','en'].includes(props.value);
  const children=value=>{if(typeof value==='string')return t(value);if(!Array.isArray(value))return value;const mapped=value.map(children);return mapped.some((item,i)=>item!==value[i])?mapped:value;};
  if(!compact&&!choice&&!['code','pre'].includes(type)&&!props.contentEditable&&Object.hasOwn(props,'children'))set('children',children(props.children));
  for(const key of ['aria-label','aria-valuetext','title','placeholder','alt'])if(typeof props[key]==='string')set(key,t(props[key]));
  if(type==='option'&&!choice&&typeof props.label==='string')set('label',t(props.label));
  if(type==='input'&&['button','submit','reset'].includes(props.type)&&typeof props.value==='string')set('value',t(props.value));
  return out;
 }
 function previewLanguage(value,persist=false){const next=validLanguage(value);document.documentElement.lang=next;document.documentElement.dataset.language=next;document.title=next==='en'?'Engineer Workbench':'工程师工作台';if(persist)try{localStorage.setItem('workbench-last-language',next);}catch{}if(active===next)return;active=next;for(const change of listeners)change();}
 function useRefresh(){const [revision,change]=R.useReducer(n=>n+1,0);R.useLayoutEffect(()=>{listeners.add(change);return()=>listeners.delete(change);},[]);return revision;}
 function LanguageSettings({value='zh-CN',onChange,disabled}){return h('section',{className:'language-settings'},h('label',{className:'form-label'},'界面语言',h('select',{'aria-label':'界面语言',value,disabled,onChange:e=>onChange(e.target.value)},h('option',{value:'zh-CN'},'简体中文'),h('option',{value:'en'},'English'))));}
 function weekday(value){return active==='en'?({一:'Mon',二:'Tue',三:'Wed',四:'Thu',五:'Fri',六:'Sat',日:'Sun'}[value]??value):value;}
 function monthLabel(value){return active==='en'?['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][value-1]:String(value)+'月';}
 function Logo(){return h('img',{className:'company-logo',src:logo,alt:'ADISSEO · A Sinochem Company',width:210,height:74,decoding:'async'});}
 function svgText(x,y,value,props={}){return h('text',{x,y,...props},t(String(value)));}
 function appendTitle(svg,title,x=24,y=23,size=16){const W=Number((svg.getAttribute('viewBox')??'0 0 900 400').split(/[ ,]+/)[2]),ns=svg.namespaceURI,text=svg.ownerDocument.createElementNS(ns,'text'),label=t(title),width=Math.max(200,W-x-24);text.setAttribute('x',x);text.setAttribute('y',y);text.setAttribute('font-size',size);text.setAttribute('text-anchor','start');text.setAttribute('fill','#243b31');let parts=[],part='',used=0;for(const char of label){const step=han.test(char)?size:size*.56;if(used+step>width&&part){parts.push(part);part='';used=0;}part+=char;used+=step;}if(part)parts.push(part);parts=parts.slice(0,2);parts.forEach((line,i)=>{const span=svg.ownerDocument.createElementNS(ns,'tspan');span.setAttribute('x',x);if(i)span.setAttribute('dy',size+3);span.textContent=line;text.appendChild(span);});svg.appendChild(text);return text;}
 function exportSvg(source,title){
  const doc=new DOMParser().parseFromString(source,'image/svg+xml'),svg=doc.documentElement;if(svg.tagName!=='svg')return source;
  const box=(svg.getAttribute('viewBox')??'0 0 '+(svg.getAttribute('width')??900)+' '+(svg.getAttribute('height')??360)).split(/[ ,]+/).map(Number),W=box[2],H=box[3];
  for(const text of svg.querySelectorAll('text')){const y=Number(text.getAttribute('y')),label=text.textContent;if(han.test(label)&&y<45&&!text.closest('[transform]')||/各曲线保留|空白不补零|缺失值不补|统计使用全部|已跨过缺失|个有效点|均值使用全部有效/.test(label)){text.remove();continue;}if(y>H*.78&&/有效|缺失|覆盖|基于|绘制|抽样|积分/.test(label)){const at=label.search(/有效|缺失|覆盖|基于|绘制|抽样|积分/),prefix=label.slice(0,at).replace(/[·；;，,\s]+$/,'');if(at>0&&/·/.test(prefix))text.textContent=prefix;else text.remove();}}
  if(active==='en')for(const text of svg.querySelectorAll('text,title'))for(const node of text.childNodes)if(node.nodeType===3)node.nodeValue=t(node.nodeValue);
  const group=doc.createElementNS(svg.namespaceURI,'g');group.setAttribute('transform','translate(0,40)');while(svg.firstChild)group.appendChild(svg.firstChild);svg.appendChild(group);svg.setAttribute('height',String(H+44));svg.setAttribute('viewBox',`0 0 ${W} ${H+44}`);
  const background=doc.createElementNS(svg.namespaceURI,'rect');background.setAttribute('width',W);background.setAttribute('height',H+44);background.setAttribute('fill','white');svg.insertBefore(background,group);appendTitle(svg,title);return new XMLSerializer().serializeToString(svg);
 }
 function localizeDocument(source){if(active!=='en')return source;const doc=new DOMParser().parseFromString(source,'text/html'),walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode())if(!node.parentElement.closest('script,style,code,pre'))node.nodeValue=t(node.nodeValue);doc.documentElement.lang='en';return '<!doctype html>'+doc.documentElement.outerHTML;}
 function mix(hex,base,amount){const rgb=s=>[1,3,5].map(at=>parseInt(s.slice(at,at+2),16));const a=rgb(hex),b=rgb(base);return '#'+a.map((v,i)=>Math.round(v*amount+b[i]*(1-amount)).toString(16).padStart(2,'0')).join('');}
 function syncTheme(){const theme=zx.find(v=>v.id===document.documentElement.dataset.theme)??zx[0],vars={'--surface-accent':theme.color,'--surface-ink':theme.ink,'--surface-nav':theme.sideStart,'--surface-nav-end':theme.sideEnd,'--surface-menu':mix(theme.color,'#142638',.73),'--surface-border':mix(theme.color,'#ffffff',.4),'--surface-rule':mix(theme.color,'#ffffff',.22),'--surface-muted':mix(theme.ink,'#ffffff',.76),'--surface-hover':mix(theme.color,'#ffffff',.1)};for(const [key,value]of Object.entries(vars))document.documentElement.style.setProperty(key,value);}
 function scan(root){
  if(!root||root.nodeType!==1)return;const nodes=[root,...root.querySelectorAll('h1,h2,h3,h4,button,a,label,span,small,b,strong,p,th,td,legend,summary,option,input,textarea')];
  for(const el of nodes){if(el.closest('svg,canvas,pre,code,script,style'))continue;el.removeAttribute('data-en');el.removeAttribute('data-ui-note');const text=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.nodeValue).join('').trim(),keepHelp=['documents','excel-sync'].includes(page),isMessage=el.matches('[role="alert"],[role="status"],.error-banner,.analysis-empty,.empty-panel,.analysis-notice,.latest-reading,[data-process-normality]');
   if(!keepHelp&&!isMessage&&(el.matches('.page-description,.data-guide,.analysis-method,.analysis-mobile-hint,.chart-foot,.auto-chart-note,.shared-file-caption,.shared-source-caption,.calendar-hint')||el.tagName==='P'&&text.length>25&&!el.closest('.capability-comparison')&&!el.querySelector('button,a,input'))){el.setAttribute('data-ui-note','true');continue;}
   if(el.matches('button,a')&&/月报|Monthly report/i.test(text)){el.setAttribute('data-ui-note','true');continue;}
   const target=el.closest('button,a,h1,h2,h3,h4,summary');if(target&&(!target.hasAttribute('aria-label')||target.dataset.autoAria)){const walker=document.createTreeWalker(target,NodeFilter.SHOW_TEXT);let n,label='';while(n=walker.nextNode())if(!n.parentElement.closest('svg,[aria-hidden="true"]'))label+=n.nodeValue;if(label.trim()){target.setAttribute('aria-label',label.trim());target.dataset.autoAria='true';}}
   if(el.matches('h1,h2,h3,h4,th')&&(!el.hasAttribute('title')||el.dataset.autoTitle)){el.title=el.textContent;el.dataset.autoTitle='true';}
  }
 }
 function use(current,profile={}){
  const revision=useRefresh(),key=AccountAuth.storageKey();names=new Set([profile.name,profile.employeeId,AccountAuth.decorate(profile).name].filter(Boolean));
  R.useLayoutEffect(()=>{scope=key;previewLanguage(profile.language??'zh-CN',true);},[key,profile.language]);
  R.useLayoutEffect(()=>{page=current;document.documentElement.dataset.workbenchPage=current;syncTheme();scan(document.getElementById('root'));},[current,revision]);
  R.useEffect(()=>{let frame=null,roots=new Set();const observer=new MutationObserver(records=>{for(const item of records){const node=item.target.nodeType===1?item.target:item.target.parentElement;if(node&&!node.closest('svg,script,style'))roots.add(node);}if(!frame&&roots.size)frame=requestAnimationFrame(()=>{frame=null;for(const node of roots)scan(node);roots.clear();});});observer.observe(document.getElementById('root'),{childList:true,subtree:true,characterData:true});const theme=new MutationObserver(syncTheme);theme.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});return()=>{observer.disconnect();theme.disconnect();if(frame)cancelAnimationFrame(frame);};},[]);
 }
 return {en,t,localize,weekday,monthLabel,language,validLanguage,previewLanguage,useRefresh,LanguageSettings,Logo,chartTitle,comparisonTitle,pageTitle,use,svgText,exportSvg,appendTitle,localizeDocument};
})();
