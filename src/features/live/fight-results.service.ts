import type { FightResult } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export class FightResultStateError extends Error {}

export async function completeFight(input: {
  fightId: string;
  result: FightResult;
  resultSummary?: string;
  actorId: string;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`fight-result:${input.fightId}`})) IS NULL AS "locked"`;
    const fight = await tx.fight.findUnique({
      where: { id: input.fightId },
      include: { redFighter: true, blueFighter: true },
    });
    if (!fight) throw new FightResultStateError("Fight not found.");
    if (fight.status === "COMPLETED") throw new FightResultStateError("This fight is already completed and its official result cannot be applied twice.");
    if (fight.status === "CANCELLED") throw new FightResultStateError("A cancelled fight cannot be completed.");

    await tx.fight.update({
      where: { id: fight.id },
      data: { status: "COMPLETED", result: input.result, resultSummary: input.resultSummary ?? null },
    });
    await tx.betMarket.updateMany({ where: { fightId: fight.id, status: "OPEN" }, data: { status: "LOCKED" } });

    let winnerName = "No contest";
    if (input.result === "DRAW") {
      winnerName = "Draw";
      await Promise.all([
        tx.fighter.update({ where: { id: fight.redFighterId }, data: { draws: { increment: 1 } } }),
        tx.fighter.update({ where: { id: fight.blueFighterId }, data: { draws: { increment: 1 } } }),
      ]);
    } else if (input.result === "RED_WIN" || input.result === "BLUE_WIN") {
      const winner = input.result === "RED_WIN" ? fight.redFighter : fight.blueFighter;
      const loser = input.result === "RED_WIN" ? fight.blueFighter : fight.redFighter;
      winnerName = winner.name;
      await Promise.all([
        tx.fighter.update({ where: { id: winner.id }, data: { wins: { increment: 1 } } }),
        tx.fighter.update({ where: { id: loser.id }, data: { losses: { increment: 1 } } }),
      ]);

      // Number 1 is the strongest rank. On an upset, the fighters exchange positions.
      if (winner.rank && loser.rank && winner.rank > loser.rank) {
        const winnerRank = winner.rank;
        const loserRank = loser.rank;
        await tx.fighter.update({ where: { id: loser.id }, data: { rank: null } });
        await tx.fighter.update({ where: { id: winner.id }, data: { rank: loserRank } });
        await tx.fighter.update({ where: { id: loser.id }, data: { rank: winnerRank } });
      }
    }

    await tx.fightUpdate.create({
      data: {
        eventId: fight.eventId,
        fightId: fight.id,
        kind: "RESULT",
        message: input.resultSummary ? `${winnerName}: ${input.resultSummary}` : winnerName,
      },
    });
    await tx.adminAuditEntry.create({
      data: {
        actorId: input.actorId,
        action: "FIGHT_RESULT_COMPLETED",
        targetType: "Fight",
        targetId: fight.id,
        summary: { result: input.result, redFighterId: fight.redFighterId, blueFighterId: fight.blueFighterId },
      },
    });
    return fight;
  }, { isolationLevel: "Serializable" });
}
