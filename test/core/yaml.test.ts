import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { readYaml } from "../../dist/core/yaml.js";
import { tmpRepo } from "../helpers/tmpRepo.ts";

test("readYaml parses ordinary and Unicode values", async () => {
  const repository = await tmpRepo("yaml");
  try {
    await repository.write("config.yml", "name: naïve façade\npaths:\n  - a b\n  - π\n");
    assert.deepEqual(await readYaml(path.join(repository.path, "config.yml")), {
      name: "naïve façade",
      paths: ["a b", "π"],
    });
  } finally {
    await repository.cleanup();
  }
});

test("readYaml rejects duplicate keys", async () => {
  const repository = await tmpRepo("yaml-duplicate");
  try {
    await repository.write("config.yml", "one: 1\none: 2\n");
    await assert.rejects(readYaml(path.join(repository.path, "config.yml")), /Map keys must be unique/);
  } finally {
    await repository.cleanup();
  }
});
