// The typed settings catalog, one source (PRD §7.3). A setting's value is validated here and nowhere else; an unknown key
// is refused, never stored. Settings listed so far are those a verb already reads.
import { z } from "zod";

export const SETTINGS = {
  /** What happens to a finished result's integration offer (GIT-11): the next action names it, accepting does it, or neither. */
  integration: z.enum(["offer", "auto-on-accept", "never"]),
} as const;

export type SettingKey = keyof typeof SETTINGS;
export const isSettingKey = (k: string): k is SettingKey => k in SETTINGS;
