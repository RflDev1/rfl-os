import { describe, expect, it } from "vitest";
import { walletAdjustmentSchema } from "./admin.schema";

const valid = {
  userId: "player-id",
  delta: "250",
  note: "Correction approved by league operations.",
  idempotencyKey: "6c3c2fcf-45e2-4ff5-b567-16d7640db74e",
  confirmed: "on",
};

describe("walletAdjustmentSchema", () => {
  it("accepts an explicitly confirmed adjustment", () => expect(walletAdjustmentSchema.safeParse(valid).success).toBe(true));
  it("rejects zero or unconfirmed adjustments", () => {
    expect(walletAdjustmentSchema.safeParse({ ...valid, delta: 0 }).success).toBe(false);
    expect(walletAdjustmentSchema.safeParse({ ...valid, confirmed: undefined }).success).toBe(false);
  });
  it("requires an operator explanation", () => expect(walletAdjustmentSchema.safeParse({ ...valid, note: "fix" }).success).toBe(false));
});

