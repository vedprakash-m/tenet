import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { ProtocolValidationError, readBoundedRegularFile, validateProtocolFile } from "../packages/eval/src/protocol.ts";
import { replayFixtureFile } from "../packages/eval/src/replay.ts";
import { createCampaignReport, renderCampaignReport } from "../packages/eval/src/report.ts";

function reportMain(args: string[]): number {
  const [inputOption, inputPath, formatOption, format, ...extra] = args;
  if (inputOption !== "--input" || !inputPath || formatOption !== "--format" || !format || extra.length > 0 ||
    (format !== "json" && format !== "markdown" && format !== "junit")) {
    process.stderr.write("Usage: npm run eval:report -- --input <path> --format json|markdown|junit\n");
    return 1;
  }
  try {
    const bytes = readBoundedRegularFile(inputPath, 10 * 1024 * 1024);
    const report = createCampaignReport(bytes);
    process.stdout.write(renderCampaignReport(report, format));
    return report.eligibility === "pass" ? 0 : 3;
  } catch (error) {
    const code = error instanceof ProtocolValidationError ? error.code : "invalid-report";
    process.stderr.write(`${JSON.stringify({ error: code })}\n`);
    return 2;
  }
}

function main(args: string[]): number {
  if (args[0] === "--input") return reportMain(args);
  const [option, path, ...extra] = args;
  if (extra.length > 0 || !path || (option !== "--protocol" && option !== "--capture")) {
    process.stderr.write("Usage: npm run eval:validate -- --protocol <path> | npm run eval:replay -- --capture <path>\n");
    return 1;
  }
  try {
    const result = option === "--protocol" ? validateProtocolFile(path) : replayFixtureFile(path);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    const code = error instanceof ProtocolValidationError ? error.code : option === "--protocol" ? "invalid-protocol" : "invalid-replay";
    process.stderr.write(`${JSON.stringify({ error: code })}\n`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}