// First draft: one record per line, cells split on every comma.
export function parseOrders(text) {
  return text
    .split("\n")
    .map((l, i) => ({ line: i + 1, cells: l.split(",") }))
    .slice(1)
    .filter((r) => r.cells.join("") !== "");
}
