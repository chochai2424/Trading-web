// Simple in-memory TTL cache shared across API routes. Survives for the
// lifetime of the server process, which is enough to stay well under
// Yahoo Finance rate limits.

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();
const pending = new Map<string, Promise<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  // De-duplicate concurrent requests for the same key
  const inFlight = pending.get(key);
  if (inFlight) return inFlight as Promise<T>;

  const promise = fetcher()
    .then((value) => {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => pending.delete(key));

  pending.set(key, promise);
  return promise;
}
