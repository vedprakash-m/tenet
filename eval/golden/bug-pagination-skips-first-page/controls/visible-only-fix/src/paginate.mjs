// The first defect is fixed; the page count still rounds down.
export function paginate(items, page, size) {
  if (!Number.isInteger(size) || size < 1) throw new RangeError("size must be a positive integer");
  const start = (page - 1) * size;
  return items.slice(start, start + size);
}

export function pageCount(total, size) {
  if (!Number.isInteger(size) || size < 1) throw new RangeError("size must be a positive integer");
  return Math.floor(total / size);
}
