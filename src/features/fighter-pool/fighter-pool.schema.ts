import { z } from "zod";

export const poolReviewSchema = z.object({
  matchId: z.string().cuid(),
  action: z.enum(["UPHOLD", "REVERSE", "VOID"]),
  reason: z.string().trim().min(10, "Give a clear reason of at least 10 characters.").max(500),
  confirmation: z.literal("CONFIRM"),
});

export const poolEndMatchSchema = z.object({
  matchId: z.string().cuid(),
  reason: z.string().trim().min(10, "Give a clear reason of at least 10 characters.").max(500),
  confirmation: z.literal("END MATCH"),
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
  schemaVersion: z.literal(1).default(1),
  completedAt: z.string().datetime().optional(),
  winnerTeam: z.enum(["RED", "BLUE"]).optional(),
  completionReason: z.enum(["BEST_OF_THREE", "DISCONNECT_FORFEIT"]).default("BEST_OF_THREE"),
  forfeitingMinecraftUsername: z.string().trim().min(1).max(16).optional(),
  rounds: z.array(z.unknown()).max(3).optional(),
});

const playerSchema = z.object({
  team: z.enum(["RED", "BLUE"]),
  fighterName: z.string().trim().min(1).max(100),
  minecraftUsername: z.string().trim().min(1).max(16),
});

const eventBaseSchema = z.object({
  schemaVersion: z.literal(1),
  eventId: z.string().uuid(),
  serverId: z.string().trim().min(1).max(80),
  matchId: z.string().cuid(),
  occurredAt: z.string().datetime(),
});

export const liveEventSchema = z.discriminatedUnion("type", [
  eventBaseSchema.extend({ type: z.literal("FIGHTER_CHECKED_IN"), data: z.object({ minecraftUsername: z.string().trim().min(1).max(16), ready: z.boolean(), players: z.array(playerSchema).length(2) }) }),
  eventBaseSchema.extend({ type: z.literal("MATCH_READY"), data: z.object({ players: z.array(playerSchema).length(2) }) }),
  eventBaseSchema.extend({ type: z.literal("ROUND_STARTING"), data: z.object({ roundNumber: z.number().int().min(1).max(3), countdownSeconds: z.number().int().min(0).max(60), redRoundWins: z.number().int().min(0).max(2), blueRoundWins: z.number().int().min(0).max(2), players: z.array(playerSchema).length(2) }) }),
  eventBaseSchema.extend({ type: z.literal("ROUND_COMPLETED"), data: z.object({ roundId: z.string().trim().min(1).max(120), roundNumber: z.number().int().min(1).max(3), winnerTeam: z.enum(["RED", "BLUE"]), winnerMinecraftUsername: z.string().trim().min(1).max(16), loserTeam: z.enum(["RED", "BLUE"]), loserMinecraftUsername: z.string().trim().min(1).max(16), redRoundWins: z.number().int().min(0).max(2), blueRoundWins: z.number().int().min(0).max(2), durationSeconds: z.number().int().min(0).max(86_400).optional(), stats: z.array(z.unknown()).max(20).optional() }) }),
  eventBaseSchema.extend({ type: z.literal("PLAYER_DISCONNECTED"), data: z.object({ minecraftUsername: z.string().trim().min(1).max(16), graceSeconds: z.literal(0), forfeited: z.literal(true) }) }),
  eventBaseSchema.extend({ type: z.literal("PLAYER_RECONNECTED"), data: z.object({ minecraftUsername: z.string().trim().min(1).max(16) }) }),
  eventBaseSchema.extend({ type: z.literal("MATCH_COMPLETED"), data: z.object({ winnerTeam: z.enum(["RED", "BLUE"]), winnerMinecraftUsername: z.string().trim().min(1).max(16), redRoundWins: z.number().int().min(0).max(2), blueRoundWins: z.number().int().min(0).max(2), completionReason: z.enum(["BEST_OF_THREE", "DISCONNECT_FORFEIT"]), rounds: z.array(z.unknown()).max(3).optional() }) }),
]);

export type FighterPoolLiveEventInput = z.infer<typeof liveEventSchema>;
