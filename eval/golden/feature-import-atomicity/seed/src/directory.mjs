export function createDirectory(initial=[]){return {list:()=>initial,importRows(){throw new Error("not built")}};}
