Import a contact batch atomically after normalization and conflict checks

Add importRows(batch) to createDirectory(initial) in src/directory.mjs, retaining list(). Accept an array of {name,email}; trim names, trim/lowercase emails, reject blank names and addresses lacking exactly one nonempty whitespace-free local/domain part (code invalid). Existing initial records are canonical and valid. A normalized email already in the directory or repeated in one batch gives code conflict. Validate the WHOLE batch before changing anything: every refused import preserves all existing rows and adds none. Return the count imported. list() sorts by email and returns detached rows; constructor/import inputs remain detached.

Run node --test check.mjs. No dependencies are needed.
