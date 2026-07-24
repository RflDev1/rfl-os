import { z } from "zod";

export function blackjackActionSchema(minWager: number, maxWager: number) {
  return z.discriminatedUnion("intent", [
    z.object({
      intent: z.literal("START"),
      wager: z.coerce.number().int("Use whole Crowns.").min(minWager, `Minimum wager is ${minWager} Crowns.`).max(maxWager, `Maximum wager is ${maxWager} Crowns.`),
      idempotencyKey: z.string().uuid(),
      roundId: z.string().optional(),
    }),
    z.object({
      intent: z.enum(["HIT", "STAND", "DOUBLE"]),
      roundId: z.string().min(1),
      idempotencyKey: z.string().uuid(),
      wager: z.unknown().optional(),
    }),
  ]);
}

