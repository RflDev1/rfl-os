"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminSection } from "@/features/admin/authorization";
import { nextFighterRank } from "@/features/fighters/ranking.service";
import { announcementSchema, contentIdSchema, eventSchema, eventVisibilitySchema, fightSchema, fighterSchema } from "./home.schema";

function fail(message: string): never {
  redirect(`/admin/home?error=${encodeURIComponent(message)}`);
}

function done(message: string): never {
  revalidatePath("/");
  revalidatePath("/admin/home");
  redirect(`/admin/home?notice=${encodeURIComponent(message)}`);
}

export async function createFighter(formData: FormData) {
  await requireAdminSection("CONTENT");
  const parsed = fighterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the fighter details.");
  const eligibleUser = await prisma.user.findFirst({
    where: { id: parsed.data.userId, status: "ACTIVE", profileCompletedAt: { not: null }, fighterProfile: null, accounts: { some: { provider: "discord" } } },
    select: { id: true },
  });
  if (!eligibleUser) fail("Choose an active Discord player who is not already assigned to a fighter.");
  const fighter = await prisma.$transaction(async (tx) => {
    const rank = await nextFighterRank(tx);
    return tx.fighter.create({ data: { ...parsed.data, rank } });
  }).catch(() => null);
  if (!fighter) fail("That player is already assigned or the fighter could not be created.");
  done(`Fighter added at rank #${fighter.rank}.`);
}

export async function createEvent(formData: FormData) {
  await requireAdminSection("CONTENT");
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the event details.");

  await prisma.$transaction(async (tx) => {
    if (parsed.data.featured) await tx.event.updateMany({ data: { featured: false } });
    await tx.event.create({ data: parsed.data });
  });
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
  done("Event publishing updated.");
}

export async function deactivateAnnouncement(formData: FormData) {
  await requireAdminSection("CONTENT");
  const parsed = contentIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail("Announcement not found.");
  await prisma.announcement.update({ where: { id: parsed.data.id }, data: { active: false } });
  done("Announcement removed from Home.");
}
