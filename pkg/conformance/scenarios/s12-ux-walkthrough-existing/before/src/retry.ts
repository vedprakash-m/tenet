export function retryPayment(fn: () => void) {
  try { fn(); } catch { fn(); }
}
export function logFailure() {
  return true;
}
