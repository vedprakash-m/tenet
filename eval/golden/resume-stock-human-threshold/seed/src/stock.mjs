export function stockStatus(quantity) {
  if (!Number.isInteger(quantity) || quantity < 0) throw new RangeError("quantity");
  return quantity === 0 ? "empty" : "ok";
}
