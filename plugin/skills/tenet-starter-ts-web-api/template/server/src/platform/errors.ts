// Problem-style JSON errors: a stable code and a human sentence, never a stack or SQL.
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, detail: string) {
    super(detail);
    this.status = status;
    this.code = code;
  }
}

export const problem = (status: number, code: string, detail: string | undefined, correlationId: string, instance?: string) => ({
  type: `urn:problem:${code}`, title: code.replaceAll("-", " "), status, ...(detail ? { detail } : {}), ...(instance ? { instance } : {}), correlationId,
});
