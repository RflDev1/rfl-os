import { describe, expect, it } from "vitest";
import { moderateListingSchema, userRoleSchema, userStatusSchema } from "./operations.schema";

const userId = "cm12345678901234567890123";

describe("high-impact admin confirmation", () => {
  it("requires a meaningful reason and exact confirmation for suspension", () => {
    expect(userStatusSchema.safeParse({ userId, status: "SUSPENDED", reason: "Repeated abuse confirmed by review.", confirmation: "CONFIRM" }).success).toBe(true);
    expect(userStatusSchema.safeParse({ userId, status: "SUSPENDED", reason: "bad", confirmation: "CONFIRM" }).success).toBe(false);
    expect(userStatusSchema.safeParse({ userId, status: "SUSPENDED", reason: "Repeated abuse confirmed by review.", confirmation: "yes" }).success).toBe(false);
  });

  it("protects role and marketplace moderation inputs", () => {
    expect(userRoleSchema.safeParse({ userId, role: "ADMIN", operation: "GRANT", reason: "Promoted for league operations coverage.", confirmation: "CONFIRM" }).success).toBe(true);
    expect(moderateListingSchema.safeParse({ listingId: userId, reason: "Listing violates collectible conduct policy.", confirmation: "CONFIRM" }).success).toBe(true);
  });
});
