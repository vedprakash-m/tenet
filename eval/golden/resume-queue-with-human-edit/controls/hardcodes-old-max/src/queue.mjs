export function createQueue() {
  const items = [];
  return {
    enqueue(x) {
      if (items.length >= 5) throw new RangeError("queue full");
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
