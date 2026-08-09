import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import type { FighterPoolLiveEventInput } from "./fighter-pool.schema";

const ACTIVE_MATCH_STATES = ["AWAITING_CHECKIN", "READY", "LIVE"] as const;
const MATCHMAKING_LOCK = 9_184_221;
const SOLO_TEST_SERVER_ID = "admin-solo-test";

export class FighterPoolError extends Error {}

export function normalizeGamertag(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function codeSecret() {
  const env = getEnv();
  return createHash("sha256").update(env.FIGHT_POOL_CODE_SECRET ?? env.AUTH_SECRET).digest();
}

function createFightCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function hashCode(code: string) {
  return createHash("sha256").update(codeSecret()).update(code.toUpperCase()).digest("hex");
}

function encryptCode(code: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", codeSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptFightCode(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new FighterPoolError("Invalid encrypted fight code.");
  const decipher = createDecipheriv("aes-256-gcm", codeSecret(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}

async function addWalletReward(tx: Prisma.TransactionClient, userId: string, amount: number, matchId: string, suffix: string) {
  if (amount <= 0) return;
  const wallet = await tx.wallet.upsert({ where: { userId }, create: { userId }, update: {} });
  const updated = await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: amount }, version: { increment: 1 } } });
  await tx.walletEntry.create({
    data: { walletId: wallet.id, delta: amount, balanceAfter: updated.balance, reason: "FIGHT_POOL_WIN", referenceId: matchId, idempotencyKey: `pool:${matchId}:${suffix}:credit` },
  });
}

async function removeWalletReward(tx: Prisma.TransactionClient, userId: string, amount: number, matchId: string, suffix: string) {
  if (amount <= 0) return;
  const wallet = await tx.wallet.findUnique({ where: { userId } });
  if (!wallet || wallet.balance < amount) throw new FighterPoolError("The original reward has already been spent. Adjust the wallet before reviewing this result.");
  const updated = await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { decrement: amount }, version: { increment: 1 } } });
  await tx.walletEntry.create({
    data: { walletId: wallet.id, delta: -amount, balanceAfter: updated.balance, reason: "FIGHT_POOL_REVERSAL", referenceId: matchId, idempotencyKey: `pool:${matchId}:${suffix}:debit` },
  });
}

async function setTwoRanks(tx: Prisma.TransactionClient, firstId: string, firstRank: number, secondId: string, secondRank: number) {
  await tx.fighter.update({ where: { id: firstId }, data: { rank: null } });
  await tx.fighter.update({ where: { id: secondId }, data: { rank: null } });
  await tx.fighter.update({ where: { id: firstId }, data: { rank: firstRank } });
  await tx.fighter.update({ where: { id: secondId }, data: { rank: secondRank } });
}

async function applyWin(tx: Prisma.TransactionClient, winner: { id: string; userId: string | null; rank: number | null }, loser: { id: string; rank: number | null }, reward: number, matchId: string, suffix: string) {
  await tx.fighter.update({ where: { id: winner.id }, data: { wins: { increment: 1 } } });
  await tx.fighter.update({ where: { id: loser.id }, data: { losses: { increment: 1 } } });
  let swapped = false;
  if (winner.rank && loser.rank && winner.rank > loser.rank) {
    await setTwoRanks(tx, winner.id, loser.rank, loser.id, winner.rank);
    swapped = true;
  }
  if (!winner.userId) throw new FighterPoolError("The winning fighter is no longer linked to an account.");
  await addWalletReward(tx, winner.userId, reward, matchId, suffix);
  return swapped;
}

