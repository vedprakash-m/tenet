Build a catalog and the borrow-return journey for a small library

Build src/library.mjs exporting createLibrary(books). Books have unique id, nonblank title and positive safe-integer copies; invalid catalogs throw code invalid. Return list(), borrow(member,bookId), returnLoan(member,loanId). list returns detached books sorted by id with available copies. borrow returns {id:"L1",member,bookId} with sequential IDs, rejects blank members (invalid), missing books (not-found), duplicate member/book loans (duplicate-loan), and exhausted stock (unavailable). Only that loan member can return it (forbidden otherwise); missing loans are not-found. Returned loans make copies available again. Inputs and returned objects must not mutate internal data.

Run node --test check.mjs. No dependencies are needed.
