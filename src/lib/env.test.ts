import { afterEach, describe, expect, it, vi } from "vitest";

const valid = {
  NODE_ENV: "test",
  APP_URL: "https://rfl.example",
  DATABASE_URL: "postgresql://example.invalid/rfl",
  AUTH_SECRET: "abcdefghijklmnopqrstuvwxyz1234567890",
  DISCORD_CLIENT_ID: "client-id",
  DISCORD_CLIENT_SECRET: "client-secret",
  DISCORD_BOT_TOKEN: "test-bot-token",
  DISCORD_API_BASE_URL: "https://discord.example/api/v10",
  DISCORD_GUILD_ID: "1514881431229431868",
  DAILY_REWARD_AMOUNT: "100",
  COIN_FLIP_MIN_WAGER: "10",
  COIN_FLIP_MAX_WAGER: "1000",
  COIN_FLIP_PAYOUT_BPS: "20000",
  COIN_FLIP_MAX_PLAYS_PER_MINUTE: "20",
  BLACKJACK_MIN_WAGER: "10",
  BLACKJACK_MAX_WAGER: "1000",
  BLACKJACK_PAYOUT_BPS: "20000",
  BLACKJACK_NATURAL_PAYOUT_BPS: "25000",
  BLACKJACK_MAX_ROUNDS_PER_MINUTE: "10",
  HIGH_LOW_MIN_WAGER: "10",
  HIGH_LOW_MAX_WAGER: "1000",
  HIGH_LOW_TARGET_RETURN_BPS: "9500",
  HIGH_LOW_MAX_STEPS: "7",
  HIGH_LOW_MAX_ROUNDS_PER_MINUTE: "10",
  BET_MIN_WAGER: "10",
  BET_MAX_WAGER: "5000",
  BET_MAX_PLACEMENTS_PER_MINUTE: "20",
  PACK_MAX_OPENINGS_PER_MINUTE: "10",
  MARKET_MIN_PRICE: "10",
  MARKET_MAX_PRICE: "100000",
  FIGHT_REQUEST_RANK_RANGE: "5",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("environment configuration", () => {
  it("accepts a complete production-shaped environment", async () => {
    for (const [name, value] of Object.entries(valid)) vi.stubEnv(name, value);
    const { getEnv } = await import("./env");
    expect(getEnv().APP_URL).toBe("https://rfl.example");
  });

  it("names missing configuration without exposing values", async () => {
    for (const [name, value] of Object.entries(valid)) vi.stubEnv(name, value);
    vi.stubEnv("DISCORD_CLIENT_SECRET", "");
    const { getEnv } = await import("./env");
    expect(() => getEnv()).toThrow("DISCORD_CLIENT_SECRET");
  });
});
