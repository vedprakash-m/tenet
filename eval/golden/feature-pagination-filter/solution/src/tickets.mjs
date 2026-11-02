const error = code => Object.assign(new Error(code), {code});
export function listTickets(tickets,{status,after=0,limit=20}={}){
 if(status!==undefined&&!['open','closed'].includes(status)||!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(limit)||limit<1||limit>100)throw error('invalid');
 const sorted=tickets.filter(t=>t.id>after&&(status===undefined||t.status===status)).sort((a,b)=>a.id-b.id);
 const items=sorted.slice(0,limit).map(t=>({...t}));
 return {items,nextCursor:sorted.length>limit?items.at(-1).id:null};
}
