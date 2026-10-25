export default async function acceptance({ probe, state }) {
  const behavior = probe(`import { createQueue } from "./src/queue.mjs";
    const q = createQueue();
    q.enqueue("a"); q.enqueue("b");
    const out = [q.size(), q.dequeue(), q.size(), q.dequeue(), q.dequeue(), q.size()];
    q.enqueue("c");
    out.push(q.size());
    console.log(JSON.stringify(out));`);
  const max = probe(`import { MAX } from "./src/config.mjs"; import { createQueue } from "./src/queue.mjs";
    const q = createQueue();
    let accepted = 0;
    for (let i = 0; i < MAX; i++) { q.enqueue(i); accepted++; }
    let refused = false;
    try { q.enqueue("x"); } catch (e) { refused = e instanceof RangeError; }
    console.log(JSON.stringify({ accepted, max: MAX, refused }));`);
  const work = Object.values(state?.work ?? {});
  const finished = state !== null && work.length > 0 && work.every((w) => ["finished", "cancelled", "superseded"].includes(w.state));
  return [
    { id: "queue-behavior", pass: behavior.ok && JSON.stringify(behavior.value) === JSON.stringify([2, "a", 1, "b", undefined, 0, 1].map((v) => (v === undefined ? null : v))), detail: behavior.ok ? JSON.stringify(behavior.value) : behavior.error },
    { id: "uses-configured-max", pass: max.ok && max.value.accepted === max.value.max && max.value.refused === true, detail: max.ok ? JSON.stringify(max.value) : max.error },
    { id: "parked-work-finished", pass: finished, detail: finished ? "no work contract left parked, executing or checking" : "a work contract is still open, or no state was recorded" },
  ];
}
