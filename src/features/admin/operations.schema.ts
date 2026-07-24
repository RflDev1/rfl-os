import { z } from "zod";

const reason = z.string().trim().min(10, "Give a clear reason of at least 10 characters.").max(300);
const confirmation = z.literal("CONFIRM", "Type CONFIRM to continue.");

export const userStatusSchema = z.object({ userId: z.string().cuid(), status: z.enum(["ACTIVE", "SUSPENDED"]), reason, confirmation });
export const userRoleSchema = z.object({ userId: z.string().cuid(), role: z.enum(["MODERATOR", "ADMIN"]), operation: z.enum(["GRANT", "REVOKE"]), reason, confirmation });
export const moderateListingSchema = z.object({ listingId: z.string().cuid(), reason, confirmation });
