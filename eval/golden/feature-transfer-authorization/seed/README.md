Transfer balances with authoritative authorization and atomic cents

Add transfer(session,from,to,cents) to createAccounts(users,initial) in src/accounts.mjs, retaining balance(id). Transfers use positive safe-integer cents between distinct existing accounts. The sender owner or a user whose authoritative users-table role is admin may transfer; caller-supplied roles are ignored. Errors carry codes unauthenticated, not-found, forbidden, invalid (bad amount, same account or receiving overflow), or insufficient. Every refusal preserves both balances. Success returns {from,to,cents}. Initial users/accounts are valid.

Run node --test check.mjs. No dependencies are needed.