export async function getFighterPoolState(userId: string) {
  const env = getEnv();
  const fighter = await prisma.fighter.findUnique({ where: { userId }, include: { poolQueueEntry: true } });
  if (!fighter) return { enabled: env.FIGHT_POOL_ENABLED, fighter: null, inLobby: false, match: null, queuePosition: null, history: [] };
  const presenceCutoff = new Date(Date.now() - env.FIGHT_POOL_PRESENCE_TTL_SECONDS * 1000);
  const [presence, match, history] = await Promise.all([
    fighter.minecraftUsernameNormalized ? prisma.fighterPoolPresence.findFirst({ where: { minecraftUsernameNormalized: fighter.minecraftUsernameNormalized, lastSeenAt: { gte: presenceCutoff } } }) : null,
    prisma.fighterPoolMatch.findFirst({
      where: { OR: [
        { status: { in: [...ACTIVE_MATCH_STATES] }, OR: [{ redFighterId: fighter.id }, { blueFighterId: fighter.id }] },
        { status: "COMPLETED", completedAt: { gte: new Date(Date.now() - 30 * 60_000) }, OR: [{ redFighterId: fighter.id, redExitedAt: null }, { blueFighterId: fighter.id, blueExitedAt: null }] },
      ] },
      include: { redFighter: true, blueFighter: true, assignedServer: true, rounds: { orderBy: { roundNumber: "asc" } } }, orderBy: { createdAt: "desc" },
    }),
    prisma.fighterPoolMatch.findMany({
      where: { status: "COMPLETED", OR: [{ redFighterId: fighter.id }, { blueFighterId: fighter.id }] },
      include: { redFighter: true, blueFighter: true, winnerFighter: true }, orderBy: { completedAt: "desc" }, take: 10,
    }),
  ]);
  const queuePosition = fighter.poolQueueEntry ? await prisma.fighterPoolQueueEntry.count({ where: { joinedAt: { lte: fighter.poolQueueEntry.joinedAt } } }) : null;
  const isLiveSummary = match ? Boolean(match.startedAt || match.currentRound || match.rounds.length || match.status === "COMPLETED") : false;
  const participantMatch = match ? {
    id: match.id,
    status: match.status,
    opponent: match.redFighterId === fighter.id ? match.blueFighter.name : match.redFighter.name,
    code: isLiveSummary ? null : decryptFightCode(match.redFighterId === fighter.id ? match.redCodeEncrypted : match.blueCodeEncrypted),
    expiresAt: match.codeExpiresAt,
    serverAddress: match.assignedServer?.publicAddress ?? null,
    serverPort: match.assignedServer?.port ?? null,
    checkedIn: match.redFighterId === fighter.id ? Boolean(match.redCheckedInAt) : Boolean(match.blueCheckedInAt),
    checkIn: {
      red: { fighterName: match.redFighter.name, minecraftUsername: match.redFighter.minecraftUsername, checkedIn: Boolean(match.redCheckedInAt) },
      blue: { fighterName: match.blueFighter.name, minecraftUsername: match.blueFighter.minecraftUsername, checkedIn: Boolean(match.blueCheckedInAt) },
    },
    canCancel: match.startedAt === null && ["AWAITING_CHECKIN", "READY"].includes(match.status),
    live: isLiveSummary ? {
      red: { fighterName: match.redFighter.name, minecraftUsername: match.redFighter.minecraftUsername, checkedIn: Boolean(match.redCheckedInAt), roundWins: match.redRoundWins },
      blue: { fighterName: match.blueFighter.name, minecraftUsername: match.blueFighter.minecraftUsername, checkedIn: Boolean(match.blueCheckedInAt), roundWins: match.blueRoundWins },
      currentRound: match.currentRound,
      countdownSeconds: match.countdownSeconds,
      countdownStartedAt: match.countdownStartedAt,
      disconnectedUsername: match.disconnectedUsername,
      reconnectDeadlineAt: match.reconnectDeadlineAt,
      winnerFighterName: match.winnerFighterId === match.redFighterId ? match.redFighter.name : match.winnerFighterId === match.blueFighterId ? match.blueFighter.name : null,
      rounds: match.rounds.map((round) => ({ roundId: round.roundId, roundNumber: round.roundNumber, winnerTeam: round.winnerTeam, winnerMinecraftUsername: round.winnerMinecraftUsername, redRoundWins: round.redRoundWins, blueRoundWins: round.blueRoundWins })),
    } : null,
  } : null;
  return { enabled: env.FIGHT_POOL_ENABLED, fighter, inLobby: Boolean(presence), match: participantMatch, queuePosition, history };
}

export async function joinFighterPool(userId: string) {
  const env = getEnv();
  if (!env.FIGHT_POOL_ENABLED) throw new FighterPoolError("The Fighter Pool is not open yet.");
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${MATCHMAKING_LOCK})`;
    const fighter = await tx.fighter.findUnique({ where: { userId }, include: { user: true } });
    if (!fighter || fighter.status !== "ACTIVE" || fighter.user?.status !== "ACTIVE" || !fighter.rank || !fighter.minecraftUsernameNormalized) throw new FighterPoolError("An active ranked fighter with a Bedrock gamertag is required.");
    const active = await tx.fighterPoolMatch.findFirst({ where: { status: { in: [...ACTIVE_MATCH_STATES] }, OR: [{ redFighterId: fighter.id }, { blueFighterId: fighter.id }] } });
    if (active) return { matched: true, matchId: active.id };
    const cutoff = new Date(Date.now() - env.FIGHT_POOL_PRESENCE_TTL_SECONDS * 1000);
    const present = await tx.fighterPoolPresence.findFirst({ where: { minecraftUsernameNormalized: fighter.minecraftUsernameNormalized, lastSeenAt: { gte: cutoff } } });
    if (!present) throw new FighterPoolError("Join the RFL Bedrock lobby before entering the Fighter Pool.");
    await tx.fighterPoolQueueEntry.upsert({ where: { fighterId: fighter.id }, create: { fighterId: fighter.id, rank: fighter.rank }, update: { rank: fighter.rank } });
    const opponentEntry = await tx.fighterPoolQueueEntry.findFirst({
      where: { fighterId: { not: fighter.id }, rank: { gte: fighter.rank - env.FIGHT_REQUEST_RANK_RANGE, lte: fighter.rank + env.FIGHT_REQUEST_RANK_RANGE }, fighter: { status: "ACTIVE", userId: { not: null }, minecraftUsernameNormalized: { not: null } } },
      include: { fighter: true }, orderBy: { joinedAt: "asc" },
    });
    if (!opponentEntry?.fighter.minecraftUsernameNormalized) return { matched: false, matchId: null };
    const opponentPresent = await tx.fighterPoolPresence.findFirst({ where: { minecraftUsernameNormalized: opponentEntry.fighter.minecraftUsernameNormalized, lastSeenAt: { gte: cutoff } } });
    if (!opponentPresent) { await tx.fighterPoolQueueEntry.delete({ where: { fighterId: opponentEntry.fighterId } }); return { matched: false, matchId: null }; }
    const server = await tx.fighterPoolServer.findFirst({ where: { kind: "ARENA", status: "AVAILABLE", currentMatchId: null, lastHeartbeatAt: { gte: cutoff } }, orderBy: { id: "asc" } });
    if (!server) return { matched: false, matchId: null };
    const redCode = createFightCode(); const blueCode = createFightCode();
    const match = await tx.fighterPoolMatch.create({ data: {
      redFighterId: opponentEntry.fighter.id, blueFighterId: fighter.id,
      redRankSnapshot: opponentEntry.fighter.rank!, blueRankSnapshot: fighter.rank,
      redCodeHash: hashCode(redCode), redCodeEncrypted: encryptCode(redCode), blueCodeHash: hashCode(blueCode), blueCodeEncrypted: encryptCode(blueCode),
      codeExpiresAt: new Date(Date.now() + env.FIGHT_POOL_CODE_TTL_MINUTES * 60_000), arenaServerId: server.id,
    } });
    await tx.fighterPoolQueueEntry.deleteMany({ where: { fighterId: { in: [fighter.id, opponentEntry.fighter.id] } } });
    await tx.fighterPoolServer.update({ where: { id: server.id }, data: { status: "RESERVED", currentMatchId: match.id } });
    return { matched: true, matchId: match.id };
  }, { isolationLevel: "Serializable" });
}

export async function leaveFighterPool(userId: string) {
  const fighter = await prisma.fighter.findUnique({ where: { userId }, select: { id: true } });
  if (fighter) await prisma.fighterPoolQueueEntry.deleteMany({ where: { fighterId: fighter.id } });
}

export async function exitCompletedPoolMatch(userId: string) {
  return prisma.$transaction(async (tx) => {
    const fighter = await tx.fighter.findUnique({ where: { userId }, select: { id: true } });
    if (!fighter) throw new FighterPoolError("An RFL fighter profile is required.");
    const match = await tx.fighterPoolMatch.findFirst({
      where: { status: "COMPLETED", OR: [{ redFighterId: fighter.id, redExitedAt: null }, { blueFighterId: fighter.id, blueExitedAt: null }] },
      orderBy: { completedAt: "desc" },
      select: { id: true, redFighterId: true },
    });
    if (!match) throw new FighterPoolError("There is no completed Fighter Pool match to exit.");
    await tx.fighterPoolMatch.update({
      where: { id: match.id },
      data: match.redFighterId === fighter.id ? { redExitedAt: new Date() } : { blueExitedAt: new Date() },
    });
    return match;
  });
}

export async function cancelUnstartedPoolMatch(userId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${MATCHMAKING_LOCK})`;
    const fighter = await tx.fighter.findUnique({ where: { userId }, select: { id: true } });
    if (!fighter) throw new FighterPoolError("An active Fighter Pool match was not found.");
    const match = await tx.fighterPoolMatch.findFirst({
      where: { status: { in: ["AWAITING_CHECKIN", "READY"] }, OR: [{ redFighterId: fighter.id }, { blueFighterId: fighter.id }] },
      include: { assignedServer: true },
      orderBy: { createdAt: "desc" },
    });
    if (!match) throw new FighterPoolError("This match has already started or is no longer active.");
    if (match.startedAt) throw new FighterPoolError("A match cannot be cancelled after Minecraft gameplay begins.");
    await tx.fighterPoolMatch.update({ where: { id: match.id }, data: { status: "CANCELLED" } });
    await tx.fighterPoolQueueEntry.deleteMany({ where: { fighterId: { in: [match.redFighterId, match.blueFighterId] } } });
    if (match.assignedServer) {
      await tx.fighterPoolServer.update({
        where: { id: match.assignedServer.id },
        data: { status: match.assignedServer.id === SOLO_TEST_SERVER_ID ? "OFFLINE" : "AVAILABLE", currentMatchId: null },
      });
    }
    return match;
  }, { isolationLevel: "Serializable" });
}

