import { z } from "zod";

export const requestFightSchema = z.object({ opponentFighterId: z.string().cuid() });
export const reviewFightRequestSchema = z.object({ requestId: z.string().cuid(), operation: z.enum(["APPROVE", "DECLINE"]), eventId: z.preprocess((value) => value === "" ? undefined : value, z.string().cuid().optional()) }).refine((data) => data.operation !== "APPROVE" || data.eventId, { message: "Choose an event for approval." });
export const retryNotificationSchema = z.object({ notificationId: z.string().cuid() });
export const assignFighterSchema = z.object({ fighterId: z.string().cuid(), userId: z.string().cuid() });
export const fighterStatusSchema = z.object({ fighterId: z.string().cuid(), status: z.enum(["ACTIVE", "SUSPENDED", "INACTIVE"]) });
