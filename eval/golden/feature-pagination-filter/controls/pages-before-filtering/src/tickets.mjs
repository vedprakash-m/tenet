const error = code => Object.assign(new Error(code), {code});
export function listTickets(tickets,{status,after=0,limit=20}={}){
 if(status!==undefined&&!['open','closed'].includes(status)||!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(limit)||limit<1||limit>100)throw error('invalid');
 const all=tickets.filter(t=>t.id>after).sort((a,b)=>a.id-b.id);
 const page=all.slice(0,limit), matches=t=>status===undefined||t.status===status;
 const items=page.filter(matches).map(t=>({...t}));
 return {items,nextCursor:items.length&&all.slice(limit).some(matches)?items.at(-1).id:null};
}
