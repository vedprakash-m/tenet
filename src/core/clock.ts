export type Clock = () => Date;

export function clockNow(clock: Clock | Date | number | string | undefined): Date {
  if (typeof clock === "function") return clock();
  if (clock instanceof Date) return new Date(clock);
  if (clock !== undefined) return new Date(clock);
  return new Date();
}

export function utcSeconds(clock?: Clock | Date | number | string): string {
  const value = clockNow(clock);
  if (Number.isNaN(value.valueOf())) throw new TypeError("clock returned an invalid time");
  return value.toISOString().replace(/\.\d{3}Z$/, "Z");
}
