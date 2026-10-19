// A decision kind is a module with one entry point; the registry in ./index.ts is the only place kinds are listed.
import type { DecideInput, State, WorkContract } from "../core/schemas.ts";
import type { Plan } from "../pipeline.ts";
import type { Ports, Tx } from "../ports/types.ts";

export interface DecisionCtx { ports: Ports; tx: Tx; state: State; work: WorkContract; input: DecideInput }
export interface Decision { kind: string; run(c: DecisionCtx): Promise<Plan> | Plan }
