import { relative } from "node:path";

const path = (value) => typeof value === "string" ? relative(process.cwd(), value).replaceAll("\\", "/") : "";

export default async function* reporter(source) {
  const files = new Map();
  const leaves = [];
  const skipped = [];
  const nesting = new Map();
  const ids = new Map();
  let terminal = { success: false, counts: null };
  for await (const event of source) {
    const type = event?.type;
    const data = event?.data ?? {};
    const file = path(data.file);
    const stack = nesting.get(file) ?? new Map();
    if (type === "test:start") {
      stack.set(data.nesting ?? 0, data.name ?? "");
      nesting.set(file, stack);
    }
    const key = [...stack.entries()]
      .filter(([depth, name]) => depth <= (data.nesting ?? 0) && name)
      .sort(([left], [right]) => left - right)
      .map(([, name]) => name).join(" :: ");
    const isSkipped = data.skip !== undefined || data.skipped === true || data.details?.skip !== undefined || data.details?.skipped === true;
    if (type === "test:pass" || type === "test:fail") {
      const hasChildren = data.details?.type === "suite";
      if (!hasChildren || isSkipped) {
        const base = `${file}:${data.line ?? 0}:${data.column ?? 0}:${key}`;
        const occurrence = (ids.get(base) ?? 0) + 1;
        ids.set(base, occurrence);
        const item = {
          id: `${base}:${occurrence}`,
          key, file, status: isSkipped ? "skip" : type === "test:pass" ? "pass" : "fail",
          durationMs: data.details?.duration_ms ?? 0,
          ...(type === "test:fail" ? {
            error: {
              name: data.details?.error?.name ?? "",
              message: data.details?.error?.message ?? "",
              code: data.details?.error?.code ?? "",
            },
          } : {}),
        };
        leaves.push(item);
        const current = files.get(item.file) ?? { file: item.file, pass: 0, fail: 0, skipped: 0, durationMs: 0 };
        current[item.status] += 1;
        current.durationMs += item.durationMs;
        files.set(item.file, current);
      }
    } else if (type === "test:skip") {
      const base = `${file}:${data.line ?? 0}:${data.column ?? 0}:${key}`;
      const occurrence = (ids.get(base) ?? 0) + 1;
      ids.set(base, occurrence);
      const item = { id: `${base}:${occurrence}`, key, file, status: "skip", durationMs: 0 };
      skipped.push(item);
      const current = files.get(item.file) ?? { file: item.file, pass: 0, fail: 0, skipped: 0, durationMs: 0 };
      current.skipped += 1;
      files.set(item.file, current);
      stack.set(data.nesting ?? 0, data.name ?? "");
    } else if (type === "test:summary") {
      terminal = {
        success: data.success === true,
        counts: data.counts ?? null,
      };
    }
    if (type === "test:pass" || type === "test:fail") stack.delete(data.nesting ?? 0);
  }
  yield `${JSON.stringify({
    version: 1,
    terminal,
    leaves: [...leaves, ...skipped],
    files: [...files.values()].sort((a, b) => a.file.localeCompare(b.file)),
  })}\n`;
}
