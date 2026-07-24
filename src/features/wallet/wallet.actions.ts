"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { claimDailyReward } from "./wallet.service";

export type RewardState = {
  claimed?: boolean;
  amount?: number;
  balance?: number;
  error?: string;
};

export async function claimDailyRewardAction(
  previousState: RewardState,
  formData: FormData,
): Promise<RewardState> {
  void previousState;
  void formData;
  const session = await auth();
  if (!session?.user.id || session.user.status !== "ACTIVE" || !session.user.profileCompletedAt) {
    return { error: "Sign in and finish your profile to claim this reward." };
  }

  try {
    const result = await claimDailyReward(session.user.id, getEnv().DAILY_REWARD_AMOUNT);
    revalidatePath("/");
    revalidatePath("/play");
    return result;
  } catch {
    return { error: "Your reward couldn’t be claimed. No Crowns were changed. Try again." };
  }
}
