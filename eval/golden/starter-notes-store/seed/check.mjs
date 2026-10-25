import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "./src/notes.mjs";

const fresh = () => join(mkdtempSync(join(tmpdir(), "notes-")), "notes.json");

test("add then list", () => {
  const store = createStore(fresh());
  store.add("buy milk");
  assert.deepEqual(store.list().map((n) => n.text), ["buy milk"]);
});

test("notes are still there when the file is opened again", () => {
  const file = fresh();
  createStore(file).add("remember this");
  assert.deepEqual(createStore(file).list().map((n) => n.text), ["remember this"]);
});

test("empty text is refused", () => {
  assert.throws(() => createStore(fresh()).add(""));
});
