// One record per line; cells follow CSV quoting ("" is a quote, commas and newlines may sit inside quotes).
export function parseOrders(text) {
  const rows = [];
  let row = [], field = "", quoted = false, line = 1, start = 1;
  const endRow = () => {
    row.push(field);
    field = "";
    if (row.length > 1 || row[0] !== "") rows.push({ line: start, cells: row });
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else {
        field += c;
        if (c === "\n") line++;
      }
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      endRow();
      line++;
      start = line;
    } else field += c;
  }
  endRow();
  return rows.slice(1);
}
