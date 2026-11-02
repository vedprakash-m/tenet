const error = code => Object.assign(new Error(code), {code});
export function createReservations(initial){
 const stock=new Map(Object.entries(initial));const requests=new Map();let next=0;
 return {
  available(sku){if(!stock.has(sku))throw error('not-found');return stock.get(sku);},
  reserve(customer,sku,quantity,key){
   if(typeof customer!=='string'||!customer.trim()||typeof key!=='string'||!key.trim()||!Number.isSafeInteger(quantity)||quantity<1)throw error('invalid');
   if(!stock.has(sku))throw error('not-found');
   const identity=key;
   const old=requests.get(identity);if(old){if(old.sku!==sku||old.quantity!==quantity)throw error('conflict');return {...old};}
   if(stock.get(sku)<quantity)throw error('unavailable');
   const record={id:'R'+ ++next,customer,sku,quantity};stock.set(sku,stock.get(sku)-quantity);requests.set(identity,record);return {...record};
  }
 };
}
