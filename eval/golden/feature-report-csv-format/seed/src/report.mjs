// renderReport(rows, format = "text"): rows are { name, qty }.
export function renderReport(rows, format = "text") {
  if (format !== "text") throw new Error("unknown format: " + format);
  return rows.map((r) => r.name + ": " + r.qty).join("\n");
}
