import type { TestReport } from "./types.js";

export type ReportReadOptions = {
  prefix?: string;
  cwd?: string;
};

export type ReportReaderResult = Omit<TestReport, "runner">;
export type ReportReader = (text: string, options: Required<Pick<ReportReadOptions, "prefix">> & ReportReadOptions) => ReportReaderResult;
