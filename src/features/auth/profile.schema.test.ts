import { describe, expect, it } from "vitest";
import { profileSchema } from "./profile.schema";

describe("profileSchema", () => {
  const validProfile = {
    displayName: "Realm King",
    acceptedRules: "on",
    acceptedTerms: "on",
    acceptedPrivacy: "on",
    dateOfBirth: "2000-01-01",
  };

  it("accepts a clear player name and the Crown rule", () => {
    expect(profileSchema.safeParse(validProfile).success).toBe(true);
  });

  it.each(["ab", "a".repeat(25), "fighter<script>", "🔥🔥🔥"])(
    "rejects unsafe or invalid name %s",
    (displayName) => {
      expect(profileSchema.safeParse({ ...validProfile, displayName }).success).toBe(false);
    },
  );

  it("requires acknowledgment that Crowns have no cash value", () => {
    expect(profileSchema.safeParse({ ...validProfile, acceptedRules: undefined }).success).toBe(false);
  });

  it("requires current legal consent", () => {
    expect(profileSchema.safeParse({ ...validProfile, acceptedTerms: undefined }).success).toBe(false);
    expect(profileSchema.safeParse({ ...validProfile, acceptedPrivacy: undefined }).success).toBe(false);
  });

  it("rejects accounts younger than 13", () => {
    const thisYear = new Date().getUTCFullYear();
    expect(profileSchema.safeParse({ ...validProfile, dateOfBirth: `${thisYear - 5}-01-01` }).success).toBe(false);
  });
});
