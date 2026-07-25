"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSection } from "@/features/admin/authorization";
import { prisma } from "@/lib/prisma";
import { fightStateSchema, liveEventStateSchema, liveUpdateSchema } from "./live.schema";
import { completeFight, FightResultStateError } from "./fight-results.service";
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

function fail(message: string): never {
  redirect(`/admin/live?error=${encodeURIComponent(message)}`);
}

function done(message: string): never {
  revalidatePath("/live");
  revalidatePath("/admin/live");
  redirect(`/admin/live?notice=${encodeURIComponent(message)}`);
}

export async function postLiveUpdate(formData: FormData) {
  await requireAdminSection("EVENTS");
  const parsed = liveUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the update.");
  await prisma.fightUpdate.create({ data: parsed.data });
  revalidatePath(`/live/${parsed.data.eventId}`);
  done("Live update published.");
}

export async function updateFightState(formData: FormData) {
  const session = await requireAdminSection("EVENTS");
  const parsed = fightStateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the fight state.");
  const existing = await prisma.fight.findUnique({ where: { id: parsed.data.fightId }, include: { redFighter: true, blueFighter: true } });
  if (!existing) fail("Fight not found.");
  if (parsed.data.status === "COMPLETED") {
    try {
      await completeFight({
        fightId: existing.id,
        result: parsed.data.result!,
        resultSummary: parsed.data.resultSummary,
        actorId: session.user.id,
      });
    } catch (error) {
      fail(error instanceof FightResultStateError ? error.message : "The official result could not be recorded.");
    }
    revalidatePath(`/live/${existing.eventId}`);
    revalidatePath(`/fighters/${existing.redFighterId}`);
    revalidatePath(`/fighters/${existing.blueFighterId}`);
    revalidatePath("/fighters");
    revalidatePath("/admin/rankings");
    await syncDiscordStream();
    done("Official result recorded. Fighter records and rankings are updated.");
  }
  if (existing.status === "COMPLETED") fail("Completed fight results cannot be changed from this control.");

  await prisma.$transaction(async (tx) => {
    await tx.fight.update({
      where: { id: existing.id },
      data: {
        status: parsed.data.status,
        result: null,
        resultSummary: null,
      },
    });
    if (parsed.data.status === "LIVE" || parsed.data.status === "COMPLETED" || parsed.data.status === "CANCELLED") {
      await tx.betMarket.updateMany({ where: { fightId: existing.id, status: "OPEN" }, data: { status: "LOCKED" } });
    }
  });
  revalidatePath(`/live/${existing.eventId}`);
  await syncDiscordStream();
  done("Fight state updated.");
}

export async function updateLiveEventState(formData: FormData) {
  await requireAdminSection("EVENTS");
  const parsed = liveEventStateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail("Check the event state.");
  await prisma.$transaction(async (tx) => {
    if (parsed.data.status === "LIVE") await tx.event.updateMany({ where: { status: "LIVE", id: { not: parsed.data.eventId } }, data: { status: "COMPLETED" } });
    await tx.event.update({ where: { id: parsed.data.eventId }, data: { status: parsed.data.status } });
  });
  revalidatePath(`/live/${parsed.data.eventId}`);
  await syncDiscordStream();
  done("Event state updated.");
}
