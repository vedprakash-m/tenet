export default async function acceptance({ probe }) {
  const checks = [];
  {
    const result = probe("import assert from \"node:assert/strict\"; import * as api from \"./src/booking.mjs\";\nconst existing=[{start:10,end:20,room:\"A\"}];\nfor (const [start,end] of [[5,25],[5,15],[12,18],[15,25],[10,20]]) assert.equal(api.canBook(existing,start,end,\"A\"),false);\nfor (const [start,end] of [[0,5],[25,30]]) assert.equal(api.canBook(existing,start,end,\"A\"),true);\nconsole.log(JSON.stringify(true));");
    const pass = result.ok && result.value === true;
    checks.push({ id: "overlap-directions", pass, detail: pass ? "crossing and containment conflicts are symmetric" : result.error || "independent assertions failed" });
  }
  {
    const result = probe("import assert from \"node:assert/strict\"; import * as api from \"./src/booking.mjs\";\nfor (const [start,end] of [[0,10],[20,25]]) assert.equal(api.canBook([{start:10,end:20,room:\"A\"}],start,end,\"A\"),true);\nconsole.log(JSON.stringify(true));");
    const pass = result.ok && result.value === true;
    checks.push({ id: "half-open-adjacency", pass, detail: pass ? "touching endpoints are not overlapping time" : result.error || "independent assertions failed" });
  }
  {
    const result = probe("import assert from \"node:assert/strict\"; import * as api from \"./src/booking.mjs\";\nconst bookings=Object.freeze([Object.freeze({start:10,end:20,room:\"A\"})]);\nassert.equal(api.canBook(bookings,12,18,\"B\"),true);\nassert.equal(api.canBook([],1,2,\"A\"),true);\nfor (const [start,end] of [[2,2],[3,1],[NaN,5],[1,Infinity]]) assert.throws(()=>api.canBook(bookings,start,end,\"A\"),RangeError);\nconsole.log(JSON.stringify(true));");
    const pass = result.ok && result.value === true;
    checks.push({ id: "room-and-preservation", pass, detail: pass ? "room separation, immutable inputs and invalid ranges are preserved" : result.error || "independent assertions failed" });
  }
  return checks;
}
