import { createHmac, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { existsSync } from "node:fs";
import { join } from "node:path";

const config = {
  siteUrl: required("RFL_SITE_URL").replace(/\/$/, ""),
  secret: required("RFL_BRIDGE_SECRET"),
  serverId: required("RFL_SERVER_ID"),
  kind: (process.env.RFL_SERVER_KIND ?? "ARENA").toUpperCase(),
  publicAddress: required("RFL_PUBLIC_ADDRESS"),
  port: Number(process.env.RFL_SERVER_PORT ?? 19132),
  bdsDirectory: required("RFL_BDS_DIRECTORY"),
  disconnectGraceMs: Number(process.env.RFL_DISCONNECT_GRACE_SECONDS ?? 180) * 1000,
};
if (!['LOBBY', 'ARENA'].includes(config.kind)) fail("RFL_SERVER_KIND must be LOBBY or ARENA.");
if (config.secret.length < 32) fail("RFL_BRIDGE_SECRET must contain at least 32 characters.");
const executable = join(config.bdsDirectory, "bedrock_server.exe");
if (!existsSync(executable)) fail(`bedrock_server.exe was not found in ${config.bdsDirectory}`);

let onlinePlayers = [];
let pendingListCount = null;
let assignment = null;
let roundWins = { RED: 0, BLUE: 0 };
let startedMatchId = null;
let stopping = false;
const disconnects = new Map();
const server = spawn(executable, [], { cwd: config.bdsDirectory, stdio: ["pipe", "pipe", "pipe"], windowsHide: false });
const output = createInterface({ input: server.stdout });
const errors = createInterface({ input: server.stderr });

output.on("line", (line) => { console.log(line); void handleLine(line); });
errors.on("line", (line) => console.error(line));
server.on("exit", (code) => { if (!stopping) console.error(`[RFL] Bedrock exited unexpectedly (${code ?? "unknown"}).`); process.exitCode = code ?? 1; });

setInterval(() => command("list"), 10_000).unref();
setInterval(() => void heartbeat(), 5_000).unref();
setTimeout(() => { command("list"); void heartbeat(); }, 2_000);

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function heartbeat() {
  try {
    const response = await post("/api/fighter-pool/bridge/heartbeat", {
      serverId: config.serverId, kind: config.kind, publicAddress: config.publicAddress,
      port: config.port, status: "AVAILABLE", players: onlinePlayers,
    });
    if (response.currentMatch && assignment?.id !== response.currentMatch.id) {
      assignment = response.currentMatch;
      roundWins = { RED: 0, BLUE: 0 };
      startedMatchId = null;
      console.log(`[RFL] Reserved for match ${assignment.id}.`);
    }
    if (!response.currentMatch && assignment && roundWins.RED === 0 && roundWins.BLUE === 0) assignment = null;
  } catch (error) { console.error(`[RFL] Heartbeat failed: ${error.message}`); }
}

async function handleLine(line) {
  const consoleMessage = cleanConsoleMessage(line);
  const connected = consoleMessage.match(/^Player connected:\s*(.+?)(?:,\s*xuid:.*)?$/i);
  if (connected?.[1]) setPlayerOnline(connected[1]);
  const disconnected = consoleMessage.match(/^Player disconnected:\s*(.+?)(?:,\s*xuid:.*)?$/i);
  if (disconnected?.[1]) setPlayerOffline(disconnected[1]);

  const list = consoleMessage.match(/^There are (\d+)\/\d+ players online:\s*(.*)$/i);
  if (list) {
    const count = Number(list[1]);
    const sameLinePlayers = parsePlayerList(list[2]);
    if (count === 0) {
      onlinePlayers = [];
      pendingListCount = null;
    } else if (sameLinePlayers.length) {
      onlinePlayers = sameLinePlayers.slice(0, count);
      pendingListCount = null;
    } else {
      pendingListCount = count;
    }
    monitorDisconnects();
  } else if (pendingListCount !== null) {
    const nextLinePlayers = parsePlayerList(consoleMessage);
    if (nextLinePlayers.length) onlinePlayers = nextLinePlayers.slice(0, pendingListCount);
    pendingListCount = null;
    monitorDisconnects();
  }

  const started = marker(line, "[RFL][MATCH_STARTED]");
  if (started && assignment?.id && startedMatchId !== assignment.id) {
    try {
      await post("/api/fighter-pool/bridge/start", { serverId: config.serverId, matchId: assignment.id });
      startedMatchId = assignment.id;
      console.log(`[RFL] Match ${assignment.id} marked live on PlayRFL.`);
    } catch (error) { console.error(`[RFL] Match start submission failed: ${error.message}`); }
  }

  const checkIn = marker(line, "[RFL][FIGHT_CODE]") ?? chatFightCode(line);
  if (checkIn && config.kind === "ARENA") {
    try {
      const response = await post("/api/fighter-pool/bridge/check-in", { serverId: config.serverId, code: checkIn.code, minecraftUsername: checkIn.minecraftUsername });
      assignment = { id: response.match.matchId, players: response.match.players };
      tell(checkIn.minecraftUsername, response.match.ready ? "Code accepted. Both fighters are ready." : "Code accepted. Waiting for your opponent.");
      if (response.match.ready) console.log(`[RFL] Match ${response.match.matchId} is ready for its best-of-three series.`);
    } catch (error) { tell(checkIn.minecraftUsername, error.message, true); }
  }

  const result = marker(line, "[RFL][LOCAL_RESULT]");
  if (!result?.winnerTeam || !assignment?.id) return;
  const team = String(result.winnerTeam).toUpperCase();
  if (!(team in roundWins)) return;
  roundWins[team] += 1;
  console.log(`[RFL] Round recorded: Red ${roundWins.RED} - Blue ${roundWins.BLUE}.`);
  if (roundWins[team] < 2) {
    broadcast(`§e[RFL] Series score: Red ${roundWins.RED} - Blue ${roundWins.BLUE}. Prepare for the next round.`);
    return;
  }
  const winner = assignment.players?.find((player) => player.team === team)?.minecraftUsername
    ?? result.players?.find((player) => player.won)?.playerName;
  if (!winner) return console.error("[RFL] Could not identify the series winner.");
  await finalizeSeries(team, winner, { rounds: result, completionReason: "BEST_OF_THREE" });
}

function monitorDisconnects() {
  if (!assignment?.players?.length) return;
  const online = new Set(onlinePlayers.map(normalize));
  for (const player of assignment.players) {
    const key = normalize(player.minecraftUsername);
    if (online.has(key)) {
      if (disconnects.delete(key)) tell(player.minecraftUsername, "Reconnect confirmed. You are back in the fight.");
      continue;
    }
    if (disconnects.has(key)) continue;
    const matchId = assignment.id;
    const deadline = Date.now() + config.disconnectGraceMs;
    disconnects.set(key, deadline);
    broadcast(`§e[RFL] ${player.minecraftUsername} disconnected and has ${Math.round(config.disconnectGraceMs / 60_000)} minutes to return.`);
    setTimeout(() => void enforceDisconnectForfeit(matchId, key), config.disconnectGraceMs).unref();
  }
}

async function enforceDisconnectForfeit(matchId, disconnectedKey) {
  if (assignment?.id !== matchId || !disconnects.has(disconnectedKey) || onlinePlayers.some((name) => normalize(name) === disconnectedKey)) return;
  const loser = assignment.players.find((player) => normalize(player.minecraftUsername) === disconnectedKey);
  const winner = assignment.players.find((player) => normalize(player.minecraftUsername) !== disconnectedKey);
  if (!loser || !winner) return;
  if (!onlinePlayers.some((name) => normalize(name) === normalize(winner.minecraftUsername))) return;
  roundWins[winner.team] = 2;
  roundWins[loser.team] = Math.min(roundWins[loser.team], 1);
  await finalizeSeries(winner.team, winner.minecraftUsername, { completionReason: "DISCONNECT_FORFEIT", forfeitingMinecraftUsername: loser.minecraftUsername });
}

async function finalizeSeries(winnerTeam, winnerMinecraftUsername, detail) {
  if (!assignment?.id) return;
  try {
    await post("/api/fighter-pool/bridge/result", {
      matchId: assignment.id, reportId: randomUUID(), winnerMinecraftUsername,
      redRoundWins: roundWins.RED, blueRoundWins: roundWins.BLUE,
      serverId: config.serverId, schemaVersion: 1, completedAt: new Date().toISOString(), winnerTeam, ...detail,
    });
    broadcast(`§a[RFL] Series complete. ${winnerMinecraftUsername} wins and the official result was recorded.`);
    assignment = null;
    startedMatchId = null;
    roundWins = { RED: 0, BLUE: 0 };
    disconnects.clear();
  } catch (error) { console.error(`[RFL] Result submission failed and will require admin review: ${error.message}`); }
}

async function post(path, body) {
  const raw = JSON.stringify(body);
  const timestamp = String(Date.now());
  const signature = createHmac("sha256", config.secret).update(timestamp).update(".").update(raw).digest("hex");
  const response = await fetch(config.siteUrl + path, { method: "POST", headers: { "content-type": "application/json", "x-rfl-timestamp": timestamp, "x-rfl-signature": signature }, body: raw });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error ?? `PlayRFL returned HTTP ${response.status}.`);
  return value;
}

