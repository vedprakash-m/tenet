export class MemoryJsonStore {
  #items = new Map();
  save(id, record) { this.#items.set(id, record); }
  get(id) { return this.#items.get(id) ?? null; }
  purge(id) { return this.#items.delete(id); }
}
