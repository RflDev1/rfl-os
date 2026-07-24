ALTER TYPE "WalletReason" ADD VALUE 'HIGH_LOW_WAGER';
ALTER TYPE "WalletReason" ADD VALUE 'HIGH_LOW_PAYOUT';
CREATE TYPE "HighLowStatus" AS ENUM ('ACTIVE', 'SETTLED');
CREATE TYPE "HighLowGuess" AS ENUM ('HIGHER', 'LOWER');
CREATE TYPE "HighLowOutcome" AS ENUM ('CASHED_OUT', 'WRONG_GUESS', 'TIE', 'MAX_STEPS');

CREATE TABLE "high_low_rounds" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "wager" INTEGER NOT NULL,
  "payout" INTEGER NOT NULL DEFAULT 0,
  "balance_after" INTEGER NOT NULL,
  "status" "HighLowStatus" NOT NULL DEFAULT 'ACTIVE',
  "outcome" "HighLowOutcome",
  "deck" JSONB NOT NULL,
  "current_card" TEXT NOT NULL,
  "step" INTEGER NOT NULL DEFAULT 0,
  "multiplier_bps" INTEGER NOT NULL DEFAULT 10000,
  "target_return_bps" INTEGER NOT NULL,
  "max_steps" INTEGER NOT NULL,
  "rules_version" INTEGER NOT NULL DEFAULT 1,
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settled_at" TIMESTAMP(3),
  CONSTRAINT "high_low_rounds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "high_low_rounds_values_valid" CHECK ("wager" > 0 AND "payout" >= 0 AND "balance_after" >= 0 AND "step" >= 0 AND "multiplier_bps" >= 10000 AND "max_steps" > 0),
  CONSTRAINT "high_low_rounds_state_consistent" CHECK (
    ("status" = 'ACTIVE' AND "outcome" IS NULL AND "settled_at" IS NULL) OR
    ("status" = 'SETTLED' AND "outcome" IS NOT NULL AND "settled_at" IS NOT NULL)
  )
);

CREATE TABLE "high_low_guesses" (
  "id" TEXT NOT NULL,
  "round_id" TEXT NOT NULL,
  "guess" "HighLowGuess",
  "previous_card" TEXT NOT NULL,
  "revealed_card" TEXT,
  "correct" BOOLEAN,
  "multiplier_after_bps" INTEGER NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "high_low_guesses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "high_low_rounds_user_id_idempotency_key_key" ON "high_low_rounds"("user_id", "idempotency_key");
CREATE UNIQUE INDEX "high_low_one_active_round_per_user" ON "high_low_rounds"("user_id") WHERE "status" = 'ACTIVE';
CREATE INDEX "high_low_rounds_user_id_created_at_idx" ON "high_low_rounds"("user_id", "created_at");
CREATE UNIQUE INDEX "high_low_guesses_round_id_idempotency_key_key" ON "high_low_guesses"("round_id", "idempotency_key");
CREATE INDEX "high_low_guesses_round_id_created_at_idx" ON "high_low_guesses"("round_id", "created_at");

ALTER TABLE "high_low_rounds" ADD CONSTRAINT "high_low_rounds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "high_low_guesses" ADD CONSTRAINT "high_low_guesses_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "high_low_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
