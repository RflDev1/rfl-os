CREATE TYPE "DiscordNotificationKind" AS ENUM (
  'FIGHT_APPROVED',
  'FIGHT_REMINDER_2H',
  'FIGHT_REMINDER_1H',
  'FIGHT_REMINDER_10M'
);

ALTER TABLE "discord_notifications"
  ADD COLUMN "fight_id" TEXT,
  ADD COLUMN "kind" "DiscordNotificationKind" NOT NULL DEFAULT 'FIGHT_APPROVED',
  ADD COLUMN "scheduled_for" TIMESTAMP(3);

UPDATE "discord_notifications" AS notification
SET
  "fight_id" = request."fight_id",
  "scheduled_for" = notification."created_at"
FROM "fight_requests" AS request
WHERE request."id" = notification."fight_request_id";

ALTER TABLE "discord_notifications"
  ALTER COLUMN "fight_id" SET NOT NULL,
  ALTER COLUMN "scheduled_for" SET NOT NULL,
  ALTER COLUMN "fight_request_id" DROP NOT NULL,
  ALTER COLUMN "kind" DROP DEFAULT;

DROP INDEX "discord_notifications_fight_request_id_recipient_user_id_key";
DROP INDEX "discord_notifications_status_created_at_idx";

CREATE UNIQUE INDEX "discord_notifications_fight_id_recipient_user_id_kind_key"
  ON "discord_notifications"("fight_id", "recipient_user_id", "kind");
CREATE INDEX "discord_notifications_status_scheduled_for_idx"
  ON "discord_notifications"("status", "scheduled_for");

ALTER TABLE "discord_notifications"
  ADD CONSTRAINT "discord_notifications_fight_id_fkey"
  FOREIGN KEY ("fight_id") REFERENCES "fights"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