function marker(line, name) { const index = line.indexOf(name); if (index < 0) return null; try { return JSON.parse(line.slice(index + name.length).trim()); } catch { return null; } }
function cleanConsoleMessage(line) { return String(line).replace(/^(?:\[[^\]]*\]\s*)+/, "").trim(); }
function parsePlayerList(value) {
  const text = String(value).trim();
  if (!text) return [];
  const withXuids = [...text.matchAll(/(?:^|,\s*)([^,]+),\s*xuid:\s*[^,]+/gi)].map((match) => match[1].trim()).filter(Boolean);
  return withXuids.length ? withXuids : text.split(",").map((name) => name.trim()).filter(Boolean);
}
function setPlayerOnline(name) { const value = String(name).trim(); if (value && !onlinePlayers.some((player) => normalize(player) === normalize(value))) onlinePlayers.push(value); }
function setPlayerOffline(name) { const key = normalize(name); onlinePlayers = onlinePlayers.filter((player) => normalize(player) !== key); }
function chatFightCode(line) { const match = line.match(/<([^>]+)>\s*!(?:fight|code)\s+([A-Z0-9]{8})\b/i); return match ? { minecraftUsername: match[1].trim(), code: match[2].toUpperCase() } : null; }
function command(value) { if (server.stdin.writable) server.stdin.write(value + "\n"); }
function tell(player, message, error = false) { command(`tellraw "${String(player).replaceAll('"', '\\"')}" ${JSON.stringify({ rawtext: [{ text: `${error ? "§c" : "§a"}[RFL] ${message}` }] })}`); }
function broadcast(message) { command(`tellraw @a ${JSON.stringify({ rawtext: [{ text: message }] })}`); }
function normalize(value) { return String(value).trim().toLocaleLowerCase("en-US"); }
function required(name) { const value = process.env[name]?.trim(); if (!value) fail(`Missing ${name}.`); return value; }
function fail(message) { console.error(`[RFL] ${message}`); process.exit(1); }
function shutdown() { if (stopping) return; stopping = true; console.log("[RFL] Stopping Bedrock safely..."); command("stop"); setTimeout(() => server.kill(), 10_000).unref(); }
