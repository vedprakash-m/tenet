// Synthetic terminal publication under the real bundle's lock, not a migration implementation.
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const [bundle, point, ...args] = process.argv.slice(2), dir = join(process.cwd(), '.tenet');
const link = fs.linkSync;
const sync = () => {
 const fd = fs.openSync(dir, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
};
const replace = (name, text) => {
 const fd = fs.openSync(join(dir, `${name}.tmp`), 'wx', 0o600);
 try { fs.writeFileSync(fd, text); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
 fs.renameSync(join(dir, `${name}.tmp`), join(dir, name)); sync();
};
fs.linkSync = (from, to) => {
 link(from, to);
 if (String(to) !== join(dir, 'lock')) return;
 replace('migration-transition.json', '{}');
 if (point !== 'before-terminal') replace('migration-terminal.json', JSON.stringify({
  operationId: 'a'.repeat(32), protocolVersion: 1, versions: { from: 2, to: 1 },
  outcome: 'rolled-back', bindingDigest: 'b'.repeat(64),
 }));
 if (point === 'after-fence-removal') { fs.rmSync(join(dir, 'migration-transition.json')); sync(); }
 process.kill(process.pid, 'SIGKILL');
};
syncBuiltinESMExports();
process.argv = [process.execPath, bundle, ...args];
await import(pathToFileURL(bundle).href);
