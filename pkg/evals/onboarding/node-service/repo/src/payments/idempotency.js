import { IDEMPOTENCY_TTL_HOURS } from "../config/limits.js";

export class IdempotencyStore {
  #seen = new Map();
  get(key, nowMs = Date.now()) {
    const entry = this.#seen.get(key);
    if (!entry) return null;
    if (nowMs - entry.at > IDEMPOTENCY_TTL_HOURS * 3600_000) return null;
    return entry.result;
  }
  set(key, result, nowMs = Date.now()) {
    this.#seen.set(key, { result, at: nowMs });
  }
}
