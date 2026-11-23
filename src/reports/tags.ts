const reservedPrefixes = new Set(["AB", "CF", "Q", "V"]);

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizePrefix(prefix = "R"): string {
  return prefix || "R";
}

export function extractTags(text: string, prefix = "R"): string[] {
  const actual = normalizePrefix(prefix);
  const found = new Set<string>();
  const bracketed = /\[([A-Za-z]+-\d+)\]/g;
  let match = bracketed.exec(text);
  while (match) {
    const tag = match[1];
    if (tag && isAllowed(tag, actual)) found.add(tag);
    match = bracketed.exec(text);
  }
  const underscored = new RegExp(
    `(?:^|_)tenet_(${escapeRegExp(actual)}|AB)_(\\d+)(?=$|[^A-Za-z0-9])`,
    "g",
  );
  match = underscored.exec(text);
  while (match) {
    const head = match[1];
    const number = match[2];
    if (head && number) found.add(`${head}-${number}`);
    match = underscored.exec(text);
  }
  return [...found];
}

export function stripTags(text: string, prefix = "R"): string {
  const actual = normalizePrefix(prefix);
  let value = text;
  const bracketed = /\[([A-Za-z]+-\d+)\]/g;
  value = value.replace(bracketed, (whole, tag: string) => (isAllowed(tag, actual) ? "" : whole));
  value = value.replace(
    new RegExp(
      `(?:^|_)tenet_(${escapeRegExp(actual)}|AB)_(\\d+)(?=$|[^A-Za-z0-9])`,
      "g",
    ),
    "",
  );
  return value.replace(/\s+/g, " ").trim();
}

export function extractTokenTags(text: string, prefix = "R"): string[] {
  const actual = normalizePrefix(prefix);
  const found = new Set(extractTags(text, actual));
  const bare = new RegExp(
    `\\b(AB-\\d+${reservedPrefixes.has(actual) ? "" : `|${escapeRegExp(actual)}-\\d+`})\\b`,
    "g",
  );
  let match = bare.exec(text);
  while (match) {
    if (match[1]) found.add(match[1]);
    match = bare.exec(text);
  }
  return [...found];
}

export function acceptanceDigestId(prefix = "R"): RegExp {
  return new RegExp(`^AB-\\d+$|^${escapeRegExp(normalizePrefix(prefix))}-\\d+$`);
}

function isAllowed(tag: string, prefix: string): boolean {
  const head = tag.slice(0, tag.indexOf("-"));
  if (head === "AB") return true;
  if (head === prefix) return !reservedPrefixes.has(head);
  return false;
}
