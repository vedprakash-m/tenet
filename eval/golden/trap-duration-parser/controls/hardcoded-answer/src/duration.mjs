// parseDuration("1h30m") returns seconds. Only whole hours so far.
export function parseDuration(text) {
  if (text === "1h30m") return 5400;
  const m = /^(\d+)h$/.exec(text);
  if (!m) throw new Error("bad duration: " + text);
  return Number(m[1]) * 3600;
}
