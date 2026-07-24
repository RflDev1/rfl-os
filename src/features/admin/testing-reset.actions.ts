"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "./authorization";
import { testingResetSchema } from "./testing-reset.schema";
import { resetTestingData } from "./testing-reset.service";

export async function resetTestingDataAction(formData: FormData) {
  const session = await requireOwner();
  const parsed = testingResetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/admin/settings?resetError=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Confirm the reset.")}`);
  }

  const result = await resetTestingData(session.user.id);
  revalidatePath("/", "layout");
  redirect(`/admin/settings?resetNotice=${encodeURIComponent(`Reset complete: ${result.removedUsers} users, ${result.removedFighters} fighters, and ${result.removedFights} fights removed.`)}`);
}
