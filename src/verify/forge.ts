import { bundleLimit, readArtifact, type BundleData } from "./bundle.js";

export type PullRequest = { number: number; body: string; head: string; base: string };
export type WorkflowRun = {
  id: string; attempt: number; workflow: string; head: string; repository: string; startedAt: string;
};
export type Conclusion = "success" | "neutral" | "failure";
export type Downloaded = { total: number; missing: number; bundles: BundleData[]; expiredAt?: string };
export interface ForgeAdapter {
  findPullRequests(head: string): Promise<PullRequest[]>;
  getPullRequest(number: number): Promise<PullRequest>;
  upsertCheckRun(check: { head: string; conclusion: Conclusion; summary: string }): Promise<void>;
  downloadBundles(run: WorkflowRun): Promise<Downloaded>;
  latestRun(head: string, workflow: string): Promise<WorkflowRun | null>;
}
export type ForgeRequest = (method: string, resource: string, body?: unknown) => Promise<{ status: number; data: unknown }>;

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}
function text(value: unknown): string { return typeof value === "string" ? value : ""; }

export function workflowRun(value: unknown): WorkflowRun {
  const raw = object(value);
  const repo = object(raw.repository);
  const id = raw.id;
  const attempt = raw.run_attempt;
  const workflow = text(raw.name);
  const head = text(raw.head_sha);
  const repository = text(repo.full_name);
  const startedAt = text(raw.run_started_at) || text(raw.created_at);
  if (typeof id !== "number" && typeof id !== "string" || !/^\d+$/.test(String(id)) ||
    typeof attempt !== "number" || !Number.isInteger(attempt) || attempt < 1 ||
    !workflow || !/^[a-f0-9]{40,64}$/.test(head) || !repository || !Number.isFinite(Date.parse(startedAt))) {
    throw new Error("invalid workflow run metadata");
  }
  return { id: String(id), attempt, workflow, head, repository, startedAt };
}

function pullRequest(value: unknown): PullRequest {
  const raw = object(value);
  const head = text(object(raw.head).sha);
  const base = text(object(raw.base).sha);
  const number = raw.number;
  if (typeof number !== "number" || !Number.isSafeInteger(number) || number < 1 ||
      !/^[a-f0-9]{40,64}$/.test(head) || !/^[a-f0-9]{40,64}$/.test(base)) throw new Error("invalid pull request metadata");
  return { number, head, base, body: text(raw.body) };
}

export class GitHubForge implements ForgeAdapter {
  private readonly prefix: string;
  constructor(private readonly repository: string, private readonly request: ForgeRequest) {
    const parts = repository.split("/");
    if (parts.length !== 2 || parts.some((part) => !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(part))) {
      throw new Error("invalid GitHub repository");
    }
    this.prefix = `/repos/${repository}`;
  }

  private async call(method: string, resource: string, body?: unknown): Promise<unknown> {
    const response = await this.request(method, this.prefix + resource, body);
    if (response.status < 200 || response.status >= 300) throw new Error(`GitHub returned ${response.status}`);
    return response.data;
  }

  private async pages(resource: string, key?: string): Promise<unknown[]> {
    const result: unknown[] = [];
    for (let page = 1; ; page += 1) {
      const response = await this.call("GET", `${resource + (resource.includes("?") ? "&" : "?")}per_page=100&page=${page}`);
      const entries = key ? object(response)[key] : response;
      if (!Array.isArray(entries)) throw new Error("GitHub returned an invalid list");
      result.push(...entries);
      if (entries.length < 100) return result;
    }
  }

  async findPullRequests(head: string): Promise<PullRequest[]> {
    return (await this.pages("/pulls?state=open")).map(pullRequest).filter((pr) => pr.head === head);
  }

  async getPullRequest(number: number): Promise<PullRequest> {
    if (!Number.isSafeInteger(number) || number < 1) throw new Error("invalid pull request number");
    return pullRequest(await this.call("GET", `/pulls/${number}`));
  }

