// In-memory fixed-window rate limiter.
// Good for a single Render instance. If you scale to several instances,
// replace the Map with Redis (Upstash) - the interface stays the same.

const store = globalThis._nsRateStore || (globalThis._nsRateStore = new Map());

if (!globalThis._nsRateSweeper) {
  globalThis._nsRateSweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }, 60_000);
  globalThis._nsRateSweeper.unref?.();
}

export function checkRateLimit(key, limit, windowMs) {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  entry.count += 1;
  if (entry.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }
  return { ok: true, remaining: limit - entry.count, retryAfter: 0 };
}
