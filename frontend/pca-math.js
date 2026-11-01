// Fixed-reference PCA. Population scaling, sample covariance, F/Jackson–Mudholkar limits.
var PCAMath = (() => {
  const C=typeof CapabilityMath!=="undefined"?CapabilityMath:require('./capability-math.js');
  const finite=v=>typeof v==='number'&&Number.isFinite(v),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const fail=message=>{throw new Error(message);};
  function eigen(matrix){
    const n=matrix.length,a=matrix.map(r=>r.slice()),v=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>+(i===j)));
    let converged=false;
    for(let iteration=0;iteration<100*n*n;iteration++){
      let p=0,q=1,largest=0,scale=0;
      for(let i=0;i<n;i++){scale=Math.max(scale,Math.abs(a[i][i]));for(let j=i+1;j<n;j++)if(Math.abs(a[i][j])>largest){largest=Math.abs(a[i][j]);p=i;q=j;}}
      if(largest<=Math.max(1,scale)*1e-14){converged=true;break;}
      const angle=.5*Math.atan2(2*a[p][q],a[q][q]-a[p][p]),c=Math.cos(angle),s=Math.sin(angle),pp=a[p][p],qq=a[q][q],pq=a[p][q];
      for(let i=0;i<n;i++)if(i!==p&&i!==q){const x=a[i][p],y=a[i][q];a[i][p]=a[p][i]=c*x-s*y;a[i][q]=a[q][i]=s*x+c*y;}
      a[p][p]=c*c*pp-2*s*c*pq+s*s*qq;a[q][q]=s*s*pp+2*s*c*pq+c*c*qq;a[p][q]=a[q][p]=0;
      for(let i=0;i<n;i++){const x=v[i][p],y=v[i][q];v[i][p]=c*x-s*y;v[i][q]=s*x+c*y;}
    }
    if(!converged)fail('PCA分解未收敛，请检查变量。');
    const order=Array.from({length:n},(_,i)=>i).sort((i,j)=>a[j][j]-a[i][i]);
    return {values:order.map(i=>Math.max(0,a[i][i])),components:order.map(i=>{const row=v.map(r=>r[i]);let largest=0;for(let j=1;j<n;j++)if(Math.abs(row[j])>Math.abs(row[largest]))largest=j;return row.map(x=>row[largest]<0?-x:x);})};
  }
  function fQuantile(p,d1,d2){let lo=0,hi=1;for(let i=0;i<100;i++){const mid=(lo+hi)/2;if(C.beta(mid,d1/2,d2/2)<p)lo=mid;else hi=mid;}const x=(lo+hi)/2;return d2*x/(d1*(1-x));}
  function limits(eigenvalues,n,N,confidence){
    const t2=n*(N*N-1)/(N*(N-n))*fQuantile(confidence,n,N-n),residual=eigenvalues.slice(n),t1=residual.reduce((s,v)=>s+v,0),t2m=residual.reduce((s,v)=>s+v*v,0),t3=residual.reduce((s,v)=>s+v*v*v,0);
    if(!residual.length||t1<=Math.max(1,eigenvalues[0])*1e-12)return {t2,spe:null};
    const h0=1-2*t1*t3/(3*t2m*t2m),base=C.inverseNormal(confidence)*Math.sqrt(2*t2m*h0*h0)/t1+1+t2m*h0*(h0-1)/(t1*t1);
    const spe=t1*Math.pow(base,1/h0);
    if(!finite(t2)||!finite(spe)||t2<=0||spe<=0)fail('无法计算可靠的PCA控制限，请调整基准数据。');
    return {t2,spe};
  }
  function train(values,{threshold=.95,confidence=.95}={}){
    if(!Array.isArray(values)||values.length<10)fail('基准至少需要10个完整样本。');
    const p=values[0]?.length,N=values.length;
    if(!Number.isInteger(p)||p<2||p>40)fail('请选择2至40个建模变量。');
    if(N<=p)fail('基准有效样本数必须大于变量数量。');
    if(!(threshold>=.5&&threshold<=.9999)||![.95,.99].includes(confidence))fail('PCA参数无效。');
    if(values.some(row=>!Array.isArray(row)||row.length!==p||!row.every(finite)))fail('PCA输入包含无效数值。');
    const center=Array(p).fill(0),ss=Array(p).fill(0);let count=0;
    for(const row of values){count++;for(let j=0;j<p;j++){const d=row[j]-center[j];center[j]+=d/count;ss[j]+=d*(row[j]-center[j]);}}
    const scale=ss.map(s=>Math.sqrt(s/N));if(scale.some(s=>!finite(s)||s<=0))fail('基准中有恒定或无效变量，请取消选择。');
    const mean=Array(p).fill(0),cov=Array.from({length:p},()=>Array(p).fill(0));count=0;
    for(const row of values){const z=row.map((x,j)=>(x-center[j])/scale[j]),d=z.map((x,j)=>x-mean[j]);count++;for(let j=0;j<p;j++)mean[j]+=d[j]/count;for(let j=0;j<p;j++)for(let k=j;k<p;k++)cov[j][k]+=d[j]*(z[k]-mean[k]);}
    for(let j=0;j<p;j++)for(let k=j;k<p;k++){cov[j][k]/=(N-1);cov[k][j]=cov[j][k];}
    const decomposition=eigen(cov),total=decomposition.values.reduce((s,v)=>s+v,0),ratios=decomposition.values.map(v=>v/total);let cumulative=0,n=0;
    for(const r of ratios){cumulative+=r;n++;if(cumulative>=threshold-1e-14)break;}
    if(decomposition.values.slice(0,n).some(v=>v<=total*1e-14))fail('变量之间存在退化关系，无法建立可靠模型。');
    return {version:1,algorithm:'standard-pca-v1',center,scale,mean,components:decomposition.components,eigenvalues:decomposition.values,ratios,n,sampleCount:N,threshold,confidence,limits:limits(decomposition.values,n,N,confidence)};
  }
  function validate(model){
    if(!model||model.version!==1||model.algorithm!=='standard-pca-v1')fail('PCA模型格式无效。');
    const p=model.center?.length,vector=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(finite);
    if(!Number.isInteger(p)||p<2||p>40||!vector(model.center,p)||!vector(model.scale,p)||model.scale.some(v=>v<=0)||!vector(model.mean,p)||!vector(model.eigenvalues,p)||!vector(model.ratios,p)||!Array.isArray(model.components)||model.components.length!==p||!model.components.every(r=>vector(r,p)))fail('PCA模型矩阵无效。');
    if(!Number.isInteger(model.n)||model.n<1||model.n>p||!Number.isSafeInteger(model.sampleCount)||model.sampleCount<=p||model.sampleCount<10||model.eigenvalues.some((v,i)=>v<0||i<model.n&&v<=0||i>0&&v>model.eigenvalues[i-1]+1e-10)||model.ratios.some(v=>v<0||v>1)||Math.abs(model.ratios.reduce((s,v)=>s+v,0)-1)>1e-8||!(model.threshold>=.5&&model.threshold<=.9999)||![.95,.99].includes(model.confidence)||!finite(model.limits?.t2)||model.limits.t2<=0||model.limits.spe!==null&&(!finite(model.limits.spe)||model.limits.spe<=0))fail('PCA模型参数无效。');
    // A restored file must describe a genuine orthonormal basis and matching limits.
    for(let i=0;i<p;i++)for(let j=i;j<p;j++)if(Math.abs(dot(model.components[i],model.components[j])-(i===j?1:0))>1e-7)fail('PCA模型方向矩阵无效。');
    const expected=limits(model.eigenvalues,model.n,model.sampleCount,model.confidence);
    if(Math.abs(model.limits.t2-expected.t2)>Math.max(1,expected.t2)*1e-8||(expected.spe===null?model.limits.spe!==null:!finite(model.limits.spe)||Math.abs(model.limits.spe-expected.spe)>Math.max(1,expected.spe)*1e-8))fail('PCA模型控制限不匹配。');
    return model;
  }
  function project(model,values){
    const z=values.map((v,j)=>(v-model.center[j])/model.scale[j]-model.mean[j]),scores=model.components.map(row=>dot(z,row));
    const t2=scores.slice(0,model.n).reduce((s,v,k)=>s+v*v/model.eigenvalues[k],0),spe=scores.slice(model.n).reduce((s,v)=>s+v*v,0),residual=z.map((x,j)=>x-model.components.slice(0,model.n).reduce((s,row,k)=>s+scores[k]*row[j],0));
    const t2Contribution=z.map((x,j)=>model.components.slice(0,model.n).reduce((s,row,k)=>s+scores[k]/model.eigenvalues[k]*x*row[j],0)),speContribution=residual.map(x=>spe>1e-24?100*x*x/spe:0);
    if(![t2,spe,...t2Contribution,...speContribution].every(finite))fail('分析数值超出计算范围，请检查数据。');
    return {t2,spe,scores,t2Flag:t2>model.limits.t2,speFlag:model.limits.spe!==null&&spe>model.limits.spe,t2Contribution,speContribution};
  }
  function analyze(model,values,{compact=false}={}){
    const totals=[model.center.map(()=>0),model.center.map(()=>0)],counts=[0,0],points=values.map(row=>{const p=project(model,row);for(const [i,flag,field]of [[0,'t2Flag','t2Contribution'],[1,'speFlag','speContribution']])if(p[flag]){counts[i]++;for(let j=0;j<model.center.length;j++)totals[i][j]+=Math.abs(p[field][j]);}return compact?{t2:p.t2,spe:p.spe,t2Flag:p.t2Flag,speFlag:p.speFlag}:p;});
    const pareto=i=>{const average=totals[i].map(v=>v/(counts[i]||1)),sum=average.reduce((s,v)=>s+v,0);let cumulative=0;return average.map((v,j)=>({index:j,value:v,percent:sum?100*v/sum:0})).sort((a,b)=>b.value-a.value).map(v=>{const previous=cumulative;cumulative+=v.percent;return {...v,cumulative,important:sum>0&&previous<80};});};
    return {points,t2Count:counts[0],speCount:counts[1],t2Pareto:pareto(0),spePareto:pareto(1)};
  }
  return {train,validate,project,analyze,eigen,fQuantile};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=PCAMath;
