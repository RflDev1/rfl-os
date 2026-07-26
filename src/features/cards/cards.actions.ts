"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/features/admin/authorization";
import { auth } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { cardSchema, openPackSchema, packSchema, setSchema } from "./cards.schema";
import { openPack, PackFundsError, PackRateLimitError, PackUnavailableError } from "./cards.service";
import { CardImageUploadError, prepareCardImage } from "./card-image-storage";

export type PackActionState = { openingId?: string; packName?: string; balance?: number; cards?: Array<{ id: string; name: string; subtitle: string | null; rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY"; serialNumber: number; setCode: string; cardNumber: number; imageUrl: string | null }>; error?: string };

export async function openPackAction(_: PackActionState, formData: FormData): Promise<PackActionState> {
  const session = await auth();
  if (!session?.user.id || session.user.status !== "ACTIVE" || !session.user.profileCompletedAt) return { error: "Sign in and finish your profile before opening packs." };
  const parsed = openPackSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "The pack request was invalid." };
  try {
    const opening = await openPack({ userId: session.user.id, ...parsed.data, maxOpeningsPerMinute: getEnv().PACK_MAX_OPENINGS_PER_MINUTE });
    revalidatePath("/cards");
    revalidatePath("/play");
    return { openingId: opening.id, packName: opening.pack.name, balance: opening.balanceAfter, cards: opening.cards.map((card) => ({ id: card.id, name: card.definition.name, subtitle: card.definition.subtitle, rarity: card.definition.rarity, serialNumber: card.serialNumber, setCode: card.definition.set.code, cardNumber: card.definition.cardNumber, imageUrl: card.definition.imageUrl })) };
  } catch (error) {
    if (error instanceof PackFundsError) return { error: "You don’t have enough Crowns for this pack." };
    if (error instanceof PackUnavailableError) return { error: "This pack is no longer available." };
    if (error instanceof PackRateLimitError) return { error: "Slow down—your next pack will be ready in a moment." };
    return { error: "The pack could not be opened. No Crowns were changed." };
  }
}

function adminDone(message: string, error = false): never {
  revalidatePath("/admin/cards"); revalidatePath("/cards");
  redirect(`/admin/cards?${error ? "error" : "notice"}=${encodeURIComponent(message)}`);
}

export async function createSetAction(formData: FormData) {
  const session = await requireAdmin();
  const parsed = setSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) adminDone(parsed.error.issues[0]?.message ?? "Check the set.", true);
  const set = await prisma.cardSet.create({ data: parsed.data }).catch(() => null);
  if (!set) adminDone("That set code or data is already in use.", true);
  await prisma.adminAuditEntry.create({ data: { actorId: session.user.id, action: "CARD_SET_CREATED", targetType: "CardSet", targetId: set.id, summary: { code: set.code, active: set.active } } });
  adminDone("Card set created.");
}

export async function createCardAction(formData: FormData) {
  const session = await requireAdmin();
  const parsed = cardSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) adminDone(parsed.error.issues[0]?.message ?? "Check the card.", true);
  const image = formData.get("image");
  let storedImage: Awaited<ReturnType<typeof prepareCardImage>> | undefined;
  if (image instanceof File && image.size > 0) {
    try { storedImage = await prepareCardImage(image); }
    catch (error) { adminDone(error instanceof CardImageUploadError ? error.message : "The card image upload failed.", true); }
  }
  const card = await prisma.$transaction(async (tx) => {
    const created = await tx.cardDefinition.create({
      data: { ...parsed.data, imageUrl: storedImage ? null : parsed.data.imageUrl },
    });
    if (storedImage) {
      await tx.cardImage.create({
        data: { cardDefinitionId: created.id, ...storedImage },
      });
      return tx.cardDefinition.update({
        where: { id: created.id },
        data: { imageUrl: `/api/card-images/${created.id}` },
      });
    }
    return created;
  }).catch(() => null);
  if (!card) adminDone("That card number or data is already in use.", true);
  await prisma.adminAuditEntry.create({ data: { actorId: session.user.id, action: "CARD_DEFINITION_CREATED", targetType: "CardDefinition", targetId: card.id, summary: { rarity: card.rarity, cardNumber: card.cardNumber } } });
  adminDone("Card definition created.");
}

export async function createPackAction(formData: FormData) {
  const session = await requireAdmin();
  const parsed = packSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) adminDone(parsed.error.issues[0]?.message ?? "Check the pack.", true);
  if (parsed.data.active) {
    const definitions = await prisma.cardDefinition.groupBy({ by: ["rarity"], where: { setId: parsed.data.setId, active: true }, _count: true });
    const available = new Set(definitions.filter((entry) => entry._count > 0).map((entry) => entry.rarity));
    const required = [["COMMON", parsed.data.commonWeight], ["RARE", parsed.data.rareWeight], ["EPIC", parsed.data.epicWeight], ["LEGENDARY", parsed.data.legendaryWeight]] as const;
    const missing = required.find(([rarity, weight]) => weight > 0 && !available.has(rarity));
    if (missing) adminDone(`Add an active ${missing[0].toLowerCase()} card before publishing this drop table.`, true);
  }
  const pack = await prisma.packDefinition.create({ data: parsed.data });
  await prisma.adminAuditEntry.create({ data: { actorId: session.user.id, action: "PACK_DEFINITION_CREATED", targetType: "PackDefinition", targetId: pack.id, summary: { price: pack.price, cardsPerPack: pack.cardsPerPack, dropTableVersion: pack.dropTableVersion } } });
  adminDone("Pack definition created.");
}