export async function recordPoolServerHeartbeat(input: { serverId: string; kind: "LOBBY" | "ARENA"; publicAddress: string; port: number; status: "AVAILABLE" | "OFFLINE"; players: string[] }) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const existing = await tx.fighterPoolServer.findUnique({ where: { id: input.serverId }, select: { currentMatchId: true } });
    const server = await tx.fighterPoolServer.upsert({
      where: { id: input.serverId },
      create: { id: input.serverId, kind: input.kind, publicAddress: input.publicAddress, port: input.port, status: input.status, lastHeartbeatAt: now },
      update: { kind: input.kind, publicAddress: input.publicAddress, port: input.port, status: existing?.currentMatchId ? "RESERVED" : input.status, lastHeartbeatAt: now },
    });
    await tx.fighterPoolPresence.deleteMany({ where: { serverId: input.serverId } });
    if (input.players.length) await tx.fighterPoolPresence.createMany({ data: [...new Map(input.players.map((name) => [normalizeGamertag(name), name.trim()])).entries()].map(([normalized, name]) => ({ serverId: input.serverId, minecraftUsername: name, minecraftUsernameNormalized: normalized, lastSeenAt: now })) });
    const currentMatch = server.currentMatchId ? await tx.fighterPoolMatch.findUnique({ where: { id: server.currentMatchId }, include: { redFighter: true, blueFighter: true } }) : null;
    return { server, presenceCount: input.players.length, currentMatch: currentMatch ? { id: currentMatch.id, status: currentMatch.status, redMinecraftUsername: currentMatch.redFighter.minecraftUsername, blueMinecraftUsername: currentMatch.blueFighter.minecraftUsername } : null };
  });
}

