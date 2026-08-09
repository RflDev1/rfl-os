"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/features/admin/authorization";
import { cancelSoloTestMatch, cancelUnstartedPoolMatch, createSoloTestMatch, exitCompletedPoolMatch, FighterPoolError, joinFighterPool, leaveFighterPool, recordSoloTestRound, resetSoloTestState, reviewPoolMatch, simulateSoloPresence } from "./fighter-pool.service";
import { poolReviewSchema } from "./fighter-pool.schema";

function poolRedirect(message: string, error = false): never {
  revalidatePath("/fighter-pool");
  redirect(`/fighter-pool?${error ? "error" : "notice"}=${encodeURIComponent(message)}`);
}

export async function joinFighterPoolAction() {
  const session = await auth();
  if (!session) redirect("/signin");
  let message: string;
  try { const result = await joinFighterPool(session.user.id); message = result.matched ? "We found a match for you!" : "You joined the Fighter Pool."; }
  catch (error) { poolRedirect(error instanceof FighterPoolError ? error.message : "The Fighter Pool could not be joined.", true); }
  poolRedirect(message);
}

export async function leaveFighterPoolAction() {
  const session = await auth();
  if (!session) redirect("/signin");
  await leaveFighterPool(session.user.id);
  poolRedirect("You left the Fighter Pool.");
}

export async function exitCompletedPoolMatchAction() {
  const session = await auth();
  if (!session) redirect("/signin");
  try { await exitCompletedPoolMatch(session.user.id); }
  catch (error) { poolRedirect(error instanceof FighterPoolError ? error.message : "The completed match could not be exited.", true); }
  poolRedirect("You exited the completed match and can join the Fighter Pool again.");
}

export async function cancelFighterPoolMatchAction() {
  const session = await auth();
  if (!session) redirect("/signin");
  try { await cancelUnstartedPoolMatch(session.user.id); }
  catch (error) { poolRedirect(error instanceof FighterPoolError ? error.message : "The match could not be cancelled.", true); }
  poolRedirect("Your unstarted Fighter Pool match was cancelled. Records and Crowns were not changed.");
}

export async function reviewPoolMatchAction(formData: FormData) {
  const session = await requireAdmin();
  const parsed = poolReviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/admin/fighter-pool?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the review.")}`);
  try { await reviewPoolMatch({ ...parsed.data, actorId: session.user.id }); }
  catch (error) { redirect(`/admin/fighter-pool?error=${encodeURIComponent(error instanceof FighterPoolError ? error.message : "The result could not be reviewed.")}`); }
  revalidatePath("/fighters"); revalidatePath("/admin/rankings"); revalidatePath("/admin/fighter-pool");
  redirect("/admin/fighter-pool?notice=Result%20review%20saved%20and%20audited.");
}

function adminPoolRedirect(message: string, error = false): never {
  revalidatePath("/fighter-pool");
  revalidatePath("/admin/fighter-pool");
  revalidatePath("/fighters");
  revalidatePath("/admin/rankings");
  redirect(`/admin/fighter-pool?${error ? "error" : "notice"}=${encodeURIComponent(message)}`);
}

export async function simulateSoloPresenceAction(formData: FormData) {
  const session = await requireAdmin();
  const fighterId = String(formData.get("fighterId") ?? "");
  try { await simulateSoloPresence({ fighterId, actorId: session.user.id }); }
  catch (error) { adminPoolRedirect(error instanceof FighterPoolError ? error.message : "Presence could not be simulated.", true); }
  adminPoolRedirect("Test lobby presence is active.");
}

export async function joinSoloQueueAction(formData: FormData) {
  const session = await requireAdmin();
  const fighterId = String(formData.get("fighterId") ?? "");
  try {
    const fighter = await prisma.fighter.findUnique({ where: { id: fighterId }, select: { userId: true } });
    if (!fighter?.userId) throw new FighterPoolError("Choose a fighter linked to an account.");
    await simulateSoloPresence({ fighterId, actorId: session.user.id });
    await joinFighterPool(fighter.userId);
  } catch (error) { adminPoolRedirect(error instanceof FighterPoolError ? error.message : "The fighter could not join the test queue.", true); }
  adminPoolRedirect("Fighter added to the real queue with simulated lobby presence.");
}

export async function createSoloTestMatchAction(formData: FormData) {
  const session = await requireAdmin();
  try { await createSoloTestMatch({ redFighterId: String(formData.get("redFighterId") ?? ""), blueFighterId: String(formData.get("blueFighterId") ?? ""), actorId: session.user.id }); }
  catch (error) { adminPoolRedirect(error instanceof FighterPoolError ? error.message : "The solo test match could not be created.", true); }
  adminPoolRedirect("Solo test match created and both fighters checked in.");
}

export async function recordSoloTestRoundAction(formData: FormData) {
  const session = await requireAdmin();
  try { await recordSoloTestRound({ matchId: String(formData.get("matchId") ?? ""), winnerFighterId: String(formData.get("winnerFighterId") ?? ""), actorId: session.user.id }); }
  catch (error) { adminPoolRedirect(error instanceof FighterPoolError ? error.message : "The test round could not be recorded.", true); }
  adminPoolRedirect("Test round recorded. A second round win completes the match and applies official results.");
}

export async function cancelSoloTestMatchAction(formData: FormData) {
  const session = await requireAdmin();
  try { await cancelSoloTestMatch({ matchId: String(formData.get("matchId") ?? ""), actorId: session.user.id }); }
  catch (error) { adminPoolRedirect(error instanceof FighterPoolError ? error.message : "The test match could not be cancelled.", true); }
  adminPoolRedirect("Solo test match cancelled without changing records or Crowns.");
}

export async function resetSoloTestStateAction() {
  const session = await requireAdmin();
  try { await resetSoloTestState({ actorId: session.user.id }); }
  catch { adminPoolRedirect("The solo test state could not be reset.", true); }
  adminPoolRedirect("Solo test presence and active match state reset. Completed results were preserved.");
}
