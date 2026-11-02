const error = code => Object.assign(new Error(code), {code});
export function applyMovements(catalog,movements){
 const next=catalog.map(r=>({...r}));
 for(const m of movements){const row=next.find(r=>r.sku===m.sku);if(!row)throw error('not-found');
  if(!Number.isSafeInteger(m.delta)||!Number.isSafeInteger(row.quantity+m.delta)||row.quantity+m.delta<0)throw error('invalid');row.quantity+=m.delta;
 }return next;
}
