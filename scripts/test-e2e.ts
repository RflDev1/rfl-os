import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import EmbeddedPostgres from "embedded-postgres";

async function availablePort() {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  assert(address && typeof address !== "string");
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function waitUntilReady(origin: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(`${origin}/api/health/ready`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("E2E web server did not become ready.");
}

async function main() {
const databaseDir = await mkdtemp(path.join(os.tmpdir(), "rfl-e2e-postgres-"));
const databasePort = await availablePort();
const appPort = await availablePort();
const nextDistDir = `.next-e2e-${appPort}`;
const postgres = new EmbeddedPostgres({ databaseDir, port: databasePort, user: "rfl_e2e", password: "rfl_e2e_password", persistent: false, initdbFlags: ["--locale=C", "--encoding=UTF8"], onLog: () => undefined, onError: (message) => process.stderr.write(`${String(message)}\n`) });
let web: ReturnType<typeof spawn> | undefined;

try {
  await postgres.initialise(); await postgres.start(); await postgres.createDatabase("rfl_e2e");
  const databaseUrl = `postgresql://rfl_e2e:rfl_e2e_password@127.0.0.1:${databasePort}/rfl_e2e`;
  const origin = `http://127.0.0.1:${appPort}`;
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "test", RFL_NEXT_DIST_DIR: nextDistDir, APP_URL: origin, DATABASE_URL: databaseUrl, DIRECT_DATABASE_URL: databaseUrl, AUTH_SECRET: "e2e-auth-secret-00000000000000000000", DISCORD_CLIENT_ID: "e2e-client", DISCORD_CLIENT_SECRET: "e2e-secret", DISCORD_BOT_TOKEN: "e2e-bot", DISCORD_API_BASE_URL: "https://discord.invalid/api/v10", DAILY_REWARD_AMOUNT: "100", COIN_FLIP_MIN_WAGER: "10", COIN_FLIP_MAX_WAGER: "1000", COIN_FLIP_PAYOUT_BPS: "20000", COIN_FLIP_MAX_PLAYS_PER_MINUTE: "20", BLACKJACK_MIN_WAGER: "10", BLACKJACK_MAX_WAGER: "1000", BLACKJACK_PAYOUT_BPS: "20000", BLACKJACK_NATURAL_PAYOUT_BPS: "25000", BLACKJACK_MAX_ROUNDS_PER_MINUTE: "10", HIGH_LOW_MIN_WAGER: "10", HIGH_LOW_MAX_WAGER: "1000", HIGH_LOW_TARGET_RETURN_BPS: "9500", HIGH_LOW_MAX_STEPS: "7", HIGH_LOW_MAX_ROUNDS_PER_MINUTE: "10", BET_MIN_WAGER: "10", BET_MAX_WAGER: "5000", BET_MAX_PLACEMENTS_PER_MINUTE: "20", PACK_MAX_OPENINGS_PER_MINUTE: "10", MARKET_MIN_PRICE: "10", MARKET_MAX_PRICE: "100000", FIGHT_REQUEST_RANK_RANGE: "5" };
  const migration = spawnSync("npm", ["run", "db:deploy"], { cwd: process.cwd(), env, encoding: "utf8" });
  assert.equal(migration.status, 0, `${migration.stdout}\n${migration.stderr}`);
  const adminSessionToken = "rfl-e2e-admin-session-token";
  const client = postgres.getPgClient("rfl_e2e", "127.0.0.1");
  await client.connect();
  await client.query(`
    INSERT INTO users (id, name, display_name, status, profile_completed_at, created_at, updated_at)
    VALUES ('rfl_e2e_admin', 'RFL Admin', 'RFL Admin', 'ACTIVE', NOW(), NOW(), NOW());
    INSERT INTO user_roles (user_id, role, granted_at) VALUES ('rfl_e2e_admin', 'PLAYER', NOW()), ('rfl_e2e_admin', 'ADMIN', NOW());
    INSERT INTO wallets (id, user_id, balance, version, created_at, updated_at) VALUES ('rfl_e2e_wallet', 'rfl_e2e_admin', 500, 0, NOW(), NOW());
    INSERT INTO sessions (session_token, user_id, expires) VALUES ('${adminSessionToken}', 'rfl_e2e_admin', NOW() + INTERVAL '1 day');
    INSERT INTO fighters (id, user_id, rank, name, nickname, wins, losses, draws, status, created_at, updated_at)
    VALUES ('cly0000000000000000000000', 'rfl_e2e_admin', 1, 'Test Champion', 'The Fixture', 8, 2, 1, 'ACTIVE', NOW(), NOW());
    INSERT INTO card_sets (id, name, code, description, released_at, active, created_at, updated_at)
    VALUES ('cly0000000000000000000001', 'Test Origins', 'TEST01', 'Browser verification set', NOW(), true, NOW(), NOW());
    INSERT INTO card_definitions (id, set_id, fighter_id, name, subtitle, rarity, card_number, image_url, active, created_at, updated_at)
    VALUES ('cly0000000000000000000002', 'cly0000000000000000000001', 'cly0000000000000000000000', 'Test Champion', 'Pack Fixture', 'COMMON', 100, NULL, true, NOW(), NOW());
    INSERT INTO pack_definitions (id, set_id, name, description, price, cards_per_pack, common_weight, rare_weight, epic_weight, legendary_weight, drop_table_version, active, created_at, updated_at)
    VALUES ('cly0000000000000000000003', 'cly0000000000000000000001', 'Test Pack', 'Responsive browser test pack', 50, 5, 100, 0, 0, 0, 1, true, NOW(), NOW());
  `);
  await client.end();
  web = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(appPort)], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
  await waitUntilReady(origin);
  const result = spawnSync("npm", ["run", "test:e2e:run"], { cwd: process.cwd(), env: { ...env, PLAYWRIGHT_BASE_URL: origin, E2E_ADMIN_SESSION_TOKEN: adminSessionToken }, encoding: "utf8", stdio: "inherit" });
  assert.equal(result.status, 0, "Playwright smoke tests failed.");
} finally {
  web?.kill("SIGTERM");
  await postgres.stop().catch(() => undefined);
  await rm(databaseDir, { recursive: true, force: true });
  await rm(path.join(process.cwd(), nextDistDir), { recursive: true, force: true });
}
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
