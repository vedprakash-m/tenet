export const SLA_BREACH_MINUTES = 15;
export function isSlaBreached(ageMinutes, acked) {
  return !acked && ageMinutes > SLA_BREACH_MINUTES;
}
