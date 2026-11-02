export function createReservations(initial){return {available:sku=>initial[sku],reserve(){throw new Error("not built")}};}
