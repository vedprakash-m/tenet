export function evaluateRun({ exit, tests }) {
  if (!Array.isArray(tests) || !tests.length || ![0,1].includes(exit)) return "inconclusive";
  return exit === 0 ? "pass" : "fail";
}
