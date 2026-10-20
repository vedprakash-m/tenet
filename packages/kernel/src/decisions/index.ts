import { adopt } from "./adopt.ts";
import { abandon } from "./abandon.ts";
import { takeover } from "./takeover.ts";
import { decisionRecord } from "./decision-record.ts";
import { dependency } from "./dependency.ts";
import { grant } from "./grant.ts";
import { overview } from "./overview.ts";
import { plan } from "./plan.ts";
import { basis } from "./basis.ts";
import { undoConfirm } from "./undo.ts";
import { scaffold } from "./scaffold.ts";
import { acceptance, branchSwitch, config, dirtyOverlap, disposition, hookConsent, repairLock, syncIndex, unexplained } from "./simple.ts";
import type { Decision } from "./types.ts";

export const DECISIONS: Record<string, Decision> = Object.fromEntries([basis, scaffold, dirtyOverlap, acceptance, disposition, repairLock, unexplained, hookConsent, syncIndex, branchSwitch, config, undoConfirm, adopt, overview, plan, grant, decisionRecord, dependency, abandon, takeover].map((d) => [d.kind, d]));
