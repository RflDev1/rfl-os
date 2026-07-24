import { describe, expect, it } from "vitest";
import { ranksEligible } from "./fight-requests.logic";

describe("fight request ranking eligibility", () => {
  it("allows rank 10 to challenge ranks 5 through 15 except self", () => {
    expect(ranksEligible(10, 5, 5)).toBe(true);
    expect(ranksEligible(10, 15, 5)).toBe(true);
    expect(ranksEligible(10, 10, 5)).toBe(false);
  });

  it("rejects fighters outside the rank window", () => {
    expect(ranksEligible(10, 4, 5)).toBe(false);
    expect(ranksEligible(10, 16, 5)).toBe(false);
  });
});