export async function checkInToPoolMatch(input: { code: string; minecraftUsername: string; serverId: string }) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${MATCHMAKING_LOCK})`;
    const codeHash = hashCode(input.code.trim().toUpperCase());
    const match = await tx.fighterPoolMatch.findFirst({ where: { status: "AWAITING_CHECKIN", codeExpiresAt: { gt: new Date() }, OR: [{ redCodeHash: codeHash }, { blueCodeHash: codeHash }] }, include: { redFighter: true, blueFighter: true, assignedServer: true } });
    if (!match || match.assignedServer?.id !== input.serverId) throw new FighterPoolError("That fight code is invalid, expired, or assigned to another arena.");
    const red = match.redCodeHash === codeHash;
    const expected = normalizeGamertag(red ? match.redFighter.minecraftUsername! : match.blueFighter.minecraftUsername!);
    if (normalizeGamertag(input.minecraftUsername) !== expected) throw new FighterPoolError("This gamertag is not assigned to that fight code.");
    if (red ? match.redCheckedInAt : match.blueCheckedInAt) throw new FighterPoolError("That fight code has already been consumed.");
    const updated = await tx.fighterPoolMatch.update({ where: { id: match.id }, data: red ? { redCheckedInAt: new Date() } : { blueCheckedInAt: new Date() } });
    const ready = Boolean(updated.redCheckedInAt && updated.blueCheckedInAt);
    if (ready) await tx.fighterPoolMatch.update({ where: { id: match.id }, data: { status: "READY" } });
    return {
      matchId: match.id,
      ready,
      status: ready ? "READY" as const : "AWAITING_CHECKIN" as const,
      players: [
        { team: "RED" as const, fighterName: match.redFighter.name, minecraftUsername: match.redFighter.minecraftUsername! },
        { team: "BLUE" as const, fighterName: match.blueFighter.name, minecraftUsername: match.blueFighter.minecraftUsername! },
      ],
    };
  });
}

function assertAssignedPlayers(match: { redFighter: { name: string; minecraftUsername: string | null; minecraftUsernameNormalized: string | null }; blueFighter: { name: string; minecraftUsername: string | null; minecraftUsernameNormalized: string | null } }, players: Array<{ team: "RED" | "BLUE"; fighterName: string; minecraftUsername: string }>) {
  const red = players.find((player) => player.team === "RED");
  const blue = players.find((player) => player.team === "BLUE");
  if (!red || !blue || normalizeGamertag(red.minecraftUsername) !== match.redFighter.minecraftUsernameNormalized || normalizeGamertag(blue.minecraftUsername) !== match.blueFighter.minecraftUsernameNormalized || red.fighterName !== match.redFighter.name || blue.fighterName !== match.blueFighter.name) {
    throw new FighterPoolError("Event players do not match this Fighter Pool assignment.");
  }
}

function assignedTeam(match: { redFighter: { minecraftUsernameNormalized: string | null }; blueFighter: { minecraftUsernameNormalized: string | null } }, username: string) {
  const normalized = normalizeGamertag(username);
  if (normalized === match.redFighter.minecraftUsernameNormalized) return "RED" as const;
  if (normalized === match.blueFighter.minecraftUsernameNormalized) return "BLUE" as const;
  throw new FighterPoolError("That Minecraft username is not assigned to this match.");
}

export async function recordPoolLiveEvent(input: FighterPoolLiveEventInput) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`pool-event:${input.matchId}`})) IS NULL AS "locked"`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`pool-event-id:${input.eventId}`})) IS NULL AS "locked"`;
    const existing = await tx.fighterPoolLiveEvent.findUnique({ where: { eventId: input.eventId } });
    if (existing) {
      const samePayload = JSON.stringify(existing.data) === JSON.stringify(input.data);
      const sameOccurredAt = existing.occurredAt.getTime() === new Date(input.occurredAt).getTime();
      if (existing.matchId !== input.matchId || existing.serverId !== input.serverId || existing.type !== input.type || !samePayload || !sameOccurredAt) throw new FighterPoolError("That event identifier conflicts with an earlier event.");
      return { duplicate: true };
    }
    const match = await tx.fighterPoolMatch.findUnique({ where: { id: input.matchId }, include: { redFighter: true, blueFighter: true, assignedServer: true } });
    if (!match) throw new FighterPoolError("Fighter Pool match not found.");
    const serverExists = await tx.fighterPoolServer.findUnique({ where: { id: input.serverId }, select: { id: true } });
    if (!serverExists) throw new FighterPoolError("Fighter Pool server not found.");
    const arenaServerId = match.arenaServerId ?? match.assignedServer?.id;
    if (arenaServerId !== input.serverId) throw new FighterPoolError("This match is assigned to another arena server.");
    const occurredAt = new Date(input.occurredAt);
    if (input.type === "FIGHTER_CHECKED_IN") {
      const data = input.data;
      assertAssignedPlayers(match, data.players);
      const team = assignedTeam(match, data.minecraftUsername);
      await tx.fighterPoolMatch.update({ where: { id: match.id }, data: team === "RED" ? { redCheckedInAt: match.redCheckedInAt ?? occurredAt } : { blueCheckedInAt: match.blueCheckedInAt ?? occurredAt } });
    } else if (input.type === "MATCH_READY") {
      const data = input.data;
      assertAssignedPlayers(match, data.players);
      if (!match.redCheckedInAt || !match.blueCheckedInAt) throw new FighterPoolError("Both fighters must check in before the match is ready.");
      if (!["AWAITING_CHECKIN", "READY"].includes(match.status)) throw new FighterPoolError("This match cannot return to the ready state.");
      await tx.fighterPoolMatch.update({ where: { id: match.id }, data: { status: "READY" } });
    } else if (input.type === "ROUND_STARTING") {
      const data = input.data;
      assertAssignedPlayers(match, data.players);
      if (!["READY", "LIVE"].includes(match.status)) throw new FighterPoolError("This match cannot start a round in its current state.");
      if (data.redRoundWins !== match.redRoundWins || data.blueRoundWins !== match.blueRoundWins) throw new FighterPoolError("The round-start score does not match the recorded series score.");
      if (data.roundNumber !== match.redRoundWins + match.blueRoundWins + 1) throw new FighterPoolError("The reported round number is not next in this series.");
      await tx.fighterPoolMatch.update({ where: { id: match.id }, data: { status: "LIVE", startedAt: match.startedAt ?? occurredAt, currentRound: data.roundNumber, countdownSeconds: data.countdownSeconds, countdownStartedAt: occurredAt } });
    } else if (input.type === "ROUND_COMPLETED") {
      const data = input.data;
      if (match.status !== "LIVE") throw new FighterPoolError("This match is not live.");
      const winnerTeam = assignedTeam(match, data.winnerMinecraftUsername);
      const loserTeam = assignedTeam(match, data.loserMinecraftUsername);
      if (winnerTeam !== data.winnerTeam || loserTeam !== data.loserTeam || winnerTeam === loserTeam) throw new FighterPoolError("Round teams do not match the assigned fighters.");
      const existingRound = await tx.fighterPoolRound.findUnique({ where: { matchId_roundId: { matchId: match.id, roundId: data.roundId } } });
      if (existingRound) {
        if (existingRound.roundNumber !== data.roundNumber || existingRound.winnerTeam !== data.winnerTeam || normalizeGamertag(existingRound.winnerMinecraftUsername) !== normalizeGamertag(data.winnerMinecraftUsername) || existingRound.redRoundWins !== data.redRoundWins || existingRound.blueRoundWins !== data.blueRoundWins) throw new FighterPoolError("That round identifier conflicts with an earlier result.");
      } else {
      const expectedRed = match.redRoundWins + (winnerTeam === "RED" ? 1 : 0);
      const expectedBlue = match.blueRoundWins + (winnerTeam === "BLUE" ? 1 : 0);
      if (data.roundNumber !== match.redRoundWins + match.blueRoundWins + 1 || data.redRoundWins !== expectedRed || data.blueRoundWins !== expectedBlue) throw new FighterPoolError("The round result is out of sequence or has a conflicting score.");
      await tx.fighterPoolRound.create({ data: { matchId: match.id, roundId: data.roundId, roundNumber: data.roundNumber, winnerTeam: data.winnerTeam, winnerMinecraftUsername: data.winnerMinecraftUsername, loserTeam: data.loserTeam, loserMinecraftUsername: data.loserMinecraftUsername, redRoundWins: data.redRoundWins, blueRoundWins: data.blueRoundWins, durationSeconds: data.durationSeconds, stats: data.stats as Prisma.InputJsonValue | undefined, occurredAt } });
      await tx.fighterPoolMatch.update({ where: { id: match.id }, data: { redRoundWins: data.redRoundWins, blueRoundWins: data.blueRoundWins, currentRound: data.roundNumber, countdownSeconds: null, countdownStartedAt: null } });
      }
    } else if (input.type === "PLAYER_DISCONNECTED") {
      const data = input.data;
      assignedTeam(match, data.minecraftUsername);
      if (!["READY", "LIVE"].includes(match.status)) throw new FighterPoolError("This match is not accepting player-presence events.");
      await tx.fighterPoolMatch.update({ where: { id: match.id }, data: { disconnectedUsername: data.minecraftUsername, reconnectDeadlineAt: new Date(occurredAt.getTime() + data.graceSeconds * 1000) } });
    } else if (input.type === "PLAYER_RECONNECTED") {
      const data = input.data;
      assignedTeam(match, data.minecraftUsername);
      if (match.disconnectedUsername && normalizeGamertag(match.disconnectedUsername) !== normalizeGamertag(data.minecraftUsername)) throw new FighterPoolError("A different fighter is currently marked disconnected.");
      await tx.fighterPoolMatch.update({ where: { id: match.id }, data: { disconnectedUsername: null, reconnectDeadlineAt: null } });
    } else if (input.type === "MATCH_COMPLETED") {
      const data = input.data;
      const team = assignedTeam(match, data.winnerMinecraftUsername);
      if (team !== data.winnerTeam || match.status !== "COMPLETED" || match.redRoundWins !== data.redRoundWins || match.blueRoundWins !== data.blueRoundWins) throw new FighterPoolError("The completion event does not match the official result.");
      await tx.fighterPoolMatch.update({ where: { id: match.id }, data: { countdownSeconds: null, countdownStartedAt: null, disconnectedUsername: null, reconnectDeadlineAt: null } });
    }

    await tx.fighterPoolLiveEvent.create({ data: { eventId: input.eventId, matchId: input.matchId, serverId: input.serverId, type: input.type, occurredAt, data: input.data as Prisma.InputJsonValue } });
    return { duplicate: false };
  }, { isolationLevel: "Serializable" });
}

export async function startPoolMatch(input: { serverId: string; matchId: string }) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${MATCHMAKING_LOCK})`;
    const match = await tx.fighterPoolMatch.findUnique({ where: { id: input.matchId }, include: { assignedServer: true } });
    if (!match || match.assignedServer?.id !== input.serverId) throw new FighterPoolError("This match is not assigned to this arena server.");
    if (match.status === "LIVE" && match.startedAt) return match;
    if (match.status !== "READY" || match.startedAt) throw new FighterPoolError("This match is not ready to start.");
    return tx.fighterPoolMatch.update({ where: { id: match.id }, data: { status: "LIVE", startedAt: new Date() } });
  }, { isolationLevel: "Serializable" });
}

