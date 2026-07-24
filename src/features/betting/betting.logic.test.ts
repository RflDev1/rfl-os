import { describe, expect, it } from "vitest";
import { betPayout, oddsLabel } from "./betting.logic";
import { placeBetSchema } from "./betting.schema";

describe("fight betting rules", () => {
  it("snapshots fixed-odds total returns using whole Crowns", () => {
    expect(betPayout(100, 18_500)).toBe(185);
    expect(betPayout(33, 15_000)).toBe(49);
    expect(oddsLabel(18_500)).toBe("1.85");
  });

  it("validates selection, limits, and idempotency keys", () => {
    const schema = placeBetSchema(10, 1_000);
    const valid = { marketId: "cm12345678901234567890123", selection: "RED", stake: 10, idempotencyKey: "123e4567-e89b-42d3-a456-426614174000" };
    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse({ ...valid, stake: 9 }).success).toBe(false);
    expect(schema.safeParse({ ...valid, selection: "DRAW" }).success).toBe(false);
  });
});
