// Tenant and item identifiers may contain arbitrary letters.
export const cacheKey = (tenant, item) => tenant + item;
