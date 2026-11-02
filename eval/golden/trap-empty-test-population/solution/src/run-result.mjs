export function evaluateRun({ exit, tests }) {
  if (!Array.isArray(tests) || tests.length === 0 || ![0,1].includes(exit)) return "inconclusive";
  const failed = tests.some(test => test.status === "failed");
  if (tests.some(test => !["passed","failed"].includes(test.status)) || (exit === 0) === failed) return "inconclusive";
  return failed ? "fail" : "pass";
}
