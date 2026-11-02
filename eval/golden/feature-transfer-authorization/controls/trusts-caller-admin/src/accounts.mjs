const error = code => Object.assign(new Error(code), {code});
export function createAccounts(users,initial){
 const accounts=new Map(initial.map(a=>[a.id,{...a}]));
 return {
  balance(id){if(!accounts.has(id))throw error('not-found');return accounts.get(id).cents;},
  transfer(session,from,to,cents){
   const user=users.get(session?.userId);if(!user)throw error('unauthenticated');
   const a=accounts.get(from),b=accounts.get(to);if(!a||!b)throw error('not-found');
   if(a.owner!==session.userId&&(user.role!=='admin'&&session.role!=='admin'))throw error('forbidden');
   if(from===to||!Number.isSafeInteger(cents)||cents<=0)throw error('invalid');
   if(a.cents<cents)throw error('insufficient');
   if(!Number.isSafeInteger(b.cents+cents))throw error('invalid');
   a.cents-=cents;b.cents+=cents;return {from,to,cents};
  }
 };
}
