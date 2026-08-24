/**
 * Run an async mapper over an iterable with a bounded number in flight.
 *
 * Vendored rather than depended on: it is twenty lines, and the whole point of
 * this package is that a user can audit what runs on their machine.
 */
export const pMap = async <T, R>(
  items: readonly T[],
  mapper: (item: T, index: number) => Promise<R>,
  concurrency: number,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let next = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index] as T, index);
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, worker));
  return results;
};
