"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { buyListing, cancelListing, createListing, ListingOwnershipError, ListingUnavailableError, MarketplaceFundsError } from "./marketplace.service";
import { buyListingSchema, cancelListingSchema, listingSchema } from "./marketplace.schema";

async function playerId() {
  const session = await auth();
  return session?.user.status === "ACTIVE" && session.user.profileCompletedAt ? session.user.id : null;
}

export async function createListingAction(formData: FormData) {
  const sellerId = await playerId();
  if (!sellerId) redirect("/signin");
  const env = getEnv();
  const parsed = listingSchema(env.MARKET_MIN_PRICE, env.MARKET_MAX_PRICE).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/market/sell/${String(formData.get("cardInstanceId"))}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the price.")}`);
  let listing;
  try {
    listing = await createListing({ sellerId, ...parsed.data });
  } catch (error) {
    const message = error instanceof ListingOwnershipError || error instanceof ListingUnavailableError ? error.message : "The card could not be listed.";
    redirect(`/market/sell/${parsed.data.cardInstanceId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/market"); revalidatePath("/market/mine"); revalidatePath("/cards");
  redirect(`/market/${listing.id}?notice=${encodeURIComponent("Listing is live.")}`);
}

export async function cancelListingAction(formData: FormData) {
  const sellerId = await playerId();
  if (!sellerId) redirect("/signin");
  const parsed = cancelListingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/market/mine?error=Invalid+listing");
  try { await cancelListing({ sellerId, listingId: parsed.data.listingId }); }
  catch (error) { redirect(`/market/mine?error=${encodeURIComponent(error instanceof Error ? error.message : "Cancellation failed.")}`); }
  revalidatePath("/market"); revalidatePath("/market/mine");
  redirect("/market/mine?notice=Listing+cancelled");
}

export type PurchaseState = { success?: string; error?: string };

export async function buyListingAction(_: PurchaseState, formData: FormData): Promise<PurchaseState> {
  const buyerId = await playerId();
  if (!buyerId) return { error: "Sign in and finish your profile before buying." };
  const values = Object.fromEntries(formData);
  if (!values.idempotencyKey) values.idempotencyKey = randomUUID();
  const parsed = buyListingSchema.safeParse(values);
  if (!parsed.success) return { error: "The purchase request was invalid." };
  try {
    await buyListing({ buyerId, ...parsed.data });
    revalidatePath("/market"); revalidatePath("/market/mine"); revalidatePath("/cards"); revalidatePath("/play");
    return { success: "Purchase complete. The card is now in your collection." };
  } catch (error) {
    if (error instanceof MarketplaceFundsError) return { error: "You don’t have enough Crowns." };
    if (error instanceof ListingUnavailableError) return { error: "Another collector already bought or cancelled this listing." };
    if (error instanceof ListingOwnershipError) return { error: error.message };
    return { error: "The purchase could not complete. No Crowns were changed." };
  }
}
