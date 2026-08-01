import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_PUBLIC_KEY: z.preprocess((value) => value === "" ? undefined : value, z.string().regex(/^[a-fA-F0-9]{64}$/).optional()),
  DISCORD_API_BASE_URL: z.string().url(),
  DAILY_REWARD_AMOUNT: z.coerce.number().int().min(1).max(100_000),
  COIN_FLIP_MIN_WAGER: z.coerce.number().int().min(1).max(100_000),
  COIN_FLIP_MAX_WAGER: z.coerce.number().int().min(1).max(1_000_000),
  COIN_FLIP_PAYOUT_BPS: z.coerce.number().int().min(10_000).max(50_000),
  COIN_FLIP_MAX_PLAYS_PER_MINUTE: z.coerce.number().int().min(1).max(120),
  BLACKJACK_MIN_WAGER: z.coerce.number().int().min(1).max(100_000),
  BLACKJACK_MAX_WAGER: z.coerce.number().int().min(1).max(1_000_000),
  BLACKJACK_PAYOUT_BPS: z.coerce.number().int().min(10_000).max(50_000),
  BLACKJACK_NATURAL_PAYOUT_BPS: z.coerce.number().int().min(10_000).max(50_000),
  BLACKJACK_MAX_ROUNDS_PER_MINUTE: z.coerce.number().int().min(1).max(60),
  HIGH_LOW_MIN_WAGER: z.coerce.number().int().min(1).max(100_000),
  HIGH_LOW_MAX_WAGER: z.coerce.number().int().min(1).max(1_000_000),
  HIGH_LOW_TARGET_RETURN_BPS: z.coerce.number().int().min(1_000).max(10_000),
  HIGH_LOW_MAX_STEPS: z.coerce.number().int().min(1).max(20),
  HIGH_LOW_MAX_ROUNDS_PER_MINUTE: z.coerce.number().int().min(1).max(60),
  BET_MIN_WAGER: z.coerce.number().int().min(1).max(100_000),
  BET_MAX_WAGER: z.coerce.number().int().min(1).max(1_000_000),
  BET_MAX_PLACEMENTS_PER_MINUTE: z.coerce.number().int().min(1).max(120),
  PACK_MAX_OPENINGS_PER_MINUTE: z.coerce.number().int().min(1).max(60),
  MARKET_MIN_PRICE: z.coerce.number().int().min(1).max(100_000),
  MARKET_MAX_PRICE: z.coerce.number().int().min(1).max(10_000_000),
  FIGHT_REQUEST_RANK_RANGE: z.coerce.number().int().min(1).max(20),
  BOOTSTRAP_ADMIN_DISCORD_ID: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().min(1).optional(),
  ),
  DISCORD_GUILD_ID: z.string().regex(/^\d+$/),
  BECOME_FIGHTER_DISCORD_URL: z.preprocess((value) => value === "" ? undefined : value, z.string().url().startsWith("https://discord.com/channels/").optional()),
  FIGHTER_ANALYST_DISCORD_ROLE_ID: z.preprocess((value) => value === "" ? undefined : value, z.string().regex(/^\d+$/).optional()),
  REMINDER_JOB_SECRET: z.preprocess((value) => value === "" ? undefined : value, z.string().min(32).optional()),
  FIGHT_POOL_ENABLED: z.preprocess((value) => value === undefined ? "false" : value, z.enum(["true", "false"]).transform((value) => value === "true")),
  FIGHT_POOL_WIN_REWARD: z.coerce.number().int().min(0).max(100_000).default(100),
  FIGHT_POOL_CODE_TTL_MINUTES: z.coerce.number().int().min(2).max(60).default(10),
  FIGHT_POOL_PRESENCE_TTL_SECONDS: z.coerce.number().int().min(10).max(300).default(45),
  FIGHT_POOL_BRIDGE_SECRET: z.preprocess((value) => value === "" ? undefined : value, z.string().min(32).optional()),
  FIGHT_POOL_CODE_SECRET: z.preprocess((value) => value === "" ? undefined : value, z.string().min(32).optional()),
});

export type AppEnv = z.infer<typeof schema>;

let cached: AppEnv | undefined;

export function getEnv(): AppEnv {
  if (cached) return cached;

  const result = schema.safeParse(process.env);
  if (!result.success) {
    const names = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid environment configuration: ${names}`);
  }

  cached = result.data;
  if (cached.COIN_FLIP_MAX_WAGER < cached.COIN_FLIP_MIN_WAGER) {
    throw new Error("Invalid environment configuration: COIN_FLIP_MAX_WAGER");
  }
  if (cached.BLACKJACK_MAX_WAGER < cached.BLACKJACK_MIN_WAGER) {
    throw new Error("Invalid environment configuration: BLACKJACK_MAX_WAGER");
  }
  if (cached.HIGH_LOW_MAX_WAGER < cached.HIGH_LOW_MIN_WAGER) {
    throw new Error("Invalid environment configuration: HIGH_LOW_MAX_WAGER");
  }
  if (cached.BET_MAX_WAGER < cached.BET_MIN_WAGER) {
    throw new Error("Invalid environment configuration: BET_MAX_WAGER");
  }
  if (cached.MARKET_MAX_PRICE < cached.MARKET_MIN_PRICE) {
    throw new Error("Invalid environment configuration: MARKET_MAX_PRICE");
  }
  return cached;
}
