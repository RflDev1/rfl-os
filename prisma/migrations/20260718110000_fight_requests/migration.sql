CREATE TYPE "FightRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

ALTER TABLE "fighters" ADD COLUMN "user_id" TEXT;
ALTER TABLE "fighters" ADD COLUMN "rank" INTEGER;
ALTER TABLE "fighters" ADD CONSTRAINT "fighters_rank_valid" CHECK ("rank" IS NULL OR "rank" > 0);

CREATE TABLE "fight_requests" (
  "id" TEXT NOT NULL,
  "requester_fighter_id" TEXT NOT NULL,
  "opponent_fighter_id" TEXT NOT NULL,
  "requested_by_id" TEXT NOT NULL,
  "requester_rank" INTEGER NOT NULL,
  "opponent_rank" INTEGER NOT NULL,
  "status" "FightRequestStatus" NOT NULL DEFAULT 'PENDING',
  "fight_id" TEXT,
  "reviewed_by_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fight_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fight_requests_distinct_fighters" CHECK ("requester_fighter_id" <> "opponent_fighter_id"),
  CONSTRAINT "fight_requests_ranks_valid" CHECK ("requester_rank" > 0 AND "opponent_rank" > 0),
  CONSTRAINT "fight_requests_state_consistent" CHECK (
    ("status" = 'PENDING' AND "fight_id" IS NULL AND "reviewed_by_id" IS NULL AND "reviewed_at" IS NULL) OR
    ("status" = 'APPROVED' AND "fight_id" IS NOT NULL AND "reviewed_by_id" IS NOT NULL AND "reviewed_at" IS NOT NULL) OR
    ("status" IN ('DECLINED', 'CANCELLED') AND "fight_id" IS NULL AND "reviewed_at" IS NOT NULL)
  )
);

CREATE TABLE "discord_notifications" (
  "id" TEXT NOT NULL,
  "fight_request_id" TEXT NOT NULL,
  "recipient_user_id" TEXT NOT NULL,
  "discord_user_id" TEXT NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMP(3),
  CONSTRAINT "discord_notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "discord_notifications_attempts_valid" CHECK ("attempts" >= 0),
  CONSTRAINT "discord_notifications_state_consistent" CHECK (
    ("status" IN ('PENDING', 'FAILED') AND "sent_at" IS NULL) OR
    ("status" = 'SENT' AND "sent_at" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "fighters_user_id_key" ON "fighters"("user_id");
CREATE UNIQUE INDEX "fighters_rank_key" ON "fighters"("rank");
CREATE UNIQUE INDEX "fight_requests_fight_id_key" ON "fight_requests"("fight_id");
CREATE UNIQUE INDEX "fight_requests_one_pending_pair" ON "fight_requests"("requester_fighter_id", "opponent_fighter_id") WHERE "status" = 'PENDING';
CREATE INDEX "fight_requests_status_created_at_idx" ON "fight_requests"("status", "created_at");
CREATE INDEX "fight_requests_requester_fighter_id_created_at_idx" ON "fight_requests"("requester_fighter_id", "created_at");
CREATE INDEX "fight_requests_opponent_fighter_id_created_at_idx" ON "fight_requests"("opponent_fighter_id", "created_at");
CREATE UNIQUE INDEX "discord_notifications_fight_request_id_recipient_user_id_key" ON "discord_notifications"("fight_request_id", "recipient_user_id");
CREATE INDEX "discord_notifications_status_created_at_idx" ON "discord_notifications"("status", "created_at");

ALTER TABLE "fighters" ADD CONSTRAINT "fighters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fight_requests" ADD CONSTRAINT "fight_requests_requester_fighter_id_fkey" FOREIGN KEY ("requester_fighter_id") REFERENCES "fighters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fight_requests" ADD CONSTRAINT "fight_requests_opponent_fighter_id_fkey" FOREIGN KEY ("opponent_fighter_id") REFERENCES "fighters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fight_requests" ADD CONSTRAINT "fight_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fight_requests" ADD CONSTRAINT "fight_requests_fight_id_fkey" FOREIGN KEY ("fight_id") REFERENCES "fights"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fight_requests" ADD CONSTRAINT "fight_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "discord_notifications" ADD CONSTRAINT "discord_notifications_fight_request_id_fkey" FOREIGN KEY ("fight_request_id") REFERENCES "fight_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "discord_notifications" ADD CONSTRAINT "discord_notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
