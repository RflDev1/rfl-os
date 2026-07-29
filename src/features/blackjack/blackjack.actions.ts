"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { blackjackActionSchema } from "./blackjack.schema";
import { actBlackjack, BlackjackFundsError, BlackjackMoveError, BlackjackRateLimitError, publicRound, startBlackjack } from "./blackjack.service";

export type BlackjackState = {
  roundId?: string;
  status?: "ACTIVE" | "SETTLED";
  outcome?: string | null;
  playerCards?: string[];
  dealerCards?: Array<string | null>;
  playerTotal?: number;
  dealerTotal?: number;
  wager?: number;
  totalWager?: number;
  payout?: number;
  balance?: number;
  canDouble?: boolean;
  error?: string;
};

export async function blackjackAction(
  previousState: BlackjackState,
  formData: FormData,
): Promise<BlackjackState> {
  const session = await auth();
  if (!session?.user.id || session.user.status !== "ACTIVE" || !session.user.profileCompletedAt) {
    return { ...previousState, error: "Sign in and finish your profile before playing." };
  }
  if (!session.user.legalOnboardingComplete) return { ...previousState, error: "Confirm your birthday and accept the current policies before playing." };
  if (!session.user.wageringEligible) return { ...previousState, error: "Casino games are available only to players age 18 or older." };
  const env = getEnv();
  const parsed = blackjackActionSchema(env.BLACKJACK_MIN_WAGER, env.BLACKJACK_MAX_WAGER).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ...previousState, error: parsed.error.issues[0]?.message ?? "Check your action." };

  try {
    const round = parsed.data.intent === "START"
      ? await startBlackjack({
          userId: session.user.id,
          wager: parsed.data.wager,
          idempotencyKey: parsed.data.idempotencyKey,
          payoutBasisPoints: env.BLACKJACK_PAYOUT_BPS,
          blackjackPayoutBps: env.BLACKJACK_NATURAL_PAYOUT_BPS,
          maxRoundsPerMinute: env.BLACKJACK_MAX_ROUNDS_PER_MINUTE,
        })
      : await actBlackjack({
          userId: session.user.id,
          roundId: parsed.data.roundId,
          move: parsed.data.intent,
          idempotencyKey: parsed.data.idempotencyKey,
        });
    revalidatePath("/");
    revalidatePath("/play");
    revalidatePath("/casino/blackjack");
    return publicRound(round);
  } catch (error) {
    if (error instanceof BlackjackFundsError) return { ...previousState, error: "You don’t have enough Crowns for that action." };
    if (error instanceof BlackjackMoveError) return { ...previousState, error: error.message };
    if (error instanceof BlackjackRateLimitError) return { ...previousState, error: "The dealer needs a moment before opening another hand." };
    return { ...previousState, error: "The hand couldn’t continue. No unresolved Crown change was made." };
  }
}
