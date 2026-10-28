-- CreateTable
CREATE TABLE "CartRecovery" (
    "cartId" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "cartUpdatedAt" TIMESTAMP(3) NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartRecovery_pkey" PRIMARY KEY ("cartId")
);

-- CreateIndex
CREATE INDEX "Subscriber_isConfirmed_unsubscribedAt_idx" ON "Subscriber"("isConfirmed", "unsubscribedAt");
