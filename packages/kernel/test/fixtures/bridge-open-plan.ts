import childProcess from "node:child_process";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { pathToFileURL } from "node:url";

const [bundle, request] = [process.argv[2]!, process.argv[3]!];
const windowsDirectorySync = process.platform === "win32";
if (windowsDirectorySync) Object.defineProperty(process, "platform", { value: "linux" });
const fsync = fs.fsyncSync;
fs.fsyncSync = (fd) => {
  try { fsync(fd); }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (!windowsDirectorySync || (code !== "EPERM" && code !== "EINVAL") ||
        !fs.fstatSync(fd).isDirectory()) throw error;
  }
};
const rename = fs.renameSync;
fs.renameSync = (from, to) => {
  const source = String(from), target = String(to);
  if (process.env.TENET_BRIDGE_KILL === "after-accounting-before-state" &&
      source.endsWith("state.tmp") && /[/\\]\.tenet[/\\]state$/.test(target)) {
    process.kill(process.pid, "SIGKILL");
  }
  rename(from, to);
};
const execFile = childProcess.execFileSync;
childProcess.execFileSync = ((file, args, options) => {
  if (file === "ps" && Array.isArray(args) && args.some((arg) => String(arg).includes("lstart"))) {
    const index = args.indexOf("-p");
    const pid = Number(args[index + 1]);
    process.kill(pid, 0);
    return `candidate-windows-process-${pid}\n`;
  }
  return execFile(file, args as never, options as never);
}) as typeof childProcess.execFileSync;
syncBuiltinESMExports();
process.argv = [process.execPath, bundle, "open", "plan", "--request", request];
await import(pathToFileURL(bundle).href);
