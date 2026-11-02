import { LOW_STOCK_THRESHOLD } from "./config.mjs";
export function stockStatus(quantity) {
  if (!Number.isInteger(quantity) || quantity < 0) throw new RangeError("quantity");
  return quantity === 0 ? "empty" : quantity < LOW_STOCK_THRESHOLD ? "low" : "ok";
}