  async upsertCheckRun(check: { head: string; conclusion: Conclusion; summary: string }): Promise<void> {
    const runs = await this.pages(`/commits/${encodeURIComponent(check.head)}/check-runs?check_name=Tenet&filter=all`, "check_runs");
    const existing = runs.map(object).find((entry) => entry.name === "Tenet" && entry.head_sha === check.head && typeof entry.id === "number");
    const body = { name: "Tenet", status: "completed", conclusion: check.conclusion, output: { title: "Tenet", summary: check.summary } };
    if (existing) await this.call("PATCH", `/check-runs/${String(existing.id)}`, body);
    else await this.call("POST", "/check-runs", { ...body, head_sha: check.head });
  }

  async latestRun(head: string, workflow: string): Promise<WorkflowRun | null> {
    const candidates = (await this.pages(`/actions/runs?head_sha=${encodeURIComponent(head)}&status=completed`, "workflow_runs"))
      .filter((row) => object(row).name === workflow).map(workflowRun)
      .filter((run) => run.head === head && run.repository === this.repository);
    return candidates.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt) || b.attempt - a.attempt)[0] ?? null;
  }

  async downloadBundles(run: WorkflowRun): Promise<Downloaded> {
    if (run.repository !== this.repository || !/^\d+$/.test(run.id)) throw new Error("workflow belongs to another repository");
    const entries = (await this.pages(`/actions/runs/${run.id}/artifacts`, "artifacts"))
      .map(object).filter((entry) => text(entry.name).startsWith("tenet-bundle-"));
    const result: Downloaded = { total: entries.length, missing: 0, bundles: [] };
    for (const artifact of entries) {
      if (artifact.expired === true) {
        result.missing += 1;
        const expiry = text(artifact.created_at);
        if (Number.isFinite(Date.parse(expiry))) result.expiredAt = expiry.slice(0, 10);
        continue;
      }
      if (typeof artifact.id !== "number" || !Number.isSafeInteger(artifact.id) || artifact.id < 1 ||
          typeof artifact.size_in_bytes !== "number" || artifact.size_in_bytes > bundleLimit) throw new Error("invalid artifact metadata or size");
      let buffer: Buffer | undefined;
      for (let attempt = 0; attempt < 3 && !buffer; attempt += 1) {
        try {
          const raw = await this.call("GET", `/actions/artifacts/${artifact.id}/zip`);
          if (Buffer.isBuffer(raw)) buffer = raw;
        } catch (error) {
          if (error instanceof RangeError) throw error;
        }
      }
      if (!buffer) { result.missing += 1; continue; }
      result.bundles.push(readArtifact(buffer));
    }
    return result;
  }
}

export function githubRequest(token: string, server = "https://api.github.com", fetcher: typeof fetch = fetch): ForgeRequest {
  const root = new URL(server);
  if (root.protocol !== "https:" || root.username || root.password) throw new Error("invalid GitHub API endpoint");
  return async (method, resource, body) => {
    const url = new URL(root.href.replace(/\/$/, "") + resource);
    const headers = { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json" };
    let response = await fetcher(url, { method, headers, redirect: "manual",
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30_000),
    });
    const artifact = resource.endsWith("/zip");
    if (artifact && response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("GitHub did not return an artifact location");
      const download = new URL(location, url);
      if (download.protocol !== "https:" || download.username || download.password) throw new Error("invalid artifact download URL");
      response = await fetcher(download, { redirect: "error", signal: AbortSignal.timeout(30_000) });
    }
    if (!response.ok) return { status: response.status, data: null };
    if (!artifact) return { status: response.status, data: await response.json() };
    const chunks: Buffer[] = [];
    let bytes = 0;
    if (!response.body) throw new Error("artifact response is empty");
    const reader = response.body.getReader();
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        bytes += next.value.length;
        if (bytes > bundleLimit) { await reader.cancel(); throw new RangeError("artifact exceeds 50 MB"); }
        chunks.push(Buffer.from(next.value));
      }
    } finally { reader.releaseLock(); }
    return { status: response.status, data: Buffer.concat(chunks) };
  };
}
