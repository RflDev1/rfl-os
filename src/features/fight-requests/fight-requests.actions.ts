"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSection } from "@/features/admin/authorization";
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
  const fighter = await prisma.fighter.update({ where: { id: parsed.data.fighterId }, data: { userId: parsed.data.userId, rank: parsed.data.rank } }).catch(() => null);
  if (!fighter) adminDone("That account or rank is already assigned.", true);
  await prisma.adminAuditEntry.create({ data: { actorId: session.user.id, action: "FIGHTER_ACCOUNT_ASSIGNED", targetType: "Fighter", targetId: fighter.id, summary: { userId: parsed.data.userId, rank: parsed.data.rank } } });
  adminDone("Fighter account and rank saved.");
}

export async function updateFighterStatusAction(formData: FormData) {
  const session = await requireAdminSection("RANKINGS");
  const parsed = fighterStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/rankings?error=Invalid+fighter+status");
  const existing = await prisma.fighter.findUnique({ where: { id: parsed.data.fighterId } });
  if (!existing) redirect("/admin/rankings?error=Fighter+not+found");
  await prisma.$transaction([
    prisma.fighter.update({ where: { id: existing.id }, data: { status: parsed.data.status } }),
    prisma.adminAuditEntry.create({ data: { actorId: session.user.id, action: "FIGHTER_STATUS_CHANGED", targetType: "Fighter", targetId: existing.id, summary: { before: existing.status, after: parsed.data.status } } }),
  ]);
  revalidatePath("/fighters");
  revalidatePath(`/fighters/${existing.id}`);
  revalidatePath("/admin/rankings");
  redirect("/admin/rankings?notice=Fighter+status+updated");
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
    const jobs = await prisma.discordNotification.findMany({ where: { fightRequestId: request.id, status: { not: "SENT" } } });
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
