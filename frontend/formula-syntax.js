// Normalize punctuation outside [metric references]; never change a metric name.
var FormulaSyntax = (() => {
  function normalize(expression){
    let reference=false,result="";
    const punctuation={"（":"(","）":")","，":",","＋":"+","－":"-","×":"*","÷":"/"};
    for(let i=0;i<expression.length;i++){
      const char=expression[i];
      if(reference){result+=char;if(char==="]"){if(expression[i+1]==="]")result+=expression[++i];else reference=false;}}
      else if(char==="["){reference=true;result+=char;}
      else result+=punctuation[char]??char;
    }
    return result;
  }
  function Assistance({value,onChange,inputRef}){
    const R=Se(),h=R.createElement;let error="";
    if(value.trim())try{TE(value,()=>({}));}catch(e){error=e.message;}
    function wrap(){const input=inputRef.current,start=input?.selectionStart??value.length,end=input?.selectionEnd??start,next=value.slice(0,start)+"("+value.slice(start,end)+")"+value.slice(end);if(next.length>2048)return;onChange(next);requestAnimationFrame(()=>{input?.focus();input?.setSelectionRange(start+1,end+1);});}
    return h("div",{className:"formula-bracket-help"},h("button",{type:"button",className:"button small-button",onMouseDown:e=>e.preventDefault(),onClick:wrap},"插入括号 / 包住选中内容"),h("p",{className:"small muted"},"支持英文 ()、中文（）、多层括号及函数参数；先计算括号内，再乘除、加减。例如：([指标A] + [指标B]) / [指标C]。指标名称仍写在 [ ] 中；括号前的乘法请写 *。"),value.trim()&&h("p",{role:error?"status":undefined,className:error?"small analysis-notice":"small muted","data-formula-syntax":error?"invalid":"valid"},error||"公式语法正确（指标引用和单位请点击预览核对）。"));
  }
  return {normalize,Assistance};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=FormulaSyntax;
