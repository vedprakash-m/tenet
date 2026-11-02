export function allPresent(requiredIds, rows) { return requiredIds.length > 0 && requiredIds.every(id => rows.some(row => row.id === id)); }
