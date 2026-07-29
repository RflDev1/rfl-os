"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSection } from "@/features/admin/authorization";
import { auth } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { BetClosedError, BetFundsError, BetRateLimitError, MarketOperationError, placeBet, settleMarket } from "./betting.service";
import { marketOperationSchema, marketSchema, placeBetSchema } from "./betting.schema";

export type BetActionState = { success?: string; balance?: number; error?: string };

export async function placeBetAction(_: BetActionState, formData: FormData): Promise<BetActionState> {
  const session = await auth();
  if (!session?.user.id || session.user.status !== "ACTIVE" || !session.user.profileCompletedAt) return { error: "Sign in and finish your profile before betting." };
  if (!session.user.legalOnboardingComplete) return { error: "Confirm your birthday and accept the current policies before betting." };
  if (!session.user.wageringEligible) return { error: "Fight betting is available only to players age 18 or older." };
  const env = getEnv();
  const parsed = placeBetSchema(env.BET_MIN_WAGER, env.BET_MAX_WAGER).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your bet." };
  try {
    const bet = await placeBet({ userId: session.user.id, ...parsed.data, maxPlacementsPerMinute: env.BET_MAX_PLACEMENTS_PER_MINUTE });
    revalidatePath("/play");
    revalidatePath("/live");
    return { success: `Bet accepted. Possible return: ${bet.possiblePayout.toLocaleString()} Crowns.`, balance: bet.balanceAfter };
  } catch (error) {
    if (error instanceof BetFundsError) return { error: "You don’t have enough Crowns for that bet." };
    if (error instanceof BetClosedError) return { error: "Betting has closed for this fight." };
    if (error instanceof BetRateLimitError) return { error: "Too many bets at once. Try again in a moment." };
    return { error: "The bet could not be accepted. No Crowns were changed." };
  }
}

function adminRedirect(message: string, error = false): never {
  revalidatePath("/admin/betting");
  redirect(`/admin/betting?${error ? "error" : "notice"}=${encodeURIComponent(message)}`);
}

export async function saveMarketAction(formData: FormData) {
  const session = await requireAdminSection("BETTING");
  const parsed = marketSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) adminRedirect(parsed.error.issues[0]?.message ?? "Check the odds.", true);
  const fight = await prisma.fight.findUnique({ where: { id: parsed.data.fightId } });
  if (!fight || fight.status !== "SCHEDULED") adminRedirect("Markets can only be opened for scheduled fights.", true);
  await prisma.$transaction(async (tx) => {
    const market = await tx.betMarket.upsert({ where: { fightId: fight.id }, create: { fightId: fight.id, redOddsBps: parsed.data.redOdds, blueOddsBps: parsed.data.blueOdds }, update: { redOddsBps: parsed.data.redOdds, blueOddsBps: parsed.data.blueOdds } });
    if (market.status !== "OPEN") throw new MarketOperationError("Only open-market odds can be edited.");
    await tx.adminAuditEntry.create({ data: { actorId: session.user.id, action: "BET_MARKET_ODDS_SAVED", targetType: "BetMarket", targetId: market.id, summary: { redOddsBps: parsed.data.redOdds, blueOddsBps: parsed.data.blueOdds } } });
  }).catch((error) => { if (error instanceof MarketOperationError) adminRedirect(error.message, true); throw error; });
  revalidatePath(`/live/${fight.eventId}`);
  adminRedirect("Market odds saved.");
}

export async function operateMarketAction(formData: FormData) {
  const session = await requireAdminSection("BETTING");
  const parsed = marketOperationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) adminRedirect("Check the market operation.", true);
  try {
    if (parsed.data.operation === "SETTLE" || parsed.data.operation === "VOID") {
      await settleMarket({ marketId: parsed.data.marketId, actorId: session.user.id, void: parsed.data.operation === "VOID" });
    } else {
      const market = await prisma.betMarket.findUnique({ where: { id: parsed.data.marketId }, include: { fight: true } });
      if (!market) throw new MarketOperationError("Market not found.");
      if (parsed.data.operation === "REOPEN" && (market.status !== "LOCKED" || market.fight.status !== "SCHEDULED")) throw new MarketOperationError("Only a locked, scheduled market can reopen.");
      if (parsed.data.operation === "LOCK" && market.status !== "OPEN") throw new MarketOperationError("Only an open market can lock.");
      await prisma.$transaction([
        prisma.betMarket.update({ where: { id: market.id }, data: { status: parsed.data.operation === "LOCK" ? "LOCKED" : "OPEN" } }),
        prisma.adminAuditEntry.create({ data: { actorId: session.user.id, action: `BET_MARKET_${parsed.data.operation}`, targetType: "BetMarket", targetId: market.id, summary: { fightId: market.fightId } } }),
      ]);
    }
  } catch (error) {
    if (error instanceof MarketOperationError) adminRedirect(error.message, true);
    adminRedirect("The market operation could not be completed.", true);
  }
  revalidatePath("/live");
  adminRedirect(`Market ${parsed.data.operation.toLowerCase()} operation completed.`);
}
