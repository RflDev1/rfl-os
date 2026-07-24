import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { nextUtcReward, utcRewardDate } from "./reward-date";

export class InsufficientCrownsError extends Error {}

export async function claimDailyReward(userId: string, amount: number, now = new Date()) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("Daily reward must be a positive integer.");
  const rewardDate = utcRewardDate(now);
  const key = `daily:${rewardDate.toISOString().slice(0, 10)}`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.dailyRewardClaim.findUnique({
          where: { userId_rewardDate: { userId, rewardDate } },
          include: { user: { include: { wallet: true } } },
        });
        if (existing) {
          return { claimed: false, amount: existing.amount, balance: existing.user.wallet?.balance ?? 0 };
        }

        const wallet = await tx.wallet.upsert({
          where: { userId },
          update: { balance: { increment: amount }, version: { increment: 1 } },
          create: { userId, balance: amount, version: 1 },
        });
        const claim = await tx.dailyRewardClaim.create({ data: { userId, rewardDate, amount } });
        await tx.walletEntry.create({
          data: {
            walletId: wallet.id,
            delta: amount,
            balanceAfter: wallet.balance,
            reason: "DAILY_REWARD",
            referenceId: claim.id,
            idempotencyKey: key,
          },
        });
        return { claimed: true, amount, balance: wallet.balance };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const claim = await prisma.dailyRewardClaim.findUnique({
          where: { userId_rewardDate: { userId, rewardDate } },
          include: { user: { include: { wallet: true } } },
        });
        if (claim) return { claimed: false, amount: claim.amount, balance: claim.user.wallet?.balance ?? 0 };
      }
      throw error;
    }
  }
  throw new Error("Daily reward could not be claimed after retrying.");
}

export async function getWalletSummary(userId: string, now = new Date()) {
  const rewardDate = utcRewardDate(now);
  const [wallet, todayClaim] = await Promise.all([
    prisma.wallet.findUnique({
      where: { userId },
      include: { entries: { orderBy: { createdAt: "desc" }, take: 8 } },
    }),
    prisma.dailyRewardClaim.findUnique({ where: { userId_rewardDate: { userId, rewardDate } } }),
  ]);
  return { wallet, claimedToday: Boolean(todayClaim), nextRewardAt: nextUtcReward(now) };
}

export async function adjustWallet(input: {
  actorId: string;
  userId: string;
  delta: number;
  note: string;
  idempotencyKey: string;
}) {
  if (!Number.isInteger(input.delta) || input.delta === 0) throw new Error("Adjustment must be a nonzero integer.");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
        if (!wallet) throw new Error("Wallet not found.");
        const existing = await tx.walletEntry.findUnique({
          where: { walletId_idempotencyKey: { walletId: wallet.id, idempotencyKey: input.idempotencyKey } },
        });
        if (existing) return { changed: false, balance: existing.balanceAfter };

        const rows = await tx.$queryRaw<Array<{ id: string; balance: number }>>`
          UPDATE "wallets"
          SET "balance" = "balance" + ${input.delta}, "version" = "version" + 1, "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = ${wallet.id} AND "balance" + ${input.delta} >= 0
          RETURNING "id", "balance"
        `;
        const changed = rows[0];
        if (!changed) throw new InsufficientCrownsError("Adjustment would make the wallet negative.");

        const entry = await tx.walletEntry.create({
          data: {
            walletId: wallet.id,
            delta: input.delta,
            balanceAfter: changed.balance,
            reason: "ADMIN_ADJUSTMENT",
            referenceId: input.actorId,
            idempotencyKey: input.idempotencyKey,
          },
        });
        await tx.adminAuditEntry.create({
          data: {
            actorId: input.actorId,
            action: "WALLET_ADJUSTED",
            targetType: "USER_WALLET",
            targetId: input.userId,
            summary: {
              delta: input.delta,
              balanceBefore: wallet.balance,
              balanceAfter: changed.balance,
              note: input.note,
              walletEntryId: entry.id,
            },
          },
        });
        return { changed: true, balance: changed.balance };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error instanceof InsufficientCrownsError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const wallet = await prisma.wallet.findUnique({ where: { userId: input.userId } });
        if (wallet) {
          const entry = await prisma.walletEntry.findUnique({
            where: { walletId_idempotencyKey: { walletId: wallet.id, idempotencyKey: input.idempotencyKey } },
          });
          if (entry) return { changed: false, balance: entry.balanceAfter };
        }
      }
      throw error;
    }
  }
  throw new Error("Wallet adjustment could not complete after retrying.");
}
