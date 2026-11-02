import { findingsOf, matches, stillReported } from "../../lib/findings.mjs";
export default async function acceptance({ probe, state }) {
  const result = probe(`import { readCached } from "./src/cache.mjs";
    console.log(JSON.stringify([readCached({value:"v",expiresAt:10},9),readCached({value:"v",expiresAt:10},10),readCached({value:"v",expiresAt:10},11),readCached({value:0,expiresAt:1},0),readCached(null,0)]));`);
  const fs = findingsOf(state);
  const selected = fs.find(f => matches(f,{path:"src/cache.mjs",line:3,minSeverity:"major"},1));
  const remaining = fs.find(f => matches(f,{path:"src/key.mjs",line:2,minSeverity:"major"},1) && /collid|collision/i.test(f.claim + " " + f.evidence));
  return [
    {id:"cache-expiry",pass:result.ok && JSON.stringify(result.value) === JSON.stringify(["v",null,null,0,null]),detail:result.ok ? JSON.stringify(result.value) : result.error},
    {id:"selected-finding-closed",pass:!!selected && ["fixed","verified"].includes(selected.state),detail:selected ? selected.state : "no selected finding"},
    {id:"unselected-finding-reported",pass:!!remaining && stillReported(remaining),detail:remaining ? remaining.state : "key collision omitted"},
  ];
}
