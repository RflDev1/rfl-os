CREATE TYPE "FighterPoolMatchStatus" AS ENUM ('AWAITING_CHECKIN', 'READY', 'LIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "FighterPoolReviewAction" AS ENUM ('UPHOLD', 'REVERSE', 'VOID');
ALTER TYPE "WalletReason" ADD VALUE 'FIGHT_POOL_WIN';
ALTER TYPE "WalletReason" ADD VALUE 'FIGHT_POOL_REVERSAL';

ALTER TABLE "fighters"
  ADD COLUMN "minecraft_username" TEXT,
  ADD COLUMN "minecraft_username_normalized" TEXT;
CREATE UNIQUE INDEX "fighters_minecraft_username_normalized_key" ON "fighters"("minecraft_username_normalized");

CREATE TABLE "fighter_pool_queue_entries" (
  "id" TEXT NOT NULL,
  "fighter_id" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fighter_pool_queue_entries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fighter_pool_queue_entries_fighter_id_key" ON "fighter_pool_queue_entries"("fighter_id");
CREATE INDEX "fighter_pool_queue_entries_joined_at_idx" ON "fighter_pool_queue_entries"("joined_at");

CREATE TABLE "fighter_pool_matches" (
  "id" TEXT NOT NULL,
  "red_fighter_id" TEXT NOT NULL,
  "blue_fighter_id" TEXT NOT NULL,
  "winner_fighter_id" TEXT,
  "loser_fighter_id" TEXT,
  "red_rank_snapshot" INTEGER NOT NULL,
  "blue_rank_snapshot" INTEGER NOT NULL,
  "red_code_hash" TEXT NOT NULL,
  "red_code_encrypted" TEXT NOT NULL,
  "blue_code_hash" TEXT NOT NULL,
  "blue_code_encrypted" TEXT NOT NULL,
  "red_checked_in_at" TIMESTAMP(3),
  "blue_checked_in_at" TIMESTAMP(3),
  "red_round_wins" INTEGER NOT NULL DEFAULT 0,
  "blue_round_wins" INTEGER NOT NULL DEFAULT 0,
  "status" "FighterPoolMatchStatus" NOT NULL DEFAULT 'AWAITING_CHECKIN',
  "result_disposition" TEXT NOT NULL DEFAULT 'ORIGINAL',
  "result_report_id" TEXT,
  "result_payload" JSONB,
  "reward_amount" INTEGER NOT NULL DEFAULT 0,
  "code_expires_at" TIMESTAMP(3) NOT NULL,
  "reconnect_deadline_at" TIMESTAMP(3),
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fighter_pool_matches_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fighter_pool_matches_result_report_id_key" ON "fighter_pool_matches"("result_report_id");
CREATE INDEX "fighter_pool_matches_red_fighter_id_created_at_idx" ON "fighter_pool_matches"("red_fighter_id", "created_at");
CREATE INDEX "fighter_pool_matches_blue_fighter_id_created_at_idx" ON "fighter_pool_matches"("blue_fighter_id", "created_at");
CREATE INDEX "fighter_pool_matches_status_created_at_idx" ON "fighter_pool_matches"("status", "created_at");

CREATE TABLE "fighter_pool_servers" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'ARENA',
  "public_address" TEXT NOT NULL,
  "port" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
  "current_match_id" TEXT,
  "last_heartbeat_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fighter_pool_servers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fighter_pool_servers_current_match_id_key" ON "fighter_pool_servers"("current_match_id");
CREATE INDEX "fighter_pool_servers_status_last_heartbeat_at_idx" ON "fighter_pool_servers"("status", "last_heartbeat_at");

CREATE TABLE "fighter_pool_presences" (
  "id" TEXT NOT NULL,
  "server_id" TEXT NOT NULL,
  "minecraft_username" TEXT NOT NULL,
  "minecraft_username_normalized" TEXT NOT NULL,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fighter_pool_presences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fighter_pool_presences_server_id_minecraft_username_normalized_key" ON "fighter_pool_presences"("server_id", "minecraft_username_normalized");
CREATE INDEX "fighter_pool_presences_minecraft_username_normalized_last_seen_at_idx" ON "fighter_pool_presences"("minecraft_username_normalized", "last_seen_at");

CREATE TABLE "fighter_pool_result_reviews" (
  "id" TEXT NOT NULL,
  "match_id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "action" "FighterPoolReviewAction" NOT NULL,
  "reason" TEXT NOT NULL,
  "previous_winner_id" TEXT,
  "resulting_winner_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fighter_pool_result_reviews_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "fighter_pool_result_reviews_match_id_created_at_idx" ON "fighter_pool_result_reviews"("match_id", "created_at");

ALTER TABLE "fighter_pool_queue_entries" ADD CONSTRAINT "fighter_pool_queue_entries_fighter_id_fkey" FOREIGN KEY ("fighter_id") REFERENCES "fighters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fighter_pool_matches" ADD CONSTRAINT "fighter_pool_matches_red_fighter_id_fkey" FOREIGN KEY ("red_fighter_id") REFERENCES "fighters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fighter_pool_matches" ADD CONSTRAINT "fighter_pool_matches_blue_fighter_id_fkey" FOREIGN KEY ("blue_fighter_id") REFERENCES "fighters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fighter_pool_matches" ADD CONSTRAINT "fighter_pool_matches_winner_fighter_id_fkey" FOREIGN KEY ("winner_fighter_id") REFERENCES "fighters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fighter_pool_matches" ADD CONSTRAINT "fighter_pool_matches_loser_fighter_id_fkey" FOREIGN KEY ("loser_fighter_id") REFERENCES "fighters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fighter_pool_servers" ADD CONSTRAINT "fighter_pool_servers_current_match_id_fkey" FOREIGN KEY ("current_match_id") REFERENCES "fighter_pool_matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fighter_pool_presences" ADD CONSTRAINT "fighter_pool_presences_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "fighter_pool_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fighter_pool_result_reviews" ADD CONSTRAINT "fighter_pool_result_reviews_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "fighter_pool_matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
