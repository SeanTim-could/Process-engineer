// Bulk selection is a local edit draft. The existing review and Save transaction own deletion.
var MetricRemoval=(()=>{
  const R=Se(),h=R.createElement;
  function Editor({columns,onChange,onDelete,onSelectionChange}){
    const root=R.useRef(null),frame=R.useRef(null);
    R.useEffect(()=>()=>{if(frame.current!==null)cancelAnimationFrame(frame.current);},[]);
    const [selected,setSelected]=R.useState([]),available=new Set(columns.map(c=>c.key)),keys=selected.filter(key=>available.has(key)),ids=new Set(keys);
    const signature=JSON.stringify(columns.map(c=>c.key));
    R.useEffect(()=>setSelected(old=>old.every(key=>available.has(key))?old:old.filter(key=>available.has(key))),[signature]);
    function change(next){onSelectionChange?.();setSelected(next);}
    function review(keys){
      onDelete(keys);if(frame.current!==null)cancelAnimationFrame(frame.current);
      frame.current=requestAnimationFrame(()=>{frame.current=null;const panel=root.current?.closest('[role="dialog"]')?.querySelector('.column-removal-review');panel?.scrollIntoView({block:'center'});panel?.querySelector('button')?.focus({preventScroll:true});});
    }
    const selection={ids,all:columns.length>0&&keys.length===columns.length,partial:keys.length>0&&keys.length<columns.length,empty:!columns.length,
      toggle:key=>change(ids.has(key)?keys.filter(k=>k!==key):[...keys,key]),toggleAll:()=>change(keys.length===columns.length?[]:columns.map(c=>c.key))};
    return h('section',{className:'metric-removal-editor',ref:root},h('div',{className:'metric-removal-toolbar'},h('span',{className:'metric-removal-count',role:'status'},Surface.t('已选择')+' '+keys.length+' '+Surface.t('个条目')),
      h('div',{className:'button-row'},h('button',{type:'button',className:'button small-button',disabled:!keys.length,onClick:()=>change([])},'清空选择'),h('button',{type:'button',className:'button primary small-button',disabled:!keys.length,onClick:()=>review(keys)},'移除所选条目'))),
      h(AN,{columns,onChange,onDelete:key=>review([key]),removalSelection:selection}));
  }
  function Header({selection}){
    const ref=R.useRef(null);R.useLayoutEffect(()=>{if(ref.current)ref.current.indeterminate=selection.partial;},[selection.partial]);
    return h('th',{className:'metric-removal-choice'},h('label',null,h('input',{ref,type:'checkbox','aria-label':'全选移除条目',checked:selection.all,disabled:selection.empty,onChange:selection.toggleAll}),h('span',null,'多选')));
  }
  function Check({selection,column}){
    return h('td',{className:'metric-removal-choice'},h('input',{type:'checkbox','aria-label':Surface.t('选择移除：')+column.label,'data-no-localize':true,'data-removal-key':column.key,checked:selection.ids.has(column.key),onChange:()=>selection.toggle(column.key)}));
  }
  return {Editor,Header,Check};
})();
