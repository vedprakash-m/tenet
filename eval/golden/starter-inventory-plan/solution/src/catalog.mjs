const error = code => Object.assign(new Error(code), {code});
export function createCatalog(rows){
 const ids=new Set();return rows.map(r=>{
  if(typeof r.sku!=='string'||!r.sku.trim()||ids.has(r.sku)||!Number.isSafeInteger(r.quantity)||r.quantity<0||!Number.isSafeInteger(r.reorderAt)||r.reorderAt<0)throw error('invalid');
  ids.add(r.sku);return {sku:r.sku,quantity:r.quantity,reorderAt:r.reorderAt};
 }).sort((a,b)=>a.sku.localeCompare(b.sku));
}
