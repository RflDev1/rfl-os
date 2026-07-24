import { Prisma, type BetSelection } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { betPayout } from "./betting.logic";

export class BetFundsError extends Error {}
export class BetClosedError extends Error {}
export class BetRateLimitError extends Error {}
export class MarketOperationError extends Error {}

export async function placeBet(input: { userId: string; marketId: string; selection: BetSelection; stake: number; idempotencyKey: string; maxPlacementsPerMinute: number }) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${input.userId})) IS NULL AS "locked"`;
        const existing = await tx.bet.findUnique({ where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } } });
        if (existing) return { ...existing, replayed: true };
        const market = await tx.betMarket.findUnique({ where: { id: input.marketId }, include: { fight: { include: { event: true } } } });
        if (!market || market.status !== "OPEN" || market.fight.status !== "SCHEDULED") throw new BetClosedError("Betting is closed for this fight.");
        const closesAt = market.fight.scheduledAt ?? market.fight.event.startsAt;
        if (closesAt <= new Date()) throw new BetClosedError("Betting is closed for this fight.");
        const recent = await tx.bet.count({ where: { userId: input.userId, createdAt: { gt: new Date(Date.now() - 60_000) } } });
        if (recent >= input.maxPlacementsPerMinute) throw new BetRateLimitError("Bet placement rate limit reached.");
        const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
        if (!wallet || wallet.balance < input.stake) throw new BetFundsError("Not enough Crowns.");
        const acceptedOddsBps = input.selection === "RED" ? market.redOddsBps : market.blueOddsBps;
        const possiblePayout = betPayout(input.stake, acceptedOddsBps);
        const balanceAfter = wallet.balance - input.stake;
        const bet = await tx.bet.create({ data: { userId: input.userId, marketId: market.id, selection: input.selection, stake: input.stake, acceptedOddsBps, possiblePayout, balanceAfter, idempotencyKey: input.idempotencyKey } });
        await tx.wallet.update({ where: { id: wallet.id }, data: { balance: balanceAfter, version: { increment: 1 } } });
        await tx.walletEntry.create({ data: { walletId: wallet.id, delta: -input.stake, balanceAfter, reason: "BET_WAGER", referenceId: bet.id, idempotencyKey: `${input.idempotencyKey}:wager` } });
        return { ...bet, replayed: false };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error instanceof BetFundsError || error instanceof BetClosedError || error instanceof BetRateLimitError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await prisma.bet.findUnique({ where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } } });
        if (existing) return { ...existing, replayed: true };
      }
      throw error;
    }
  }
  throw new Error("Bet could not be placed after retrying.");
}

async function settleMarketOnce(input: { marketId: string; actorId: string; void: boolean }) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${input.marketId})) IS NULL AS "locked"`;
    const market = await tx.betMarket.findUnique({ where: { id: input.marketId }, include: { fight: true, bets: { where: { status: "PENDING" }, orderBy: { createdAt: "asc" } } } });
    if (!market) throw new MarketOperationError("Market not found.");
    if (market.status === "SETTLED" || market.status === "VOID") return { market, replayed: true };
    if (!input.void && (market.fight.status !== "COMPLETED" || !["RED_WIN", "BLUE_WIN"].includes(market.fight.result ?? ""))) throw new MarketOperationError("Record a red or blue winner before settlement.");
    const winner: BetSelection | null = input.void ? null : market.fight.result === "RED_WIN" ? "RED" : "BLUE";
    const settledAt = new Date();
    for (const bet of market.bets) {
      const won = winner !== null && bet.selection === winner;
      const payout = input.void ? bet.stake : won ? bet.possiblePayout : 0;
      const status = input.void ? "VOID" : won ? "WON" : "LOST";
      if (payout > 0) {
        const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: bet.userId } });
        const balanceAfter = wallet.balance + payout;
        await tx.wallet.update({ where: { id: wallet.id }, data: { balance: balanceAfter, version: { increment: 1 } } });
        await tx.walletEntry.create({ data: { walletId: wallet.id, delta: payout, balanceAfter, reason: input.void ? "BET_REFUND" : "BET_PAYOUT", referenceId: bet.id, idempotencyKey: `bet:${bet.id}:${input.void ? "refund" : "payout"}` } });
        await tx.bet.update({ where: { id: bet.id }, data: { status, payout, balanceAfter, settledAt } });
      } else {
        await tx.bet.update({ where: { id: bet.id }, data: { status, settledAt } });
      }
    }
    const updated = await tx.betMarket.update({ where: { id: market.id }, data: { status: input.void ? "VOID" : "SETTLED", settledAt, settledById: input.actorId } });
    await tx.adminAuditEntry.create({ data: { actorId: input.actorId, action: input.void ? "BET_MARKET_VOIDED" : "BET_MARKET_SETTLED", targetType: "BetMarket", targetId: market.id, summary: { fightId: market.fightId, bets: market.bets.length, result: market.fight.result } } });
    return { market: updated, replayed: false };
  }, { isolationLevel: "Serializable" });
}

export async function settleMarket(input: { marketId: string; actorId: string; void: boolean }) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await settleMarketOnce(input);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("Market could not settle after retrying.");
}
