export function retry(fn: () => void) {
  fn();
}
export function logFailure() {
  return true;
}
