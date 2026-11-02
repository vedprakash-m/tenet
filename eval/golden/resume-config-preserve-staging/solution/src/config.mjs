export function loadConfig(defaults, overrides) {
  const result = { ...defaults };
  for (const [key, value] of Object.entries(overrides)) if (value !== undefined) result[key] = value;
  return result;
}
