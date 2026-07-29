"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/features/admin/authorization";
import { auth } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { cardSchema, entityIdSchema, openPackSchema, packSchema, setSchema, updateCardSchema } from "./cards.schema";
import { openPack, PackFundsError, PackRateLimitError, PackUnavailableError } from "./cards.service";
import { CardImageUploadError, prepareCardImage } from "./card-image-storage";

export type PackActionState = { openingId?: string; packName?: string; balance?: number; cards?: Array<{ id: string; name: string; subtitle: string | null; rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY"; serialNumber: number; setCode: string; cardNumber: number; maxSupply: number | null; imageUrl: string | null }>; error?: string };

export async function openPackAction(_: PackActionState, formData: FormData): Promise<PackActionState> {
  const session = await auth();
  if (!session?.user.id || session.user.status !== "ACTIVE" || !session.user.profileCompletedAt) return { error: "Sign in and finish your profile before opening packs." };
  const parsed = openPackSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "The pack request was invalid." };
  try {
    const opening = await openPack({ userId: session.user.id, ...parsed.data, maxOpeningsPerMinute: getEnv().PACK_MAX_OPENINGS_PER_MINUTE });
    revalidatePath("/cards");
    revalidatePath("/play");
    return { openingId: opening.id, packName: opening.pack.name, balance: opening.balanceAfter, cards: opening.cards.map((card) => ({ id: card.id, name: card.definition.name, subtitle: card.definition.subtitle, rarity: card.definition.rarity, serialNumber: card.serialNumber, setCode: card.definition.set.code, cardNumber: card.definition.cardNumber, maxSupply: card.definition.maxSupply, imageUrl: card.definition.imageUrl })) };
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

function formId(formData: FormData) {
  const parsed = entityIdSchema.safeParse(formData.get("id"));
  if (!parsed.success) adminDone("That catalog item is invalid.", true);
  return parsed.data;
}

export async function updateSetAction(formData: FormData) {
  const session = await requireAdmin();
  const id = formId(formData);
  const parsed = setSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) adminDone(parsed.error.issues[0]?.message ?? "Check the set.", true);
  const set = await prisma.cardSet.update({ where: { id }, data: parsed.data }).catch(() => null);
  if (!set) adminDone("The set could not be updated. Its code may already be in use.", true);
  await prisma.adminAuditEntry.create({ data: { actorId: session.user.id, action: "CARD_SET_UPDATED", targetType: "CardSet", targetId: id, summary: { code: set.code, active: set.active } } });
  adminDone("Card set updated.");
}

export async function deleteSetAction(formData: FormData) {
  const session = await requireAdmin();
  const id = formId(formData);
  const set = await prisma.cardSet.findUnique({ where: { id }, include: { _count: { select: { definitions: true, packs: true } } } });
  if (!set) adminDone("Card set not found.", true);
  if (set._count.definitions || set._count.packs) adminDone("Remove this set’s unused cards and packs first. Published history cannot be erased.", true);
  await prisma.cardSet.delete({ where: { id } });
  await prisma.adminAuditEntry.create({ data: { actorId: session.user.id, action: "CARD_SET_DELETED", targetType: "CardSet", targetId: id, summary: { code: set.code } } });
  adminDone("Unused card set deleted.");
}

export async function updateCardAction(formData: FormData) {
  const session = await requireAdmin();
  const id = formId(formData);
  const parsed = updateCardSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) adminDone(parsed.error.issues[0]?.message ?? "Check the card.", true);
  const existing = await prisma.cardDefinition.findUnique({ where: { id }, include: { _count: { select: { instances: true } } } });
  if (!existing) adminDone("Card not found.", true);
  if (existing._count.instances > 0 && (parsed.data.setId !== existing.setId || parsed.data.cardNumber !== existing.cardNumber)) adminDone("The set and card number are locked after the first copy is issued.", true);
  if (existing.maxSupply === 1 && existing._count.instances > 0 && parsed.data.maxSupply !== 1) adminDone("An issued 1 of 1 must remain permanently unique.", true);
  if (parsed.data.maxSupply === 1 && existing._count.instances > 1) adminDone("This card already has multiple issued copies, so it cannot become a 1 of 1.", true);
  const card = await prisma.cardDefinition.update({ where: { id }, data: parsed.data }).catch(() => null);
  if (!card) adminDone("The card could not be updated. Its number may already be in use.", true);
  await prisma.adminAuditEntry.create({ data: { actorId: session.user.id, action: "CARD_DEFINITION_UPDATED", targetType: "CardDefinition", targetId: id, summary: { active: card.active, maxSupply: card.maxSupply } } });
  adminDone("Card updated.");
}

export async function deleteCardAction(formData: FormData) {
  const session = await requireAdmin();
  const id = formId(formData);
  const card = await prisma.cardDefinition.findUnique({ where: { id }, include: { _count: { select: { instances: true } } } });
  if (!card) adminDone("Card not found.", true);
  if (card._count.instances) adminDone("Issued cards cannot be deleted. Mark this card inactive instead.", true);
  await prisma.cardDefinition.delete({ where: { id } });
  await prisma.adminAuditEntry.create({ data: { actorId: session.user.id, action: "CARD_DEFINITION_DELETED", targetType: "CardDefinition", targetId: id, summary: { name: card.name } } });
  adminDone("Unused card deleted.");
}

export async function updatePackAction(formData: FormData) {
  const session = await requireAdmin();
  const id = formId(formData);
  const parsed = packSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) adminDone(parsed.error.issues[0]?.message ?? "Check the pack.", true);
  const existing = await prisma.packDefinition.findUnique({ where: { id }, include: { _count: { select: { openings: true } } } });
  if (!existing) adminDone("Pack not found.", true);
  if (existing._count.openings && parsed.data.setId !== existing.setId) adminDone("A pack’s set is locked after its first opening.", true);
  const pack = await prisma.packDefinition.update({ where: { id }, data: { ...parsed.data, dropTableVersion: { increment: 1 } } });
  await prisma.adminAuditEntry.create({ data: { actorId: session.user.id, action: "PACK_DEFINITION_UPDATED", targetType: "PackDefinition", targetId: id, summary: { active: pack.active, dropTableVersion: pack.dropTableVersion } } });
  adminDone("Pack updated and its drop-table version advanced.");
}

export async function deletePackAction(formData: FormData) {
  const session = await requireAdmin();
  const id = formId(formData);
  const pack = await prisma.packDefinition.findUnique({ where: { id }, include: { _count: { select: { openings: true } } } });
  if (!pack) adminDone("Pack not found.", true);
  if (pack._count.openings) adminDone("Opened packs cannot be deleted. Mark this pack inactive instead.", true);
  await prisma.packDefinition.delete({ where: { id } });
  await prisma.adminAuditEntry.create({ data: { actorId: session.user.id, action: "PACK_DEFINITION_DELETED", targetType: "PackDefinition", targetId: id, summary: { name: pack.name } } });
  adminDone("Unused pack deleted.");
}
