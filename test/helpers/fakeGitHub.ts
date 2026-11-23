export type GitHubRequest = {
  method: string;
  path: string;
  body?: unknown;
};

export function fakeGitHub() {
  const requests: GitHubRequest[] = [];
  return {
    requests,
    request(method: string, requestPath: string, body?: unknown) {
      const entry: GitHubRequest =
        body === undefined ? { method, path: requestPath } : { method, path: requestPath, body };
      requests.push(entry);
      return { status: 200, data: { method, path: requestPath } };
    },
    reset() {
      requests.length = 0;
    },
  };
}
