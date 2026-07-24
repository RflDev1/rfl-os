ALTER TYPE "WalletReason" ADD VALUE 'PACK_PURCHASE';
CREATE TYPE "CardRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

CREATE TABLE "card_sets" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "released_at" TIMESTAMP(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "card_sets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "card_definitions" (
  "id" TEXT NOT NULL,
  "set_id" TEXT NOT NULL,
  "fighter_id" TEXT,
  "name" TEXT NOT NULL,
  "subtitle" TEXT,
  "rarity" "CardRarity" NOT NULL,
  "card_number" INTEGER NOT NULL,
  "image_url" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "card_definitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "card_definitions_number_valid" CHECK ("card_number" > 0)
);

CREATE TABLE "pack_definitions" (
  "id" TEXT NOT NULL,
  "set_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price" INTEGER NOT NULL,
  "cards_per_pack" INTEGER NOT NULL,
  "common_weight" INTEGER NOT NULL,
  "rare_weight" INTEGER NOT NULL,
  "epic_weight" INTEGER NOT NULL,
  "legendary_weight" INTEGER NOT NULL,
  "drop_table_version" INTEGER NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pack_definitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pack_definitions_values_valid" CHECK (
    "price" > 0 AND "cards_per_pack" BETWEEN 1 AND 10 AND
    "common_weight" >= 0 AND "rare_weight" >= 0 AND "epic_weight" >= 0 AND "legendary_weight" >= 0 AND
    ("common_weight" + "rare_weight" + "epic_weight" + "legendary_weight") > 0 AND "drop_table_version" > 0
  )
);

CREATE TABLE "pack_openings" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "pack_id" TEXT NOT NULL,
  "price" INTEGER NOT NULL,
  "balance_after" INTEGER NOT NULL,
  "drop_table_version" INTEGER NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pack_openings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pack_openings_values_valid" CHECK ("price" > 0 AND "balance_after" >= 0 AND "drop_table_version" > 0)
);

CREATE TABLE "card_instances" (
  "id" TEXT NOT NULL,
  "definition_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "opening_id" TEXT NOT NULL,
  "serial_number" SERIAL NOT NULL,
  "acquired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "card_instances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "card_sets_code_key" ON "card_sets"("code");
CREATE INDEX "card_sets_active_released_at_idx" ON "card_sets"("active", "released_at");
CREATE UNIQUE INDEX "card_definitions_set_id_card_number_key" ON "card_definitions"("set_id", "card_number");
CREATE INDEX "card_definitions_set_id_rarity_active_idx" ON "card_definitions"("set_id", "rarity", "active");
CREATE INDEX "pack_definitions_active_created_at_idx" ON "pack_definitions"("active", "created_at");
CREATE UNIQUE INDEX "pack_openings_user_id_idempotency_key_key" ON "pack_openings"("user_id", "idempotency_key");
CREATE INDEX "pack_openings_user_id_created_at_idx" ON "pack_openings"("user_id", "created_at");
CREATE UNIQUE INDEX "card_instances_serial_number_key" ON "card_instances"("serial_number");
CREATE INDEX "card_instances_owner_id_acquired_at_idx" ON "card_instances"("owner_id", "acquired_at");
CREATE INDEX "card_instances_definition_id_owner_id_idx" ON "card_instances"("definition_id", "owner_id");

ALTER TABLE "card_definitions" ADD CONSTRAINT "card_definitions_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "card_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "card_definitions" ADD CONSTRAINT "card_definitions_fighter_id_fkey" FOREIGN KEY ("fighter_id") REFERENCES "fighters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pack_definitions" ADD CONSTRAINT "pack_definitions_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "card_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pack_openings" ADD CONSTRAINT "pack_openings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pack_openings" ADD CONSTRAINT "pack_openings_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "pack_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "card_instances" ADD CONSTRAINT "card_instances_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "card_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "card_instances" ADD CONSTRAINT "card_instances_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "card_instances" ADD CONSTRAINT "card_instances_opening_id_fkey" FOREIGN KEY ("opening_id") REFERENCES "pack_openings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
