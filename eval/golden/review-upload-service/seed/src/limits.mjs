// clamp(n, lo, hi): n limited to the range lo..hi, both ends included.
export function clamp(n, lo, hi) {
  if (n < lo) return lo;
  if (n >= hi) return hi - 1;
  return n;
}
