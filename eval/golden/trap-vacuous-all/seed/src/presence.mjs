export function allPresent(requiredIds, rows) { return requiredIds.every(id => rows.some(row => row.id === id)); }
