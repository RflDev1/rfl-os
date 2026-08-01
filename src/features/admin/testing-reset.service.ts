import { prisma } from "@/lib/prisma";

const TESTING_RESET_LOCK = 8_734_102;

export async function resetTestingData(ownerUserId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${TESTING_RESET_LOCK})`;

    const owner = await tx.user.findUnique({ where: { id: ownerUserId }, select: { id: true } });
    if (!owner) throw new Error("Owner account not found.");

    const removedUsers = await tx.user.count({ where: { id: { not: ownerUserId } } });
    const removedFighters = await tx.fighter.count();
    const removedFights = await tx.fight.count();

    await tx.marketSale.deleteMany();
    await tx.marketListing.deleteMany();
    await tx.cardInstance.deleteMany();
    await tx.packOpening.deleteMany();

    await tx.discordNotification.deleteMany();
    await tx.fightRequest.deleteMany();
    await tx.bet.deleteMany();
    await tx.betMarket.deleteMany();
    await tx.fightUpdate.deleteMany();
    await tx.fight.deleteMany();
    await tx.event.deleteMany();

    await tx.fighterPoolResultReview.deleteMany();
    await tx.fighterPoolQueueEntry.deleteMany();
    await tx.fighterPoolPresence.deleteMany();
    await tx.fighterPoolMatch.deleteMany();
    await tx.fighterPoolServer.deleteMany();

    await tx.cardDefinition.updateMany({ data: { fighterId: null } });
    await tx.fighter.deleteMany();

    await tx.blackjackAction.deleteMany();
    await tx.blackjackRound.deleteMany();
    await tx.highLowGuessRecord.deleteMany();
    await tx.highLowRound.deleteMany();
    await tx.coinFlipRound.deleteMany();
    await tx.dailyRewardClaim.deleteMany();
    await tx.walletEntry.deleteMany();
    await tx.adminAuditEntry.deleteMany();
    await tx.announcement.deleteMany();
    await tx.verificationToken.deleteMany();

    await tx.wallet.deleteMany({ where: { userId: { not: ownerUserId } } });
    await tx.wallet.upsert({
      where: { userId: ownerUserId },
      update: { balance: 0, version: { increment: 1 } },
      create: { userId: ownerUserId },
    });
    await tx.session.deleteMany({ where: { userId: { not: ownerUserId } } });
    await tx.account.deleteMany({ where: { userId: { not: ownerUserId } } });
    await tx.userRole.deleteMany({ where: { userId: { not: ownerUserId } } });
    await tx.user.deleteMany({ where: { id: { not: ownerUserId } } });

    await tx.adminAuditEntry.create({
      data: {
        actorId: ownerUserId,
        action: "TESTING_DATA_RESET",
        targetType: "Platform",
        targetId: "playrfl",
        summary: {
          removedUsers,
          removedFighters,
          removedFights,
          preservedCardCatalog: true,
        },
      },
    });

    return { removedUsers, removedFighters, removedFights };
  }, { maxWait: 5_000, timeout: 30_000 });
}
