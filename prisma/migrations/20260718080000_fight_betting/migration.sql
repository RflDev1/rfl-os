ALTER TYPE "WalletReason" ADD VALUE 'BET_WAGER';
ALTER TYPE "WalletReason" ADD VALUE 'BET_PAYOUT';
ALTER TYPE "WalletReason" ADD VALUE 'BET_REFUND';

CREATE TYPE "BetMarketStatus" AS ENUM ('OPEN', 'LOCKED', 'SETTLED', 'VOID');
CREATE TYPE "BetSelection" AS ENUM ('RED', 'BLUE');
CREATE TYPE "BetStatus" AS ENUM ('PENDING', 'WON', 'LOST', 'VOID');

CREATE TABLE "bet_markets" (
  "id" TEXT NOT NULL,
  "fight_id" TEXT NOT NULL,
  "status" "BetMarketStatus" NOT NULL DEFAULT 'OPEN',
  "red_odds_bps" INTEGER NOT NULL,
  "blue_odds_bps" INTEGER NOT NULL,
  "settled_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "settled_at" TIMESTAMP(3),
  CONSTRAINT "bet_markets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bet_markets_odds_valid" CHECK ("red_odds_bps" >= 10000 AND "blue_odds_bps" >= 10000),
  CONSTRAINT "bet_markets_state_consistent" CHECK (
    ("status" IN ('OPEN', 'LOCKED') AND "settled_at" IS NULL AND "settled_by_id" IS NULL) OR
    ("status" IN ('SETTLED', 'VOID') AND "settled_at" IS NOT NULL AND "settled_by_id" IS NOT NULL)
  )
);

CREATE TABLE "bets" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "market_id" TEXT NOT NULL,
  "selection" "BetSelection" NOT NULL,
  "stake" INTEGER NOT NULL,
  "accepted_odds_bps" INTEGER NOT NULL,
  "possible_payout" INTEGER NOT NULL,
  "payout" INTEGER NOT NULL DEFAULT 0,
  "balance_after" INTEGER NOT NULL,
  "status" "BetStatus" NOT NULL DEFAULT 'PENDING',
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settled_at" TIMESTAMP(3),
  CONSTRAINT "bets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bets_values_valid" CHECK ("stake" > 0 AND "accepted_odds_bps" >= 10000 AND "possible_payout" >= "stake" AND "payout" >= 0 AND "balance_after" >= 0),
  CONSTRAINT "bets_state_consistent" CHECK (
    ("status" = 'PENDING' AND "settled_at" IS NULL AND "payout" = 0) OR
    ("status" = 'WON' AND "settled_at" IS NOT NULL AND "payout" = "possible_payout") OR
    ("status" = 'LOST' AND "settled_at" IS NOT NULL AND "payout" = 0) OR
    ("status" = 'VOID' AND "settled_at" IS NOT NULL AND "payout" = "stake")
  )
);

CREATE UNIQUE INDEX "bet_markets_fight_id_key" ON "bet_markets"("fight_id");
CREATE INDEX "bet_markets_status_created_at_idx" ON "bet_markets"("status", "created_at");
CREATE UNIQUE INDEX "bets_user_id_idempotency_key_key" ON "bets"("user_id", "idempotency_key");
CREATE INDEX "bets_user_id_created_at_idx" ON "bets"("user_id", "created_at");
CREATE INDEX "bets_market_id_status_idx" ON "bets"("market_id", "status");

ALTER TABLE "bet_markets" ADD CONSTRAINT "bet_markets_fight_id_fkey" FOREIGN KEY ("fight_id") REFERENCES "fights"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bet_markets" ADD CONSTRAINT "bet_markets_settled_by_id_fkey" FOREIGN KEY ("settled_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bets" ADD CONSTRAINT "bets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bets" ADD CONSTRAINT "bets_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "bet_markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
