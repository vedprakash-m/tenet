const error = code => Object.assign(new Error(code), {code});
export function createDirectory(initial=[]){
 const rows=initial.map(x=>({...x}));
 return {
  list(){return rows.map(x=>({...x})).sort((a,b)=>a.email.localeCompare(b.email));},
  importRows(batch){
   if(!Array.isArray(batch))throw error('invalid');
   const seen=new Set(rows.map(x=>x.email));const pending=[];
   for(const item of batch){
    if(typeof item?.name!=='string'||!item.name.trim()||typeof item.email!=='string')throw error('invalid');
    const email=item.email.trim().toLowerCase();if(!/^[^@\s]+@[^@\s]+$/.test(email))throw error('invalid');
    if(seen.has(email))throw error('conflict');seen.add(email);pending.push({name:item.name.trim(),email});rows.push({name:item.name.trim(),email});
   }
   return pending.length;
  }
 };
}