export async function completePoolMatch(input: { serverId: string; matchId: string; reportId: string; winnerMinecraftUsername: string; redRoundWins: number; blueRoundWins: number; completedAt?: string; winnerTeam?: "RED" | "BLUE"; completionReason?: "BEST_OF_THREE" | "DISCONNECT_FORFEIT"; forfeitingMinecraftUsername?: string; payload: Prisma.InputJsonValue }) {
  const env = getEnv();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${MATCHMAKING_LOCK})`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`pool-result:${input.matchId}`})) IS NULL AS "locked"`;
    const duplicate = await tx.fighterPoolMatch.findFirst({ where: { resultReportId: input.reportId }, include: { redFighter: true, blueFighter: true } });
    if (duplicate) {
      if (duplicate.id !== input.matchId) throw new FighterPoolError("That report identifier belongs to another match.");
      const winnerIsRed = normalizeGamertag(input.winnerMinecraftUsername) === duplicate.redFighter.minecraftUsernameNormalized;
      const winnerIsBlue = normalizeGamertag(input.winnerMinecraftUsername) === duplicate.blueFighter.minecraftUsernameNormalized;
      const winnerId = winnerIsRed ? duplicate.redFighterId : winnerIsBlue ? duplicate.blueFighterId : null;
      if (winnerId !== duplicate.winnerFighterId || duplicate.redRoundWins !== input.redRoundWins || duplicate.blueRoundWins !== input.blueRoundWins) throw new FighterPoolError("That report identifier conflicts with the recorded official result.");
      return duplicate;
    }
    const match = await tx.fighterPoolMatch.findUnique({ where: { id: input.matchId }, include: { redFighter: true, blueFighter: true, assignedServer: true, rounds: true } });
    if (!match) throw new FighterPoolError("Fighter Pool match not found.");
    if (!["READY", "LIVE"].includes(match.status)) throw new FighterPoolError("This match cannot accept a result.");
    if ((match.arenaServerId ?? match.assignedServer?.id) !== input.serverId) throw new FighterPoolError("This match is assigned to another arena server.");
    if (Math.max(input.redRoundWins, input.blueRoundWins) !== 2 || input.redRoundWins === input.blueRoundWins) throw new FighterPoolError("A best-of-three result must have one fighter reach two round wins.");
    const winnerIsRed = normalizeGamertag(input.winnerMinecraftUsername) === match.redFighter.minecraftUsernameNormalized;
    const winnerIsBlue = normalizeGamertag(input.winnerMinecraftUsername) === match.blueFighter.minecraftUsernameNormalized;
    if (!winnerIsRed && !winnerIsBlue) throw new FighterPoolError("The reported winner is not assigned to this match.");
    if ((winnerIsRed && input.redRoundWins !== 2) || (winnerIsBlue && input.blueRoundWins !== 2)) throw new FighterPoolError("The reported winner does not match the series score.");
    if (match.rounds.length && (match.redRoundWins !== input.redRoundWins || match.blueRoundWins !== input.blueRoundWins)) throw new FighterPoolError("The official result conflicts with the recorded round timeline.");
    if (input.winnerTeam && input.winnerTeam !== (winnerIsRed ? "RED" : "BLUE")) throw new FighterPoolError("The reported winner team does not match the winner.");
    if (input.completionReason === "DISCONNECT_FORFEIT") {
      if (!input.forfeitingMinecraftUsername) throw new FighterPoolError("A disconnect forfeit must name the forfeiting fighter.");
      const forfeitingTeam = assignedTeam(match, input.forfeitingMinecraftUsername);
      if (forfeitingTeam === (winnerIsRed ? "RED" : "BLUE")) throw new FighterPoolError("The winner cannot be the forfeiting fighter.");
    }
    const winner = winnerIsRed ? match.redFighter : match.blueFighter;
    const loser = winnerIsRed ? match.blueFighter : match.redFighter;
    const swapped = await applyWin(tx, winner, loser, env.FIGHT_POOL_WIN_REWARD, match.id, "original");
    const completed = await tx.fighterPoolMatch.update({ where: { id: match.id }, data: {
      status: "COMPLETED", winnerFighterId: winner.id, loserFighterId: loser.id, redRoundWins: input.redRoundWins, blueRoundWins: input.blueRoundWins,
      rewardAmount: env.FIGHT_POOL_WIN_REWARD, resultReportId: input.reportId, completedAt: input.completedAt ? new Date(input.completedAt) : new Date(),
      resultPayload: { envelope: input.payload, rankingSwapApplied: swapped, redRankBefore: match.redRankSnapshot, blueRankBefore: match.blueRankSnapshot },
    } });
    if (match.assignedServer) await tx.fighterPoolServer.update({ where: { id: match.assignedServer.id }, data: { status: "AVAILABLE", currentMatchId: null } });
    return completed;
  }, { isolationLevel: "Serializable" });
}

