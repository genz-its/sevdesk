/**
 * Rows requested per page. The sevdesk API defaults to 100 when no `limit` is
 * sent, which is why an unpaginated list silently stops at 100 rows.
 */
const PAGE_SIZE = 1000;

export interface FetchAllOptions<T> {
  /** Maximum number of rows to return, counted after `keep`. */
  limit?: number;
  /** Number of rows to skip before the first page. */
  offset?: number;
  /** Client-side filter for endpoints whose own filters are unreliable. */
  keep?: (item: T) => boolean;
}

/**
 * Collects rows of a list endpoint across as many pages as needed.
 *
 * Paging stops on an empty page rather than a short one, so a server-side cap
 * on `limit` cannot truncate the result the way the API default does.
 */
export async function fetchAll<T>(
  fetchPage: (page: { limit: number; offset: number }) => Promise<T[]>,
  options: FetchAllOptions<T> = {},
): Promise<T[]> {
  const { limit, keep } = options;
  const items: T[] = [];
  let offset = options.offset ?? 0;
  while (limit === undefined || items.length < limit) {
    const page = await fetchPage({
      limit: pageSize(limit, items.length, keep),
      offset,
    });
    if (page.length === 0) {
      break;
    }
    offset += page.length;
    items.push(...(keep === undefined ? page : page.filter(keep)));
  }
  return limit === undefined ? items : items.slice(0, limit);
}

/**
 * Without a `keep` filter every row counts towards `limit`, so a small `limit`
 * only needs a correspondingly small page.
 */
function pageSize<T>(
  limit: number | undefined,
  collected: number,
  keep: FetchAllOptions<T>['keep'],
): number {
  if (limit === undefined || keep !== undefined) {
    return PAGE_SIZE;
  }
  return Math.min(limit - collected, PAGE_SIZE);
}
