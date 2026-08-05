import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import EmbeddedPostgres from "embedded-postgres";

type Sample = { status: number; durationMs: number };

async function availablePort() {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  assert(address && typeof address !== "string");
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function waitUntilReady(origin: string) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try { if ((await fetch(`${origin}/api/health/ready`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Local RFL server did not become ready.");
}

async function request(origin: string, route: string, init: RequestInit = {}): Promise<Sample> {
  const started = performance.now();
  try {
    const response = await fetch(origin + route, { redirect: "manual", ...init });
    await response.arrayBuffer();
    return { status: response.status, durationMs: performance.now() - started };
  } catch {
    return { status: 0, durationMs: performance.now() - started };
  }
}

async function runConcurrent(origin: string, routes: string[], total: number, concurrency: number, ipPrefix: string, headers: HeadersInit = {}) {
  const samples: Sample[] = [];
  let cursor = 0;
  const started = performance.now();
  await Promise.all(Array.from({ length: concurrency }, async (_, worker) => {
    while (true) {
      const index = cursor++;
      if (index >= total) return;
      samples.push(await request(origin, routes[index % routes.length], { headers: { ...headers, "x-forwarded-for": `${ipPrefix}.${worker + 1}` } }));
    }
  }));
  return { samples, wallMs: performance.now() - started };
}

function percentile(values: number[], fraction: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
}

function report(name: string, samples: Sample[], wallMs: number) {
  const statuses = Object.fromEntries([...new Set(samples.map((sample) => sample.status))].sort((a, b) => a - b).map((status) => [status, samples.filter((sample) => sample.status === status).length]));
  const durations = samples.map((sample) => sample.durationMs);
  const row = {
    test: name,
    requests: samples.length,
    requestsPerSecond: Number((samples.length / (wallMs / 1000)).toFixed(1)),
    p50Ms: Number(percentile(durations, 0.5).toFixed(1)),
    p95Ms: Number(percentile(durations, 0.95).toFixed(1)),
    p99Ms: Number(percentile(durations, 0.99).toFixed(1)),
    statuses: JSON.stringify(statuses),
  };
  console.table([row]);
  return statuses;
}

async function boundaryTest(origin: string, name: string, route: string, total: number, ip: string, init: RequestInit = {}, concurrency = 12) {
  const samples: Sample[] = [];
  let cursor = 0;
  const started = performance.now();
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= total) return;
      samples.push(await request(origin, route, { ...init, headers: { ...init.headers, "x-forwarded-for": ip } }));
    }
  }));
  const statuses = report(name, samples, performance.now() - started);
  return { samples, statuses };
}

