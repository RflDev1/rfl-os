import { z } from "zod";

export function listingSchema(minPrice: number, maxPrice: number) {
  return z.object({ cardInstanceId: z.string().cuid(), price: z.coerce.number().int("Use whole Crowns.").min(minPrice, `Minimum price is ${minPrice} Crowns.`).max(maxPrice, `Maximum price is ${maxPrice} Crowns.`) });
}

export const cancelListingSchema = z.object({ listingId: z.string().cuid() });
export const buyListingSchema = z.object({ listingId: z.string().cuid(), idempotencyKey: z.string().uuid() });
