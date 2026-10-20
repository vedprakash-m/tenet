import { basis } from "./basis.ts";
import { undoConfirm } from "./undo.ts";
import { scaffold } from "./scaffold.ts";
import { acceptance, branchSwitch, config, dirtyOverlap, disposition, hookConsent, repairLock, syncIndex, unexplained } from "./simple.ts";
import type { Decision } from "./types.ts";

export const DECISIONS: Record<string, Decision> = Object.fromEntries([basis, scaffold, dirtyOverlap, acceptance, disposition, repairLock, unexplained, hookConsent, syncIndex, branchSwitch, config, undoConfirm].map((d) => [d.kind, d]));
