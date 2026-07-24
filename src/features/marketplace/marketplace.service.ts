import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { sellerProceeds } from "./marketplace.logic";

export class ListingOwnershipError extends Error {}
export class ListingUnavailableError extends Error {}
export class MarketplaceFundsError extends Error {}

export async function createListing(input: { sellerId: string; cardInstanceId: string; price: number }) {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${input.cardInstanceId})) IS NULL AS "locked"`;
      const card = await tx.cardInstance.findUnique({ where: { id: input.cardInstanceId } });
      if (!card || card.ownerId !== input.sellerId) throw new ListingOwnershipError("You do not own this card.");
      return tx.marketListing.create({ data: { cardInstanceId: card.id, sellerId: input.sellerId, price: input.price } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof ListingOwnershipError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ListingUnavailableError("This card is already listed.");
    throw error;
  }
}

export async function cancelListing(input: { sellerId: string; listingId: string }) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${input.listingId})) IS NULL AS "locked"`;
    const listing = await tx.marketListing.findUnique({ where: { id: input.listingId }, include: { card: true } });
    if (!listing || listing.sellerId !== input.sellerId) throw new ListingOwnershipError("You do not own this listing.");
    if (listing.status !== "ACTIVE" || listing.card.ownerId !== input.sellerId) throw new ListingUnavailableError("This listing is no longer active.");
    return tx.marketListing.update({ where: { id: listing.id }, data: { status: "CANCELLED", closedAt: new Date() } });
  }, { isolationLevel: "Serializable" });
}

async function buyListingOnce(input: { buyerId: string; listingId: string; idempotencyKey: string }) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${input.listingId})) IS NULL AS "locked"`;
    const replay = await tx.marketSale.findUnique({ where: { buyerId_idempotencyKey: { buyerId: input.buyerId, idempotencyKey: input.idempotencyKey } } });
    if (replay) return { ...replay, replayed: true };
    const listing = await tx.marketListing.findUnique({ where: { id: input.listingId }, include: { card: true } });
    if (!listing || listing.status !== "ACTIVE" || listing.card.ownerId !== listing.sellerId) throw new ListingUnavailableError("This listing is no longer available.");
    if (listing.sellerId === input.buyerId) throw new ListingOwnershipError("You cannot buy your own listing.");
    const [firstUserId, secondUserId] = [input.buyerId, listing.sellerId].sort();
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`wallet:${firstUserId}`})) IS NULL AS "locked"`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`wallet:${secondUserId}`})) IS NULL AS "locked"`;
    const [buyerWallet, sellerWallet] = await Promise.all([tx.wallet.findUnique({ where: { userId: input.buyerId } }), tx.wallet.findUnique({ where: { userId: listing.sellerId } })]);
    if (!buyerWallet || buyerWallet.balance < listing.price) throw new MarketplaceFundsError("Not enough Crowns.");
    if (!sellerWallet) throw new ListingUnavailableError("The seller cannot receive Crowns.");
    const { fee, proceeds } = sellerProceeds(listing.price);
    const buyerBalance = buyerWallet.balance - listing.price;
    const sellerBalance = sellerWallet.balance + proceeds;
    const sale = await tx.marketSale.create({ data: { listingId: listing.id, cardInstanceId: listing.cardInstanceId, buyerId: input.buyerId, sellerId: listing.sellerId, price: listing.price, fee, idempotencyKey: input.idempotencyKey } });
    await tx.wallet.update({ where: { id: buyerWallet.id }, data: { balance: buyerBalance, version: { increment: 1 } } });
    await tx.wallet.update({ where: { id: sellerWallet.id }, data: { balance: sellerBalance, version: { increment: 1 } } });
    await tx.walletEntry.create({ data: { walletId: buyerWallet.id, delta: -listing.price, balanceAfter: buyerBalance, reason: "MARKET_PURCHASE", referenceId: sale.id, idempotencyKey: `market:${sale.id}:purchase` } });
    await tx.walletEntry.create({ data: { walletId: sellerWallet.id, delta: proceeds, balanceAfter: sellerBalance, reason: "MARKET_SALE", referenceId: sale.id, idempotencyKey: `market:${sale.id}:sale` } });
    await tx.cardInstance.update({ where: { id: listing.cardInstanceId }, data: { ownerId: input.buyerId } });
    await tx.marketListing.update({ where: { id: listing.id }, data: { status: "SOLD", closedAt: new Date() } });
    return { ...sale, replayed: false };
  }, { isolationLevel: "Serializable" });
}

export async function buyListing(input: { buyerId: string; listingId: string; idempotencyKey: string }) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await buyListingOnce(input); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const replay = await prisma.marketSale.findUnique({ where: { buyerId_idempotencyKey: { buyerId: input.buyerId, idempotencyKey: input.idempotencyKey } } });
        if (replay) return { ...replay, replayed: true };
      }
      throw error;
    }
  }
  throw new Error("Marketplace purchase could not complete after retrying.");
}
