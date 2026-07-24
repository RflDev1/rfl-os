import { z } from "zod";

export const openPackSchema = z.object({ packId: z.string().cuid(), idempotencyKey: z.string().min(8).max(200) });

export const setSchema = z.object({ name: z.string().trim().min(2).max(80), code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,12}$/), description: z.string().trim().max(500).optional(), releasedAt: z.coerce.date(), active: z.preprocess((value) => value === "on" || value === true, z.boolean()) });

export const cardSchema = z.object({ setId: z.string().cuid(), fighterId: z.preprocess((value) => value === "" ? undefined : value, z.string().cuid().optional()), name: z.string().trim().min(2).max(80), subtitle: z.string().trim().max(120).optional(), rarity: z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY"]), cardNumber: z.coerce.number().int().min(1).max(9999), imageUrl: z.preprocess((value) => value === "" ? undefined : value, z.string().url().startsWith("https://").max(1000).optional()) });

export const packSchema = z.object({ setId: z.string().cuid(), name: z.string().trim().min(2).max(80), description: z.string().trim().max(300).optional(), price: z.coerce.number().int().min(1).max(1_000_000), cardsPerPack: z.coerce.number().int().min(1).max(10), commonWeight: z.coerce.number().int().min(0).max(1_000_000), rareWeight: z.coerce.number().int().min(0).max(1_000_000), epicWeight: z.coerce.number().int().min(0).max(1_000_000), legendaryWeight: z.coerce.number().int().min(0).max(1_000_000), active: z.preprocess((value) => value === "on" || value === true, z.boolean()) }).refine((data) => data.commonWeight + data.rareWeight + data.epicWeight + data.legendaryWeight > 0, "Drop weights must total more than zero.");
