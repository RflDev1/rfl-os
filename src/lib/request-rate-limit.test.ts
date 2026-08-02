import { beforeEach, describe, expect, it } from "vitest";
import { checkRequestRateLimit, clearRequestRateLimitsForTests } from "./request-rate-limit";

describe("request rate limiter", () => {
  beforeEach(clearRequestRateLimitsForTests);

  it("blocks requests above the configured window limit", () => {
    expect(checkRequestRateLimit("ip:one", 2, 60_000, 1_000).allowed).toBe(true);
    expect(checkRequestRateLimit("ip:one", 2, 60_000, 1_001).allowed).toBe(true);
    const blocked = checkRequestRateLimit("ip:one", 2, 60_000, 1_002);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBe(60);
  });

  it("opens a fresh window after expiry", () => {
    checkRequestRateLimit("ip:two", 1, 1_000, 5_000);
    expect(checkRequestRateLimit("ip:two", 1, 1_000, 5_500).allowed).toBe(false);
    expect(checkRequestRateLimit("ip:two", 1, 1_000, 6_000).allowed).toBe(true);
  });
});
