export function retry(fn: () => void) {
  try { fn(); } catch { fn(); }
}
