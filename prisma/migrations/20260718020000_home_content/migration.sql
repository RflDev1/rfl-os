CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "FightStatus" AS ENUM ('SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED');

CREATE TABLE "events" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "venue" TEXT,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fighters" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nickname" TEXT,
  "wins" INTEGER NOT NULL DEFAULT 0,
  "losses" INTEGER NOT NULL DEFAULT 0,
  "draws" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fighters_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fighters_record_nonnegative" CHECK ("wins" >= 0 AND "losses" >= 0 AND "draws" >= 0)
);

CREATE TABLE "fights" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "red_fighter_id" TEXT NOT NULL,
  "blue_fighter_id" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 1,
  "status" "FightStatus" NOT NULL DEFAULT 'SCHEDULED',
  "scheduled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fights_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fights_distinct_fighters" CHECK ("red_fighter_id" <> "blue_fighter_id"),
  CONSTRAINT "fights_position_positive" CHECK ("position" > 0)
);

CREATE TABLE "announcements" (
  "id" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "link_label" TEXT,
  "link_url" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ends_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "announcements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "announcements_schedule_valid" CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at")
);

CREATE INDEX "events_status_starts_at_idx" ON "events"("status", "starts_at");
CREATE INDEX "fighters_active_name_idx" ON "fighters"("active", "name");
CREATE INDEX "fights_event_id_position_idx" ON "fights"("event_id", "position");
CREATE INDEX "announcements_active_starts_at_idx" ON "announcements"("active", "starts_at");

ALTER TABLE "fights" ADD CONSTRAINT "fights_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fights" ADD CONSTRAINT "fights_red_fighter_id_fkey"
  FOREIGN KEY ("red_fighter_id") REFERENCES "fighters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fights" ADD CONSTRAINT "fights_blue_fighter_id_fkey"
  FOREIGN KEY ("blue_fighter_id") REFERENCES "fighters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

