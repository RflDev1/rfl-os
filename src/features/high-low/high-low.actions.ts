"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { actHighLow, HighLowFundsError, HighLowMoveError, HighLowRateLimitError, publicHighLow, startHighLow } from "./high-low.service";
import { highLowActionSchema } from "./high-low.schema";

export type HighLowState = {
  roundId?: string; status?: "ACTIVE" | "SETTLED"; outcome?: string | null; currentCard?: string; step?: number;
  multiplierBps?: number; maxSteps?: number; wager?: number; payout?: number; balance?: number;
  history?: Array<{ card: string; correct: boolean }>; error?: string;
  higherNextBps?: number | null; lowerNextBps?: number | null;
};

export async function highLowAction(previous: HighLowState, formData: FormData): Promise<HighLowState> {
  const session = await auth();
  if (!session?.user.id || session.user.status !== "ACTIVE" || !session.user.profileCompletedAt) return { ...previous, error: "Sign in and finish your profile before playing." };
  if (!session.user.legalOnboardingComplete) return { ...previous, error: "Confirm your birthday and accept the current policies before playing." };
  if (!session.user.wageringEligible) return { ...previous, error: "Casino games are available only to players age 18 or older." };
  const env = getEnv();
  const parsed = highLowActionSchema(env.HIGH_LOW_MIN_WAGER, env.HIGH_LOW_MAX_WAGER).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ...previous, error: parsed.error.issues[0]?.message ?? "Check your action." };
  try {
    const round = parsed.data.intent === "START"
      ? await startHighLow({ userId: session.user.id, wager: parsed.data.wager, idempotencyKey: parsed.data.idempotencyKey, targetReturnBps: env.HIGH_LOW_TARGET_RETURN_BPS, maxSteps: env.HIGH_LOW_MAX_STEPS, maxRoundsPerMinute: env.HIGH_LOW_MAX_ROUNDS_PER_MINUTE })
      : await actHighLow({ userId: session.user.id, roundId: parsed.data.roundId, intent: parsed.data.intent, idempotencyKey: parsed.data.idempotencyKey });
    revalidatePath("/play");
    revalidatePath("/casino/high-low");
    return publicHighLow(round);
  } catch (error) {
    if (error instanceof HighLowFundsError) return { ...previous, error: "You don’t have enough Crowns for that wager." };
    if (error instanceof HighLowMoveError) return { ...previous, error: error.message };
    if (error instanceof HighLowRateLimitError) return { ...previous, error: "The deck needs a moment before another run." };
    return { ...previous, error: "The round couldn’t continue. No unresolved Crown change was made." };
  }
}
