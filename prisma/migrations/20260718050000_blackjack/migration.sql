ALTER TYPE "WalletReason" ADD VALUE 'BLACKJACK_WAGER';
ALTER TYPE "WalletReason" ADD VALUE 'BLACKJACK_PAYOUT';
CREATE TYPE "BlackjackStatus" AS ENUM ('ACTIVE', 'SETTLED');
CREATE TYPE "BlackjackOutcome" AS ENUM ('PLAYER_BLACKJACK', 'PLAYER_WIN', 'DEALER_WIN', 'PUSH', 'PLAYER_BUST', 'DEALER_BUST');
CREATE TYPE "BlackjackMove" AS ENUM ('DEAL', 'HIT', 'STAND', 'DOUBLE');

CREATE TABLE "blackjack_rounds" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "wager" INTEGER NOT NULL,
  "total_wager" INTEGER NOT NULL,
  "payout" INTEGER NOT NULL DEFAULT 0,
  "balance_after" INTEGER NOT NULL,
  "status" "BlackjackStatus" NOT NULL DEFAULT 'ACTIVE',
  "outcome" "BlackjackOutcome",
  "deck" JSONB NOT NULL,
  "player_cards" JSONB NOT NULL,
  "dealer_cards" JSONB NOT NULL,
  "payout_basis_points" INTEGER NOT NULL,
  "blackjack_payout_bps" INTEGER NOT NULL,
  "rules_version" INTEGER NOT NULL DEFAULT 1,
  "version" INTEGER NOT NULL DEFAULT 0,
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settled_at" TIMESTAMP(3),
  CONSTRAINT "blackjack_rounds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "blackjack_rounds_wagers_positive" CHECK ("wager" > 0 AND "total_wager" >= "wager"),
  CONSTRAINT "blackjack_rounds_payout_nonnegative" CHECK ("payout" >= 0),
  CONSTRAINT "blackjack_rounds_balance_nonnegative" CHECK ("balance_after" >= 0),
  CONSTRAINT "blackjack_rounds_state_consistent" CHECK (
    ("status" = 'ACTIVE' AND "outcome" IS NULL AND "settled_at" IS NULL) OR
    ("status" = 'SETTLED' AND "outcome" IS NOT NULL AND "settled_at" IS NOT NULL)
  )
);

CREATE TABLE "blackjack_actions" (
  "id" TEXT NOT NULL,
  "round_id" TEXT NOT NULL,
  "move" "BlackjackMove" NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "blackjack_actions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blackjack_rounds_user_id_idempotency_key_key"
  ON "blackjack_rounds"("user_id", "idempotency_key");
CREATE UNIQUE INDEX "blackjack_one_active_round_per_user"
  ON "blackjack_rounds"("user_id") WHERE "status" = 'ACTIVE';
CREATE INDEX "blackjack_rounds_user_id_created_at_idx"
  ON "blackjack_rounds"("user_id", "created_at");
CREATE UNIQUE INDEX "blackjack_actions_round_id_idempotency_key_key"
  ON "blackjack_actions"("round_id", "idempotency_key");
CREATE INDEX "blackjack_actions_round_id_created_at_idx"
  ON "blackjack_actions"("round_id", "created_at");

ALTER TABLE "blackjack_rounds" ADD CONSTRAINT "blackjack_rounds_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "blackjack_actions" ADD CONSTRAINT "blackjack_actions_round_id_fkey"
  FOREIGN KEY ("round_id") REFERENCES "blackjack_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
