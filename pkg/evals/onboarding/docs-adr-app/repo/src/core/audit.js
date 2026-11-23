export function appendAudit(log, event) {
  return [...log, Object.freeze({ ...event })];
}
