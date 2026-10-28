-- DropForeignKey
ALTER TABLE "ReviewImage" DROP CONSTRAINT "ReviewImage_reviewId_fkey";

-- DropIndex
DROP INDEX "OrderNote_vendorOrderId_idx";

-- DropIndex
DROP INDEX "Page_slug_locale_key";

-- AlterTable
ALTER TABLE "OrderNote" DROP COLUMN "vendorOrderId";

-- AlterTable
ALTER TABLE "Page" DROP COLUMN "locale";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "locale";

-- DropTable
DROP TABLE "ReviewImage";

-- CreateIndex
CREATE UNIQUE INDEX "Page_slug_key" ON "Page"("slug");


-- Data: settings and roles of removed features (marketplace, loyalty, tax, marketing, staff roles)
DELETE FROM "Setting"
WHERE "key" LIKE 'loyalty.%'
   OR "key" LIKE 'tax.%'
   OR "key" LIKE 'marketing.%'
   OR "key" LIKE 'marketplace.%'
   OR "key" = 'payments.onlineMethods';

DELETE FROM "Role"
WHERE "name" IN ('CONTENT_MANAGER', 'MARKETING_MANAGER', 'SUPPORT_AGENT', 'WAREHOUSE_STAFF', 'VENDOR_STAFF')
   OR "isSystem" = false;
