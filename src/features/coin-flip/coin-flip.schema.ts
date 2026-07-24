import { z } from "zod";

export function coinFlipSchema(minWager: number, maxWager: number) {
  return z.object({
    choice: z.enum(["HEADS", "TAILS"]),
    wager: z.coerce.number().int("Use whole Crowns.").min(minWager, `Minimum wager is ${minWager} Crowns.`).max(maxWager, `Maximum wager is ${maxWager} Crowns.`),
    idempotencyKey: z.string().uuid(),
  });
}

