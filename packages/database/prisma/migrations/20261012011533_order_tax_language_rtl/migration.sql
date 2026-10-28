-- AlterTable
ALTER TABLE "Language" ADD COLUMN     "isRtl" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "taxAdded" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "taxInclusive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "taxName" TEXT,
ADD COLUMN     "taxRate" DECIMAL(6,4);

-- AlterTable
ALTER TABLE "VendorOrder" ADD COLUMN     "taxAdded" DECIMAL(12,2) NOT NULL DEFAULT 0;
