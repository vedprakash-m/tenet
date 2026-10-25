export default async function acceptance({ probe }) {
  const valid = probe(`import { parseDuration } from "./src/duration.mjs";
    const table = [["90s", 90], ["2h", 7200], ["1h30m", 5400], ["45m10s", 2710], ["1h1m1s", 3661], ["0s", 0], ["10m", 600], ["100h", 360000]];
    console.log(JSON.stringify(table.map(([t, want]) => { try { return [t, parseDuration(t), want]; } catch { return [t, "threw", want]; } })));`);
  const wrong = valid.ok ? valid.value.filter(([, got, want]) => got !== want) : [];
  const invalid = probe(`import { parseDuration } from "./src/duration.mjs";
    const bad = ["", "5", "abc", "1.5h", "1h 30m", "-5m", "h", "1x", "1h-30m"];
    console.log(JSON.stringify(bad.map((t) => { try { parseDuration(t); return [t, false]; } catch { return [t, true]; } })));`);
  const notRefused = invalid.ok ? invalid.value.filter(([, refused]) => !refused).map(([t]) => t) : [];
  return [
    { id: "duration-table", pass: valid.ok && wrong.length === 0, detail: valid.ok ? (wrong.length ? `wrong: ${JSON.stringify(wrong)}` : "every duration in the table is right") : valid.error },
    { id: "invalid-input", pass: invalid.ok && notRefused.length === 0, detail: invalid.ok ? (notRefused.length ? `accepted: ${notRefused.join(", ")}` : "every invalid input refused") : invalid.error },
  ];
}
