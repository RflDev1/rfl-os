"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSection } from "@/features/admin/authorization";
import { syncUserFighterRole } from "@/features/discord/fighter-role";
import { nextFighterRank } from "@/features/fighters/ranking.service";
import { auth } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { deliverDiscordNotification } from "./discord.service";
import { FightRequestEligibilityError, FightRequestStateError, reviewFightRequest, submitFightRequest } from "./fight-requests.service";
import { assignFighterSchema, fighterStatusSchema, requestFightSchema, retryNotificationSchema, reviewFightRequestSchema } from "./fight-requests.schema";

export async function requestFightAction(formData: FormData) {
  const session = await auth();
  if (!session?.user.id || session.user.status !== "ACTIVE" || !session.user.profileCompletedAt) redirect("/signin");
  const parsed = requestFightSchema.safeParse(Object.fromEntries(formData));
  const requestCenter = formData.get("returnTo") === "fight-requests";
  const destination = requestCenter ? "/fight-requests" : `/fighters/${String(formData.get("opponentFighterId"))}`;
  if (!parsed.success) redirect(`${destination}?${requestCenter ? "error" : "requestError"}=Invalid+fighter`);
  try { await submitFightRequest({ userId: session.user.id, opponentFighterId: parsed.data.opponentFighterId, rankRange: getEnv().FIGHT_REQUEST_RANK_RANGE }); }
  catch (error) {
    const message = error instanceof FightRequestEligibilityError || error instanceof FightRequestStateError ? error.message : "The request could not be submitted.";
    redirect(`${requestCenter ? "/fight-requests?error=" : `/fighters/${parsed.data.opponentFighterId}?requestError=`}${encodeURIComponent(message)}`);
  }
  revalidatePath("/play");
  redirect(`${requestCenter ? "/fight-requests?notice=" : `/fighters/${parsed.data.opponentFighterId}?requestNotice=`}${encodeURIComponent("Fight request sent for admin approval.")}`);
}

function adminDone(message: string, error = false): never {
  revalidatePath("/admin/requests"); revalidatePath("/play");
  redirect(`/admin/requests?${error ? "error" : "notice"}=${encodeURIComponent(message)}`);
}

export async function assignFighterAction(formData: FormData) {
  const session = await requireAdminSection("REQUESTS");
  const parsed = assignFighterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) adminDone(parsed.error.issues[0]?.message ?? "Check the fighter assignment.", true);
  const fighter = await prisma.$transaction(async (tx) => {
    const existing = await tx.fighter.findUnique({ where: { id: parsed.data.fighterId }, select: { rank: true, userId: true, status: true } });
    if (!existing || existing.userId || existing.status === "INACTIVE") throw new Error("Fighter unavailable");
    const rank = existing.rank ?? await nextFighterRank(tx);
    const updated = await tx.fighter.update({ where: { id: parsed.data.fighterId }, data: { userId: parsed.data.userId, rank } });
    await tx.adminAuditEntry.create({ data: { actorId: session.user.id, action: "FIGHTER_ACCOUNT_ASSIGNED", targetType: "Fighter", targetId: updated.id, summary: { userId: parsed.data.userId, rank, rankAssignedAutomatically: existing.rank === null } } });
    return updated;
  }).catch(() => null);
  if (!fighter) adminDone("That account is already assigned or the fighter is unavailable.", true);
  adminDone(`Fighter account saved at rank #${fighter.rank}.`);
}

