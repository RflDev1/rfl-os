ALTER TABLE "card_definitions"
ADD COLUMN "max_supply" INTEGER;

ALTER TABLE "card_definitions"
ADD CONSTRAINT "card_definitions_max_supply_positive"
CHECK ("max_supply" IS NULL OR "max_supply" >= 1);
