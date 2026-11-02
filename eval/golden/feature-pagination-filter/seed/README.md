Add filtered keyset pagination without skipping sparse ticket IDs

Implement listTickets(tickets,{status,after=0,limit=20}={}) in src/tickets.mjs. Tickets have unique positive safe-integer IDs and status open or closed. Filter optional status and IDs strictly greater than after BEFORE sorting ascending and taking limit. Return detached items and nextCursor: the last returned ID only when another matching row remains, otherwise null. Cursor IDs need not exist and IDs may be sparse. Input order and records remain unchanged. Reject unknown status, negative/non-safe-integer after, and limits outside integer 1..100 with code invalid.

Run node --test check.mjs. No dependencies are needed.
