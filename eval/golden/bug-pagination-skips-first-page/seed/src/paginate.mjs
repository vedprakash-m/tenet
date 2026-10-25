// paginate(items, page, size): page numbers start at 1. pageCount(total, size): how many pages hold `total` items.
export function paginate(items, page, size) {
  if (!Number.isInteger(size) || size < 1) throw new RangeError("size must be a positive integer");
  const start = page * size;
  return items.slice(start, start + size);
}

export function pageCount(total, size) {
  if (!Number.isInteger(size) || size < 1) throw new RangeError("size must be a positive integer");
  return Math.floor(total / size);
}
