const reservedPrefixes = new Set(["AB", "CF", "Q", "V"]);

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tagPrefixes(prefix: string): string {
  return prefix && !reservedPrefixes.has(prefix) ? `AB|${escapeRegExp(prefix)}` : "AB";
}

function underscored(prefixes: string): RegExp {
  return new RegExp(`(?<![A-Za-z0-9])tenet_(${prefixes})_(\\d+)(?![A-Za-z0-9])`, "g");
}

export function extractTags(text: string, prefix = "R"): string[] {
  const heads = tagPrefixes(prefix);
  const found = new Set<string>();
  for (const [, tag] of text.matchAll(new RegExp(`\\[((?:${heads})-\\d+)\\]`, "g"))) {
    if (tag) found.add(tag);
  }
  for (const [, head, number] of text.matchAll(underscored(heads))) {
    found.add(`${head}-${number}`);
  }
  return [...found];
}

export function stripTags(text: string, prefix = "R"): string {
  const heads = tagPrefixes(prefix);
  const identifier = underscored(heads);
  return text
    .replace(new RegExp(`\\[(?:${heads})-\\d+\\]`, "g"), "")
    .replace(/[A-Za-z0-9_]+/g, (word) => {
      const cleaned = word.replace(identifier, "");
      return cleaned === word ? word : cleaned.replace(/^_+|_+$/g, "");
    })
    .replace(/_{2,}/g, "_")
    .replace(/^[\s_]+|[\s_]+$/g, "")
    .replace(/\s+/g, " ");
}

export function extractTokenTags(text: string, prefix = "R"): string[] {
  const heads = tagPrefixes(prefix);
  const bare = new RegExp(`^(?:${heads})-\\d+$`);
  const identifier = new RegExp(`^tenet_(${heads})_(\\d+)$`);
  const found = new Set<string>();
  for (const token of text.split(/[,\s]+/)) {
    const tag = token.startsWith("[") && token.endsWith("]") ? token.slice(1, -1) : token;
    if (bare.test(tag)) found.add(tag);
    else {
      const match = identifier.exec(token);
      if (match) found.add(`${match[1]}-${match[2]}`);
    }
  }
  return [...found];
}
