// CSV by plain joining: right for simple names, wrong for names with commas or quotes.
export function renderReport(rows, format = "text") {
  if (format === "csv") return ["name,qty", ...rows.map((r) => r.name + "," + r.qty)].join("\n");
  if (format !== "text") throw new Error("unknown format: " + format);
  return rows.map((r) => r.name + ": " + r.qty).join("\n");
}
