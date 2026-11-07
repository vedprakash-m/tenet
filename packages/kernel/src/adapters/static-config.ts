export function unsupportedTsConfig(text: string): string | undefined {
  let config: unknown;
  try { config = JSON.parse(text); }
  catch { return "tsconfig.json: must be plain JSON for static checks"; }
  if (!config || typeof config !== "object" || Array.isArray(config))
    return "tsconfig.json: must be a JSON object for static checks";
  const record = config as Record<string, unknown>;
  if (record.extends !== undefined) return "tsconfig.json: extends is not supported";
  if (Array.isArray(record.references) && record.references.length)
    return "tsconfig.json: references are not supported";
  const options = record.compilerOptions;
  if (options && typeof options === "object" && !Array.isArray(options)) {
    const compilerOptions = options as Record<string, unknown>;
    if (compilerOptions.composite) return "tsconfig.json: compilerOptions.composite is not supported";
    if (compilerOptions.tsBuildInfoFile !== undefined)
      return "tsconfig.json: compilerOptions.tsBuildInfoFile is not supported";
  }
  return undefined;
}
