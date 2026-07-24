import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

async function availablePort() {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a local port.");
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function main() {
  const databaseDir = await mkdtemp(path.join(os.tmpdir(), "rfl-preview-postgres-"));
  const databasePort = await availablePort();
  const postgres = new EmbeddedPostgres({
    databaseDir,
    port: databasePort,
    user: "rfl_preview",
    password: "rfl_preview_password",
    persistent: false,
    initdbFlags: ["--locale=C", "--encoding=UTF8"],
  });
  let web: ReturnType<typeof spawn> | undefined;

  const cleanUp = async () => {
    web?.kill("SIGTERM");
    await postgres.stop().catch(() => undefined);
    await rm(databaseDir, { recursive: true, force: true });
  };

  try {
    await postgres.initialise();
    await postgres.start();
    await postgres.createDatabase("rfl_preview");

    const databaseUrl = `postgresql://rfl_preview:rfl_preview_password@127.0.0.1:${databasePort}/rfl_preview`;
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "development",
      APP_URL: "http://localhost:3000",
      DATABASE_URL: databaseUrl,
      DIRECT_DATABASE_URL: databaseUrl,
      AUTH_SECRET: "local-preview-secret-000000000000000000000000",
    };

    const migration = spawnSync("npm", ["run", "db:deploy"], { env, stdio: "inherit" });
    if (migration.status !== 0) throw new Error("Local preview database migration failed.");

    process.stdout.write("\nRFL preview is starting at http://localhost:3000\nPress Control-C to stop it. Preview data is temporary.\n\n");
    web = spawn("npm", ["run", "dev"], { env, stdio: "inherit" });

    await new Promise<void>((resolve, reject) => {
      web?.once("exit", (code, signal) => code === 0 || signal === "SIGTERM" ? resolve() : reject(new Error(`Preview server exited with code ${code}.`)));
      web?.once("error", reject);
      process.once("SIGINT", () => resolve());
      process.once("SIGTERM", () => resolve());
    });
  } finally {
    await cleanUp();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
