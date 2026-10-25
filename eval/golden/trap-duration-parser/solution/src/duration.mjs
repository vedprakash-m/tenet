// parseDuration("1h30m") returns seconds; hours, minutes and seconds are each optional, in that order.
export function parseDuration(text) {
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(text);
  if (!m || text === "") throw new Error("bad duration: " + text);
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}
