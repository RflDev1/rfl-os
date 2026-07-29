import { describe, expect, it } from "vitest";
import { canUseWagering, isAtLeastAge } from "./legal";

describe("age eligibility", () => {
  const now = new Date("2026-07-29T12:00:00.000Z");

  it("unlocks wagering on the eighteenth birthday", () => {
    expect(isAtLeastAge(new Date("2008-07-29T00:00:00.000Z"), 18, now)).toBe(true);
    expect(isAtLeastAge(new Date("2008-07-30T00:00:00.000Z"), 18, now)).toBe(false);
  });

  it("requires both current consent and age 18", () => {
    const consent = {
      dateOfBirth: new Date("2008-07-29T00:00:00.000Z"),
      termsAcceptedAt: now,
      termsVersion: "1.0-draft",
      privacyAcceptedAt: now,
      privacyVersion: "1.0-draft",
    };
    expect(canUseWagering(consent, now)).toBe(true);
    expect(canUseWagering({ ...consent, termsVersion: "old" }, now)).toBe(false);
  });
});
