// Canonical templates from tenet/specs/tech-spec/messages.md §2, including the
// approved round 4 specification answers (07ff12d).
export type DiagnosticText = { message: string; fix: string };
export type MessageVars = Readonly<Record<string, string | number>>;

export const messageTemplates = {
  "TN-ACC-DUP-ID": {
    "message": "Duplicate acceptance item ID {id}.",
    "fix": "Renumber or remove the repeated {id} item."
  },
  "TN-ACC-MISSING-ID": {
    "message": "Acceptance item needs an ID.",
    "fix": "Prefix the item with [AB-<n>]."
  },
  "TN-ACC-UNPASSED": {
    "message": "Acceptance items not passing: {ids}.",
    "fix": "Add passing tests tagged with [AB-n] or fix failing tests for {ids}."
  },
  "TN-BLESS-INFERRED": {
    "message": "Section {slug} still contains inferred statements ({ids}).",
    "fix": "Edit or adopt {ids}, then run `tenet bless`."
  },
  "TN-BLESS-NO-TTY": {
    "message": "Interactive terminal required to bless specifications.",
    "fix": "Run `tenet bless` in an interactive terminal session."
  },
  "TN-BLESS-OPEN-CONFLICT": {
    "message": "Section {slug} has unresolved conflicts or open questions ({ids}).",
    "fix": "Resolve {ids} in Conflicts or Open questions, then run `tenet bless`."
  },
  "TN-BUDGET": {
    "message": "File {path} is over its token budget ({tokens} > {limit} tokens).",
    "fix": "Trim {path} or run `tenet split` to extract a section into a part."
  },
  "TN-BUDGET-WARN": {
    "message": "File {path} is at or over 90% of its token budget ({tokens} / {limit} tokens).",
    "fix": "Trim {path} or run `tenet split` to extract a section into a part."
  },
  "TN-CITE-FILE": {
    "message": "Cited file {path} was not found.",
    "fix": "Update the citation path or restore {path}."
  },
  "TN-CITE-HEADING": {
    "message": "Cited heading #{slug} was not found in {path}.",
    "fix": "Update the doc: citation to an existing heading slug in {path}."
  },
  "TN-CITE-RANGE": {
    "message": "Citation {cite} has an invalid line range or format.",
    "fix": "Fix {cite} to use a valid path:line or path:start-end within file length."
  },
  "TN-CITE-TEST": {
    "message": "Cited test {name} was not found in {file}.",
    "fix": "Update the test: citation to match a declared test in {file}."
  },
  "TN-ENV-GIT": {
    "message": "Git {found} is below required version 2.40.",
    "fix": "Install Git 2.40 or newer and retry."
  },
  "TN-ENV-NO-COMMIT": {
    "message": "Repository has no commits yet.",
    "fix": "Make a first commit, then run `tenet onboard`."
  },
  "TN-ENV-NODE": {
    "message": "Node.js {found} is below required version 22.",
    "fix": "Install Node.js 22 LTS or newer and retry."
  },
  "TN-ENV-NOT-GIT": {
    "message": "Directory {path} is not a Git repository.",
    "fix": "Run `git init` or run from inside a Git repository."
  },
  "TN-ENV-REGISTRY": {
    "message": "Could not reach the npm registry to verify {package}@{version}: {cause}.",
    "fix": "Check your network or proxy, or run `tenet {command} --offline` to record local package integrity."
  },
  "TN-ENV-OFFLINE": {
    "message": "Command `tenet {command}` requires network access, which is disabled by `--offline`.",
    "fix": "Re-run `tenet {command}` without `--offline`."
  },
  "TN-EV-DUP": {
    "message": "Duplicate event ID {id} has conflicting content.",
    "fix": "Keep one canonical event for {id} and remove the conflicting entry."
  },
  "TN-EV-ORPHAN": {
    "message": "Event {id} references unknown predecessor {prev}.",
    "fix": "Include or fetch event {prev} before reducing work item events."
  },
  "TN-GATE-*": {
    "message": "Gate blocked or held by rule {rule}: {reason}.",
    "fix": "Resolve {reason} and re-run the gate check."
  },
  "TN-GATE-APPROVE-NOT-EVIDENCE": {
    "message": "Approval cannot satisfy evidence claim {claim}.",
    "fix": "Supply required verification evidence for {claim} or request a time-boxed waiver via `tenet decide`."
  },
  "TN-GATE-CLAIM": {
    "message": "Claim {claim} is {state}.",
    "fix": "Satisfy {claim}, wait for CI verification, or request a waiver via `tenet decide`."
  },
  "TN-GATE-CONFLICT": {
    "message": "Work item has unresolved event conflicts ({ids}).",
    "fix": "Run `tenet resolve` on {ids} before advancing."
  },
  "TN-GATE-FROZEN": {
    "message": "Work item is frozen.",
    "fix": "Wait for the Owner to unfreeze the work item before advancing."
  },
  "TN-GATE-REVIEW": {
    "message": "Review is incomplete or requires adjudication ({reason}).",
    "fix": "Resolve review findings or record a decision via `tenet decide`."
  },
  "TN-GATE-STOP": {
    "message": "Stop threshold reached: {reason}.",
    "fix": "Write an escalation report and run `tenet escalate`."
  },
  "TN-GATE-TRUST": {
    "message": "Protected trust-surface claim {claim} is not satisfied.",
    "fix": "Open a change-policy decision request via `tenet decide`."
  },
  "TN-GATE-UNKNOWN": {
    "message": "Policy applicability is unknown because {missing} is missing.",
    "fix": "Define {missing} in tenet.yaml or CODEOWNERS and re-run."
  },
  "TN-INIT-EXISTS": {
    "message": "File {path} already exists with different content.",
    "fix": "Review {path} or rerun `tenet init --force` to overwrite managed blocks."
  },
  "TN-INTERNAL": {
    "message": "Internal failure: {detail}.",
    "fix": "Report this defect with the command and error details."
  },
  "TN-KIT-EDITED": {
    "message": "Vendored kit digest differs from tenet.lock ({actual} != {expected}).",
    "fix": "Restore .tenet/kit or run `tenet upgrade` to update tenet.lock."
  },
  "TN-KIT-INVALID": {
    "message": "Kit at {path} is invalid: {detail}.",
    "fix": "Restore {path} to regular kit files or run `tenet upgrade`."
  },
  "TN-KIT-MISSING": {
    "message": "Kit directory {path} was not found.",
    "fix": "Reinstall @vedprakash-m/tenet or fix kit_path in tenet.yaml."
  },
  "TN-LOCK-INVALID": {
    "message": "Lock file tenet.lock is invalid: {detail}.",
    "fix": "Fix tenet.lock or run `tenet init` to regenerate it."
  },
  "TN-LOCK-MISMATCH": {
    "message": "Installed package {installed} differs from tenet.lock ({locked}).",
    "fix": "Run `tenet upgrade` or reinstall @vedprakash-m/tenet@{locked}."
  },
  "TN-LOCK-MISSING": {
    "message": "Lock file tenet.lock was not found.",
    "fix": "Run `tenet init` to create and pin tenet.lock."
  },
  "TN-PATH-ESCAPE": {
    "message": "Path {path} resolves outside the repository root.",
    "fix": "Use a relative path inside the repository without symlink escapes."
  },
  "TN-POLICY-ALPHA0-CAP": {
    "message": "The {rule} rule is capped at advise in alpha.0.",
    "fix": "The configured mode will take effect when rule modes are available."
  },
  "TN-POLICY-BRANCH": {
    "message": "Branch modifies protected policy file tenet.yaml.",
    "fix": "Revert tenet.yaml on this branch or move policy changes to a separate change."
  },
  "TN-POLICY-INCOMPATIBLE": {
    "message": "Claim requirements for {claim} have no compatible intersection.",
    "fix": "Align conflicting claim methods or pass rules across policy layers."
  },
  "TN-POLICY-LEVEL-UNAVAILABLE": {
    "message": "Policy level {level} is not yet available; running as observe.",
    "fix": "Set an available level in tenet.yaml or wait for support for {level}."
  },
  "TN-POLICY-LOOSEN": {
    "message": "Policy layer {layer} attempts to loosen {name}.",
    "fix": "Remove the loosening override from {layer} so later layers only tighten."
  },
  "TN-POLICY-MISSING": {
    "message": "Policy file tenet.yaml was not found.",
    "fix": "Run `tenet init` to create tenet.yaml."
  },
  "TN-POLICY-RULE": {
    "message": "Unknown policy rule or setting {name} in tenet.yaml.",
    "fix": "Remove or fix {name} in tenet.yaml against the active pack."
  },
  "TN-POLICY-SCHEMA": {
    "message": "tenet.yaml does not match the alpha.0 schema: {detail}.",
    "fix": "Fix tenet.yaml or remove fields that are not available in alpha.0."
  },
  "TN-PROTECTED": {
    "message": "Change modifies protected path {path}.",
    "fix": "Revert edits to {path} or open a change-policy decision request via `tenet decide`."
  },
  "TN-RECORD-BUNDLE": {
    "message": "Recorded CI bundle {run_id} failed verification: {reason}.",
    "fix": "Re-run the CI verification workflow and check bundle integrity."
  },
  "TN-REPORT-MALFORMED": {
    "message": "Test report {path} is not valid {kind} input.",
    "fix": "Fix the {kind} report format, XML entity rules, or size/case limits for {path}."
  },
  "TN-REPORT-MISSING": {
    "message": "Test report {path} was not found.",
    "fix": "Run tests to generate {path}, or provide an existing report path."
  },
  "TN-SCHEMA": {
    "message": "File {path} failed {schema} schema validation at {pointer}.",
    "fix": "Update {path} at {pointer} to match the {schema} schema."
  },
  "TN-SPEC-BLESSED-COPY": {
    "message": "Blessed copy for section {slug} is missing or changed on disk.",
    "fix": "Run `tenet bless` to restore or re-bless section {slug}."
  },
  "TN-SPEC-DUP-ID": {
    "message": "Duplicate specification ID {id}.",
    "fix": "Run `tenet fix` to assign a new ID, or remove the duplicate {id}."
  },
  "TN-SPEC-DUP-SECTION": {
    "message": "Duplicate section slug {slug}.",
    "fix": "Rename or merge the repeated {slug} heading."
  },
  "TN-SPEC-MISSING-ID": {
    "message": "Specification line needs an ID.",
    "fix": "Run `tenet fix` or prefix the line with an unused ID."
  },
  "TN-SPEC-NO-FRONT": {
    "message": "Specification file has no YAML front matter.",
    "fix": "Run `tenet fix` to add the front matter."
  },
  "TN-SPEC-REQ-META": {
    "message": "Requirement metadata is malformed: check closing braces, allowed keys, and origin.",
    "fix": "Fix the `{…}` metadata block with allowed keys and valid origin."
  },
  "TN-SPEC-VISION-WAITS-FOR-PRD": {
    "message": "{count} vision {items} for a blessed requirement; bless the PRD next",
    "fix": "Run `tenet bless --doc prd` for separate files or `tenet bless --section requirements` for one file."
  },
  "TN-SPEC-UNCOVERED-VISION": {
    "message": "Blessed vision item {id} is not served by a blessed requirement or listed under ## Not yet in scope.",
    "fix": "Add serves: {id} to a blessed requirement or list {id} under a blessed ## Not yet in scope section."
  },
  "TN-SUBJ-DIRTY": {
    "message": "Working tree has uncommitted changes.",
    "fix": "Commit or stash local changes before running `tenet {command}`."
  },
  "TN-USAGE-*": {
    "message": "Invalid usage for `tenet {command}`: {detail}.",
    "fix": "Run `tenet {command} --help` for valid arguments and flags."
  },
  "TN-USAGE-BUDGET": {
    "message": "Context token budget {budget} must be a positive integer.",
    "fix": "Pass a positive integer to `--budget-tokens` or `budget_tokens`."
  },
  "TN-USAGE-REF": {
    "message": "The git ref is invalid.",
    "fix": "Pass a repository ref."
  },
  "TN-WEAK-*": {
    "message": "Possible test weakening ({finding}) in {file}: {names}.",
    "fix": "Restore removed tests or remove skip markers in {file}, or ask for a waiver."
  }
} as const satisfies Record<string, DiagnosticText>;

