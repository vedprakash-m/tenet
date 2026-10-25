// First draft: notes live in memory only.
export function createStore(file) {
  const notes = [];
  return {
    add(text) {
      const note = { id: notes.length + 1, text };
      notes.push(note);
      return note;
    },
    list() {
      return [...notes];
    },
  };
}
