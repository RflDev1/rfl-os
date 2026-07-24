import { z } from "zod";

export const walletAdjustmentSchema = z.object({
  userId: z.string().min(1),
  delta: z.coerce.number().int().min(-100_000).max(100_000).refine((value) => value !== 0, "Enter an amount other than zero."),
  note: z.string().trim().min(8, "Explain why this adjustment is needed.").max(240),
  idempotencyKey: z.string().uuid(),
  confirmed: z.literal("on", { error: "Confirm the adjustment before applying it." }),
});

