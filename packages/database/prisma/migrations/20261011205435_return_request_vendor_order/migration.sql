-- AlterTable
ALTER TABLE "ReturnRequest" ADD COLUMN     "decisionNote" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "vendorOrderId" TEXT;

-- CreateIndex
CREATE INDEX "ReturnRequest_vendorOrderId_idx" ON "ReturnRequest"("vendorOrderId");
