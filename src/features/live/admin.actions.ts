"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/features/admin/authorization";
import { prisma } from "@/lib/prisma";
import { fightStateSchema, liveEventStateSchema, liveUpdateSchema } from "./live.schema";

function fail(message: string): never {
  redirect(`/admin/live?error=${encodeURIComponent(message)}`);
}

function done(message: string): never {
  revalidatePath("/live");
  revalidatePath("/admin/live");
  redirect(`/admin/live?notice=${encodeURIComponent(message)}`);
}

export async function postLiveUpdate(formData: FormData) {
  await requireAdmin();
  const parsed = liveUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the update.");
  await prisma.fightUpdate.create({ data: parsed.data });
  revalidatePath(`/live/${parsed.data.eventId}`);
  done("Live update published.");
}

export async function updateFightState(formData: FormData) {
  await requireAdmin();
  const parsed = fightStateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the fight state.");
  const existing = await prisma.fight.findUnique({ where: { id: parsed.data.fightId }, include: { redFighter: true, blueFighter: true } });
  if (!existing) fail("Fight not found.");

  await prisma.$transaction(async (tx) => {
    await tx.fight.update({
      where: { id: existing.id },
      data: {
        status: parsed.data.status,
        result: parsed.data.status === "COMPLETED" ? parsed.data.result : null,
        resultSummary: parsed.data.status === "COMPLETED" ? parsed.data.resultSummary : null,
      },
    });
    if (parsed.data.status === "LIVE" || parsed.data.status === "COMPLETED" || parsed.data.status === "CANCELLED") {
      await tx.betMarket.updateMany({ where: { fightId: existing.id, status: "OPEN" }, data: { status: "LOCKED" } });
    }
    if (parsed.data.status === "COMPLETED") {
      const winner = parsed.data.result === "RED_WIN" ? existing.redFighter.name : parsed.data.result === "BLUE_WIN" ? existing.blueFighter.name : parsed.data.result === "DRAW" ? "Draw" : "No contest";
      await tx.fightUpdate.create({
        data: { eventId: existing.eventId, fightId: existing.id, kind: "RESULT", message: parsed.data.resultSummary ? `${winner}: ${parsed.data.resultSummary}` : winner },
      });
    }
  });
  revalidatePath(`/live/${existing.eventId}`);
  done("Fight state updated.");
}

export async function updateLiveEventState(formData: FormData) {
  await requireAdmin();
  const parsed = liveEventStateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail("Check the event state.");
  await prisma.$transaction(async (tx) => {
    if (parsed.data.status === "LIVE") await tx.event.updateMany({ where: { status: "LIVE", id: { not: parsed.data.eventId } }, data: { status: "COMPLETED" } });
    await tx.event.update({ where: { id: parsed.data.eventId }, data: { status: parsed.data.status } });
  });
  revalidatePath(`/live/${parsed.data.eventId}`);
  done("Event state updated.");
}
