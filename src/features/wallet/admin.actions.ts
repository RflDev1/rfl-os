"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/features/admin/authorization";
import { adjustWallet, InsufficientCrownsError } from "./wallet.service";
import { walletAdjustmentSchema } from "./admin.schema";

export async function applyWalletAdjustment(formData: FormData) {
  const session = await requireAdmin();
  const parsed = walletAdjustmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/admin/economy?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the adjustment.")}`);

  try {
    await adjustWallet({
      actorId: session.user.id,
      userId: parsed.data.userId,
      delta: parsed.data.delta,
      note: parsed.data.note,
      idempotencyKey: parsed.data.idempotencyKey,
    });
  } catch (error) {
    const message = error instanceof InsufficientCrownsError
      ? "That adjustment would make the player’s balance negative."
      : "The adjustment could not be applied. No Crowns were changed.";
    redirect(`/admin/economy?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/play");
  revalidatePath("/admin/economy");
  redirect("/admin/economy?notice=Crown%20adjustment%20recorded.");
}

