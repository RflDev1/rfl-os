import { z } from "zod";

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(3, "Use at least 3 characters.")
    .max(24, "Keep your name under 25 characters.")
    .regex(/^[a-zA-Z0-9 _-]+$/, "Use letters, numbers, spaces, dashes, or underscores."),
  acceptedRules: z.literal("on", { error: "Accept the player rules to continue." }),
});

export type ProfileState = { error?: string; fields?: { displayName?: string } };

