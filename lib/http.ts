/** Edge caching for our API responses: 60 s fresh, then 60 s stale-while-revalidate. */
export function cacheHeaders(stale = false): Record<string, string> {
  return {
    // Stale data (the IEC is failing) is cached briefly so we retry soon.
    "Cache-Control": stale ? "public, s-maxage=15, stale-while-revalidate=60" : "public, s-maxage=60, stale-while-revalidate=60",
  };
}
