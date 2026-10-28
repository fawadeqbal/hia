-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "vendorOrderId" TEXT;

-- AlterTable
ALTER TABLE "OrderNote" ADD COLUMN     "vendorOrderId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_vendorOrderId_key" ON "Invoice"("vendorOrderId");

-- CreateIndex
CREATE INDEX "OrderNote_orderId_idx" ON "OrderNote"("orderId");

-- CreateIndex
CREATE INDEX "OrderNote_vendorOrderId_idx" ON "OrderNote"("vendorOrderId");

