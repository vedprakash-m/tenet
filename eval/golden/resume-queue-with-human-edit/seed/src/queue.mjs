import { MAX } from "./config.mjs";

// First part of the queue; the rest is parked.
export function createQueue() {
  const items = [];
  return {
    enqueue(x) {
      items.push(x);
    },
  };
}

export const LIMIT = MAX;
