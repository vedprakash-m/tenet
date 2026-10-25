import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

const MAX = 280;

function load(file) {
  if (!existsSync(file)) return [];
  const data = JSON.parse(readFileSync(file, "utf8")); // a damaged file throws here and is never replaced
  if (!Array.isArray(data)) throw new Error("the notes file does not hold a list");
  return data;
}

function save(file, notes) {
  writeFileSync(`${file}.tmp`, JSON.stringify(notes));
  renameSync(`${file}.tmp`, file);
}

export function createStore(file) {
  const notes = load(file);
  return {
    add(text) {
      if (typeof text !== "string" || text.trim() === "" || text.length > MAX) throw new Error(`note text must be 1-${MAX} characters`);
      const note = { id: notes.reduce((m, n) => Math.max(m, n.id), 0) + 1, text };
      notes.push(note);
      save(file, notes);
      return note;
    },
    list() {
      return notes.map((n) => ({ ...n }));
    },
  };
}
