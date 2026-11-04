// Normalize newly imported measurements; never change timestamps, missing data,
// signed changes, or application-generated formula results.
var ImportValues=(()=>{
 function quantity(column){const meta=xr(column.unit??'');return !column.formula&&column.kind!=='limit'&&(!!meta?.totalUnit||['mass','volume','normal-volume','energy'].includes(meta?.dimension)||['quantity','counter'].includes(column.kind));}
 function value(value,column){return typeof value==='number'&&value<0&&quantity(column)?0:value;}
 function record(row,settings){
  if(!row||typeof row!=='object'||Array.isArray(row))return row;
  const next={...row,extras:{...row.extras}},zero=v=>{const n=typeof v==='string'&&v.trim()?Number(v):v;return typeof n==='number'&&Number.isFinite(n)&&n<0?0:v;};
  for(const key of ['feed','product','gas','steam','electricity','water','sulfur','hours'])if(Object.hasOwn(next,key))next[key]=zero(next[key]);
  for(const column of settings.customMetrics??[])if(quantity({...column,kind:column.mode==='sum'?'quantity':'reading'})){const key=column.field;if(Object.hasOwn(next.extras,key))next.extras[key]=zero(next.extras[key]);}
  return next;
 }
 async function request(req){
  if(req.method!=='POST'||new URL(req.url).pathname!=='/api/records')return req;
  const body=await req.clone().json();if(!body||!Array.isArray(body.records))return req;
  return new Request(req,{body:JSON.stringify({...body,records:body.records.map(row=>record(row,$r().state.settings))})});
 }
 return {value,request};
})();
