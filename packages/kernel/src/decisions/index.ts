import { basis } from "./basis.ts";
import { scaffold } from "./scaffold.ts";
import { acceptance, dirtyOverlap, disposition, hookConsent, repairLock, unexplained } from "./simple.ts";
import type { Decision } from "./types.ts";

export const DECISIONS: Record<string, Decision> = Object.fromEntries([basis, scaffold, dirtyOverlap, acceptance, disposition, repairLock, unexplained, hookConsent].map((d) => [d.kind, d]));
