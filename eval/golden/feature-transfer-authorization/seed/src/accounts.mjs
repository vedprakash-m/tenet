export function createAccounts(users,initial){const a=new Map(initial.map(x=>[x.id,{...x}]));return {balance:id=>a.get(id).cents,transfer(){throw new Error("not built")}};}
