-- CreateTable
CREATE TABLE "app_snapshots" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "data" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_snapshots_pkey" PRIMARY KEY ("id")
);
