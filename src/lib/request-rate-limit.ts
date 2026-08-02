type WindowEntry = { count: number; resetAt: number };

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

const MAX_TRACKED_KEYS = 10_000;
const windows = new Map<string, WindowEntry>();

function prune(now: number) {
  for (const [key, entry] of windows) {
    if (entry.resetAt <= now) windows.delete(key);
  }
  while (windows.size >= MAX_TRACKED_KEYS) {
    const oldest = windows.keys().next().value as string | undefined;
    if (!oldest) break;
    windows.delete(oldest);
  }
}

export function checkRequestRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitDecision {
  let entry = windows.get(key);
  if (!entry || entry.resetAt <= now) {
    if (windows.size >= MAX_TRACKED_KEYS) prune(now);
    entry = { count: 0, resetAt: now + windowMs };
    windows.set(key, entry);
  }

  entry.count += 1;
  const allowed = entry.count <= limit;
  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

export function clearRequestRateLimitsForTests() {
  windows.clear();
}
