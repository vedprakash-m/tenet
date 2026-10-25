const AMOUNT = /^\d+(\.\d{1,2})?$/;

export function validateRows(records) {
  const valid = [], errors = [];
  for (const { line, cells } of records) {
    if (cells.length !== 2) { errors.push({ line, reason: "expected 2 columns" }); continue; }
    const [customer, amount] = cells.map((c) => c.trim());
    if (customer === "") errors.push({ line, reason: "customer is empty" });
    else if (!AMOUNT.test(amount)) errors.push({ line, reason: "amount must be a non-negative number with at most 2 decimals" });
    else {
      const [whole, frac = ""] = amount.split(".");
      valid.push({ line, customer, cents: Number(whole) * 100 + Number(frac.padEnd(2, "0")) });
    }
  }
  return { valid, errors };
}
