import { canOverrideFreeze } from "../core/freeze.js";
export function handleOverride(body) {
  return canOverrideFreeze(body) ? 200 : 403;
}
