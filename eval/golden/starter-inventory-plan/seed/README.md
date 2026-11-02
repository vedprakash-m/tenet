Build an inventory app as catalog, movement and reorder increments

Build an inventory app in three separately reviewed plan increments, whose outcomes name catalog, movements and report respectively. Record catalog -> movements -> report dependencies and finish each with its own check. src/catalog.mjs exports createCatalog(rows): detached SKU-sorted rows {sku,quantity,reorderAt}; reject blank/duplicate SKU and negative or non-safe-integer numeric fields with code invalid. src/movements.mjs exports applyMovements(catalog,movements): apply signed safe-integer deltas sequentially to a detached copy; reject missing SKU (not-found), negative resulting stock, noninteger delta or overflow (invalid), leaving input unchanged on all outcomes. src/report.mjs exports reorderReport(catalog): SKU-sorted {sku,quantity,needed} for quantity <= reorderAt, where needed=reorderAt+1-quantity. Demonstrate a movement changing the reorder report.

Run node --test check.mjs. No dependencies are needed.
