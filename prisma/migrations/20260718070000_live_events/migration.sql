CREATE TYPE "FightResult" AS ENUM ('RED_WIN', 'BLUE_WIN', 'DRAW', 'NO_CONTEST');
CREATE TYPE "FightUpdateKind" AS ENUM ('ANNOUNCEMENT', 'FIGHT', 'RESULT');

ALTER TABLE "fights" ADD COLUMN "result" "FightResult";
ALTER TABLE "fights" ADD COLUMN "result_summary" TEXT;
ALTER TABLE "fights" ADD CONSTRAINT "fights_result_consistent" CHECK (
  ("status" = 'COMPLETED' AND "result" IS NOT NULL) OR
  ("status" <> 'COMPLETED' AND "result" IS NULL)
) NOT VALID;

CREATE TABLE "fight_updates" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "fight_id" TEXT,
  "kind" "FightUpdateKind" NOT NULL DEFAULT 'ANNOUNCEMENT',
  "message" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fight_updates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fight_updates_event_id_created_at_idx" ON "fight_updates"("event_id", "created_at");
ALTER TABLE "fight_updates" ADD CONSTRAINT "fight_updates_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fight_updates" ADD CONSTRAINT "fight_updates_fight_id_fkey" FOREIGN KEY ("fight_id") REFERENCES "fights"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
