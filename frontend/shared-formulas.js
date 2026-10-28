// A production recipe belongs to its metric, with independent results per group.
// Explicit remote references, other sampling points and LIMS clocks keep their binding.
var SharedFormulas = (() => {
  function home(formula,columns) {
    if(eg(formula).targetGroup!==undefined)return eg(formula).targetGroup;
    const lims=ag(columns),groups=[...new Set(Object.values(formula.bindings).filter(b=>!b.datasetId&&!lims.has(b.key)&&b.group!==undefined).map(b=>b.group))];
    return groups.length===1?groups[0]:'';
  }
  function reusable(column, columns, seen = new Set()) {
    if (!column?.formula || column.source === 'lims' || eg(column.formula).timeline === 'lims' || seen.has(column.key)) return false;
    const formula = column.formula, origin = home(formula,columns), next = new Set([...seen, column.key]), lims=ag(columns);
    let local = false;
    for (const binding of Object.values(formula.bindings)) {
      if (binding.datasetId) continue;
      const dependency = columns.find(c => c.key === binding.key);
      if (!dependency)return false;
      if (lims.has(binding.key))continue;
      if (binding.group !== undefined && binding.group !== origin) return false;
      if (dependency.formula && !reusable(dependency, columns, next)) return false;
      local = true;
    }
    return local;
  }
  function adapt(column, columns, group) {
    if (!reusable(column, columns) || home(column.formula,columns) === group) return column;
    const formula = structuredClone(column.formula);
    formula.matching = {...eg(formula), targetGroup:group};
    const lims=ag(columns);
    for (const binding of Object.values(formula.bindings)) if (!binding.datasetId && !lims.has(binding.key) && binding.group !== undefined) binding.group = group;
    return {...column, formula};
  }
  function calculate(columns, points) {
    const result = HoCore(columns, points), byGroup = new Map();
    for (const point of result) {if (!byGroup.has(point.group)) byGroup.set(point.group, []);byGroup.get(point.group).push(point);}
    for (const [group, rows] of byGroup) {
      const adapted = columns.map(c => adapt(c, columns, group)), keys = new Set(adapted.filter((c,i) => c !== columns[i]).map(c => c.key));
      if (!keys.size) continue;
      const computed = HoCore(adapted, points), lookup = new Map(computed.filter(p => p.group === group).map(p => [JSON.stringify([p.unit,p.time]),p]));
      for (const row of rows) {
        const other = lookup.get(JSON.stringify([row.unit,row.time]));if (!other) continue;
        for (const key of keys) {
          delete row.values[key];delete row.calculationIssues?.[key];delete row.calculationMatches?.[key];
          if (Object.hasOwn(other.values,key)) row.values[key]=other.values[key];
          for (const field of ['calculationIssues','calculationMatches']) if (other[field]?.[key]) (row[field]??={})[key]=other[field][key];
        }
      }
    }
    return result;
  }
  return {reusable,adapt,calculate};
})();
