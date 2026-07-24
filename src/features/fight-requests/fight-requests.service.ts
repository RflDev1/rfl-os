import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ranksEligible } from "./fight-requests.logic";

export class FightRequestEligibilityError extends Error {}
export class FightRequestStateError extends Error {}

export async function submitFightRequest(input: { userId: string; opponentFighterId: string; rankRange: number }) {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`fight-request:${input.userId}`})) IS NULL AS "locked"`;
      const [requester, opponent] = await Promise.all([tx.fighter.findUnique({ where: { userId: input.userId } }), tx.fighter.findUnique({ where: { id: input.opponentFighterId } })]);
      if (!requester?.rank || requester.status !== "ACTIVE") throw new FightRequestEligibilityError("Only active ranked fighter accounts can send requests.");
      if (!opponent?.rank || opponent.status !== "ACTIVE" || !opponent.userId || !ranksEligible(requester.rank, opponent.rank, input.rankRange)) throw new FightRequestEligibilityError("That fighter is unavailable or outside your eligible rank range.");
      const pending = await tx.fightRequest.findFirst({ where: { status: "PENDING", OR: [{ requesterFighterId: requester.id, opponentFighterId: opponent.id }, { requesterFighterId: opponent.id, opponentFighterId: requester.id }] } });
      if (pending) throw new FightRequestStateError("A request between these fighters is already pending.");
      return tx.fightRequest.create({ data: { requesterFighterId: requester.id, opponentFighterId: opponent.id, requestedById: input.userId, requesterRank: requester.rank, opponentRank: opponent.rank } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof FightRequestEligibilityError || error instanceof FightRequestStateError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new FightRequestStateError("A request between these fighters is already pending.");
    throw error;
  }
}

export async function reviewFightRequest(input: { requestId: string; actorId: string; operation: "APPROVE" | "DECLINE"; eventId?: string; rankRange: number }) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${input.requestId})) IS NULL AS "locked"`;
    const request = await tx.fightRequest.findUnique({ where: { id: input.requestId }, include: { requester: { include: { user: { include: { accounts: { where: { provider: "discord" } } } } } }, opponent: { include: { user: { include: { accounts: { where: { provider: "discord" } } } } } } } });
    if (!request || request.status !== "PENDING") throw new FightRequestStateError("This request has already been reviewed.");
    if (input.operation === "DECLINE") {
      const declined = await tx.fightRequest.update({ where: { id: request.id }, data: { status: "DECLINED", reviewedById: input.actorId, reviewedAt: new Date() } });
      await tx.adminAuditEntry.create({ data: { actorId: input.actorId, action: "FIGHT_REQUEST_DECLINED", targetType: "FightRequest", targetId: request.id, summary: { requesterFighterId: request.requesterFighterId, opponentFighterId: request.opponentFighterId } } });
      return declined;
    }
    if (!input.eventId) throw new FightRequestStateError("Choose a scheduled event.");
    if (request.requester.status !== "ACTIVE" || request.opponent.status !== "ACTIVE" || !request.requester.rank || !request.opponent.rank || !request.requester.userId || !request.opponent.userId || !ranksEligible(request.requester.rank, request.opponent.rank, input.rankRange)) throw new FightRequestEligibilityError("The fighters are no longer active and rank-eligible.");
    const event = await tx.event.findFirst({ where: { id: input.eventId, status: "SCHEDULED" } });
    if (!event) throw new FightRequestStateError("The selected event is not scheduled.");
    const lastFight = await tx.fight.aggregate({ where: { eventId: event.id }, _max: { position: true } });
    const fight = await tx.fight.create({ data: { eventId: event.id, redFighterId: request.requesterFighterId, blueFighterId: request.opponentFighterId, position: (lastFight._max.position ?? 0) + 1, scheduledAt: event.startsAt } });
    const approved = await tx.fightRequest.update({ where: { id: request.id }, data: { status: "APPROVED", fightId: fight.id, reviewedById: input.actorId, reviewedAt: new Date() } });
    const recipients = [request.requester.user, request.opponent.user].filter((user): user is NonNullable<typeof user> => Boolean(user));
    const scheduledAt = fight.scheduledAt ?? event.startsAt;
    const notificationTimes = [
      { kind: "FIGHT_APPROVED" as const, scheduledFor: new Date() },
      { kind: "FIGHT_REMINDER_2H" as const, scheduledFor: new Date(scheduledAt.getTime() - 2 * 60 * 60 * 1000) },
      { kind: "FIGHT_REMINDER_1H" as const, scheduledFor: new Date(scheduledAt.getTime() - 60 * 60 * 1000) },
      { kind: "FIGHT_REMINDER_10M" as const, scheduledFor: new Date(scheduledAt.getTime() - 10 * 60 * 1000) },
    ];
    for (const user of recipients) {
      const discord = user.accounts[0];
      if (discord) {
        await tx.discordNotification.createMany({
          data: notificationTimes.map(({ kind, scheduledFor }) => ({
            fightRequestId: request.id,
            fightId: fight.id,
            recipientUserId: user.id,
            discordUserId: discord.providerAccountId,
            kind,
            scheduledFor,
          })),
        });
      }
    }
    await tx.adminAuditEntry.create({ data: { actorId: input.actorId, action: "FIGHT_REQUEST_APPROVED", targetType: "FightRequest", targetId: request.id, summary: { fightId: fight.id, eventId: event.id, requesterRank: request.requester.rank, opponentRank: request.opponent.rank } } });
    return approved;
  }, { isolationLevel: "Serializable" });
}
