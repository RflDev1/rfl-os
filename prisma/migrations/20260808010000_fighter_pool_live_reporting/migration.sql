ALTER TABLE "fighter_pool_matches"
  ADD COLUMN "arena_server_id" TEXT,
  ADD COLUMN "current_round" INTEGER,
  ADD COLUMN "countdown_seconds" INTEGER,
  ADD COLUMN "countdown_started_at" TIMESTAMP(3),
  ADD COLUMN "disconnected_username" TEXT;

UPDATE "fighter_pool_matches" AS match
SET "arena_server_id" = server."id"
FROM "fighter_pool_servers" AS server
WHERE server."current_match_id" = match."id";

CREATE TABLE "fighter_pool_live_events" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "match_id" TEXT NOT NULL,
  "server_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "data" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fighter_pool_live_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fighter_pool_rounds" (
  "id" TEXT NOT NULL,
  "match_id" TEXT NOT NULL,
  "round_id" TEXT NOT NULL,
  "round_number" INTEGER NOT NULL,
  "winner_team" TEXT NOT NULL,
  "winner_minecraft_username" TEXT NOT NULL,
  "loser_team" TEXT NOT NULL,
  "loser_minecraft_username" TEXT NOT NULL,
  "red_round_wins" INTEGER NOT NULL,
  "blue_round_wins" INTEGER NOT NULL,
  "duration_seconds" INTEGER,
  "stats" JSONB,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fighter_pool_rounds_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fighter_pool_live_events_event_id_key" ON "fighter_pool_live_events"("event_id");
CREATE INDEX "fighter_pool_live_events_match_id_occurred_at_idx" ON "fighter_pool_live_events"("match_id", "occurred_at");
CREATE UNIQUE INDEX "fighter_pool_rounds_match_id_round_id_key" ON "fighter_pool_rounds"("match_id", "round_id");
CREATE UNIQUE INDEX "fighter_pool_rounds_match_id_round_number_key" ON "fighter_pool_rounds"("match_id", "round_number");
CREATE INDEX "fighter_pool_rounds_match_id_occurred_at_idx" ON "fighter_pool_rounds"("match_id", "occurred_at");
ALTER TABLE "fighter_pool_live_events" ADD CONSTRAINT "fighter_pool_live_events_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "fighter_pool_matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fighter_pool_rounds" ADD CONSTRAINT "fighter_pool_rounds_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "fighter_pool_matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
