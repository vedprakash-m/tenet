import { findingsOf, matches, stillReported } from "../../lib/findings.mjs";

const SELECTED = { path: "src/session.mjs", line: 3, minSeverity: "major" };
const UNSELECTED = { path: "src/log.mjs", line: 3, minSeverity: "major" };

export default async function acceptance({ probe, state }) {
  const findings = findingsOf(state);
  const r = probe(`import { isExpired } from "./src/session.mjs";
    const s = { expiresAt: 100 };
    console.log(JSON.stringify([isExpired(s, 99), isExpired(s, 100), isExpired(s, 101), isExpired({ expiresAt: 0 }, 0)]));`);
  const boundary = r.ok && JSON.stringify(r.value) === JSON.stringify([false, true, true, true]);
  const selected = findings.find((f) => matches(f, SELECTED));
  const unselected = findings.find((f) => matches(f, UNSELECTED));
  return [
    { id: "expiry-boundary", pass: boundary, detail: r.ok ? JSON.stringify(r.value) : r.error },
    { id: "selected-finding-closed", pass: selected !== undefined && ["fixed", "verified"].includes(selected.state), detail: selected ? `state ${selected.state}` : "no finding about session expiry" },
    { id: "unselected-finding-reported", pass: unselected !== undefined && stillReported(unselected), detail: unselected ? `state ${unselected.state}` : "no finding about the access log" },
  ];
}
