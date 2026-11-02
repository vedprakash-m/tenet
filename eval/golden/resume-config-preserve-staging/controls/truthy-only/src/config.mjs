export function loadConfig(defaults, overrides) {
  return Object.fromEntries(Object.keys(defaults).map(key => [key, overrides[key] || defaults[key]]));
}
