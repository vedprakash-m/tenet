export function canBook(bookings, start, end, room) {
  if (![start,end].every(Number.isFinite) || start >= end) throw new RangeError("invalid booking");
  return !bookings.some(b => b.room === room && start <= b.end && end >= b.start);
}
