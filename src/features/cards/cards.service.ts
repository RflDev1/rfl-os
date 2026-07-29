import { randomInt } from "node:crypto";
import { Prisma, type CardRarity } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { pickRarity, type DropWeights } from "./cards.logic";

export class PackFundsError extends Error {}
export class PackUnavailableError extends Error {}
export class PackRateLimitError extends Error {}

export async function openPack(input: { userId: string; packId: string; idempotencyKey: string; maxOpeningsPerMinute: number }, nextInt: (maximum: number) => number = randomInt) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${input.userId})) IS NULL AS "locked"`;
        const existing = await tx.packOpening.findUnique({ where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } }, include: { cards: { include: { definition: { include: { set: true } } }, orderBy: { serialNumber: "asc" } }, pack: true } });
        if (existing) return { ...existing, replayed: true };
        const pack = await tx.packDefinition.findUnique({ where: { id: input.packId }, include: { set: true } });
        if (!pack || !pack.active || !pack.set.active || pack.set.releasedAt > new Date()) throw new PackUnavailableError("This pack is unavailable.");
        await tx.$queryRaw`SELECT "id" FROM "card_definitions" WHERE "set_id" = ${pack.setId} FOR UPDATE`;
        const definitions = await tx.cardDefinition.findMany({
          where: { setId: pack.setId, active: true },
          include: { _count: { select: { instances: true } } },
        });
        const recent = await tx.packOpening.count({ where: { userId: input.userId, createdAt: { gt: new Date(Date.now() - 60_000) } } });
        if (recent >= input.maxOpeningsPerMinute) throw new PackRateLimitError("Pack opening rate limit reached.");
        const remaining = new Map(definitions.map((card) => [card.id, card.maxSupply === null ? Number.POSITIVE_INFINITY : card.maxSupply - card._count.instances]));
        const selections: typeof definitions = [];
        for (let index = 0; index < pack.cardsPerPack; index += 1) {
          const byRarity = new Map<CardRarity, typeof definitions>();
          for (const rarity of ["COMMON", "RARE", "EPIC", "LEGENDARY"] as const) byRarity.set(rarity, definitions.filter((card) => card.rarity === rarity && (remaining.get(card.id) ?? 0) > 0));
          const weights: DropWeights = { COMMON: byRarity.get("COMMON")!.length ? pack.commonWeight : 0, RARE: byRarity.get("RARE")!.length ? pack.rareWeight : 0, EPIC: byRarity.get("EPIC")!.length ? pack.epicWeight : 0, LEGENDARY: byRarity.get("LEGENDARY")!.length ? pack.legendaryWeight : 0 };
          if (Object.values(weights).every((weight) => weight === 0)) throw new PackUnavailableError("Not enough cards remain in this pack.");
          const rarity = pickRarity(weights, nextInt);
          const candidates = byRarity.get(rarity)!;
          const selected = candidates[nextInt(candidates.length)]!;
          selections.push(selected);
          remaining.set(selected.id, (remaining.get(selected.id) ?? 0) - 1);
        }
        const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
        if (!wallet || wallet.balance < pack.price) throw new PackFundsError("Not enough Crowns.");
        const balanceAfter = wallet.balance - pack.price;
        const opening = await tx.packOpening.create({ data: { userId: input.userId, packId: pack.id, price: pack.price, balanceAfter, dropTableVersion: pack.dropTableVersion, idempotencyKey: input.idempotencyKey } });
        await tx.wallet.update({ where: { id: wallet.id }, data: { balance: balanceAfter, version: { increment: 1 } } });
        await tx.walletEntry.create({ data: { walletId: wallet.id, delta: -pack.price, balanceAfter, reason: "PACK_PURCHASE", referenceId: opening.id, idempotencyKey: `${input.idempotencyKey}:purchase` } });
        for (const definition of selections) await tx.cardInstance.create({ data: { definitionId: definition.id, ownerId: input.userId, openingId: opening.id } });
        const committed = await tx.packOpening.findUniqueOrThrow({ where: { id: opening.id }, include: { cards: { include: { definition: { include: { set: true } } }, orderBy: { serialNumber: "asc" } }, pack: true } });
        return { ...committed, replayed: false };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error instanceof PackFundsError || error instanceof PackUnavailableError || error instanceof PackRateLimitError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await prisma.packOpening.findUnique({ where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } }, include: { cards: { include: { definition: { include: { set: true } } }, orderBy: { serialNumber: "asc" } }, pack: true } });
        if (existing) return { ...existing, replayed: true };
      }
      throw error;
    }
  }
  throw new Error("Pack could not open after retrying.");
}