export async function updateFighterStatusAction(formData: FormData) {
  const session = await requireAdminSection("RANKINGS");
  const parsed = fighterStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/rankings?error=Invalid+fighter+status");
  const existing = await prisma.fighter.findUnique({
    where: { id: parsed.data.fighterId },
    include: {
      redFights: { where: { status: { in: ["SCHEDULED", "LIVE"] } }, select: { id: true }, take: 1 },
      blueFights: { where: { status: { in: ["SCHEDULED", "LIVE"] } }, select: { id: true }, take: 1 },
      poolMatchesAsRed: { where: { status: { in: ["AWAITING_CHECKIN", "READY", "LIVE"] } }, select: { id: true }, take: 1 },
      poolMatchesAsBlue: { where: { status: { in: ["AWAITING_CHECKIN", "READY", "LIVE"] } }, select: { id: true }, take: 1 },
    },
  });
  if (!existing) redirect("/admin/rankings?error=Fighter+not+found");
  if (!existing.userId && parsed.data.status === "ACTIVE") {
    redirect("/admin/rankings?error=Archived+fighters+must+be+re-added+from+Home+content");
  }
  if (
    parsed.data.status === "INACTIVE" &&
    (existing.redFights.length > 0 || existing.blueFights.length > 0)
  ) {
    redirect("/admin/rankings?error=Cancel+or+complete+scheduled%2Flive+fights+before+making+this+fighter+inactive");
  }
  if (parsed.data.status !== "ACTIVE" && (existing.poolMatchesAsRed.length > 0 || existing.poolMatchesAsBlue.length > 0)) {
    redirect("/admin/rankings?error=Resolve+the+active+Fighter+Pool+match+before+changing+this+fighter%27s+status");
  }

  let activeFighterId = existing.id;
  let assignedRank = existing.rank;
  if (existing.status === "INACTIVE" && parsed.data.status === "ACTIVE" && existing.userId) {
    const replacement = await prisma.$transaction(async (tx) => {
      await tx.fighter.update({
        where: { id: existing.id },
        data: { userId: null, rank: null, status: "INACTIVE", minecraftUsername: null, minecraftUsernameNormalized: null },
      });
      const rank = await nextFighterRank(tx);
      const created = await tx.fighter.create({
        data: {
          userId: existing.userId,
          rank,
          name: existing.name,
          nickname: existing.nickname,
          minecraftUsername: existing.minecraftUsername,
          minecraftUsernameNormalized: existing.minecraftUsernameNormalized,
          wins: 0,
          losses: 0,
          draws: 0,
          status: "ACTIVE",
        },
      });
      await tx.adminAuditEntry.create({
        data: {
          actorId: session.user.id,
          action: "FIGHTER_REACTIVATED",
          targetType: "Fighter",
          targetId: created.id,
          summary: {
            archivedFighterId: existing.id,
            userId: existing.userId,
            rank,
            record: "0-0-0",
          },
        },
      });
      return created;
    });
    activeFighterId = replacement.id;
    assignedRank = replacement.rank;
  } else {
    await prisma.$transaction(async (tx) => {
      if (parsed.data.status !== "ACTIVE") {
        await tx.fighterPoolQueueEntry.deleteMany({ where: { fighterId: existing.id } });
        await tx.fightRequest.updateMany({
          where: {
            status: "PENDING",
            OR: [{ requesterFighterId: existing.id }, { opponentFighterId: existing.id }],
          },
          data: { status: "CANCELLED" },
        });
      }
      const rank = parsed.data.status === "INACTIVE"
        ? null
        : existing.rank ?? await nextFighterRank(tx);
      await tx.fighter.update({
        where: { id: existing.id },
        data: { status: parsed.data.status, rank },
      });
      await tx.adminAuditEntry.create({
        data: {
          actorId: session.user.id,
          action: "FIGHTER_STATUS_CHANGED",
          targetType: "Fighter",
          targetId: existing.id,
          summary: { before: existing.status, after: parsed.data.status, rank },
        },
      });
      assignedRank = rank;
    });
  }

  let roleSynced = true;
  if (existing.userId) {
    const env = getEnv();
    roleSynced = await syncUserFighterRole({
      apiBaseUrl: env.DISCORD_API_BASE_URL,
      botToken: env.DISCORD_BOT_TOKEN,
      guildId: env.DISCORD_GUILD_ID,
    }, existing.userId, parsed.data.status === "ACTIVE").catch((error) => {
      console.error("[rfl-discord] Fighter role sync failed", error);
      return false;
    });
  }
  revalidatePath("/fighters");
  revalidatePath(`/fighters/${existing.id}`);
  if (activeFighterId !== existing.id) revalidatePath(`/fighters/${activeFighterId}`);
  revalidatePath("/admin/rankings");
  revalidatePath("/admin/home");
  const message = existing.status === "INACTIVE" && parsed.data.status === "ACTIVE"
    ? `Fighter reactivated at rank #${assignedRank} with a fresh 0-0-0 record.${roleSynced ? "" : " Discord role sync failed; check the bot role hierarchy."}`
    : `Fighter status updated.${roleSynced ? "" : " Discord role sync failed; check the bot role hierarchy."}`;
  redirect(`/admin/rankings?notice=${encodeURIComponent(message)}`);
}

export async function reviewFightRequestAction(formData: FormData) {
  const session = await requireAdminSection("REQUESTS");
  const parsed = reviewFightRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) adminDone(parsed.error.issues[0]?.message ?? "Check the review.", true);
  let request;
  try { request = await reviewFightRequest({ ...parsed.data, actorId: session.user.id, rankRange: getEnv().FIGHT_REQUEST_RANK_RANGE }); }
  catch (error) { adminDone(error instanceof Error ? error.message : "The request could not be reviewed.", true); }
  if (request.status === "APPROVED") {
    const env = getEnv();
    const jobs = await prisma.discordNotification.findMany({ where: { fightRequestId: request.id, kind: "FIGHT_APPROVED", status: { not: "SENT" } } });
    await Promise.allSettled(jobs.map((job) => deliverDiscordNotification(job.id, { apiBaseUrl: env.DISCORD_API_BASE_URL, botToken: env.DISCORD_BOT_TOKEN, appUrl: env.APP_URL })));
  }
  revalidatePath("/live");
  adminDone(request.status === "APPROVED" ? "Request approved, fight scheduled, and Discord delivery queued." : "Request declined.");
}

export async function retryDiscordNotificationAction(formData: FormData) {
  await requireAdminSection("REQUESTS");
  const parsed = retryNotificationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) adminDone("Invalid notification.", true);
  const env = getEnv();
  try { await deliverDiscordNotification(parsed.data.notificationId, { apiBaseUrl: env.DISCORD_API_BASE_URL, botToken: env.DISCORD_BOT_TOKEN, appUrl: env.APP_URL }); }
  catch { adminDone("Discord delivery failed again. Check bot access and retry.", true); }
  adminDone("Discord notification delivered.");
}
