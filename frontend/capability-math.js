// Reference-report statistics. No external service or production dependency.
var CapabilityMath = (() => {
  const M=typeof AnalysisMath!=="undefined"?AnalysisMath:require('./analysis-math.js');
  const finite=M.finite,safe=M.safe,poly=(x,a)=>a.reduce((v,c)=>v*x+c,0);
  // Cephes rational approximations for erfc; keeping log tails avoids cancellation
  // in AD statistics and tiny normal-theory defect probabilities.
  const T=[9.604973739870516,90.02601972038427,2232.005345946843,7003.325141128051,55592.3013010395],U=[1,33.56171416475031,521.3579497801527,4594.323829709801,22629.00006138909,49267.3942608636];
  const P=[2.461969814735305e-10,.5641895648310688,7.463210564422699,48.63719709856814,196.5208329560771,526.4451949954773,934.5285271719576,1027.551886895157,557.5353353693993],Q=[1,13.2281951154745,86.70721408859897,354.9377788878199,975.7085017432055,1823.909166879097,2246.33760818711,1656.663091941613,557.5353408177277];
  const V=[.5641895835477551,1.275366707599781,5.019050422511805,6.160210979930536,7.409742699504489,2.978866653721002],W=[1,2.260528632201173,9.396035249380015,12.04895398080967,17.08144507475659,9.608968090632859,3.369076451000815];
  function logUpper(z){
    if(z<0)return Math.log1p(-Math.exp(logUpper(-z)));
    const x=z/Math.SQRT2;if(x<1){const erf=x*poly(x*x,T)/poly(x*x,U);return Math.log((1-erf)/2);}
    return -Math.LN2-x*x+Math.log(poly(x,x<8?P:V))-Math.log(poly(x,x<8?Q:W));
  }
  const upper=z=>z===Infinity?0:z===-Infinity?1:Math.exp(logUpper(z));
  const cdf=z=>z<0?upper(-z):1-upper(z);
  function inverseNormal(p){
    if(!(p>0&&p<1))return null;
    const a=[-39.6968302866538,220.946098424521,-275.928510446969,138.357751867269,-30.6647980661472,2.50662827745924],b=[-54.4760987982241,161.585836858041,-155.698979859887,66.8013118877197,-13.2806815528857],c=[-.00778489400243029,-.322396458041136,-2.40075827716184,-2.54973253934373,4.37466414146497,2.93816398269878],d=[.00778469570904146,.32246712907004,2.445134137143,3.75440866190742];
    let x;if(p<.02425){const q=Math.sqrt(-2*Math.log(p));x=poly(q,c)/poly(q,[...d,1]);}else if(p>1-.02425){const q=Math.sqrt(-2*Math.log1p(-p));x=-poly(q,c)/poly(q,[...d,1]);}else{const q=p-.5,r=q*q;x=q*poly(r,a)/poly(r,[...b,1]);}
    const density=Math.exp(-x*x/2)/Math.sqrt(2*Math.PI);if(density>0)x-=(cdf(x)-p)/density;
    return safe(x);
  }
  function logGamma(z){
    const c=[.9999999999998099,676.5203681218851,-1259.1392167224028,771.3234287776531,-176.6150291621406,12.50734327868691,-.1385710952657201,9.984369578019572e-6,1.5056327351493116e-7];
    if(z<.5)return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-logGamma(1-z);
    z--;let x=c[0];for(let i=1;i<c.length;i++)x+=c[i]/(z+i);const t=z+7.5;return .5*Math.log(2*Math.PI)+(z+.5)*Math.log(t)-t+Math.log(x);
  }
  function betaCF(a,b,x){
    const tiny=1e-300,qab=a+b,qap=a+1,qam=a-1;let c=1,d=1-qab*x/qap;if(Math.abs(d)<tiny)d=tiny;d=1/d;let h=d;
    for(let m=1;m<=300;m++){const m2=2*m;let aa=m*(b-m)*x/((qam+m2)*(a+m2));d=1+aa*d;if(Math.abs(d)<tiny)d=tiny;c=1+aa/c;if(Math.abs(c)<tiny)c=tiny;d=1/d;h*=d*c;aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));d=1+aa*d;if(Math.abs(d)<tiny)d=tiny;c=1+aa/c;if(Math.abs(c)<tiny)c=tiny;d=1/d;const delta=d*c;h*=delta;if(Math.abs(delta-1)<3e-14)return h;}
    throw new Error("统计检验未收敛，请检查数据范围。");
  }
  function beta(x,a,b){if(x<=0)return 0;if(x>=1)return 1;const bt=Math.exp(logGamma(a+b)-logGamma(a)-logGamma(b)+a*Math.log(x)+b*Math.log1p(-x));return Math.max(0,Math.min(1,x<(a+1)/(a+b+2)?bt*betaCF(a,b,x)/a:1-bt*betaCF(b,a,1-x)/b));}
  const tTwoSided=(t,df)=>beta(df/(df+t*t),df/2,.5);
  function c4(n){if(n<=1)return null;const df=n-1;return n>5000?1-1/(4*df)+1/(32*df*df)+5/(128*df**3):Math.exp(.5*Math.log(2/df)+logGamma(n/2)-logGamma(df/2));}
  function normality(values){
    const sorted=values.filter(finite).sort((a,b)=>a-b),s=M.summarize(sorted);if(s.n<8)return {n:s.n,A2:null,adjusted:null,p:null,reason:"至少需要8个有效样本"};
    if(!(s.sd>0))return {n:s.n,A2:null,adjusted:null,p:null,reason:"无法估计非零标准差"};
    let total=0;for(let i=0;i<sorted.length;i++){const lo=(sorted[i]-s.mean)/s.sd,hi=(sorted[sorted.length-1-i]-s.mean)/s.sd;total+=(2*i+1)*(logUpper(-lo)+logUpper(hi));}
    const A2=Math.max(0,-s.n-total/s.n),adjusted=A2*(1+.75/s.n+2.25/(s.n*s.n));let p;
    if(adjusted<.2)p=1-Math.exp(-13.436+101.14*adjusted-223.73*adjusted**2);
    else if(adjusted<.34)p=1-Math.exp(-8.318+42.796*adjusted-59.938*adjusted**2);
    else if(adjusted<.6)p=Math.exp(.9177-4.279*adjusted-1.38*adjusted**2);
    else p=adjusted>13?0:Math.exp(1.2937-5.709*adjusted+.0186*adjusted**2);
    return {n:s.n,A2:safe(A2),adjusted:safe(adjusted),p:finite(p)?Math.max(0,Math.min(1,p)):null,reason:"",ties:s.n-new Set(sorted).size};
  }
  function prepare(rows,key,size=10){
    if(!Number.isInteger(size)||size<1||size>100)throw new Error("子组大小须为1至100的整数；1表示个体值 I-MR。");
    const samples=rows.filter(r=>Object.hasOwn(r.values,key)).sort((a,b)=>a.time-b.time),values=samples.map(r=>r.values[key]),stats=M.summarize(values),byGroup=new Map();
    if(stats.n&&stats.mean===null||stats.n>1&&stats.sd===null)throw new Error("数值范围过大，无法可靠估计波动，请先缩小数值量级。");
    for(const row of samples){const group=row.group??"";if(!byGroup.has(group))byGroup.set(group,[]);byGroup.get(group).push(row);}
    let groups=[],invalidGroups=0,unassigned=0,df=0,ss=0;
    if(size>1)for(const [label,data] of byGroup)for(let i=0;i<data.length;i+=size){const block=data.slice(i,i+size),v=block.map(r=>r.values[key]);
      if(v.some(x=>!finite(x))||v.length<2){invalidGroups++;unassigned+=v.filter(finite).length;continue;}
      const s=M.summarize(v);groups.push({index:groups.length+1,group:label,time:block.at(-1).time,n:s.n,mean:s.mean,sd:s.sd});df+=s.n-1;ss+=(s.n-1)*s.sd*s.sd;
    }
    const ranges=M.movingRanges(samples,key),mr=M.summarize(ranges.map(r=>r.values.range));
    const within=size===1?(mr.n?mr.mean/1.128:null):df>0?Math.sqrt(ss/df)/c4(df+1):null;
    const controlMean=size===1?stats.mean:groups.length?groups.reduce((sum,g)=>sum+g.mean*g.n,0)/groups.reduce((n,g)=>n+g.n,0):null;
    const xChart=size===1?samples.map((r,i)=>({index:i+1,group:r.group,time:r.time,value:r.values[key],excluded:M.excluded(r,key),center:stats.mean,lower:within>0?stats.mean-3*within:null,upper:within>0?stats.mean+3*within:null})):groups.map(g=>({...g,value:g.mean,center:controlMean,lower:within!==null?controlMean-3*within/Math.sqrt(g.n):null,upper:within!==null?controlMean+3*within/Math.sqrt(g.n):null}));
    const sChart=size===1?ranges.map((r,i)=>({index:i+1,group:r.group,time:r.time,value:r.values.range,center:mr.mean,lower:0,upper:mr.mean===null?null:3.267*mr.mean})):groups.map(g=>{const center=within===null?null:within*c4(g.n),spread=within===null?null:within*Math.sqrt(Math.max(0,1-c4(g.n)**2));return {...g,value:g.sd,center,lower:spread===null?null:Math.max(0,center-3*spread),upper:spread===null?null:center+3*spread};});
    const flag=arr=>arr.map(p=>({...p,signal:finite(p.value)&&finite(p.lower)&&finite(p.upper)&&(p.value<p.lower||p.value>p.upper)}));
    return {values:values.filter(finite),stats,within:safe(within),size,groups,invalidGroups,unassigned,df,mrbar:mr.mean,movingRangeCount:mr.n,xChart:flag(xChart),sChart:flag(sChart),normality:normality(values)};
  }
  function evaluate(prepared,low=null,high=null){
    const {lsl,usl}=M.limits(low,high),s=prepared.stats,spec=lsl!==null||usl!==null;
    const estimate=sigma=>{
      if(!spec||s.n<2||!(sigma>0))return {span:null,index:null,probability:null,percent:null,ppm:null,z:null};
      const probability=Math.min(1,(lsl!==null?upper((s.mean-lsl)/sigma):0)+(usl!==null?upper((usl-s.mean)/sigma):0));
      return {span:lsl!==null&&usl!==null?safe((usl-lsl)/(6*sigma)):null,index:safe(Math.min(lsl!==null?(s.mean-lsl)/(3*sigma):Infinity,usl!==null?(usl-s.mean)/(3*sigma):Infinity)),probability,percent:probability*100,ppm:probability*1e6,z:probability>0&&probability<1?-inverseNormal(probability):null};
    };
    const overall=estimate(s.sd),within=estimate(prepared.within),outside=spec?prepared.values.filter(v=>lsl!==null&&v<lsl||usl!==null&&v>usl).length:null,observed=outside!==null&&s.n?outside/s.n:null;
    return {...s,lsl,usl,within:prepared.within,subgroupSize:prepared.size,subgroups:prepared.size===1?s.n:prepared.groups.length,Cp:within.span,Cpk:within.index,Pp:overall.span,Ppk:overall.index,Zoverall:overall.z,Zwithin:within.z,overallPercent:overall.percent,withinPercent:within.percent,estimatedPPM:overall.ppm,withinPPM:within.ppm,outside,observedPercent:observed===null?null:observed*100,observedPPM:observed===null?null:observed*1e6,passRate:observed===null?null:100-observed*100,controlSignals:prepared.xChart.filter(p=>p.signal).length,sSignals:prepared.sChart.filter(p=>p.signal).length};
  }
  function compare(a,b){
    const x=a.stats,y=b.stats;let mean={p:null,statistic:null,df:null,method:"Welch 双侧 t 检验"},variance={p:null,statistic:null,df:null,method:"Levene 中位数检验（双侧）"};
    if(x.n>=2&&y.n>=2){const va=x.sd*x.sd/x.n,vb=y.sd*y.sd/y.n,se2=va+vb;
      if(se2>0&&finite(se2)){const statistic=(y.mean-x.mean)/Math.sqrt(se2),df=se2*se2/(va*va/(x.n-1)+vb*vb/(y.n-1));mean={...mean,p:tTwoSided(statistic,df),statistic,df};}
      const za=a.values.map(v=>Math.abs(v-x.median)),zb=b.values.map(v=>Math.abs(v-y.median)),sa=M.summarize(za),sb=M.summarize(zb),grand=(sa.mean*x.n+sb.mean*y.n)/(x.n+y.n),between=x.n*(sa.mean-grand)**2+y.n*(sb.mean-grand)**2,inside=(x.n-1)*sa.sd**2+(y.n-1)*sb.sd**2,df=x.n+y.n-2;
      if(inside>0&&finite(inside)){const statistic=between/(inside/df);variance={...variance,p:beta(df/(df+statistic),df/2,.5),statistic,df};}
    }
    return {mean,variance};
  }
  function splitSequence(rows,key,cut){
    const ordered=rows.filter(r=>Object.hasOwn(r.values,key)).sort((a,b)=>a.time-b.time),state=[0,1].map(()=>({n:0,mean:0,mrMean:0,rangeCount:0,previous:new Map()})),points=[],ranges=[];
    for(const row of ordered){const phase=row.time<cut?0:1,s=state[phase],value=row.values[key],previous=s.previous.get(row.group);let range=null;
      if(finite(value)){s.n++;s.mean+=(value-s.mean)/s.n;if(previous&&finite(previous.values[key])){range=Math.abs(value-previous.values[key]);s.rangeCount++;s.mrMean+=(range-s.mrMean)/s.rangeCount;}}
      s.previous.set(row.group,row);points.push({...row,phase,value:finite(value)?value:null,excluded:M.excluded(row,key)});ranges.push({...row,phase,value:range,excluded:M.excluded(row,key)||finite(value)&&previous&&M.excluded(previous,key)});
    }
    const stats=state.map(s=>{const within=s.rangeCount?s.mrMean/1.128:null;return {n:s.n,mean:s.n?s.mean:null,mrMean:s.rangeCount?s.mrMean:null,rangeCount:s.rangeCount,within,lower:s.n&&within>0?s.mean-3*within:null,upper:s.n&&within>0?s.mean+3*within:null,mrUpper:s.rangeCount?s.mrMean*3.267:null};});
    return {points,ranges,stats};
  }
  return {logUpper,upper,cdf,inverseNormal,logGamma,beta,c4,normality,prepare,evaluate,compare,splitSequence};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=CapabilityMath;
