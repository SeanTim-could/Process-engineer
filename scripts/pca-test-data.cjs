// Explicitly import an independent copy for PCA fixtures; sharing a source ID
// with the production collection is deliberately unsupported.
async function importPcaData(api,entry,options={}){
 const unitId=options.unitId??entry.dataset.unitIds[0],columns=options.columns??entry.dataset.columns,points=(options.points??entry.points).filter(p=>p.unit===unitId).map(p=>({time:p.time,group:p.group,values:Object.fromEntries(columns.map(c=>[c.key,p.values[c.key]??null]))})),catalog=await api('/api/pca-data');
 const result=await api('/api/pca-data','PUT',{action:'import',expectedRevision:catalog.revision,dataset:{name:options.name??entry.dataset.name,filename:entry.dataset.filename,sheet:entry.dataset.sheet,unitId,columns:columns.map(c=>({key:c.key,label:c.label,unit:c.unit??''})),points}});return result.datasets.at(-1).id;
}
module.exports={importPcaData};
