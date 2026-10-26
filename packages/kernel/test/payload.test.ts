import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { payloadChecksums, verifyPayload } from "../../../tools/payload.ts";
import { projectScratch } from "../../../tools/test-scratch.ts";

const roots: string[] = [];
const fixture = () => {
  const root = projectScratch("payload-fixture-");
  roots.push(root);
  mkdirSync(join(root, "nested"));
  writeFileSync(join(root, "NOTICE"), "notice\r\n");
  writeFileSync(join(root, "nested", "body.txt"), "body\n");
  return root;
};
const inventory = ["NOTICE", "nested/body.txt"];
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
after(() => roots.forEach(root => rmSync(root, { recursive: true, force: true })));

describe("complete payload checksums", () => {
  it("hashes exact bytes in canonical order, independent of inventory ordering and root location", () => {
    const expected = `${digest("notice\r\n")}  NOTICE\n${digest("body\n")}  nested/body.txt\n`;
    assert.equal(payloadChecksums(fixture(), inventory), expected);
    assert.equal(payloadChecksums(fixture(), [...inventory].reverse()), expected);
    assert.equal(expected.includes("\r"), false);
  });

  it("changes the checksum when payload bytes change", () => {
    const root = fixture();
    const before = payloadChecksums(root, inventory);
    writeFileSync(join(root, "nested", "body.txt"), "changed\n");
    assert.notEqual(payloadChecksums(root, inventory), before);
  });

  it("verifies only a complete, byte-exact checksum manifest and rejects changed payload bytes", () => {
    const root = fixture();
    assert.throws(() => verifyPayload(root, inventory), /ENOENT/);
    const sums = payloadChecksums(root, inventory);
    writeFileSync(join(root, "SHA256SUMS"), sums);
    assert.doesNotThrow(() => verifyPayload(root, inventory));
    for (const invalid of [sums.split("\n")[0] + "\n", sums.replace(/\n/g, "\r\n"), `${sums}${sums}`]) {
      writeFileSync(join(root, "SHA256SUMS"), invalid);
      assert.throws(() => verifyPayload(root, inventory), /payload checksum mismatch/);
    }
    writeFileSync(join(root, "SHA256SUMS"), sums);
    writeFileSync(join(root, "NOTICE"), "changed");
    assert.throws(() => verifyPayload(root, inventory), /payload checksum mismatch/);
  });

  it("excludes only the checksum manifest itself, including hidden payload files in admission", () => {
    const root = fixture();
    writeFileSync(join(root, "SHA256SUMS"), "old manifest\n");
    assert.equal(payloadChecksums(root, inventory).includes("SHA256SUMS"), false);
    writeFileSync(join(root, ".unexpected"), "not allowed");
    assert.throws(() => payloadChecksums(root, inventory), /unexpected payload file: \.unexpected/);
  });

  it("rejects missing and unexpected payload files", () => {
    const root = fixture();
    rmSync(join(root, "NOTICE"));
    assert.throws(() => payloadChecksums(root, inventory), /missing payload file: NOTICE/);
    writeFileSync(join(root, "NOTICE"), "notice");
    writeFileSync(join(root, "nested", "extra.txt"), "extra");
    assert.throws(() => payloadChecksums(root, inventory), /unexpected payload file: nested\/extra.txt/);
  });

  it("rejects malformed, duplicate, case-colliding and self-referential inventories", () => {
    const root = fixture();
    for (const value of [null, {}, [], ["NOTICE", "NOTICE"], ["NOTICE", "notice"], [1],
      ["/NOTICE"], ["C:/NOTICE"], ["../NOTICE"], ["nested/../NOTICE"], ["nested//body.txt"],
      ["nested\\body.txt"], ["./NOTICE"], ["NOTICE\n"], ["NOTICE."], ["SHA256SUMS"]]) {
      assert.throws(() => payloadChecksums(root, value), /invalid payload inventory/);
    }
  });

  it("rejects linked leaves, directories, roots and checksum metadata", () => {
    const root = fixture();
    const other = fixture();
    rmSync(join(root, "NOTICE"));
    symlinkSync(join(other, "NOTICE"), join(root, "NOTICE"));
    assert.throws(() => payloadChecksums(root, inventory), /linked payload path/);
    rmSync(join(root, "NOTICE"));
    writeFileSync(join(root, "NOTICE"), "notice");
    rmSync(join(root, "nested"), { recursive: true });
    symlinkSync(join(other, "nested"), join(root, "nested"), "junction");
    assert.throws(() => payloadChecksums(root, inventory), /linked payload path/);
    const linkedRoot = join(root, "linked-root");
    symlinkSync(other, linkedRoot, "junction");
    assert.throws(() => payloadChecksums(linkedRoot, inventory), /linked payload path/);
    symlinkSync(join(other, "NOTICE"), join(other, "SHA256SUMS"));
    assert.throws(() => payloadChecksums(other, inventory), /linked payload path/);
  });
});
