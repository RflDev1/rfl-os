CREATE TYPE "FighterStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

ALTER TABLE "fighters" ADD COLUMN "status" "FighterStatus" NOT NULL DEFAULT 'ACTIVE';
UPDATE "fighters" SET "status" = CASE WHEN "active" THEN 'ACTIVE'::"FighterStatus" ELSE 'INACTIVE'::"FighterStatus" END;
DROP INDEX "fighters_active_name_idx";
ALTER TABLE "fighters" DROP COLUMN "active";
CREATE INDEX "fighters_status_name_idx" ON "fighters"("status", "name");