export async function reviewPoolMatch(input: { matchId: string; actorId: string; action: "UPHOLD" | "REVERSE" | "VOID"; reason: string }) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`pool-review:${input.matchId}`})) IS NULL AS "locked"`;
    const match = await tx.fighterPoolMatch.findUnique({ where: { id: input.matchId }, include: { redFighter: true, blueFighter: true, winnerFighter: true, loserFighter: true, reviews: true } });
    if (!match || match.status !== "COMPLETED" || !match.winnerFighter || !match.loserFighter || !match.completedAt) throw new FighterPoolError("Only completed Fighter Pool matches can be reviewed.");
    if (match.reviews.length) throw new FighterPoolError("This result has already received a final administrative review.");
    if (input.action !== "UPHOLD") {
      const laterPoolMatch = await tx.fighterPoolMatch.findFirst({ where: { status: "COMPLETED", completedAt: { gt: match.completedAt }, OR: [{ redFighterId: { in: [match.redFighterId, match.blueFighterId] } }, { blueFighterId: { in: [match.redFighterId, match.blueFighterId] } }] } });
      const laterOfficialFight = await tx.fight.findFirst({ where: { status: "COMPLETED", updatedAt: { gt: match.completedAt }, OR: [{ redFighterId: { in: [match.redFighterId, match.blueFighterId] } }, { blueFighterId: { in: [match.redFighterId, match.blueFighterId] } }] } });
      if (laterPoolMatch || laterOfficialFight) throw new FighterPoolError("A later completed fight depends on this ranking. Review the newer results first.");
    }
    let resultingWinnerId: string | null = match.winnerFighterId;
    let disposition = "UPHELD";
    if (input.action === "REVERSE" || input.action === "VOID") {
      await tx.fighter.update({ where: { id: match.winnerFighter.id }, data: { wins: { decrement: 1 } } });
      await tx.fighter.update({ where: { id: match.loserFighter.id }, data: { losses: { decrement: 1 } } });
      if (!match.winnerFighter.userId) throw new FighterPoolError("The original winner is no longer linked to an account.");
      await removeWalletReward(tx, match.winnerFighter.userId, match.rewardAmount, match.id, input.action.toLowerCase());
      await setTwoRanks(tx, match.redFighterId, match.redRankSnapshot, match.blueFighterId, match.blueRankSnapshot);
      if (input.action === "REVERSE") {
        await applyWin(tx, match.loserFighter, match.winnerFighter, match.rewardAmount, match.id, "reversed");
        resultingWinnerId = match.loserFighter.id; disposition = "REVERSED";
        await tx.fighterPoolMatch.update({ where: { id: match.id }, data: { winnerFighterId: match.loserFighter.id, loserFighterId: match.winnerFighter.id, resultDisposition: disposition } });
      } else {
        resultingWinnerId = null; disposition = "VOIDED";
        await tx.fighterPoolMatch.update({ where: { id: match.id }, data: { winnerFighterId: null, loserFighterId: null, rewardAmount: 0, resultDisposition: disposition } });
      }
    } else await tx.fighterPoolMatch.update({ where: { id: match.id }, data: { resultDisposition: disposition } });
    const review = await tx.fighterPoolResultReview.create({ data: { matchId: match.id, actorId: input.actorId, action: input.action, reason: input.reason, previousWinnerId: match.winnerFighterId, resultingWinnerId } });
    await tx.adminAuditEntry.create({ data: { actorId: input.actorId, action: `FIGHT_POOL_RESULT_${input.action}`, targetType: "FighterPoolMatch", targetId: match.id, summary: { reason: input.reason, previousWinnerId: match.winnerFighterId, resultingWinnerId, disposition } } });
    return review;
  }, { isolationLevel: "Serializable" });
}

export async function simulateSoloPresence(input: { fighterId: string; actorId: string }) {
  const fighter = await prisma.fighter.findUnique({ where: { id: input.fighterId } });
  if (!fighter?.minecraftUsername || !fighter.minecraftUsernameNormalized) throw new FighterPoolError("Choose a fighter with a Bedrock gamertag.");
  const minecraftUsername = fighter.minecraftUsername;
  const minecraftUsernameNormalized = fighter.minecraftUsernameNormalized;
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.fighterPoolServer.upsert({
      where: { id: SOLO_TEST_SERVER_ID },
      create: { id: SOLO_TEST_SERVER_ID, kind: "TEST", publicAddress: "Admin simulation", port: 19132, status: "OFFLINE", lastHeartbeatAt: now },
      update: { kind: "TEST", status: "OFFLINE", lastHeartbeatAt: now },
    });
    await tx.fighterPoolPresence.upsert({
      where: { serverId_minecraftUsernameNormalized: { serverId: SOLO_TEST_SERVER_ID, minecraftUsernameNormalized } },
      create: { serverId: SOLO_TEST_SERVER_ID, minecraftUsername, minecraftUsernameNormalized, lastSeenAt: now },
      update: { minecraftUsername, lastSeenAt: now },
    });
    await tx.adminAuditEntry.create({ data: { actorId: input.actorId, action: "FIGHT_POOL_TEST_PRESENCE", targetType: "Fighter", targetId: fighter.id, summary: { minecraftUsername: fighter.minecraftUsername } } });
  });
}

export async function createSoloTestMatch(input: { redFighterId: string; blueFighterId: string; actorId: string }) {
  const env = getEnv();
  if (input.redFighterId === input.blueFighterId) throw new FighterPoolError("Choose two different fighters.");
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${MATCHMAKING_LOCK})`;
    const testServer = await tx.fighterPoolServer.findUnique({ where: { id: SOLO_TEST_SERVER_ID }, include: { currentMatch: true } });
    if (testServer?.currentMatch && ACTIVE_MATCH_STATES.includes(testServer.currentMatch.status as (typeof ACTIVE_MATCH_STATES)[number])) throw new FighterPoolError("Cancel or finish the active solo test match first.");
    const fighters = await tx.fighter.findMany({ where: { id: { in: [input.redFighterId, input.blueFighterId] } } });
    const red = fighters.find((fighter) => fighter.id === input.redFighterId);
    const blue = fighters.find((fighter) => fighter.id === input.blueFighterId);
    if (!red || !blue || red.status !== "ACTIVE" || blue.status !== "ACTIVE" || !red.userId || !blue.userId || !red.rank || !blue.rank || !red.minecraftUsernameNormalized || !blue.minecraftUsernameNormalized) {
      throw new FighterPoolError("Both test fighters must be active, ranked, linked accounts with Bedrock gamertags.");
    }
    if (Math.abs(red.rank - blue.rank) > env.FIGHT_REQUEST_RANK_RANGE) throw new FighterPoolError(`Test fighters must be within ${env.FIGHT_REQUEST_RANK_RANGE} ranks.`);
    const existing = await tx.fighterPoolMatch.findFirst({ where: { status: { in: [...ACTIVE_MATCH_STATES] }, OR: [{ redFighterId: { in: [red.id, blue.id] } }, { blueFighterId: { in: [red.id, blue.id] } }] } });
    if (existing) throw new FighterPoolError("One of these fighters already has an active Fighter Pool match.");
    const redCode = createFightCode(); const blueCode = createFightCode();
    const match = await tx.fighterPoolMatch.create({ data: {
      redFighterId: red.id, blueFighterId: blue.id, redRankSnapshot: red.rank, blueRankSnapshot: blue.rank,
      redCodeHash: hashCode(redCode), redCodeEncrypted: encryptCode(redCode), blueCodeHash: hashCode(blueCode), blueCodeEncrypted: encryptCode(blueCode),
      codeExpiresAt: new Date(Date.now() + env.FIGHT_POOL_CODE_TTL_MINUTES * 60_000), redCheckedInAt: new Date(), blueCheckedInAt: new Date(), status: "READY", arenaServerId: SOLO_TEST_SERVER_ID,
      resultPayload: { soloTest: true, createdBy: input.actorId },
    } });
    await tx.fighterPoolQueueEntry.deleteMany({ where: { fighterId: { in: [red.id, blue.id] } } });
    await tx.fighterPoolServer.upsert({
      where: { id: SOLO_TEST_SERVER_ID },
      create: { id: SOLO_TEST_SERVER_ID, kind: "TEST", publicAddress: "Admin simulation", port: 19132, status: "RESERVED", currentMatchId: match.id },
      update: { kind: "TEST", status: "RESERVED", currentMatchId: match.id, lastHeartbeatAt: new Date() },
    });
    await tx.adminAuditEntry.create({ data: { actorId: input.actorId, action: "FIGHT_POOL_TEST_MATCH_CREATED", targetType: "FighterPoolMatch", targetId: match.id, summary: { redFighterId: red.id, blueFighterId: blue.id, recordsAndRewardsAreOfficial: true } } });
    return match;
  }, { isolationLevel: "Serializable" });
}

