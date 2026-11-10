// Trait detection (QLT-11): a static registry of path and dependency signals for the R1 traits. Pure.
// Every entry declares partial coverage, so a missing signal yields `unknown`, never "not indicated" (trait-detection.md E10, E18).
// Project traits describe the repository; change traits come from the paths of the work's own change.
import { hashOf } from "./ids.ts";
import { R1_TRAITS, NOT_ASSESSED_IN_R1 } from "./traits.ts";
import type { R1Trait } from "./traits.ts";

export { NOT_ASSESSED_IN_R1 };
export type TraitOutcome = "present" | "unknown";
export interface TraitResult { trait: R1Trait; outcome: TraitOutcome; evidence: string[] }
export interface TraitCorrection { trait: R1Trait; outcome: "present" | "absent"; scope: "project" | "change"; work?: string; bind: string }

const W = String.raw`(?:^|[/._-])`, E = String.raw`(?:$|[/._-])`;
const word = (...xs: string[]) => new RegExp(`${W}(?:${xs.join("|")})${E}`, "i");

/** Path signals, shared by project and change detection. */
export const PATH_SIGNALS: Record<R1Trait, RegExp | null> = {
  ui: /\.(?:tsx|jsx|vue|svelte|css|scss|html)$/i,
  persistence: new RegExp(`${word("migrations?", "db", "database", "schema", "repositor(?:y|ies)", "prisma").source}|\\.sql$`, "i"),
  auth: word(
    "auth", "authn", "authz", "login", "logout", "sign-?in", "sign-?out", "session", "password", "oauth", "csrf", "rbac", "permissions?",
  ),
  "personal-data": word("account", "profile", "pii", "personal", "customer", "borrower", "gdpr"),
  "public-api": word("api", "routes?", "openapi", "graphql", "endpoints?"),
  "external-effects": word("e?mail", "smtp", "webhooks?", "payments?", "stripe", "sms", "notifications?", "notify"),
  "background-jobs": word("jobs?", "queues?", "workers?", "cron", "scheduler"),
  i18n: word("locales?", "i18n", "l10n", "translations?"),
  cli: word("bin", "cli"),
  library: null,
};

/** Dependency signals read from package.json. */
const DEP_SIGNALS: Partial<Record<R1Trait, readonly string[]>> = {
  ui: ["react", "vue", "svelte", "@angular/core", "solid-js", "preact", "lit"],
  persistence: [
    "pg", "mysql2", "sqlite3", "better-sqlite3", "@prisma/client", "prisma", "typeorm", "sequelize", "mongoose", "knex", "drizzle-orm",
  ],
  auth: ["passport", "next-auth", "@auth/core", "jsonwebtoken", "jose", "bcrypt", "bcryptjs", "argon2", "lucia", "express-session"],
  "external-effects": ["nodemailer", "stripe", "twilio", "@sendgrid/mail", "@aws-sdk/client-ses", "@aws-sdk/client-sns"],
  "public-api": ["express", "fastify", "koa", "hono", "@nestjs/core", "@trpc/server", "graphql"],
  "background-jobs": ["bullmq", "bull", "agenda", "node-cron", "bree", "pg-boss"],
  i18n: ["i18next", "react-intl", "@formatjs/intl", "vue-i18n"],
  cli: ["commander", "yargs", "cac", "clipanion", "oclif"],
};

const MAX_EVIDENCE = 5;

function packageFacts(text: string | null): { deps: Set<string>; library: boolean; bin: boolean } {
  try {
    const p = JSON.parse(text ?? "{}") as Record<string, unknown>;
    const names = ["dependencies", "devDependencies", "peerDependencies"].flatMap((k) => Object.keys((p[k] ?? {}) as object));
    return { deps: new Set(names), library: p.private !== true && (!!p.exports || !!p.main), bin: !!p.bin };
  } catch {
    return { deps: new Set(), library: false, bin: false };
  }
}

const byPath = (t: R1Trait, paths: readonly string[]) => {
  const re = PATH_SIGNALS[t];
  return re ? paths.filter((p) => re.test(p)).slice(0, MAX_EVIDENCE) : [];
};

/** Project traits from the tracked paths and package.json. */
export function detectProject(paths: readonly string[], packageJson: string | null): TraitResult[] {
  const pkg = packageFacts(packageJson);
  return R1_TRAITS.map((trait) => {
    const deps = (DEP_SIGNALS[trait] ?? []).filter((d) => pkg.deps.has(d)).map((d) => `package.json: ${d}`);
    const flag = (trait === "library" && pkg.library) || (trait === "cli" && pkg.bin);
    const extra = flag ? [`package.json: ${trait === "cli" ? "bin" : "exports or main"}`] : [];
    const evidence = [...extra, ...deps, ...byPath(trait, paths)].slice(0, MAX_EVIDENCE);
    return { trait, outcome: evidence.length ? "present" : "unknown", evidence };
  });
}

/** Change traits from the paths the work changed. Only a matching path makes a trait present. */
export function detectChange(paths: readonly string[]): TraitResult[] {
  return R1_TRAITS.map((trait) => {
    const evidence = byPath(trait, [...paths].sort());
    return { trait, outcome: evidence.length ? "present" : "unknown", evidence };
  });
}

/** What a correction is bound to: the detected results it answers. Changed evidence makes it stale. */
export const traitBind = (results: readonly TraitResult[], scope: string, work = ""): string => hashOf({ results, scope, work });

/** The traits that apply: detected present ones, adjusted by corrections bound to these same results. */
export function effectiveTraits(results: readonly TraitResult[], corrections: readonly TraitCorrection[], bind: string): R1Trait[] {
  const live = corrections.filter((c) => c.bind === bind);
  return R1_TRAITS.filter((t) => {
    const c = live.filter((x) => x.trait === t).at(-1);
    return c ? c.outcome === "present" : results.find((r) => r.trait === t)?.outcome === "present";
  });
}

/** Parses "+auth,-ui": add or remove canonical traits. Anything else is refused by the caller. */
export function parseCorrections(text: string): { trait: R1Trait; outcome: "present" | "absent" }[] | null {
  const items = text.split(",").map((s) => s.trim()).filter(Boolean);
  const out = items.map((s) => {
    const t = s.slice(1) as R1Trait;
    if ((s[0] !== "+" && s[0] !== "-") || !(R1_TRAITS as readonly string[]).includes(t)) return null;
    return { trait: t, outcome: s[0] === "+" ? "present" as const : "absent" as const };
  });
  return out.length && out.every((x) => x !== null) ? (out as { trait: R1Trait; outcome: "present" | "absent" }[]) : null;
}
