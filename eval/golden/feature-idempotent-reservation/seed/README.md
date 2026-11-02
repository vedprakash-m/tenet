Make stock reservations retry-safe with customer-scoped request keys

Add reserve(customer,sku,quantity,key) to createReservations(initialStock) in src/reservations.mjs, retaining available(sku). Initial stock is valid nonnegative integer stock keyed by SKU. A successful reservation returns {id:"R1",customer,sku,quantity} with sequential IDs and subtracts stock once. Repeating the same customer/key and same SKU/quantity returns that reservation without charging stock again. The same customer/key with different SKU or quantity throws code conflict. Keys are scoped by customer, with no delimiter collisions. Bad customer/key or nonpositive/non-safe-integer quantity gives invalid, unknown SKU not-found, insufficient stock unavailable. Failed requests consume neither stock, ID nor key. Returned records are detached.

Run node --test check.mjs. No dependencies are needed.
