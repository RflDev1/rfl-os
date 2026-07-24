import { describe, expect, it } from "vitest";
import { nextUtcReward, utcRewardDate } from "./reward-date";

describe("daily reward dates", () => {
  it("normalizes eligibility to a UTC calendar day", () => {
    expect(utcRewardDate(new Date("2026-07-18T23:59:59-05:00")).toISOString()).toBe("2026-07-19T00:00:00.000Z");
  });

  it("returns the next UTC reset", () => {
    expect(nextUtcReward(new Date("2026-12-31T23:59:59Z")).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});
