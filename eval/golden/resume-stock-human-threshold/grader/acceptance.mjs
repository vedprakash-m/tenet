export default async function acceptance({ probe, state }) {
 const shape=probe(`import { stockStatus } from "./src/stock.mjs";
 const out=[stockStatus(0),stockStatus(1)]; for(const n of [-1,1.5,NaN]) {try {stockStatus(n);out.push(false);}catch(e){out.push(e instanceof RangeError);}} console.log(JSON.stringify(out));`);
 const threshold=probe(`import { stockStatus } from "./src/stock.mjs"; import { LOW_STOCK_THRESHOLD as t } from "./src/config.mjs";
 console.log(JSON.stringify([stockStatus(t-1),stockStatus(t),stockStatus(t+1)]));`);
 const w=state?.work?.["W-1"];
 return [
 {id:"stock-behavior",pass:shape.ok && JSON.stringify(shape.value)===JSON.stringify(["empty","low",true,true,true]),detail:shape.ok ? JSON.stringify(shape.value) : shape.error},
 {id:"configured-threshold",pass:threshold.ok && JSON.stringify(threshold.value)===JSON.stringify(["low","ok","ok"]),detail:threshold.ok ? JSON.stringify(threshold.value) : threshold.error},
 {id:"parked-work-finished",pass:w?.state==="finished",detail:w?.state??"no prior work"},
 ];
}
