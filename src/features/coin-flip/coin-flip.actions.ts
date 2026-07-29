"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { coinFlipSchema } from "./coin-flip.schema";
import { CoinFlipFundsError, CoinFlipRateLimitError, playCoinFlip } from "./coin-flip.service";

export type CoinFlipState = {
  roundId?: string;
  result?: "HEADS" | "TAILS";
  won?: boolean;
  wager?: number;
  payout?: number;
  balance?: number;
  error?: string;
};

export async function playCoinFlipAction(
  previousState: CoinFlipState,
  formData: FormData,
): Promise<CoinFlipState> {
  void previousState;
  const session = await auth();
  if (!session?.user.id || session.user.status !== "ACTIVE" || !session.user.profileCompletedAt) {
    return { error: "Sign in and finish your profile before playing." };
  }
  if (!session.user.legalOnboardingComplete) return { error: "Confirm your birthday and accept the current policies before playing." };
  if (!session.user.wageringEligible) return { error: "Casino games are available only to players age 18 or older." };
  const env = getEnv();
  const parsed = coinFlipSchema(env.COIN_FLIP_MIN_WAGER, env.COIN_FLIP_MAX_WAGER).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your wager." };

  try {
    const round = await playCoinFlip({
      userId: session.user.id,
      ...parsed.data,
      payoutBasisPoints: env.COIN_FLIP_PAYOUT_BPS,
      maxPlaysPerMinute: env.COIN_FLIP_MAX_PLAYS_PER_MINUTE,
    });
    revalidatePath("/");
    revalidatePath("/play");
    revalidatePath("/casino/coin-flip");
    return {
      roundId: round.id,
      result: round.result,
      won: round.won,
      wager: round.wager,
      payout: round.payout,
      balance: round.balanceAfter,
    };
  } catch (error) {
    if (error instanceof CoinFlipFundsError) return { error: "You don’t have enough Crowns for that wager." };
    if (error instanceof CoinFlipRateLimitError) return { error: "Take a breath—the table will be ready again in a moment." };
    return { error: "The flip couldn’t be settled. No Crowns were changed. Try again." };
  }
}
