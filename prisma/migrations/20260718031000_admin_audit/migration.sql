CREATE TABLE "admin_audit_entries" (
  "id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "summary" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_audit_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_audit_entries_actor_id_created_at_idx"
  ON "admin_audit_entries"("actor_id", "created_at");
CREATE INDEX "admin_audit_entries_target_type_target_id_created_at_idx"
  ON "admin_audit_entries"("target_type", "target_id", "created_at");

ALTER TABLE "admin_audit_entries" ADD CONSTRAINT "admin_audit_entries_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

