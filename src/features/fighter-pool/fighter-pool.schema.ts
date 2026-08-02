import { z } from "zod";

export const poolReviewSchema = z.object({
  matchId: z.string().cuid(),
  action: z.enum(["UPHOLD", "REVERSE", "VOID"]),
  reason: z.string().trim().min(10, "Give a clear reason of at least 10 characters.").max(500),
  confirmation: z.literal("CONFIRM"),
});

export const heartbeatSchema = z.object({
  serverId: z.string().trim().min(1).max(80),
  kind: z.enum(["LOBBY", "ARENA"]),
  publicAddress: z.string().trim().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  status: z.enum(["AVAILABLE", "OFFLINE"]).default("AVAILABLE"),
  players: z.array(z.string().trim().min(1).max(16)).max(200),
});

export const checkInSchema = z.object({ serverId: z.string().min(1).max(80), code: z.string().trim().min(6).max(16), minecraftUsername: z.string().trim().min(1).max(16) });
export const matchStartedSchema = z.object({ serverId: z.string().trim().min(1).max(80), matchId: z.string().cuid() });
export const resultSchema = z.object({
  serverId: z.string().trim().min(1).max(80), matchId: z.string().cuid(), reportId: z.string().uuid(), winnerMinecraftUsername: z.string().trim().min(1).max(16),
  redRoundWins: z.number().int().min(0).max(2), blueRoundWins: z.number().int().min(0).max(2),
});
