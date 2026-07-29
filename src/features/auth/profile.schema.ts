import { z } from "zod";
import { isAtLeastAge, MINIMUM_ACCOUNT_AGE, parseDateOfBirth } from "@/lib/legal";

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(3, "Use at least 3 characters.")
    .max(24, "Keep your name under 25 characters.")
    .regex(/^[a-zA-Z0-9 _-]+$/, "Use letters, numbers, spaces, dashes, or underscores."),
  acceptedRules: z.literal("on", { error: "Accept the player rules to continue." }),
  acceptedTerms: z.literal("on", { error: "You must agree to the Terms and Conditions." }),
  acceptedPrivacy: z.literal("on", { error: "You must acknowledge the Privacy Policy." }),
  dateOfBirth: z.string().refine((value) => {
    const date = parseDateOfBirth(value);
    return Boolean(date && date <= new Date() && isAtLeastAge(date, MINIMUM_ACCOUNT_AGE));
  }, `You must provide a valid birthday and be at least ${MINIMUM_ACCOUNT_AGE}.`),
});

export type ProfileState = { error?: string; fields?: { displayName?: string; dateOfBirth?: string } };
