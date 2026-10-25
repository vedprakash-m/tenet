import { envelopeConsentPlan } from "../core/execution-envelope.ts";
import type { State, WorkContract } from "../core/schemas.ts";
import type { Ports } from "../ports/types.ts";
import type { Run } from "./check-evidence.ts";

type Shape = Pick<Run, "toRun" | "toExecute">;

export function checkEnvelopeGate(ports: Ports, state: State, work: WorkContract, shape: Shape) {
  const envelope = ports.runner.planEnvelope({
    projectId: state.workspaceId, root: ports.root, obligations: shape.toRun, toExecute: shape.toExecute, stack: ports.stack,
  });
  return { envelope, plan: envelopeConsentPlan(state, work, envelope) };
}