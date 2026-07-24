import { describe, expect, it } from "vitest";
import { blackjackActionSchema } from "./blackjack.schema";

const key = "6c3c2fcf-45e2-4ff5-b567-16d7640db74e";

describe("Blackjack action validation", () => {
  const schema = blackjackActionSchema(10, 1_000);
  it("validates opening wagers", () => {
    expect(schema.safeParse({ intent: "START", wager: 10, idempotencyKey: key }).success).toBe(true);
    expect(schema.safeParse({ intent: "START", wager: 9, idempotencyKey: key }).success).toBe(false);
  });
  it("requires a round for player moves", () => {
    expect(schema.safeParse({ intent: "HIT", roundId: "round", idempotencyKey: key }).success).toBe(true);
    expect(schema.safeParse({ intent: "STAND", idempotencyKey: key }).success).toBe(false);
  });
});

