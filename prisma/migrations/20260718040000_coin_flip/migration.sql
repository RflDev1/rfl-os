ALTER TYPE "WalletReason" ADD VALUE 'COIN_FLIP_WAGER';
ALTER TYPE "WalletReason" ADD VALUE 'COIN_FLIP_WIN';
CREATE TYPE "CoinSide" AS ENUM ('HEADS', 'TAILS');

CREATE TABLE "coin_flip_rounds" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "choice" "CoinSide" NOT NULL,
  "result" "CoinSide" NOT NULL,
  "wager" INTEGER NOT NULL,
  "payout" INTEGER NOT NULL,
  "won" BOOLEAN NOT NULL,
  "balance_after" INTEGER NOT NULL,
  "payout_basis_points" INTEGER NOT NULL,
  "random_source_version" INTEGER NOT NULL DEFAULT 1,
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "coin_flip_rounds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "coin_flip_rounds_wager_positive" CHECK ("wager" > 0),
  CONSTRAINT "coin_flip_rounds_payout_nonnegative" CHECK ("payout" >= 0),
  CONSTRAINT "coin_flip_rounds_balance_nonnegative" CHECK ("balance_after" >= 0),
  CONSTRAINT "coin_flip_rounds_payout_consistent" CHECK (
    ("won" = true AND "choice" = "result" AND "payout" > 0) OR
    ("won" = false AND "choice" <> "result" AND "payout" = 0)
  )
);

CREATE UNIQUE INDEX "coin_flip_rounds_user_id_idempotency_key_key"
  ON "coin_flip_rounds"("user_id", "idempotency_key");
CREATE INDEX "coin_flip_rounds_user_id_created_at_idx"
  ON "coin_flip_rounds"("user_id", "created_at");

ALTER TABLE "coin_flip_rounds" ADD CONSTRAINT "coin_flip_rounds_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

