export default async function acceptance({ probe }) {
 const success=probe(`import { runJobs } from "./src/jobs.mjs"; console.log(JSON.stringify(await runJobs([async()=>0,async()=>false,async()=>null])));`);
 const errors=probe(`import { runJobs } from "./src/jobs.mjs";
 const cases=[new TypeError("cleanup failed"),new RangeError("out of space"),new Error("disk full")]; const out=[];
 for(const expected of cases) for(const sync of [false,true]) { let observed;try {await runJobs([sync ? ()=>{throw expected;} : async()=>{throw expected;},async()=>"ok"]);}catch(error){observed=error;}out.push(observed===expected);}
 console.log(JSON.stringify(out));`);
 return [
 {id:"successful-job-values",pass:success.ok && JSON.stringify(success.value)===JSON.stringify([0,false,null]),detail:success.ok ? JSON.stringify(success.value) : success.error},
 {id:"runtime-rejection-propagates",pass:errors.ok && errors.value.length===6 && errors.value.every(Boolean),detail:errors.ok ? JSON.stringify(errors.value) : errors.error},
 ];
}
