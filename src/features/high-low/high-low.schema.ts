import { z } from "zod";

export function highLowActionSchema(minWager: number, maxWager: number) {
  return z.discriminatedUnion("intent", [
    z.object({ intent: z.literal("START"), wager: z.coerce.number().int().min(minWager).max(maxWager), idempotencyKey: z.string().uuid(), roundId: z.string().optional() }),
    z.object({ intent: z.enum(["HIGHER", "LOWER", "CASH_OUT"]), roundId: z.string().min(1), idempotencyKey: z.string().uuid(), wager: z.unknown().optional() }),
  ]);
}

