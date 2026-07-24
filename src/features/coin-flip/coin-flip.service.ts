import { randomInt } from "node:crypto";
import { Prisma, type CoinSide } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { coinFlipPayout } from "./coin-flip.logic";

export class CoinFlipFundsError extends Error {}
export class CoinFlipRateLimitError extends Error {}

export function secureCoinSide(): CoinSide {
  return randomInt(0, 2) === 0 ? "HEADS" : "TAILS";
}

export async function playCoinFlip(
  input: {
    userId: string;
    choice: CoinSide;
    wager: number;
    idempotencyKey: string;
    payoutBasisPoints: number;
    maxPlaysPerMinute: number;
  },
  randomSide: () => CoinSide = secureCoinSide,
) {
  const result = randomSide();
  const won = result === input.choice;
  const payout = won ? coinFlipPayout(input.wager, input.payoutBasisPoints) : 0;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${input.userId})) IS NULL AS "locked"`;
        const existing = await tx.coinFlipRound.findUnique({
          where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } },
        });
        if (existing) return { ...existing, replayed: true };

        const minuteAgo = new Date(Date.now() - 60_000);
        const recent = await tx.coinFlipRound.count({ where: { userId: input.userId, createdAt: { gt: minuteAgo } } });
        if (recent >= input.maxPlaysPerMinute) throw new CoinFlipRateLimitError("Coin Flip rate limit reached.");

        const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
        if (!wallet || wallet.balance < input.wager) throw new CoinFlipFundsError("Not enough Crowns.");

        const balanceAfterWager = wallet.balance - input.wager;
        const balanceAfter = balanceAfterWager + payout;
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: balanceAfter, version: { increment: 1 } },
        });
        const round = await tx.coinFlipRound.create({
          data: {
            userId: input.userId,
            choice: input.choice,
            result,
            wager: input.wager,
            payout,
            won,
            balanceAfter,
            payoutBasisPoints: input.payoutBasisPoints,
            idempotencyKey: input.idempotencyKey,
          },
        });
        await tx.walletEntry.create({
          data: {
            walletId: wallet.id,
            delta: -input.wager,
            balanceAfter: balanceAfterWager,
            reason: "COIN_FLIP_WAGER",
            referenceId: round.id,
            idempotencyKey: `${input.idempotencyKey}:wager`,
          },
        });
        if (payout > 0) {
          await tx.walletEntry.create({
            data: {
              walletId: wallet.id,
              delta: payout,
              balanceAfter,
              reason: "COIN_FLIP_WIN",
              referenceId: round.id,
              idempotencyKey: `${input.idempotencyKey}:win`,
            },
          });
        }
        return { ...round, replayed: false };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error instanceof CoinFlipFundsError || error instanceof CoinFlipRateLimitError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await prisma.coinFlipRound.findUnique({
          where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } },
        });
        if (existing) return { ...existing, replayed: true };
      }
      throw error;
    }
  }
  throw new Error("Coin Flip could not settle after retrying.");
}
