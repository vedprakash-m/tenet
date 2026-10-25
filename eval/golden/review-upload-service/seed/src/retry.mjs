// withRetry(fn, tries): call fn until it succeeds, at most `tries` times.
export async function withRetry(fn, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
    }
  }
  return undefined;
}
