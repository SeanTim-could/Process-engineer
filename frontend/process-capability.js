// One-process capability over the same selection used by the time-series charts.
var ProcessCapability = (() => {
  const R=Se(),h=R.createElement,M=AnalysisMath,C=CapabilityMath,P=AnalysisPlots;
  function Panel({rows,column,config,update,Field}){
    const prepared=R.useMemo(()=>{try{return {value:C.prepare(rows,column.key,config.capabilitySize??1)};}catch(e){return {error:e.message};}},[rows,column.key,config.capabilitySize]);
    let result=null,error=prepared.error;try{if(prepared.value)result=C.evaluate(prepared.value,config.lsl,config.usl);}catch(e){error=e.message;}
    const fields=[["有效样本","n"],["缺失 / 已排除读数","missing"],["均值","mean"],["标准差（整体）","sd"],["标准差（组内）","within"],["Cp","Cp"],["Cpk","Cpk"],["Pp","Pp"],["Ppk","Ppk"],["超规格（观测，%）","observedPercent"],["超规格（整体预测，PPM）","estimatedPPM"],["超规格（组内预测，PPM）","withinPPM"]];
    const normality=prepared.value?.normality;
    function exportStats(){const quote=v=>'"'+String(v??"").replace(/"/g,'""')+'"';const records=[["统计量","数值"],...fields.map(([label,key])=>[label,result[key]]),["规格下限 LSL",result.lsl],["规格上限 USL",result.usl],["子组大小",config.capabilitySize??1],["Anderson–Darling A²",normality.A2],["正态性检验 P",normality.p]];P.download("\ufeff"+records.map(r=>r.map(quote).join(",")).join("\r\n"),"过程能力分析.csv","text/csv;charset=utf-8");}
    return h("section",{className:"process-capability"},h("section",{className:"panel analysis-controls"},h("div",{className:"analysis-figure-head"},h("div",null,h("h3",null,"过程能力分析"),h("p",{className:"small muted"},"使用上方相同的数据来源、指标、采样分组、时间范围和规格限。")),result&&h("button",{className:"button",onClick:exportStats},"导出过程能力数据")),
      h(Field,{label:"过程能力子组大小",type:"number",min:1,max:100,step:1,value:config.capabilitySize??1,onChange:e=>update({capabilitySize:e.target.value===""?"":Number(e.target.value)})}),
      h("p",{className:"small muted"},"1 使用 I-MR 估计组内标准差；2–100 按同一采样分组的时间顺序划分子组，合并子组方差并作 c4 修正。请按实际取样方式选择；上方时序 I-MR 图始终按个体值绘制。"),
      error&&h("p",{className:"error-banner",role:"alert"},error),result&&h(R.Fragment,null,
        result.lsl===null&&result.usl===null&&h("p",{className:"analysis-notice"},"请在上方填写规格下限或上限，以计算能力指数和超规格比例。单边规格可计算 Cpk / Ppk，Cp / Pp 需要双边规格。"),
        h("div",{className:"table-wrap"},h("table",{className:"data-table capability-table process-capability-table"},h("thead",null,h("tr",null,h("th",null,"统计量"),h("th",null,"当前过程"))),h("tbody",null,...fields.map(([label,key])=>h("tr",{key,"data-process-stat":key},h("th",null,label),h("td",null,P.format(result[key]))))))),
        h("p",{className:"small muted","data-process-normality":"true"},normality.p===null?"正态性检验："+normality.reason:`Anderson–Darling 正态性检验：A²=${P.format(normality.A2)}，P=${normality.p<.0001?"< 0.0001":P.format(normality.p)}。`),
        (normality.p!==null&&normality.p<.05)&&h("p",{className:"analysis-notice"},"正态性检验未通过（P < 0.05），正态预测超规格比例和能力指数仅供参考，请同时查看实际观测超规格比例。"),
        h("p",{className:"small muted"},`组内估计采用 ${prepared.value.size===1?prepared.value.movingRangeCount+" 对相邻读数":prepared.value.groups.length+" 个有效子组"}；无效子组 ${prepared.value.invalidGroups} 个。少于2个有效值或零波动时，相应指数显示“—”。`),
        h("p",{className:"analysis-method small"},"能力指数应结合过程稳定性、独立性和分布形态解释。控制限反映过程波动，规格限反映要求；两者用途不同。图形跨过手动排除点连线，但不补值；移动极差估计仍不跨越被排除的读数。"))),
      result&&h(P.Figure,{config:{...config,keys:[column.key],type:"histogram",normalized:false,title:"过程能力分布 · "+column.label},rows,columns:[column],references:[{label:"LSL",value:result.lsl},{label:"USL",value:result.usl}],normalCurves:[{mean:result.mean,sd:result.sd,label:"整体正态拟合",color:"#c94343"},{mean:result.mean,sd:result.within,label:"组内正态拟合",color:"#727b8c",dashed:true}],subtitle:"直方图使用全部有效读数；实线为整体拟合，虚线为组内拟合。"}));
  }
  return {Panel};
})();
