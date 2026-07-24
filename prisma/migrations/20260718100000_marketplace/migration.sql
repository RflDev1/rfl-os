ALTER TYPE "WalletReason" ADD VALUE 'MARKET_PURCHASE';
ALTER TYPE "WalletReason" ADD VALUE 'MARKET_SALE';
CREATE TYPE "MarketListingStatus" AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED');

CREATE TABLE "market_listings" (
  "id" TEXT NOT NULL,
  "card_instance_id" TEXT NOT NULL,
  "seller_id" TEXT NOT NULL,
  "price" INTEGER NOT NULL,
  "status" "MarketListingStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "closed_at" TIMESTAMP(3),
  CONSTRAINT "market_listings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "market_listings_price_valid" CHECK ("price" > 0),
  CONSTRAINT "market_listings_state_consistent" CHECK (
    ("status" = 'ACTIVE' AND "closed_at" IS NULL) OR
    ("status" IN ('SOLD', 'CANCELLED') AND "closed_at" IS NOT NULL)
  )
);

CREATE TABLE "market_sales" (
  "id" TEXT NOT NULL,
  "listing_id" TEXT NOT NULL,
  "card_instance_id" TEXT NOT NULL,
  "buyer_id" TEXT NOT NULL,
  "seller_id" TEXT NOT NULL,
  "price" INTEGER NOT NULL,
  "fee" INTEGER NOT NULL DEFAULT 0,
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "market_sales_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "market_sales_values_valid" CHECK ("price" > 0 AND "fee" >= 0 AND "fee" <= "price" AND "buyer_id" <> "seller_id")
);

CREATE UNIQUE INDEX "market_one_active_listing_per_card" ON "market_listings"("card_instance_id") WHERE "status" = 'ACTIVE';
CREATE INDEX "market_listings_status_created_at_idx" ON "market_listings"("status", "created_at");
CREATE INDEX "market_listings_seller_id_status_created_at_idx" ON "market_listings"("seller_id", "status", "created_at");
CREATE INDEX "market_listings_card_instance_id_created_at_idx" ON "market_listings"("card_instance_id", "created_at");
CREATE UNIQUE INDEX "market_sales_listing_id_key" ON "market_sales"("listing_id");
CREATE UNIQUE INDEX "market_sales_buyer_id_idempotency_key_key" ON "market_sales"("buyer_id", "idempotency_key");
CREATE INDEX "market_sales_buyer_id_created_at_idx" ON "market_sales"("buyer_id", "created_at");
CREATE INDEX "market_sales_seller_id_created_at_idx" ON "market_sales"("seller_id", "created_at");

ALTER TABLE "market_listings" ADD CONSTRAINT "market_listings_card_instance_id_fkey" FOREIGN KEY ("card_instance_id") REFERENCES "card_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "market_listings" ADD CONSTRAINT "market_listings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "market_sales" ADD CONSTRAINT "market_sales_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "market_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "market_sales" ADD CONSTRAINT "market_sales_card_instance_id_fkey" FOREIGN KEY ("card_instance_id") REFERENCES "card_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "market_sales" ADD CONSTRAINT "market_sales_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "market_sales" ADD CONSTRAINT "market_sales_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
