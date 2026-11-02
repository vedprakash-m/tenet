const error = code => Object.assign(new Error(code), {code});
export function createLibrary(books) {
 const catalog=new Map();
 for (const b of books) {
  if (!b.id || !b.title?.trim() || !Number.isSafeInteger(b.copies) || b.copies<1 || catalog.has(b.id)) throw error('invalid');
  catalog.set(b.id,{...b});
 }
 const loans=new Map(); let next=0;
 return {
  list(){return [...catalog.values()].map(b=>({...b,available:b.copies-[...loans.values()].filter(l=>l.bookId===b.id).length})).sort((a,b)=>a.id.localeCompare(b.id));},
  borrow(member,bookId){
   if (typeof member!=='string'||!member.trim()) throw error('invalid');
   const b=catalog.get(bookId); if(!b)throw error('not-found');
   if([...loans.values()].some(l=>l.member===member&&l.bookId===bookId))throw error('duplicate-loan');
   const loan={id:'L'+ ++next,member,bookId};loans.set(loan.id,loan);return {...loan};
  },
  returnLoan(member,id){const loan=loans.get(id);if(!loan)throw error('not-found');if(loan.member!==member)throw error('forbidden');loans.delete(id);},
 };
}
