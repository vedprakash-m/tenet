import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseIndexRecords } from "../src/adapters/git-index-records.ts";
import { KernelError } from "../src/core/errors.ts";

const oid = "a".repeat(40);
const record = (path: string, stage = 0, mode = "100644") => `${mode} ${oid} ${stage}\t${path}\0`;
const refused = (value: string | Buffer) => assert.throws(() => parseIndexRecords(value),
  error => error instanceof KernelError && error.exit === 2 && error.reasons[0]?.code === "capability-missing");

describe("strict Git index records", () => {
  it("uses exact path plus stage identity and keeps valid conflicts unresolved [GIT-03, SEC-06]", () => {
    const records = parseIndexRecords(record("file", 1) + record("file", 2) + record("file", 3)
      + record("Private/file") + record("private/file"));
    assert.deepEqual([...records.unmerged], ["file"]);
    assert.deepEqual([...records.entries.keys()], ["Private/file", "private/file"]);
    assert.equal(JSON.stringify([...records.entries]).includes('"file"'), false);
    for (const invalid of [record("file") + record("file"), record("file", 1) + record("file", 1),
      record("file", 1) + record("file"), record("file") + record("file", 2)]) refused(invalid);
  });

  it("strictly decodes UTF-8 without coalescing valid replacement characters [SEC-06, SEC-11]", () => {
    const valid = parseIndexRecords(Buffer.from(record("\ufffd") + record("café") + record("cafe\u0301")));
    assert.deepEqual([...valid.entries.keys()], ["\ufffd", "café", "cafe\u0301"]);
    refused(Buffer.concat([Buffer.from(record("valid")), Buffer.from(`100644 ${oid} 0\t`), Buffer.from([255, 0])]));
    assert.deepEqual([...parseIndexRecords(record("\ufeffname")).entries.keys()], ["\ufeffname"]);
  });

  it("refuses malformed framing, mode, OID, stage and non-relative path records [SEC-06, GIT-03]", () => {
    for (const invalid of [record("file").slice(0, -1), record("file") + "\0", record("file", 4),
      record("file", 0, "100664"), record("../file"), record("/file"), record(""), record("file").replace(oid, "g".repeat(40))])
      refused(invalid);
    assert.equal(parseIndexRecords("").entries.size, 0);
    const names = [":path", "[path]", "*path", "?path", "\\path", "-path", "tab\tpath", "line\npath"];
    assert.deepEqual([...parseIndexRecords(names.map(path => record(path)).join("")).entries.keys()], names);
  });
});
