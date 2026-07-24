import { readFile } from "node:fs/promises";
import path from "node:path";

const required = [
  "APP_URL", "DATABASE_URL", "DIRECT_DATABASE_URL", "AUTH_SECRET",
  "DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_BOT_TOKEN",
  "DISCORD_API_BASE_URL", "DAILY_REWARD_AMOUNT", "COIN_FLIP_MIN_WAGER",
  "COIN_FLIP_MAX_WAGER", "COIN_FLIP_PAYOUT_BPS",
  "COIN_FLIP_MAX_PLAYS_PER_MINUTE", "BLACKJACK_MIN_WAGER",
  "BLACKJACK_MAX_WAGER", "BLACKJACK_PAYOUT_BPS",
  "BLACKJACK_NATURAL_PAYOUT_BPS", "BLACKJACK_MAX_ROUNDS_PER_MINUTE",
  "HIGH_LOW_MIN_WAGER", "HIGH_LOW_MAX_WAGER", "HIGH_LOW_TARGET_RETURN_BPS",
  "HIGH_LOW_MAX_STEPS", "HIGH_LOW_MAX_ROUNDS_PER_MINUTE", "BET_MIN_WAGER",
  "BET_MAX_WAGER", "BET_MAX_PLACEMENTS_PER_MINUTE",
  "PACK_MAX_OPENINGS_PER_MINUTE", "MARKET_MIN_PRICE", "MARKET_MAX_PRICE",
  "FIGHT_REQUEST_RANK_RANGE", "CARD_IMAGE_STORAGE_ENDPOINT",
  "CARD_IMAGE_STORAGE_REGION", "CARD_IMAGE_STORAGE_BUCKET",
  "CARD_IMAGE_STORAGE_ACCESS_KEY", "CARD_IMAGE_STORAGE_SECRET_KEY",
  "CARD_IMAGE_PUBLIC_BASE_URL",
] as const;

function parseEnv(contents: string) {
  const values: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    values[key] = rawValue.trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

function assertUrl(name: string, value: string, protocol = "https:") {
  try {
    const url = new URL(value);
    if (url.protocol !== protocol) throw new Error();
    if (["localhost", "127.0.0.1", "rfl.example"].includes(url.hostname) || url.hostname.endsWith(".invalid")) throw new Error();
  } catch {
    throw new Error(`${name} must be a real ${protocol.replace(":", "").toUpperCase()} URL.`);
  }
}

async function main() {
  const suppliedPath = process.argv[2];
  if (!suppliedPath) throw new Error("Usage: npm run deploy:check -- /absolute/path/to/production.env");
  const envPath = path.resolve(suppliedPath);
  const values = parseEnv(await readFile(envPath, "utf8"));
  const missing = required.filter((name) => !values[name]);
  if (missing.length) throw new Error(`Missing production variables: ${missing.join(", ")}`);

  assertUrl("APP_URL", values.APP_URL);
  assertUrl("DISCORD_API_BASE_URL", values.DISCORD_API_BASE_URL);
  assertUrl("CARD_IMAGE_STORAGE_ENDPOINT", values.CARD_IMAGE_STORAGE_ENDPOINT);
  assertUrl("CARD_IMAGE_PUBLIC_BASE_URL", values.CARD_IMAGE_PUBLIC_BASE_URL);
  if (values.APP_URL.endsWith("/")) throw new Error("APP_URL must not have a trailing slash.");
  if (values.AUTH_SECRET.length < 32 || /replace|example|generate|build-only/i.test(values.AUTH_SECRET)) {
    throw new Error("AUTH_SECRET must be a non-placeholder secret of at least 32 characters.");
  }
  if (!/^\d{17,20}$/.test(values.DISCORD_CLIENT_ID)) throw new Error("DISCORD_CLIENT_ID must be a Discord snowflake.");
  if (![values.DATABASE_URL, values.DIRECT_DATABASE_URL].every((value) => /^postgres(ql)?:\/\//.test(value))) {
    throw new Error("DATABASE_URL and DIRECT_DATABASE_URL must be PostgreSQL URLs.");
  }
  if (![values.DATABASE_URL, values.DIRECT_DATABASE_URL].every((value) => /[?&]sslmode=(require|verify-full)\b/.test(value))) {
    throw new Error("Both database URLs must enable TLS with sslmode=require or sslmode=verify-full.");
  }

  const appSpec = await readFile(path.join(process.cwd(), ".do", "app.yaml"), "utf8");
  if (appSpec.includes("OWNER/REPOSITORY")) throw new Error("Replace OWNER/REPOSITORY in .do/app.yaml before deployment.");
  process.stdout.write(`Deployment preflight passed for ${new URL(values.APP_URL).origin}. No secret values were printed.\n`);
}

main().catch((error) => {
  process.stderr.write(`Deployment preflight failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
