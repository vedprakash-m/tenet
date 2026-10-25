// renderReport(rows, format = "text"): rows are { name, qty }.
const cell = (v) => (/[",\r\n]/.test(String(v)) ? '"' + String(v).replaceAll('"', '""') + '"' : String(v));

export function renderReport(rows, format = "text") {
  if (format === "csv") return ["name,qty", ...rows.map((r) => cell(r.name) + "," + cell(r.qty))].join("\n");
  if (format !== "text") throw new Error("unknown format: " + format);
  return rows.map((r) => r.name + ": " + r.qty).join("\n");
}
