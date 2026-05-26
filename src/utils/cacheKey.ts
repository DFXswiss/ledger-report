// Single version prefix for every localStorage entry the app writes. Bump
// when an on-disk cache schema changes so we don't read entries written by
// an older code path. Keep the prefix narrow — it's a free-form namespace,
// not a semantic version. Increment to v2:, v3: etc. on the next break.
export const CACHE_VERSION = "v1";

export function cacheKey(parts: ReadonlyArray<string | number>): string {
  return `${CACHE_VERSION}:${parts.join("-")}`;
}