async function main() {
  const generatedFileSnapshots = await Promise.all(["next-env.d.ts", "tsconfig.json"].map(async (file) => ({ file, content: await readFile(file) })));
  const databaseDir = await mkdtemp(path.join(os.tmpdir(), "rfl-load-postgres-"));
  const databasePort = await availablePort();
  const appPort = await availablePort();
  const nextDistDir = `.next-load-${appPort}`;
  const postgres = new EmbeddedPostgres({ databaseDir, port: databasePort, user: "rfl_load", password: "rfl_load_password", persistent: false, initdbFlags: ["--locale=C", "--encoding=UTF8"], onLog: () => undefined, onError: () => undefined });
  let web: ReturnType<typeof spawn> | undefined;

  try {
    await postgres.initialise(); await postgres.start(); await postgres.createDatabase("rfl_load");
    const databaseUrl = `postgresql://rfl_load:rfl_load_password@127.0.0.1:${databasePort}/rfl_load`;
    const origin = `http://127.0.0.1:${appPort}`;
    const env: NodeJS.ProcessEnv = {
      ...process.env, NODE_ENV: "test", RFL_NEXT_DIST_DIR: nextDistDir, APP_URL: origin, AUTH_URL: origin,
      DATABASE_URL: databaseUrl, DIRECT_DATABASE_URL: databaseUrl, AUTH_SECRET: "load-auth-secret-00000000000000000000",
      DISCORD_CLIENT_ID: "load-client", DISCORD_CLIENT_SECRET: "load-secret", DISCORD_BOT_TOKEN: "load-bot-token",
      DISCORD_API_BASE_URL: "https://discord.invalid/api/v10", DISCORD_GUILD_ID: "1514881431229431868",
      FIGHT_POOL_ENABLED: "true", FIGHT_POOL_BRIDGE_SECRET: "load-bridge-secret-0000000000000000", FIGHT_POOL_CODE_SECRET: "load-code-secret-000000000000000000",
    };
    const migration = spawnSync("npm", ["run", "db:deploy"], { cwd: process.cwd(), env, encoding: "utf8" });
    assert.equal(migration.status, 0, `${migration.stdout}\n${migration.stderr}`);

    const sessionToken = "rfl-load-session-token";
    const client = postgres.getPgClient("rfl_load", "127.0.0.1");
    await client.connect();
    await client.query(`
      INSERT INTO users (id, name, display_name, status, profile_completed_at, created_at, updated_at)
      VALUES ('rfl_load_user', 'Load Tester', 'Load Tester', 'ACTIVE', NOW(), NOW(), NOW());
      INSERT INTO user_roles (user_id, role, granted_at) VALUES ('rfl_load_user', 'PLAYER', NOW());
      INSERT INTO wallets (id, user_id, balance, version, created_at, updated_at) VALUES ('rfl_load_wallet', 'rfl_load_user', 10000, 0, NOW(), NOW());
      INSERT INTO sessions (session_token, user_id, expires) VALUES ('${sessionToken}', 'rfl_load_user', NOW() + INTERVAL '1 day');
    `);
    await client.end();

    web = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(appPort)], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
    let serverErrors = "";
    web.stdout?.on("data", () => undefined);
    web.stderr?.on("data", (chunk) => { serverErrors += String(chunk); });
    await waitUntilReady(origin);

    const pages = ["/", "/live", "/fighters", "/cards", "/market", "/casino/coin-flip", "/casino/blackjack", "/casino/high-low", "/fighter-pool"];
    const browsing = await runConcurrent(origin, pages, 360, 18, "10.10.0");
    const browsingStatuses = report("18 simulated users across 9 features", browsing.samples, browsing.wallMs);
    assert.equal(browsingStatuses[0] ?? 0, 0, "Browsing load produced connection failures.");
    assert.equal(browsingStatuses[500] ?? 0, 0, "Browsing load produced HTTP 500 errors.");

    const health = await runConcurrent(origin, ["/api/health/live", "/api/health/ready"], 300, 30, "10.20.0");
    const healthStatuses = report("Health endpoints (intentionally exempt)", health.samples, health.wallMs);
    assert.equal(healthStatuses[200], 300);

    const pageLimit = await boundaryTest(origin, "Page rate-limit boundary (180/minute)", "/", 200, "10.30.0.1");
    assert.equal(pageLimit.statuses[429], 20);

    const apiLimit = await boundaryTest(origin, "API rate-limit boundary (90/minute)", "/api/fighter-pool/state", 105, "10.40.0.1", { headers: { cookie: `authjs.session-token=${sessionToken}` } });
    assert.equal(apiLimit.statuses[429], 15);
    assert.equal(apiLimit.statuses[200], 90);

    const authLimit = await boundaryTest(origin, "Authentication rate-limit boundary (20/minute)", "/signin", 30, "10.50.0.1");
    assert.equal(authLimit.statuses[429], 10);

    const bridgeLimit = await boundaryTest(origin, "Bridge rate-limit boundary (60/minute)", "/api/fighter-pool/bridge/heartbeat", 75, "10.60.0.1", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(bridgeLimit.statuses[429], 15);
    assert.equal(bridgeLimit.statuses[500] ?? 0, 0);

    if (/uncaught|unhandled|fatal|out of memory/i.test(serverErrors)) throw new Error(`Server emitted a fatal runtime error:\n${serverErrors.slice(-4000)}`);
    console.log("\nLocal flooding test completed successfully. No production traffic was generated.");
  } finally {
    web?.kill("SIGTERM");
    await postgres.stop().catch(() => undefined);
    await rm(databaseDir, { recursive: true, force: true });
    await rm(path.join(process.cwd(), nextDistDir), { recursive: true, force: true });
    await Promise.all(generatedFileSnapshots.map(({ file, content }) => writeFile(file, content)));
  }
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`); process.exitCode = 1; });
