import { HostTimings, timingReport } from "./core/timing.ts";
import type { Ports, Runner } from "./ports/types.ts";

/** Invocation-local elapsed intervals; overlapping runner calls count once, including failed calls. */
export function callTiming(ports: Ports) {
  const started = ports.clock.ms();
  let running = 0, tool = 0, toolStarted = started, invalid = false;
  const runner: Runner = {
    guardRun: (dir, admit) => ports.runner.guardRun(dir, admit),
    environmentNames: (extra) => ports.runner.environmentNames(extra),
    planEnvelope: (input) => ports.runner.planEnvelope(input),
    stopRun: (dir) => ports.runner.stopRun(dir),
    allocatePort: () => ports.runner.allocatePort(),
    async run(spec) {
      if (running++ === 0) toolStarted = ports.clock.ms();
      try {
        return await ports.runner.run(spec);
      } finally {
        if (--running === 0) tool += Math.max(0, ports.clock.ms() - toolStarted);
      }
    },
  };
  const read = (collectHost = true) => {
    const at = ports.clock.ms();
    let observation: HostTimings = {};
    if (collectHost) {
      try {
        if (ports.host.callTimings) observation = ports.host.callTimings();
      } catch (e) {
        invalid = true;
        throw e;
      }
    }
    const host = HostTimings.safeParse(observation);
    if (!host.success) {
      invalid = true;
      throw new Error("Invalid host timing observation.");
    }
    return timingReport(Math.max(0, at - started), tool + (running ? Math.max(0, at - toolStarted) : 0), host.data, invalid);
  };
  return { runner, read };
}
