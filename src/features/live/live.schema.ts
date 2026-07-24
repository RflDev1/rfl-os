import { z } from "zod";

export const liveUpdateSchema = z.object({
  eventId: z.string().min(1),
  fightId: z.string().transform((value) => value || undefined).optional(),
  kind: z.enum(["ANNOUNCEMENT", "FIGHT", "RESULT"]),
  message: z.string().trim().min(3).max(280),
});

export const fightStateSchema = z.object({
  fightId: z.string().min(1),
  status: z.enum(["SCHEDULED", "LIVE", "COMPLETED", "CANCELLED"]),
  result: z.preprocess((value) => value === "" ? undefined : value, z.enum(["RED_WIN", "BLUE_WIN", "DRAW", "NO_CONTEST"]).optional()),
  resultSummary: z.string().trim().max(160).transform((value) => value || undefined),
}).superRefine((value, context) => {
  if (value.status === "COMPLETED" && !value.result) context.addIssue({ code: "custom", message: "Choose a result before completing the fight.", path: ["result"] });
});

export const liveEventStateSchema = z.object({
  eventId: z.string().min(1),
  status: z.enum(["DRAFT", "SCHEDULED", "LIVE", "COMPLETED", "CANCELLED"]),
});
