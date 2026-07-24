import { z } from "zod";

export const testingResetSchema = z.object({
  confirmation: z.literal("RESET PLAYRFL", { error: "Type RESET PLAYRFL exactly." }),
  acknowledge: z.literal("on", { error: "Confirm that you understand this cannot be undone." }),
});
