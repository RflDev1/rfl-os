import { z } from "zod";

export function placeBetSchema(minStake: number, maxStake: number) {
  return z.object({
    marketId: z.string().cuid(),
    selection: z.enum(["RED", "BLUE"]),
    stake: z.coerce.number().int("Use whole Crowns.").min(minStake, `Minimum bet is ${minStake} Crowns.`).max(maxStake, `Maximum bet is ${maxStake} Crowns.`),
    idempotencyKey: z.string().min(8).max(200),
  });
}

export const marketSchema = z.object({
  fightId: z.string().cuid(),
  redOdds: z.coerce.number().min(1, "Red odds must be at least 1.00.").max(100).transform((value) => Math.round(value * 10_000)),
  blueOdds: z.coerce.number().min(1, "Blue odds must be at least 1.00.").max(100).transform((value) => Math.round(value * 10_000)),
});

export const marketOperationSchema = z.object({
  marketId: z.string().cuid(),
  operation: z.enum(["LOCK", "REOPEN", "SETTLE", "VOID"]),
});
