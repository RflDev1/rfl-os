import { describe, expect, it } from "vitest";
import { profileSchema } from "./profile.schema";

describe("profileSchema", () => {
  it("accepts a clear player name and the Crown rule", () => {
    expect(profileSchema.safeParse({ displayName: "Realm King", acceptedRules: "on" }).success).toBe(true);
  });

  it.each(["ab", "a".repeat(25), "fighter<script>", "🔥🔥🔥"])(
    "rejects unsafe or invalid name %s",
    (displayName) => {
      expect(profileSchema.safeParse({ displayName, acceptedRules: "on" }).success).toBe(false);
    },
  );

  it("requires acknowledgment that Crowns have no cash value", () => {
    expect(profileSchema.safeParse({ displayName: "Realm King" }).success).toBe(false);
  });
});

