// Shared form presentation. Values and the callers' change handlers remain the
// source of truth; search text is only committed after choosing a real option.
var FormControls=(()=>{
 const R=Se(),h=R.createElement,SEARCH_AT=20,TableContext=R.createContext(false);
 const text=value=>Array.isArray(value)?value.map(text).join(''):R.isValidElement(value)?text(value.props.children):typeof value==='string'||typeof value==='number'?String(value):'';
 const prompt=option=>option?.value===''&&/^请(?:先)?选择|^Select(?: |…)|^Choose /i.test(option.label);
 const caption=p=>p.floatingLabel??p['aria-label']??p.label??p.placeholder??'';
 const native=p=>{const {floatingLabel,fieldKind,toolbar,...rest}=p;return {...rest,'data-native-field':true};};
 function options(children,disabled=false,group=''){
  return R.Children.toArray(children).flatMap(el=>!R.isValidElement(el)?[]:el.type==='optgroup'?options(el.props.children,disabled||el.props.disabled,el.props.label):el.type==='option'?[{value:String(el.props.value??text(el.props.children)),label:text(el.props.children),disabled:disabled||el.props.disabled,group}]:[]);
 }
 function labelNode(id,label){return label?h('label',{htmlFor:id,className:'floating-caption'},label):null;}
 const FieldScope=R.forwardRef(function FieldScope({scopeTag,inTable,...props},ref){return h(TableContext.Provider,{value:inTable},h(scopeTag,{...props,ref,'data-native-field':true}));});
 const FieldLabel=R.forwardRef(function FieldLabel({labelTag,plainChildren,children,...props},ref){const table=R.useContext(TableContext);return h(labelTag==='label'?'div':labelTag,{...props,ref,'data-native-field':true},table?plainChildren:children);});
 const Field=R.forwardRef(function Field(p,ref){
  const table=R.useContext(TableContext),{fieldKind='input'}=p,uid=R.useId(),id=p.id??'field-'+uid.replace(/:/g,''),choices=fieldKind==='select'?options(p.children):[],[draft,setDraft]=R.useState(p.defaultValue??choices[0]?.value??''),value=p.value??draft,label=caption(p),props=native(p),selected=choices.find(o=>o.value===String(value)),filled=value!==''&&value!=null||!!selected?.label&&!prompt(selected);
  const onChange=event=>{setDraft(event.target.value);p.onChange?.(event);};
  // Column headers already identify spreadsheet cells. Retain their accessible
  // names and original editing behavior without adding visible row/column text.
  if(table)return h(fieldKind,{...props,id,ref,placeholder:p['data-grid-row']!==undefined?undefined:p.placeholder,'aria-label':p['aria-label']??(label||undefined)});
  return h('span',{className:'floating-field'+(label?' has-caption':''),'data-filled':String(filled)},h(fieldKind,{...props,id,ref,onChange,'aria-label':p['aria-label']??(label||undefined)}),labelNode(id,label));
 });
 const DateField=R.forwardRef(function DateField(p,ref){
  const table=R.useContext(TableContext);if(table)return h(ta,{...native(p),ref});
  const label=caption(p);return h('span',{className:'floating-field floating-date has-caption','data-filled':String(!!p.value)},h(ta,{...native(p),ref}),h('span',{className:'floating-caption','aria-hidden':true},label));
 });
 function SearchMenu({anchor,children,onClose,id}){
  const ref=R.useRef(null),[box,setBox]=R.useState(null);
  R.useLayoutEffect(()=>{const el=ref.current,a=anchor.current;if(!el||!a)return;function place(){const r=a.getBoundingClientRect(),width=Math.min(Math.max(r.width,240),innerWidth-16),height=Math.min(300,innerHeight-16),below=innerHeight-r.bottom-8,above=r.top-8,top=below>=Math.min(height,160)||below>=above?r.bottom+4:Math.max(8,r.top-Math.min(height,above)-4);setBox({left:Math.max(8,Math.min(r.left,innerWidth-width-8)),top,width,maxHeight:Math.max(80,Math.min(height,top>r.top?innerHeight-top-8:above))});}place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);const outside=e=>{if(!el.contains(e.target)&&!a.contains(e.target))onClose();};document.addEventListener('pointerdown',outside);return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);document.removeEventListener('pointerdown',outside);};},[anchor,onClose]);
  return i9.createPortal(h('div',{ref,id,role:'listbox',className:'field-search-menu',style:{...box,visibility:box?'visible':'hidden'},onPointerDown:e=>e.preventDefault()},children),document.body);
 }
 function highlight(label,query){if(!query)return label;const pos=label.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());return pos<0?label:h(R.Fragment,null,label.slice(0,pos),h('mark',null,label.slice(pos,pos+query.length)),label.slice(pos+query.length));}
 const Choice=R.forwardRef(function Choice(p,ref){
  const table=R.useContext(TableContext),uid=R.useId(),id=p.id??'choice-'+uid.replace(/:/g,''),label=p.toolbar||table?'':caption(p),allItems=options(p.children),items=allItems.filter(o=>!prompt(o)),[draft,setDraft]=R.useState(p.defaultValue??items[0]?.value??''),value=String(p.value??draft),selected=items.find(o=>o.value===value),[open,setOpen]=R.useState(false),[query,setQuery]=R.useState(''),[active,setActive]=R.useState(0),anchor=R.useRef(null),input=R.useRef(null),menu=id+'-options',filtered=items.filter(o=>(o.label+' '+o.group).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),visible=filtered.slice(0,80),close=R.useCallback(()=>{setOpen(false);setQuery('');},[]);
  const choose=(next,event)=>{if(p.disabled||next.disabled)return;setDraft(next.value);close();const target={value:next.value,name:p.name??'',id,type:'select-one'};p.onChange?.({target,currentTarget:target,type:'change',nativeEvent:event?.nativeEvent,preventDefault:()=>event?.preventDefault(),stopPropagation:()=>event?.stopPropagation()});};
  R.useEffect(()=>{if(!open)return;document.getElementById(menu+'-'+active)?.scrollIntoView({block:'nearest'});},[active,open,menu]);
  R.useEffect(()=>{close();},[value,close]);
  // Calendar navigation is ordered numeric input, so it retains its dedicated
  // native selectors. Multiple selection also retains its native semantics.
  const calendar=/^(日历|Calendar)|(?:小时|分钟| hour$| minute$)/i.test(p['aria-label']??'');
  if(calendar||p.toolbar&&items.length>=5&&items.length<SEARCH_AT)return h('select',{...native(p),ref});
  if(p.multiple||p.size>1||items.length>=5&&items.length<SEARCH_AT)return h(Field,{...p,ref,id,fieldKind:'select'});
  if(items.length<5)return h('fieldset',{id,className:'field-radio-group '+(p.className??''),disabled:p.disabled,'aria-describedby':p['aria-describedby'],'aria-invalid':p['aria-invalid'],onBlur:p.onBlur,onFocus:p.onFocus,'aria-label':p['aria-label']??label,style:p.style},label?h('legend',null,label):null,!items.length?h('small',null,allItems[0]?.label??'没有可选项'):null,items.map((o,i)=>h('label',{key:o.value,className:'field-radio-option'},h('input',{'data-native-field':true,type:'radio',ref:i===0?ref:undefined,name:p.name??id,value:o.value,checked:o.value===value,required:p.required,disabled:o.disabled,onChange:e=>choose(o,e)}),h('span',{'data-no-localize':['zh-CN','en'].includes(o.value)},o.label))));
  const forward=node=>{input.current=node;if(typeof ref==='function')ref(node);else if(ref)ref.current=node;};
  function key(e){if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true);const step=e.key==='ArrowDown'?1:-1;setActive(old=>{let next=old;for(let n=0;n<visible.length;n++){next=(next+step+visible.length)%visible.length;if(!visible[next].disabled)return next;}return old;});}else if(e.key==='Enter'&&open){e.preventDefault();if(visible[active])choose(visible[active],e);}else if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();close();}else if(e.key==='Tab')close();p.onKeyDown?.(e);}
  return h('span',{ref:anchor,className:'floating-field field-autocomplete'+(label?' has-caption':''),'data-filled':String(open||!!selected?.label)},p.name?h('input',{'data-native-field':true,type:'hidden',name:p.name,value,disabled:p.disabled}):null,h('input',{'data-native-field':true,ref:forward,id,role:'combobox',type:'text',value:open?query:selected?.label??'',disabled:p.disabled,required:p.required,autoComplete:'off','aria-label':p['aria-label']??label,'data-choice-value':value,'aria-expanded':open,'aria-controls':menu,'aria-autocomplete':'list','aria-activedescendant':open&&visible[active]?menu+'-'+active:undefined,onFocus:()=>{setOpen(true);setQuery('');setActive(0);},onClick:()=>setOpen(true),onChange:e=>{setQuery(e.target.value);setActive(0);setOpen(true);},onKeyDown:key,onBlur:e=>{p.onBlur?.(e);close();}}),labelNode(id,label),h('span',{className:'field-choice-arrow','aria-hidden':true},'⌄'),open?h(SearchMenu,{anchor,id:menu,onClose:close},visible.length?visible.map((o,i)=>h('div',{id:menu+'-'+i,key:o.value,role:'option','data-value':o.value,'aria-selected':o.value===value,'aria-disabled':!!o.disabled,className:'field-search-option'+(i===active?' active':''),onPointerMove:()=>setActive(i),onClick:e=>{choose(o,e);input.current?.focus();}},highlight(o.label,query.trim()),o.group?h('small',null,o.group):null)):h('div',{className:'field-search-empty',role:'status'},'没有匹配选项'),filtered.length>80?h('small',{className:'field-search-empty'},'输入关键词查找更多选项'):null):null);
 });
 const controls=new Set([Field,Choice,DateField]);
 function adapt(type,props){
  if(!props||props['data-native-field'])return [type,props];
  if(typeof type==='string'&&(type==='dialog'||['dialog','alertdialog'].includes(props.role)))return [FieldScope,{...props,scopeTag:type,inTable:false}];
  if(type==='table'||['div','section'].includes(type)&&['grid','table','treegrid'].includes(props.role))return [FieldScope,{...props,scopeTag:type,inTable:true}];
  if(type==='input'&&!['checkbox','radio','file','button','hidden','range','color','submit','reset'].includes(props.type))return [Field,{...props,fieldKind:'input'}];
  if(type==='textarea')return [Field,{...props,fieldKind:'textarea'}];
  if(type==='select')return [Choice,props];
  if(typeof ta!=='undefined'&&type===ta)return [DateField,props];
  if(type==='label'||type==='div'){
   const children=R.Children.toArray(props.children),index=children.findIndex(c=>R.isValidElement(c)&&controls.has(c.type));
   if(index<0||children.filter(c=>R.isValidElement(c)&&controls.has(c.type)).length!==1)return [type,props];
   // The page-level device switcher is a toolbar control, with a single inline
   // caption. Ordinary form fields continue to use their floating labels.
   if(type==='label'&&/(^|\s)select-wrap(\s|$)/.test(props.className??'')&&children[index].type===Choice)return ['div',{...props,className:props.className+' toolbar-device-select',children:[...children.slice(0,index),h('span',{className:'toolbar-device-caption'},'装置'),R.cloneElement(children[index],{toolbar:true}),...children.slice(index+1)]}];
   const before=children.slice(0,index),simple=before.every(c=>typeof c==='string'||typeof c==='number'||R.isValidElement(c)&&['span','small','b','strong'].includes(c.type));
   if(!simple||!before.length)return [type,props];const label=before.map(text).join('').trim();if(!label)return [type,props];
   return [FieldLabel,{...props,labelTag:type,plainChildren:[...before,R.cloneElement(children[index],{floatingLabel:label,'aria-label':children[index].props['aria-label']??label}),...children.slice(index+1)],children:[R.cloneElement(children[index],{floatingLabel:label}),...children.slice(index+1)]}];
  }
  return [type,props];
 }
 return {adapt,Field,Choice,DateField};
})();
