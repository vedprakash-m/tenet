import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DirectoryIdentity,
  MarkerV3,
  markerBindingPayload,
  sameDirectoryIdentity,
} from "../src/core/marker-identity.ts";
import { createCandidateMarker } from "../src/adapters/marker-binding.ts";
import { readQualifiedDirectoryIdentity } from "../src/adapters/marker-identity-fs.ts";
import { KernelError } from "../src/core/errors.ts";
import type { MarkerBindingPort } from "../src/ports/types.ts";

const identity = (ino = "9007199254740992") => ({
  kind: "directory-v1",
  platform: "win32",
  architecture: "x64",
  filesystem: "ntfs",
  dev: "18446744073709551615",
  ino,
  birthNs: "1700000000000000000",
});

const marker = () => ({
  schema: 3,
  workspaceId: "ws_aaaaaaaaaa",
  tag: "abcd",
  nonce: "abcdefghijkl",
  dev: 18446744073709552000,
  ino: 9007199254740992,
  identity: identity(),
  binding: {
    kind: "none",
    reason: "host-storage-verified-absent",
    capability: "a".repeat(64),
  },
});

describe("marker identity records [CON-02, SEC-12]", () => {
  it("preserves bigint inode distinctions that collapse to the same Number", () => {
    const first = DirectoryIdentity.parse(identity("9007199254740992"));
    const second = DirectoryIdentity.parse(identity("9007199254740993"));
    assert.equal(Number(first.ino), Number(second.ino));
    assert.equal(sameDirectoryIdentity(first, second), false);
  });

  it("requires canonical lossless authoritative decimal identities", () => {
    for (const change of [
      { ino: 9007199254740992 },
      { ino: "09007199254740992" },
      { ino: "+9007199254740992" },
      { ino: "0" },
      { birthNs: "0" },
      { dev: `1${"0".repeat(40)}` },
    ]) assert.equal(DirectoryIdentity.safeParse({ ...identity(), ...change }).success, false, JSON.stringify(change));
  });

  it("requires every identity component to match exactly", () => {
    const first = DirectoryIdentity.parse(identity());
    for (const change of [
      { platform: "linux" },
      { architecture: "arm64" },
      { filesystem: "apfs" },
      { dev: "1" },
      { birthNs: "1700000000000000001" },
    ]) {
      const second = DirectoryIdentity.parse({ ...identity(), ...change });
      assert.equal(sameDirectoryIdentity(first, second), false);
    }
  });

  it("keeps numeric shadows but never serializes them as authoritative identity", () => {
    const parsed = MarkerV3.parse(marker());
    assert.equal(typeof parsed.dev, "number");
    assert.equal(typeof parsed.ino, "number");
    assert.equal(typeof parsed.identity.dev, "string");
    assert.equal(typeof parsed.identity.ino, "string");
    assert.deepEqual(markerBindingPayload(parsed), [
      "tenet-marker", 3, parsed.workspaceId, parsed.tag, parsed.nonce,
      parsed.identity.kind, parsed.identity.platform, parsed.identity.architecture,
      parsed.identity.filesystem, parsed.identity.dev, parsed.identity.ino,
      parsed.identity.birthNs, parsed.binding.kind === "host-key-v1" ? parsed.binding.keyId : null,
    ]);
  });

  it("strictly refuses unknown fields, duplicate JSON intent and malformed bindings", () => {
    assert.equal(MarkerV3.safeParse({ ...marker(), future: true }).success, false);
    assert.equal(MarkerV3.safeParse({ ...marker(), binding: { ...marker().binding, keyId: "a".repeat(24) } }).success, false);
    assert.equal(MarkerV3.safeParse({ ...marker(), binding: { kind: "host-key-v1", keyId: "A".repeat(24), authenticator: "a".repeat(64) } }).success, false);
  });
});

