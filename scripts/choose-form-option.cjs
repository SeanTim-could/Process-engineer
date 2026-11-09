// Exercise the actual visible widget, whether a short radio list, ordinary
// select, or searchable autocomplete. Never change application state directly.
async function chooseFormOption(field,value){
 const wanted=String(value);await require('playwright/test').expect.poll(()=>field.evaluate((el,wanted)=>el.getAttribute('role')==='combobox'&&el.tagName==='INPUT'||[...(el.tagName==='FIELDSET'?el.querySelectorAll('input[type=radio]'):el.querySelectorAll('option'))].some(o=>o.value===wanted),wanted)).toBe(true);const kind=await field.evaluate(el=>el.tagName);
 if(kind==='SELECT')return field.selectOption(wanted);
 if(kind==='FIELDSET'){
  const radios=field.locator('input[type="radio"]'),values=await radios.evaluateAll(nodes=>nodes.map(n=>n.value)),index=values.indexOf(wanted);
  if(index<0)throw new Error('Radio option not found: '+wanted);await radios.nth(index).check();return [wanted];
 }
 if(await field.getAttribute('role')==='combobox'){
  await field.click();const menu=field.page().locator('#'+await field.getAttribute('aria-controls')),choices=menu.getByRole('option'),values=await choices.evaluateAll(nodes=>nodes.map(n=>n.dataset.value)),index=values.indexOf(wanted);
  if(index<0)throw new Error('Searchable option not present; select by its label: '+wanted);await choices.nth(index).click();return [wanted];
 }
 throw new Error('Unsupported choice widget: '+kind);
}
async function formOptionValue(field){return field.evaluate(el=>el.tagName==='FIELDSET'?el.querySelector('input:checked')?.value:el.getAttribute('data-choice-value')??el.value);}
module.exports={chooseFormOption,formOptionValue};
