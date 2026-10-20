// The verbs. `publish` is not registered: remote effects stay refused until their authority and reconciliation exist.
import type { Verb } from "../pipeline.ts";
import { check } from "./check.ts";
import { commit } from "./commit.ts";
import { decide } from "./decide.ts";
import { findings } from "./findings.ts";
import { finish } from "./finish.ts";
import { inspect } from "./inspect.ts";
import { integrate } from "./integrate.ts";
import { open } from "./open.ts";
import { packet } from "./packet.ts";
import { review } from "./review.ts";
import { stop } from "./stop.ts";
import { undo } from "./undo.ts";

export const VERBS: Record<string, Verb> = Object.fromEntries([open, decide, check, findings, finish, review, inspect, stop, commit, packet, integrate, undo].map((v) => [v.name, v]));