describe("candidate marker binding [CON-05, SEC-12]", () => {
  const rand = { base32: (length: number) => "a".repeat(length) };
  const payload = (status: ReturnType<MarkerBindingPort["status"]>): MarkerBindingPort => ({
    status: () => status,
    create: () => ({ keyId: "b".repeat(24), authenticator: "c".repeat(64) }),
    verify: () => "verified",
  });
  it("binds an available host and immediately verifies the exact payload", () => {
    const host = payload({ kind: "available", capabilityHash: "1".repeat(64) });
    let verified: unknown[] | undefined;
    host.verify = (_keyId, signed, _authenticator) => {
      verified = [...signed];
      return "verified";
    };
    const created = createCandidateMarker(DirectoryIdentity.parse(identity()), host, rand);
    assert.equal(created.binding.kind, "host-key-v1");
    assert.deepEqual(verified, markerBindingPayload(created));
  });

  it("records verified absence but never strengthens or invents a binding", () => {
    const host = payload({ kind: "absent", capabilityHash: "2".repeat(64) });
    host.create = () => assert.fail("an absent binding must not create a key");
    const created = createCandidateMarker(DirectoryIdentity.parse(identity()), host, rand);
    assert.deepEqual(created.binding, {
      kind: "none", reason: "host-storage-verified-absent", capability: "2".repeat(64),
    });
  });

  describe("directory identity admission [CON-02, CON-04]", () => {
    const qualification = {
      platform: "win32",
      architecture: "x64",
      filesystem: "ntfs",
      birthTimeSource: "native-birthtime-ns",
    } as const;
    const observed = {
      directory: true, symbolicLink: false, dev: 18446744073709551615n,
      ino: 9007199254740993n, birthNs: 1700000000000000000n,
    };

    it("reads and rechecks one exact bigint tuple", () => {
      let reads = 0;
      const value = readQualifiedDirectoryIdentity("fixture", qualification, () => {
        reads++;
        return observed;
      });
      assert.equal(reads, 2);
      assert.deepEqual(value, identity("9007199254740993"));
    });

    it("refuses a changed second observation without a rounded fallback", () => {
      let reads = 0;
      assert.throws(() => readQualifiedDirectoryIdentity("fixture", qualification, () => {
        reads++;
        return reads === 1 ? observed : { ...observed, birthNs: observed.birthNs + 1n };
      }), (error: unknown) => error instanceof KernelError && error.reasons[0]?.code === "marker-identity-unavailable");
    });

    for (const change of [
      { directory: false }, { symbolicLink: true }, { ino: 0n }, { birthNs: 0n },
    ]) {
      it(`refuses an inadmissible directory observation ${String(Object.keys(change)[0])}`, () => {
        assert.throws(() => readQualifiedDirectoryIdentity("fixture", qualification, () => ({ ...observed, ...change })),
          (error: unknown) => error instanceof KernelError && error.reasons[0]?.code === "marker-identity-unavailable");
      });
    }

    it("does not infer a qualified creation time from ctime or a nonzero wall-clock value", () => {
      assert.throws(() => readQualifiedDirectoryIdentity("fixture", {
        ...qualification, birthTimeSource: "ctime-ns",
      } as unknown as typeof qualification), (error: unknown) =>
        error instanceof KernelError && error.reasons[0]?.code === "marker-identity-unavailable");
    });
  });

  for (const status of [
    { kind: "unknown", detail: "not observed" },
    { kind: "unavailable", detail: "denied" },
  ] as const) {
    it(`fails closed for ${status.kind} binding`, () => {
      assert.throws(
        () => createCandidateMarker(DirectoryIdentity.parse(identity()), payload(status), rand),
        (error: unknown) => error instanceof KernelError && error.reasons[0]?.code === "marker-binding-unavailable",
      );
    });
  }

  it("does not publish a candidate when immediate verification fails", () => {
    const host = payload({ kind: "available", capabilityHash: "3".repeat(64) });
    host.verify = () => "invalid";
    assert.throws(
      () => createCandidateMarker(DirectoryIdentity.parse(identity()), host, rand),
      (error: unknown) => error instanceof KernelError && error.reasons[0]?.code === "marker-binding-unavailable",
    );
  });

  for (const operation of ["status", "create", "verify"] as const) {
    it(`maps ${operation} failure to marker-binding-unavailable without fallback`, () => {
      const host = payload({ kind: "available", capabilityHash: "4".repeat(64) });
      host[operation] = (() => { throw new Error("host operation failed"); }) as never;
      assert.throws(
        () => createCandidateMarker(DirectoryIdentity.parse(identity()), host, rand),
        (error: unknown) => error instanceof KernelError && error.reasons[0]?.code === "marker-binding-unavailable",
      );
    });
  }
});
