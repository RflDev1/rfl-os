CREATE TYPE "WalletReason" AS ENUM ('DAILY_REWARD', 'ADMIN_ADJUSTMENT');

CREATE TABLE "wallet_entries" (
  "id" TEXT NOT NULL,
  "wallet_id" TEXT NOT NULL,
  "delta" INTEGER NOT NULL,
  "balance_after" INTEGER NOT NULL,
  "reason" "WalletReason" NOT NULL,
  "reference_id" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wallet_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "wallet_entries_delta_nonzero" CHECK ("delta" <> 0),
  CONSTRAINT "wallet_entries_balance_nonnegative" CHECK ("balance_after" >= 0)
);

CREATE TABLE "daily_reward_claims" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "reward_date" DATE NOT NULL,
  "amount" INTEGER NOT NULL,
  "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "daily_reward_claims_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "daily_reward_claims_amount_positive" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "wallet_entries_wallet_id_idempotency_key_key"
  ON "wallet_entries"("wallet_id", "idempotency_key");
CREATE INDEX "wallet_entries_wallet_id_created_at_idx"
  ON "wallet_entries"("wallet_id", "created_at");
CREATE UNIQUE INDEX "daily_reward_claims_user_id_reward_date_key"
  ON "daily_reward_claims"("user_id", "reward_date");
CREATE INDEX "daily_reward_claims_user_id_claimed_at_idx"
  ON "daily_reward_claims"("user_id", "claimed_at");

ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_wallet_id_fkey"
  FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_reward_claims" ADD CONSTRAINT "daily_reward_claims_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

