// Module names live with the indicator definition, so JSON, imports and offline
// workspaces carry them without a separate account-level registry.
var MetricModules=(()=>{
 const R=Se(),h=R.createElement,PREFIX='custom:',MAX=40,palette=['#336fd6','#078a9b','#9b6db7','#bd7d16','#c35d6e','#168b70'];
 const clean=value=>String(value??'').normalize('NFKC').trim().replace(/\s+/g,' '),custom=value=>typeof value==='string'&&value.startsWith(PREFIX);
 function valid(value){return Yl.some(m=>m.id===value)||custom(value)&&typeof value==='string'&&clean(value.slice(PREFIX.length)).length>0&&clean(value.slice(PREFIX.length)).length<=MAX&&value.slice(PREFIX.length).length<=MAX&&!/[\u0000-\u001f\u007f]/.test(value);}
 function label(value){return Yl.find(m=>m.id===value)?.label??(custom(value)?value.slice(PREFIX.length):String(value??''));}
 function fromName(value){const name=clean(value),builtin=Yl.find(m=>[m.id,m.label,Surface.en(m.label)].some(v=>v.toLowerCase()===name.toLowerCase()));return builtin?.id??PREFIX+String(value??'');}
 function normalize(value){if(!valid(value))throw new Error('所属模块须填写1至40字的名称。');return custom(value)?fromName(clean(label(value))):value;}
 function catalog(columns=[],workspace=false){
  const found=new Map(Yl.map(m=>[m.id,{...m}]));
  const all=workspace?[...Object.values($r().state.datasets??{}).filter(e=>e.dataset.status==='ready'&&e.dataset.role!=='archive').flatMap(e=>e.dataset.columns),...columns]:columns;
  for(const c of all)if(custom(c.module)&&valid(c.module)){const id=normalize(c.module);if(!found.has(id))found.set(id,{id,label:label(id)});}
  return [...found.values()];
 }
 function color(value){if(EN[value])return EN[value];let hash=0;for(const ch of String(value))hash=(hash*31+ch.codePointAt(0))>>>0;return palette[hash%palette.length];}
 function Label({value}){return h('span',{'data-no-localize':custom(value)||undefined},label(value));}
 function Field({column,columns,onChange}){
  const list='metric-modules-'+R.useId().replace(/:/g,''),options=catalog(columns,true),shown=custom(column.module)?label(column.module):Surface.t(label(column.module));
  return h('div',{className:'metric-module-field'},h('input',{'aria-label':column.header+'所属模块',list,value:shown,maxLength:MAX,autoComplete:'off',placeholder:'选择或输入模块名称',onChange:e=>onChange(fromName(e.target.value)),onBlur:()=>{if(valid(column.module))onChange(normalize(column.module));}}),h('datalist',{id:list},...options.map(m=>h('option',{key:m.id,value:custom(m.id)?m.label:Surface.t(m.label),'data-no-localize':true}))),h('small',null,'可输入自定义名称，同名归为一组'));
 }
 return {valid,normalize,label,catalog,color,Label,Field};
})();
