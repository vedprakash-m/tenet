import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { validate } = (await import(pathToFileURL(path.join(root, "src", "core", "schema.ts")).href)) as typeof import(
  "../../src/core/schema.js"
);
type SchemaName = Parameters<typeof validate>[0];
const schemaRoot = path.join(root, "kit", "schemas");
const fixtureRoot = path.join(root, "test", "schemas");
const schemaNames = [
  "assignment",
  "board",
  "bundle",
  "finding",
  "interview",
  "inventory",
  "lock",
  "manifest",
  "proof-card",
  "spec-front-matter",
  "tenet-yaml",
  "test-report",
] as const satisfies readonly SchemaName[];

test("all implemented schemas use the published 0.1 ID and 2020-12", async () => {
  for (const name of schemaNames) {
    const schema = JSON.parse(await readFile(path.join(schemaRoot, `${name}.json`), "utf8"));
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.equal(schema.$id, `https://vedprakash-m.github.io/tenet/schemas/0.1/${name}.json`);
  }
  const retained = JSON.parse(await readFile(path.join(schemaRoot, "packet.json"), "utf8"));
  assert.equal(retained.$id, "https://vedprakash-m.github.io/tenet/schemas/0.1/packet.json");
});

for (const name of schemaNames) {
  test(`${name} fixtures satisfy the fixture contract`, async () => {
    const directory = path.join(fixtureRoot, name);
    const files = (await readdir(directory)).sort();
    const valid = files.filter((file) => file.startsWith("valid-"));
    const invalid = files.filter((file) => !file.startsWith("valid-"));
    assert.ok(valid.length >= 2, `${name} needs at least two valid fixtures`);
    assert.ok(invalid.length >= 3, `${name} needs at least three invalid fixtures`);

    for (const file of valid) {
      const data = JSON.parse(await readFile(path.join(directory, file), "utf8"));
      assert.deepEqual(validate(name, data), { ok: true, errors: [] }, `${name}/${file}`);
    }
    for (const file of invalid) {
      const expectedKeyword = path.parse(file).name;
      const data = JSON.parse(await readFile(path.join(directory, file), "utf8"));
      const result = validate(name, data);
      assert.equal(result.ok, false, `${name}/${file}`);
      assert.ok(
        result.errors.some((error) => error.keyword === expectedKeyword),
        `${name}/${file} must fail with ${expectedKeyword}; got ${JSON.stringify(result.errors)}`,
      );
      for (const error of result.errors) {
        assert.match(error.pointer, /^(?:|\/(?:[^~]|~[01])*)$/);
      }
    }
  });
}

test("unknown keys are refused while x- extensions are accepted", async () => {
  const validPath = path.join(fixtureRoot, "finding", "valid-contract.json");
  const finding = JSON.parse(await readFile(validPath, "utf8"));
  assert.equal(validate("finding", { ...finding, "x-context": { trace: true } }).ok, true);
  assert.equal(
    validate("finding", { ...finding, unexpected: true }).errors[0]?.keyword,
    "additionalProperties",
  );
});

test("board accepts the alpha.0 subset without future fields", async () => {
  const board = JSON.parse(
    await readFile(path.join(fixtureRoot, "board", "valid-contract.json"), "utf8"),
  );
  assert.deepEqual(validate("board", board), { ok: true, errors: [] });
});

test("x- extensions do not produce generated index signatures", async () => {
  const generated = await readFile(path.join(root, "src", "types", "generated.ts"), "utf8");
  const finding = generated.slice(
    generated.indexOf("export type Finding ="),
    generated.indexOf("export type Interview ="),
  );
  assert.doesNotMatch(finding, /\[key: string\]/);
});

test.skip("pending: kit/schemas/agent-card.json", () => {
  throw new Error("The named needs do not define the agent card shape.");
});

test.skip("pending: kit/schemas/pack.json", () => {
  throw new Error("The named needs do not define the pack shape.");
});
