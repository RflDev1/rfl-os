CREATE TABLE "emergency_locks" (
    "id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "activated_at" TIMESTAMP(3),
    "activation_cause" TEXT,
    "unlocked_at" TIMESTAMP(3),
    "unlocked_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_locks_pkey" PRIMARY KEY ("id")
);