export async function recordSoloTestRound(input: { matchId: string; winnerFighterId: string; actorId: string }) {
  const match = await prisma.fighterPoolMatch.findUnique({ where: { id: input.matchId }, include: { redFighter: true, blueFighter: true, assignedServer: true } });
  if (!match || !ACTIVE_MATCH_STATES.includes(match.status as (typeof ACTIVE_MATCH_STATES)[number]) || match.assignedServer?.id !== SOLO_TEST_SERVER_ID) throw new FighterPoolError("Choose an active solo test match.");
  const redWon = input.winnerFighterId === match.redFighterId;
  const blueWon = input.winnerFighterId === match.blueFighterId;
  if (!redWon && !blueWon) throw new FighterPoolError("That fighter is not in this match.");
  const redRoundWins = match.redRoundWins + (redWon ? 1 : 0);
  const blueRoundWins = match.blueRoundWins + (blueWon ? 1 : 0);
  if (redRoundWins === 2 || blueRoundWins === 2) {
    const completed = await completePoolMatch({
      serverId: SOLO_TEST_SERVER_ID, matchId: match.id, reportId: `solo-test-${match.id}-${Date.now()}`,
      winnerMinecraftUsername: redWon ? match.redFighter.minecraftUsername! : match.blueFighter.minecraftUsername!, redRoundWins, blueRoundWins,
      payload: { soloTest: true, submittedBy: input.actorId },
    });
    await prisma.adminAuditEntry.create({ data: { actorId: input.actorId, action: "FIGHT_POOL_TEST_COMPLETED", targetType: "FighterPoolMatch", targetId: match.id, summary: { winnerFighterId: input.winnerFighterId, redRoundWins, blueRoundWins, recordsRankingsAndCrownsUpdated: true } } });
    return completed;
  }
  const updated = await prisma.fighterPoolMatch.update({ where: { id: match.id }, data: { status: "LIVE", startedAt: match.startedAt ?? new Date(), redRoundWins, blueRoundWins } });
  await prisma.adminAuditEntry.create({ data: { actorId: input.actorId, action: "FIGHT_POOL_TEST_ROUND", targetType: "FighterPoolMatch", targetId: match.id, summary: { winnerFighterId: input.winnerFighterId, redRoundWins, blueRoundWins } } });
  return updated;
}

