// The destructive stop answer reuses stop's recovery and process cleanup, bound to its preview (CON-10, SEC-13).
import type { Decision } from "./types.ts";
import { stopWork } from "../verbs/stop.ts";

export const abandon: Decision = {
  kind: "abandon-confirm",
  run: ({ ports, state, input, tx }) => stopWork(ports, state, { h: input.h!, mode: "abandon", answers: input.answers }, tx),
};