const wildcardPrefixes = ["TN-GATE-*", "TN-USAGE-*", "TN-WEAK-*"] as const;
const templates: Readonly<Record<string, DiagnosticText>> = messageTemplates;

export function messageTemplate(code: string): Readonly<DiagnosticText> | undefined {
  if (Object.hasOwn(templates, code)) return templates[code];
  const family = wildcardPrefixes.find((prefix) => code.startsWith(prefix.slice(0, -1)));
  return family === undefined ? undefined : messageTemplates[family];
}

export function message(code: string, vars: MessageVars = {}): DiagnosticText {
  const template = messageTemplate(code);
  if (!template) throw new RangeError(`Unknown diagnostic code: ${code}`);

  const substitute = (text: string): string => text.replace(/\{([a-z_][a-z_0-9]*)\}/gi, (_, name: string) => {
    if (!Object.hasOwn(vars, name)) throw new TypeError(`Missing diagnostic variable ${name} for ${code}`);
    return String(vars[name]);
  });
  return { message: substitute(template.message), fix: substitute(template.fix) };
}

export const onboardText = {
  description: "Inspect your project and prepare a specification drafting assignment.",
  read: "Will read: code, configuration, tests, docs, CI, owners",
  skip: "Will skip: .env*, credentials, archive folders, vendored, generated, excluded, binary, and oversized files",
  drafting: "Drafting sends project content to your agent and its model provider.",
  readCounts: (revision: string, read: number, skipped: number) => `Read ${read} files at ${revision} and skipped ${skipped}.`,
  firstFindings: (findings: string) => `First findings: ${findings}`,
  assignment: "Drafting assignment: .tenet/onboard/assignment.json",
  deadPath: (file: string, target: string) => `${file} links missing path ${target}`,
  skippedTests: (count: number, file: string) => `${count} skipped or focused test(s) in ${file}`,
  ownersUnmatched: (pattern: string) => `CODEOWNERS pattern ${pattern} matches no tracked files`,
  noTestReport: "No machine-readable test report configured",
  invalidLayout: "choose one-file or separate for --layout",
  unexpectedPositionals: "unexpected positional arguments",
} as const;
