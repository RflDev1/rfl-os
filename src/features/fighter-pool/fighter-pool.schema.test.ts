import { describe, expect, it } from "vitest";
import { liveEventSchema, resultSchema } from "./fighter-pool.schema";

const envelope = {
  schemaVersion: 1 as const,
  eventId: "c71904d7-af78-4cb8-b236-119633fb92e4",
  serverId: "bisect-arena-01",
  matchId: "cm12345678901234567890123",
  occurredAt: "2026-08-08T12:00:00.000Z",
};

const players = [
  { team: "RED" as const, fighterName: "RockGuy", minecraftUsername: "RITODOG" },
  { team: "BLUE" as const, fighterName: "Opponent", minecraftUsername: "PLAYER 2" },
];

describe("Fighter Pool bridge schemas", () => {
  it("accepts a round completion envelope", () => {
    expect(liveEventSchema.safeParse({ ...envelope, type: "ROUND_COMPLETED", data: { roundId: "duel:1", roundNumber: 1, winnerTeam: "RED", winnerMinecraftUsername: "RITODOG", loserTeam: "BLUE", loserMinecraftUsername: "PLAYER 2", redRoundWins: 1, blueRoundWins: 0, durationSeconds: 184, stats: [] } }).success).toBe(true);
  });

  it("rejects unsupported event types and invalid rounds", () => {
    expect(liveEventSchema.safeParse({ ...envelope, type: "SERVER_MESSAGE", data: {} }).success).toBe(false);
    expect(liveEventSchema.safeParse({ ...envelope, type: "ROUND_STARTING", data: { roundNumber: 4, countdownSeconds: 10, redRoundWins: 0, blueRoundWins: 0, players } }).success).toBe(false);
  });

  it("accepts the extended official result contract", () => {
    expect(resultSchema.safeParse({ serverId: envelope.serverId, matchId: envelope.matchId, reportId: envelope.eventId, winnerMinecraftUsername: "RITODOG", redRoundWins: 2, blueRoundWins: 1, schemaVersion: 1, completedAt: envelope.occurredAt, winnerTeam: "RED", completionReason: "BEST_OF_THREE", rounds: [] }).success).toBe(true);
  });
});