export async function cancelSoloTestMatch(input: { matchId: string; actorId: string }) {
  await prisma.$transaction(async (tx) => {
    const match = await tx.fighterPoolMatch.findUnique({ where: { id: input.matchId }, include: { assignedServer: true } });
    if (!match || !ACTIVE_MATCH_STATES.includes(match.status as (typeof ACTIVE_MATCH_STATES)[number]) || match.assignedServer?.id !== SOLO_TEST_SERVER_ID) throw new FighterPoolError("Choose an active solo test match.");
    await tx.fighterPoolMatch.update({ where: { id: match.id }, data: { status: "CANCELLED" } });
    await tx.fighterPoolServer.update({ where: { id: SOLO_TEST_SERVER_ID }, data: { currentMatchId: null, status: "OFFLINE" } });
    await tx.adminAuditEntry.create({ data: { actorId: input.actorId, action: "FIGHT_POOL_TEST_CANCELLED", targetType: "FighterPoolMatch", targetId: match.id, summary: { recordsChanged: false, crownsChanged: false } } });
  });
}

export async function resetSoloTestState(input: { actorId: string }) {
  await prisma.$transaction(async (tx) => {
    const active = await tx.fighterPoolServer.findUnique({ where: { id: SOLO_TEST_SERVER_ID }, include: { currentMatch: true } });
    if (active?.currentMatch && ACTIVE_MATCH_STATES.includes(active.currentMatch.status as (typeof ACTIVE_MATCH_STATES)[number])) await tx.fighterPoolMatch.update({ where: { id: active.currentMatch.id }, data: { status: "CANCELLED" } });
    await tx.fighterPoolPresence.deleteMany({ where: { serverId: SOLO_TEST_SERVER_ID } });
    if (active) await tx.fighterPoolServer.update({ where: { id: SOLO_TEST_SERVER_ID }, data: { currentMatchId: null, status: "OFFLINE" } });
    await tx.adminAuditEntry.create({ data: { actorId: input.actorId, action: "FIGHT_POOL_TEST_RESET", targetType: "FighterPoolServer", targetId: SOLO_TEST_SERVER_ID, summary: { completedResultsPreserved: true } } });
  });
}
