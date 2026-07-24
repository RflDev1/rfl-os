import { describe, expect, it } from "vitest";
import { coinFlipPayout, payoutLabel } from "./coin-flip.logic";
import { coinFlipSchema } from "./coin-flip.schema";

describe("Coin Flip rules", () => {
  it("calculates integer Crown payouts from basis points", () => {
    expect(coinFlipPayout(125, 20_000)).toBe(250);
    expect(payoutLabel(20_000)).toBe("2×");
  });
  it("enforces configured wager limits and whole Crowns", () => {
    const schema = coinFlipSchema(10, 1_000);
    const base = { choice: "HEADS", idempotencyKey: "6c3c2fcf-45e2-4ff5-b567-16d7640db74e" };
    expect(schema.safeParse({ ...base, wager: 10 }).success).toBe(true);
    expect(schema.safeParse({ ...base, wager: 9 }).success).toBe(false);
    expect(schema.safeParse({ ...base, wager: 10.5 }).success).toBe(false);
  });
});

