CREATE TABLE "card_images" (
  "card_definition_id" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "content_type" TEXT NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "card_images_pkey" PRIMARY KEY ("card_definition_id")
);

ALTER TABLE "card_images"
ADD CONSTRAINT "card_images_card_definition_id_fkey"
FOREIGN KEY ("card_definition_id") REFERENCES "card_definitions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
