ALTER TABLE "users"
  ADD COLUMN "date_of_birth" DATE,
  ADD COLUMN "terms_accepted_at" TIMESTAMP(3),
  ADD COLUMN "terms_version" TEXT,
  ADD COLUMN "privacy_accepted_at" TIMESTAMP(3),
  ADD COLUMN "privacy_version" TEXT;

CREATE TABLE "legal_acceptances" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "terms_version" TEXT NOT NULL,
  "privacy_version" TEXT NOT NULL,
  "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legal_acceptances_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "legal_acceptances_user_id_accepted_at_idx"
  ON "legal_acceptances"("user_id", "accepted_at");

ALTER TABLE "legal_acceptances"
  ADD CONSTRAINT "legal_acceptances_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
