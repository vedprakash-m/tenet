import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import formatsModule from "ajv-formats";
import { parse } from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { validate } = (await import(pathToFileURL(path.join(root, "src", "core", "schema.ts")).href)) as typeof import(
  "../../src/core/schema.js"
);
type SchemaName = Parameters<typeof validate>[0];
const schemaRoot = path.join(root, "kit", "schemas");
const fixtureRoot = path.join(root, "test", "schemas");
const directSchemaNames = ["agent-card", "pack"] as const;
type DirectSchemaName = (typeof directSchemaNames)[number];
type SchemaResult = Awaited<ReturnType<typeof validate>>;
const directAjv = new Ajv2020({ allErrors: true, strict: true });
const addFormats = formatsModule as unknown as (instance: Ajv2020) => Ajv2020;
addFormats(directAjv);
const directValidators = new Map<DirectSchemaName, ValidateFunction>();

async function validateDirect(name: DirectSchemaName, data: unknown): Promise<SchemaResult> {
  let validator = directValidators.get(name);
  if (!validator) {
    const schema = JSON.parse(await readFile(path.join(schemaRoot, `${name}.json`), "utf8"));
    validator = directAjv.compile(schema);
    directValidators.set(name, validator);
  }
  const ok = validator(data);
  return ok
    ? { ok: true, errors: [] }
    : {
        ok: false,
        errors: (validator.errors ?? []).map((error) => ({
          pointer: error.instancePath,
          keyword: error.keyword,
          message: error.message ?? "Validation failed",
        })),
      };
}

async function assertFixtureContract(
  name: DirectSchemaName,
): Promise<void> {
  const directory = path.join(fixtureRoot, name);
  const files = (await readdir(directory)).sort();
  const valid = files.filter((file) => file.startsWith("valid-"));
  const invalid = files.filter((file) => !file.startsWith("valid-"));
  assert.ok(valid.length >= 2, `${name} needs at least two valid fixtures`);
  assert.ok(invalid.length >= 3, `${name} needs at least three invalid fixtures`);

  for (const file of valid) {
    const data = JSON.parse(await readFile(path.join(directory, file), "utf8"));
    assert.deepEqual(await validateDirect(name, data), { ok: true, errors: [] }, `${name}/${file}`);
  }
  for (const file of invalid) {
    const expectedKeyword = path.parse(file).name;
    const data = JSON.parse(await readFile(path.join(directory, file), "utf8"));
    const result = await validateDirect(name, data);
    assert.equal(result.ok, false, `${name}/${file}`);
    assert.ok(
      result.errors.some((error) => error.keyword === expectedKeyword),
      `${name}/${file} must fail with ${expectedKeyword}; got ${JSON.stringify(result.errors)}`,
    );
    for (const error of result.errors) {
      assert.match(error.pointer, /^(?:|\/(?:[^~]|~[01])*)$/);
    }
  }
}
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
  for (const name of [...schemaNames, ...directSchemaNames]) {
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
  const agentCard = generated.slice(
    generated.indexOf("export type AgentCard ="),
    generated.indexOf("export type Assignment ="),
  );
  const pack = generated.slice(
    generated.indexOf("export type Pack ="),
    generated.indexOf("export type Packet ="),
  );
  assert.doesNotMatch(agentCard, /\[key: string\]/);
  assert.doesNotMatch(pack, /\[key: string\]/);
});

test("kit/schemas/agent-card.json enforces fixtures and validates every agent card", async () => {
  await assertFixtureContract("agent-card");
  const creator = JSON.parse(
    await readFile(path.join(fixtureRoot, "agent-card", "valid-contract.json"), "utf8"),
  );
  assert.equal((await validateDirect("agent-card", { ...creator, criteria: [] })).ok, false);
  const critic = JSON.parse(
    await readFile(path.join(fixtureRoot, "agent-card", "valid-critic.json"), "utf8"),
  );
  const { criteria: _criteria, ...criticWithoutCriteria } = critic;
  assert.equal((await validateDirect("agent-card", criticWithoutCriteria)).ok, false);
  const agentRoot = path.join(root, "kit", "agents");
  const cards = (await readdir(agentRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();
  assert.ok(cards.length > 0, "at least one agent card is required");
  for (const card of cards) {
    const text = await readFile(path.join(agentRoot, card), "utf8");
    const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
    assert.ok(match, `${card} must have YAML front matter`);
    const frontMatter = parse(match[1]);
    assert.ok(
      frontMatter && typeof frontMatter === "object" && "kind" in frontMatter,
      `${card} front matter must have kind`,
    );
    assert.deepEqual(await validateDirect("agent-card", frontMatter), { ok: true, errors: [] }, card);
  }
});

test("kit/schemas/pack.json enforces fixtures and validates the minimal pack", async () => {
  await assertFixtureContract("pack");
  const pack = parse(
    await readFile(path.join(root, "kit", "packs", "minimal", "pack.yaml"), "utf8"),
  );
  assert.deepEqual(await validateDirect("pack", pack), { ok: true, errors: [] });
});
