"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/features/admin/authorization";
import { FighterPoolError, joinFighterPool, leaveFighterPool, reviewPoolMatch } from "./fighter-pool.service";
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

export async function reviewPoolMatchAction(formData: FormData) {
  const session = await requireAdmin();
  const parsed = poolReviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/admin/fighter-pool?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the review.")}`);
  try { await reviewPoolMatch({ ...parsed.data, actorId: session.user.id }); }
  catch (error) { redirect(`/admin/fighter-pool?error=${encodeURIComponent(error instanceof FighterPoolError ? error.message : "The result could not be reviewed.")}`); }
  revalidatePath("/fighters"); revalidatePath("/admin/rankings"); revalidatePath("/admin/fighter-pool");
  redirect("/admin/fighter-pool?notice=Result%20review%20saved%20and%20audited.");
}
