export type FakeClock = {
  now(): Date;
  set(value: Date | string | number): void;
  advance(milliseconds: number): void;
};

export function fakeClock(initial: Date | string | number = 0): FakeClock {
  let current = new Date(initial);
  return {
    now: () => new Date(current),
    set(value) {
      current = new Date(value);
    },
    advance(milliseconds) {
      current = new Date(current.getTime() + milliseconds);
    },
  };
}
