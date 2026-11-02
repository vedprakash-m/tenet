export function inWindow(value, { min, max, minInclusive = true, maxInclusive = true }) {
  if (![value, min, max].every(Number.isFinite) || min > max) throw new RangeError("invalid finite interval");
  return (minInclusive ? value >= min : value > min) && value <= max;
}
