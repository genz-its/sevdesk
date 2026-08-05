import { describe, expect, it, vi } from 'vitest';
import { fetchAll } from '../src/pagination';

/** Serves `total` sequential numbers, honoring the requested limit and offset. */
function servePages(total: number) {
  return vi.fn(async ({ limit, offset }: { limit: number; offset: number }) =>
    Array.from(
      { length: Math.max(0, Math.min(limit, total - offset)) },
      (_, index) => offset + index,
    ),
  );
}

describe('fetchAll', () => {
  it('collects rows beyond the first page', async () => {
    const fetchPage = servePages(2500);

    const items = await fetchAll(fetchPage);

    expect(items).toHaveLength(2500);
    expect(items.at(-1)).toBe(2499);
    // The trailing request at 2500 is the empty page that confirms the end.
    expect(fetchPage.mock.calls.map(([page]) => page.offset)).toEqual([
      0, 1000, 2000, 2500,
    ]);
  });

  it('stops on an empty page rather than a short one', async () => {
    // A server that caps every page at 300 rows regardless of the limit asked
    // for would silently truncate a short-page termination.
    let served = 0;
    const fetchPage = vi.fn(async () => {
      const page = Array.from(
        { length: Math.min(300, 1000 - served) },
        () => 0,
      );
      served += page.length;
      return page;
    });

    const items = await fetchAll(fetchPage);

    expect(items).toHaveLength(1000);
  });

  it('requests only the remaining rows when there is no filter', async () => {
    const fetchPage = servePages(50);

    const items = await fetchAll(fetchPage, { limit: 5 });

    expect(items).toEqual([0, 1, 2, 3, 4]);
    expect(fetchPage.mock.calls[0]?.[0]).toEqual({ limit: 5, offset: 0 });
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('pages until the limit is met in kept rows', async () => {
    const fetchPage = servePages(5000);

    const items = await fetchAll(fetchPage, {
      limit: 3,
      keep: (value) => value % 1500 === 0,
    });

    expect(items).toEqual([0, 1500, 3000]);
    expect(fetchPage.mock.calls.map(([page]) => page.limit)).toEqual([
      1000, 1000, 1000, 1000,
    ]);
  });

  it('starts at the given offset', async () => {
    const fetchPage = servePages(1200);

    const items = await fetchAll(fetchPage, { offset: 1150 });

    expect(items).toEqual(
      Array.from({ length: 50 }, (_, index) => 1150 + index),
    );
  });
});
