// Pure Git filter configuration: inspection disables programs; execution pins only the consented names.
import { sha256 } from "./ids.ts";

type Config = ReadonlyMap<string, readonly string[]>;

export function filterOverrides(config: Config, enabled: readonly string[] = []): string[] {
  return [...config].flatMap(([name, fields]) => {
    const off = ["clean=", "smudge=", "process=", "required=false"];
    return (enabled.includes(name) ? fields : off).flatMap(field => ["-c", `filter.${name}.${field}`]);
  });
}

/** NUL-delimited path/attribute/value records; preserve command order because Git's last assignment wins. */
export function usedFilters(config: Config, attributes: string): { names: string[]; hash: string } | null {
  const used = new Set<string>(), records = attributes.split("\0");
  for (let i = 0; i + 2 < records.length; i += 3) if (config.has(records[i + 2]!)) used.add(records[i + 2]!);
  if (!used.size) return null;
  const names = [...used].sort();
  return { names, hash: sha256(JSON.stringify(names.map(n => [n, config.get(n)!]))).slice(0, 16) };
}

export function filterConfig(text: string): Map<string, string[]> {
  const config = new Map<string, string[]>();
  for (const record of text.split("\0").filter(Boolean)) {
    const nl = record.indexOf("\n"), parts = record.slice(0, nl).split(".");
    const name = parts.slice(1, -1).join("."), field = parts.at(-1)!;
    if (name && ["clean", "smudge", "process", "required"].includes(field))
      config.set(name, [...(config.get(name) ?? []), `${field}=${record.slice(nl + 1)}`]);
  }
  return config;
}
