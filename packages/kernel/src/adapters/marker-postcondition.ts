import { existsSync, readFileSync, renameSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { KernelError } from "../core/errors.ts";
import { sha256, stableStringify } from "../core/ids.ts";
import {
  RollbackPostcondition,
  RollbackTerminalAcceptedV2,
} from "../core/marker-transition.ts";
import type { RollbackPostcondition as Postcondition } from "../core/marker-transition.ts";
import {
  canonicalCandidateRecord,
  syncCandidateDirectory,
  syncCandidateFile,
  writeCandidateFile,
} from "./marker-snapshot.ts";
import { parseUniqueRecord } from "./private-record-fs.ts";
import {
  admitCandidateCleanupEvidence, admitCandidateRollbackEvidence, admitCandidateRollbackProbe,
} from "./marker-rollback.ts";

export interface CandidatePostconditionOptions {
  operationId: string;
  acceptance: string;
  terminal: string;
  evidence: string;
  snapshot: string;
  bridgeDigest: string;
  probe(request: string): Promise<{ exit: number; handle?: string }>;
}

type ProbeFacts = {
  handle: string;
  responseHandle: string;
  resultDigest: string;
  workspaceId: string;
  schema: 1 | 2;
  requestDigest: string;
};
type FileFacts = {
  marker: string;
  state: string;
  previous: string | null;
};

const refuse = (detail: string): never => {
  throw new KernelError("unsupported-record", `candidate postcondition refused: ${detail}`, { exit: 4 });
};

export const rollbackProbeRequest = (operationId: string): string =>
  `Tenet rollback usability probe ${operationId}`;

function bytes(path: string): Buffer | null {
  return existsSync(path) ? readFileSync(path) : null;
}

function fileFacts(root: string): FileFacts {
  const marker = bytes(join(root, "marker"));
  const state = bytes(join(root, "state"));
  if (!marker || !state) return refuse("the restored marker or state is missing");
  const previous = bytes(join(root, "state.prev"));
  return { marker: sha256(marker), state: sha256(state), previous: previous ? sha256(previous) : null };
}

function admittedPostcondition(path: string): Postcondition {
  const raw = readFileSync(path, "utf8");
  const record = RollbackPostcondition.parse(parseUniqueRecord(raw));
  if (raw !== canonicalCandidateRecord(record)) refuse("the postcondition record is not canonical");
  return record;
}

function journalWithoutEffects(root: string, before: Buffer): void {
  const current = bytes(join(root, "log")) ?? Buffer.alloc(0);
  if (current.length < before.length || !current.subarray(0, before.length).equals(before)) {
    refuse("the journal prefix changed during the ordinary probe");
  }
  const appended = current.subarray(before.length).toString("utf8").split("\n").filter(Boolean);
  for (const line of appended) {
    let record: { kind?: string };
    try { record = parseUniqueRecord(line) as { kind?: string }; }
    catch { return refuse("the ordinary probe appended an unreadable journal record"); }
    if (record.kind === "intent" || record.kind === "result") {
      refuse("the ordinary probe added an external-effect intent or result");
    }
  }
}

function admittedAcceptance(
  workspace: string,
  operationId: string,
  expected: string,
  options: CandidatePostconditionOptions,
  sourceMustMatch = true,
) {
  const root = join(workspace, ".tenet");
  const path = join(root, `migration-evidence-v2/${operationId}/accepted.json`);
  const raw = bytes(path);
  if (!raw || sha256(raw) !== expected) return refuse("the durable terminal acceptance changed");
  let accepted: ReturnType<typeof RollbackTerminalAcceptedV2.parse>;
  try {
    accepted = RollbackTerminalAcceptedV2.parse(parseUniqueRecord(raw.toString("utf8")));
    if (raw.toString("utf8") !== canonicalCandidateRecord(accepted)) {
      return refuse("the terminal acceptance is not canonical");
    }
  }
  catch { return refuse("the durable terminal acceptance is invalid"); }
  const graph = admitCandidateRollbackEvidence(workspace, operationId, options.bridgeDigest, sourceMustMatch);
  if (accepted.operationId !== operationId || accepted.terminal !== options.terminal ||
      accepted.evidence !== options.evidence || accepted.bridgeDigest !== options.bridgeDigest ||
      graph.terminal !== options.terminal || graph.evidence !== options.evidence ||
      graph.snapshot !== options.snapshot || graph.bridgeDigest !== options.bridgeDigest ||
      accepted.bindingDigest !== graph.bindingDigest) {
    refuse("the terminal acceptance does not bind the admitted rollback graph");
  }
  return accepted;
}

function ordinaryOpen(
  root: string,
  response: { exit: number; handle?: string },
  request: string,
  requestDigest: string,
): ProbeFacts {
  if (response.exit !== 0 || !response.handle) {
    return refuse(`the ordinary open plan call did not exit 0: ${JSON.stringify(response)}`);
  }
  let state: Record<string, unknown>;
  try { state = JSON.parse(readFileSync(join(root, "state"), "utf8")) as Record<string, unknown>; }
  catch { return refuse("the ordinary open plan call did not leave readable state"); }
  if (state.schema !== 2 || typeof state.workspaceId !== "string" || state.sourceOwner !== undefined) {
    return refuse("the ordinary open plan call changed source ownership or schema");
  }
  const work = Object.values((state.work ?? {}) as Record<string, Record<string, unknown>>);
  const matches = work.filter((entry) =>
    entry.profile === "plan" && entry.request === request &&
    entry.state === "proposed");
  if (matches.length !== 1) return refuse("the ordinary open plan result is not one proposed plan contract");
  const session = matches[0]!.session as { inCall?: unknown } | undefined;
  if (session?.inCall !== undefined) return refuse("the ordinary open plan call left an in-call process");
  if (!Array.isArray(matches[0]!.grants) || matches[0]!.grants.length !== 0) {
    return refuse("the ordinary open plan call created a grant");
  }
  const normalized = {
    profile: "plan",
    requestDigest,
    responseHandle: response.handle,
    workspaceId: state.workspaceId,
    schema: state.schema,
    state: "proposed",
    sourceOwner: null,
    externalEffect: false,
    exit: 0,
  };
  return {
    handle: String(matches[0]!.id),
    responseHandle: response.handle,
    resultDigest: sha256(stableStringify(normalized)),
    workspaceId: state.workspaceId,
    schema: state.schema,
    requestDigest,
  };
}

function provisionalRecord(
  options: CandidatePostconditionOptions,
  source: FileFacts,
  probe: FileFacts,
  open: ProbeFacts,
): Postcondition {
  return RollbackPostcondition.parse({
    format: 2,
    operationId: options.operationId,
    acceptance: options.acceptance,
    terminal: options.terminal,
    evidence: options.evidence,
    snapshot: options.snapshot,
    bridgeDigest: options.bridgeDigest,
    marker: source.marker,
    sourceState: source.state,
    sourceStatePrevious: source.previous,
    probeState: probe.state,
    probeStatePrevious: probe.previous,
    workspaceId: open.workspaceId,
    schema: open.schema,
    probe: {
      verb: "open",
      profile: "plan",
      requestDigest: open.requestDigest,
      handle: open.handle,
      exit: 0,
      resultDigest: open.resultDigest,
    },
  });
}

function writeProvisional(path: string, record: Postcondition, operationId: string): void {
  const temp = `${path}.tmp`;
  writeCandidateFile(temp, Buffer.from(canonicalCandidateRecord(record)), true);
  renameSync(temp, path);
  syncCandidateDirectory(dirname(path));
  if (canonicalCandidateRecord(RollbackPostcondition.parse(parseUniqueRecord(
    readFileSync(path, "utf8"),
  ))) !== canonicalCandidateRecord(record)) refuse("the provisional postcondition changed after admission");
  void operationId;
}

function validateProbeFiles(root: string, record: Postcondition): void {
  const current = fileFacts(root);
  if (current.marker !== record.marker || current.state !== record.probeState ||
      current.previous !== record.probeStatePrevious) {
    refuse("the marker or probe state changed after the first ordinary call");
  }
}

type ProbeAdmission = ReturnType<typeof admitCandidateRollbackProbe>;
function validateFinalProbe(
  record: Postcondition,
  options: CandidatePostconditionOptions,
  admitted: ProbeAdmission,
): void {
  if (!admitted.alreadyStarted ||
      record.acceptance !== options.acceptance ||
      record.terminal !== options.terminal ||
      record.evidence !== options.evidence ||
      record.snapshot !== options.snapshot ||
      record.bridgeDigest !== options.bridgeDigest ||
      record.marker !== admitted.source.marker ||
      record.sourceState !== admitted.source.state ||
      record.sourceStatePrevious !== admitted.source.previous ||
      record.workspaceId !== admitted.workspaceId ||
      record.schema !== admitted.schema ||
      record.probe.requestDigest !== sha256(rollbackProbeRequest(options.operationId))) {
    refuse("the final postcondition does not match the admitted ordinary probe");
  }
}

async function repeatedProbe(
  root: string,
  options: CandidatePostconditionOptions,
  record: Postcondition,
): Promise<Postcondition> {
  validateProbeFiles(root, record);
  const request = rollbackProbeRequest(options.operationId);
  const journal = bytes(join(root, "log")) ?? Buffer.alloc(0);
  const response = await options.probe(request);
  journalWithoutEffects(root, journal);
  const repeated = ordinaryOpen(root, response, request, record.probe.requestDigest);
  if (repeated.handle !== record.probe.handle || repeated.resultDigest !== record.probe.resultDigest) {
    return refuse("the repeated ordinary open did not return the same handle and result");
  }
  validateProbeFiles(root, record);
  return record;
}

async function resumeProvisional(
  root: string,
  options: CandidatePostconditionOptions,
  path: string,
): Promise<Postcondition> {
  const record = admittedPostcondition(path);
  const verified = await repeatedProbe(root, options, record);
  const final = join(dirname(path), "postcondition.json");
  renameSync(path, final);
  syncCandidateDirectory(dirname(path));
  admittedPostcondition(final);
  return verified;
}

function promoteProvisionalTemp(root: string, temp: string, final: string): void {
  const record = admittedPostcondition(temp);
  validateProbeFiles(root, record);
  syncCandidateFile(temp);
  renameSync(temp, final);
  syncCandidateDirectory(dirname(temp));
  admittedPostcondition(final);
}

export async function runCandidatePostcondition(
  workspace: string,
  options: CandidatePostconditionOptions,
): Promise<Postcondition> {
  const root = join(workspace, ".tenet");
  const evidenceDir = join(root, `migration-evidence-v2/${options.operationId}`);
  const provisional = join(evidenceDir, "postcondition-provisional.json");
  const provisionalTemp = `${provisional}.tmp`;
  const final = join(evidenceDir, "postcondition.json");
  const acceptedBefore = existsSync(join(evidenceDir, "accepted.json"));
  if (acceptedBefore) admittedAcceptance(workspace, options.operationId, options.acceptance, options, false);
  const request = rollbackProbeRequest(options.operationId);
  const recoveryCalls = existsSync(provisionalTemp) || existsSync(provisional) || existsSync(final) ? 2 : 1;
  const admittedProbe = admitCandidateRollbackProbe(
    workspace, options.operationId, options.bridgeDigest, request, recoveryCalls, existsSync(final) || existsSync(provisional),
  );
  if (existsSync(final)) {
    syncCandidateDirectory(evidenceDir);
    admittedAcceptance(workspace, options.operationId, options.acceptance, options, false);
    const record = admittedPostcondition(final);
    validateFinalProbe(record, options, admittedProbe);
    validateProbeFiles(root, record);
    return record;
  }
  if (existsSync(provisionalTemp)) promoteProvisionalTemp(root, provisionalTemp, provisional);
  if (existsSync(provisional)) return resumeProvisional(root, options, provisional);
  const source = admittedProbe.source;
  const journal = bytes(join(root, "log")) ?? Buffer.alloc(0);
  const first = await options.probe(request);
  journalWithoutEffects(root, journal);
  if (!acceptedBefore) admittedAcceptance(workspace, options.operationId, options.acceptance, options, false);
  const completedProbe = admitCandidateRollbackProbe(
    workspace, options.operationId, options.bridgeDigest, request,
    admittedProbe.alreadyStarted ? 2 : 1, true,
  );
  if (!completedProbe.alreadyStarted) refuse("the first ordinary probe changed no admitted state");
  const open = ordinaryOpen(root, first, request, sha256(request));
  const probe = fileFacts(root);
  const record = provisionalRecord(options, source, probe, open);
  validateFinalProbe(record, options, completedProbe);
  writeProvisional(provisional, record, options.operationId);
  return resumeProvisional(root, options, provisional);
}

export function cleanupCandidateEvidence(workspace: string, operationId: string): void {
  const root = join(workspace, ".tenet");
  const evidenceDir = join(root, `migration-evidence-v2/${operationId}`);
  const acceptedPath = join(evidenceDir, "accepted.json");
  const finalPath = join(evidenceDir, "postcondition.json");
  const acceptedBytes = bytes(acceptedPath), finalBytes = bytes(finalPath);
  if (!acceptedBytes || !finalBytes) return refuse("cleanup requires durable acceptance and final postcondition");
  const accepted = RollbackTerminalAcceptedV2.parse(parseUniqueRecord(acceptedBytes.toString("utf8")));
  if (acceptedBytes.toString("utf8") !== canonicalCandidateRecord(accepted)) {
    refuse("the retained acceptance is not canonical");
  }
  const final = admittedPostcondition(finalPath);
  if (existsSync(join(evidenceDir, "source.json"))) {
    admittedAcceptance(workspace, operationId, sha256(acceptedBytes), {
      operationId,
      acceptance: sha256(acceptedBytes),
      terminal: accepted.terminal,
      evidence: accepted.evidence,
      snapshot: final.snapshot,
      bridgeDigest: accepted.bridgeDigest,
      probe: async () => refuse("cleanup cannot run an ordinary probe"),
    }, false);
  } else if (existsSync(join(evidenceDir, "evidence.json"))) {
    admitCandidateCleanupEvidence(workspace, operationId, {
      terminal: final.terminal,
      evidence: final.evidence,
      snapshot: final.snapshot,
      bridgeDigest: final.bridgeDigest,
      bindingDigest: accepted.bindingDigest,
    });
  }
  if (accepted.operationId !== operationId || final.operationId !== operationId ||
      sha256(acceptedBytes) !== final.acceptance) refuse("the retained acceptance and postcondition disagree");
  validateProbeFiles(root, final);
  const source = join(evidenceDir, "source.json");
  const target = join(evidenceDir, "target.json");
  const evidence = join(evidenceDir, "evidence.json");
  if (existsSync(evidence) && sha256(readFileSync(evidence)) !== final.evidence) {
    refuse("the retained evidence changed after success");
  }
  const present = [existsSync(source), existsSync(target), existsSync(evidence)];
  let remove: string | undefined;
  if (present.every(Boolean)) remove = source;
  else if (!present[0] && present[1] && present[2]) remove = target;
  else if (!present[0] && !present[1] && present[2]) {
    remove = evidence;
  } else if (present.some(Boolean)) refuse("the retained evidence is not an admitted cleanup prefix");
  if (remove) {
    unlinkSync(remove);
    syncCandidateDirectory(evidenceDir);
  }
}
