"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminSection } from "@/features/admin/authorization";
import { syncUserFighterRole } from "@/features/discord/fighter-role";
import { nextFighterRank } from "@/features/fighters/ranking.service";
import { announcementSchema, contentIdSchema, eventSchema, eventVisibilitySchema, fightSchema, fighterSchema, removeFighterSchema } from "./home.schema";
import { getEnv } from "@/lib/env";
import { syncFightStreamChannel } from "@/features/discord/stream-channel";

async function syncDiscordStream() {
  const env = getEnv();
  await syncFightStreamChannel({
    apiBaseUrl: env.DISCORD_API_BASE_URL,
    botToken: env.DISCORD_BOT_TOKEN,
    guildId: env.DISCORD_GUILD_ID,
  }).catch((error) => console.error("[rfl-discord] Fight Stream sync failed", error));
}

async function syncFighterRole(userId: string, active: boolean) {
  const env = getEnv();
  return syncUserFighterRole({
    apiBaseUrl: env.DISCORD_API_BASE_URL,
    botToken: env.DISCORD_BOT_TOKEN,
    guildId: env.DISCORD_GUILD_ID,
  }, userId, active).catch((error) => {
    console.error("[rfl-discord] Fighter role sync failed", error);
    return false;
  });
}

function fail(message: string): never {
  redirect(`/admin/home?error=${encodeURIComponent(message)}`);
}

function done(message: string): never {
  revalidatePath("/");
  revalidatePath("/admin/home");
  redirect(`/admin/home?notice=${encodeURIComponent(message)}`);
}

export async function createFighter(formData: FormData) {
  const session = await requireAdminSection("CONTENT");
  const parsed = fighterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the fighter details.");
  const eligibleUser = await prisma.user.findFirst({
    where: { id: parsed.data.userId, status: "ACTIVE", profileCompletedAt: { not: null }, fighterProfile: null, accounts: { some: { provider: "discord" } } },
    select: { id: true },
  });
  if (!eligibleUser) fail("Choose an active Discord player who is not already assigned to a fighter.");
  const fighter = await prisma.$transaction(async (tx) => {
    const rank = await nextFighterRank(tx);
    const created = await tx.fighter.create({
      data: { ...parsed.data, rank, wins: 0, losses: 0, draws: 0, status: "ACTIVE" },
    });
    await tx.adminAuditEntry.create({
      data: {
        actorId: session.user.id,
        action: "FIGHTER_CREATED",
        targetType: "Fighter",
        targetId: created.id,
        summary: { userId: parsed.data.userId, rank, record: "0-0-0" },
      },
    });
    return created;
  }).catch(() => null);
  if (!fighter) fail("That player is already assigned or the fighter could not be created.");
  const roleSynced = await syncFighterRole(parsed.data.userId, true);
  done(`Fighter added at rank #${fighter.rank} with a 0-0-0 record.${roleSynced ? "" : " Fighter saved, but the Discord role could not be synced."}`);
}

export async function removeFighter(formData: FormData) {
  const session = await requireAdminSection("CONTENT");
  const parsed = removeFighterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail("Choose a fighter and type REMOVE to confirm.");

  const fighter = await prisma.fighter.findUnique({
    where: { id: parsed.data.fighterId },
    select: {
      id: true,
      userId: true,
      name: true,
      rank: true,
      status: true,
      redFights: { where: { status: { in: ["SCHEDULED", "LIVE"] } }, select: { id: true }, take: 1 },
      blueFights: { where: { status: { in: ["SCHEDULED", "LIVE"] } }, select: { id: true }, take: 1 },
      poolMatchesAsRed: { where: { status: { in: ["AWAITING_CHECKIN", "READY", "LIVE"] } }, select: { id: true }, take: 1 },
      poolMatchesAsBlue: { where: { status: { in: ["AWAITING_CHECKIN", "READY", "LIVE"] } }, select: { id: true }, take: 1 },
    },
  });
  if (!fighter?.userId) fail("That fighter is already removed or is not linked to a player.");
  if (fighter.redFights.length || fighter.blueFights.length) {
    fail("Cancel or complete this fighter's scheduled/live fights before removing them.");
  }
  if (fighter.poolMatchesAsRed.length || fighter.poolMatchesAsBlue.length) fail("Resolve this fighter's active Fighter Pool match before removing them.");

  await prisma.$transaction(async (tx) => {
    await tx.fightRequest.updateMany({
      where: {
        status: "PENDING",
        OR: [{ requesterFighterId: fighter.id }, { opponentFighterId: fighter.id }],
      },
      data: { status: "CANCELLED" },
    });
    await tx.fighterPoolQueueEntry.deleteMany({ where: { fighterId: fighter.id } });
    await tx.fighter.update({
      where: { id: fighter.id },
      data: { userId: null, rank: null, status: "INACTIVE" },
    });
    await tx.adminAuditEntry.create({
      data: {
        actorId: session.user.id,
        action: "FIGHTER_REMOVED",
        targetType: "Fighter",
        targetId: fighter.id,
        summary: {
          userId: fighter.userId,
          name: fighter.name,
          previousRank: fighter.rank,
          previousStatus: fighter.status,
          historicalProfilePreserved: true,
        },
      },
    });
  });

  const roleSynced = await syncFighterRole(fighter.userId, false);
  revalidatePath("/fighters");
  revalidatePath(`/fighters/${fighter.id}`);
  revalidatePath("/admin/rankings");
  revalidatePath("/admin/requests");
  done(`${fighter.name} was removed. Their historical record remains archived.${roleSynced ? "" : " The Discord role could not be removed automatically."}`);
}

export async function createEvent(formData: FormData) {
  await requireAdminSection("CONTENT");
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the event details.");

  await prisma.$transaction(async (tx) => {
    if (parsed.data.featured) await tx.event.updateMany({ data: { featured: false } });
    await tx.event.create({ data: parsed.data });
  });
  await syncDiscordStream();
  done("Event published to the home schedule.");
}

export async function createFight(formData: FormData) {
  await requireAdminSection("CONTENT");
  const parsed = fightSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the fight details.");
  await prisma.fight.create({ data: parsed.data });
  done("Fight added to the event.");
}

export async function createAnnouncement(formData: FormData) {
  await requireAdminSection("CONTENT");
  const parsed = announcementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the announcement.");
  await prisma.announcement.create({ data: parsed.data });
  done("Announcement is live.");
}

export async function updateEventVisibility(formData: FormData) {
  await requireAdminSection("CONTENT");
  const parsed = eventVisibilitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail("Check the event publishing settings.");
  await prisma.$transaction(async (tx) => {
    if (parsed.data.featured) await tx.event.updateMany({ data: { featured: false } });
    await tx.event.update({
      where: { id: parsed.data.eventId },
      data: { status: parsed.data.status, featured: parsed.data.featured },
    });
  });
  await syncDiscordStream();
  done("Event publishing updated.");
}

export async function deactivateAnnouncement(formData: FormData) {
  await requireAdminSection("CONTENT");
  const parsed = contentIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail("Announcement not found.");
  await prisma.announcement.update({ where: { id: parsed.data.id }, data: { active: false } });
  done("Announcement removed from Home.");
}
