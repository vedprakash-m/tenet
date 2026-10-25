import { MAX } from "./config.mjs";

export function createQueue() {
  const items = [];
  return {
    enqueue(x) {
      if (items.length >= MAX) throw new RangeError("queue full");
      items.push(x);
    },
    dequeue() {
      return items.shift();
    },
    size() {
      return items.length;
    },
  };
}
