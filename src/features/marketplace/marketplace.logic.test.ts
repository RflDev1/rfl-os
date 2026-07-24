import { describe, expect, it } from "vitest";
import { sellerProceeds } from "./marketplace.logic";
import { listingSchema } from "./marketplace.schema";

describe("marketplace policy", () => {
  it("has a visible zero-fee launch policy", () => expect(sellerProceeds(275)).toEqual({ fee: 0, proceeds: 275 }));
  it("requires whole-Crown prices inside configured limits", () => {
    const schema = listingSchema(10, 1_000);
    expect(schema.safeParse({ cardInstanceId: "cm12345678901234567890123", price: 10 }).success).toBe(true);
    expect(schema.safeParse({ cardInstanceId: "cm12345678901234567890123", price: 10.5 }).success).toBe(false);
  });
});
