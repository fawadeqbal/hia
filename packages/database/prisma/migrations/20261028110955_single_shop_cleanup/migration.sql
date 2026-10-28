-- AlterEnum
BEGIN;
CREATE TYPE "PaymentMethod_new" AS ENUM ('CARD', 'WALLET', 'BANK_TRANSFER', 'COD');
ALTER TABLE "Order" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod_new" USING ("paymentMethod"::text::"PaymentMethod_new");
ALTER TABLE "Payment" ALTER COLUMN "method" TYPE "PaymentMethod_new" USING ("method"::text::"PaymentMethod_new");
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";
DROP TYPE "public"."PaymentMethod_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ProductStatus_new" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
ALTER TABLE "public"."Product" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Product" ALTER COLUMN "status" TYPE "ProductStatus_new" USING ("status"::text::"ProductStatus_new");
ALTER TYPE "ProductStatus" RENAME TO "ProductStatus_old";
ALTER TYPE "ProductStatus_new" RENAME TO "ProductStatus";
DROP TYPE "public"."ProductStatus_old";
ALTER TABLE "Product" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- DropForeignKey
ALTER TABLE "BlogPost" DROP CONSTRAINT "BlogPost_authorId_fkey";

-- DropForeignKey
ALTER TABLE "BlogPost" DROP CONSTRAINT "BlogPost_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "CommissionRule" DROP CONSTRAINT "CommissionRule_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "CommissionRule" DROP CONSTRAINT "CommissionRule_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "Coupon" DROP CONSTRAINT "Coupon_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "Dispute" DROP CONSTRAINT "Dispute_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Dispute" DROP CONSTRAINT "Dispute_orderId_fkey";

-- DropForeignKey
ALTER TABLE "Dispute" DROP CONSTRAINT "Dispute_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "GiftCardTransaction" DROP CONSTRAINT "GiftCardTransaction_giftCardId_fkey";

-- DropForeignKey
ALTER TABLE "GiftCardTransaction" DROP CONSTRAINT "GiftCardTransaction_orderId_fkey";

-- DropForeignKey
ALTER TABLE "LoyaltyAccount" DROP CONSTRAINT "LoyaltyAccount_tierId_fkey";

-- DropForeignKey
ALTER TABLE "LoyaltyAccount" DROP CONSTRAINT "LoyaltyAccount_userId_fkey";

-- DropForeignKey
ALTER TABLE "Payout" DROP CONSTRAINT "Payout_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "PayoutItem" DROP CONSTRAINT "PayoutItem_payoutId_fkey";

-- DropForeignKey
ALTER TABLE "PayoutItem" DROP CONSTRAINT "PayoutItem_vendorOrderId_fkey";

-- DropForeignKey
ALTER TABLE "PointsTransaction" DROP CONSTRAINT "PointsTransaction_accountId_fkey";

-- DropForeignKey
ALTER TABLE "PointsTransaction" DROP CONSTRAINT "PointsTransaction_orderId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_brandId_fkey";

-- DropForeignKey
ALTER TABLE "ProductTranslation" DROP CONSTRAINT "ProductTranslation_productId_fkey";

-- DropForeignKey
ALTER TABLE "Referral" DROP CONSTRAINT "Referral_refereeId_fkey";

-- DropForeignKey
ALTER TABLE "Referral" DROP CONSTRAINT "Referral_referrerId_fkey";

-- DropForeignKey
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_permissionId_fkey";

-- DropForeignKey
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_roleId_fkey";

-- DropForeignKey
ALTER TABLE "VendorDocument" DROP CONSTRAINT "VendorDocument_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "VendorStaff" DROP CONSTRAINT "VendorStaff_userId_fkey";

-- DropForeignKey
ALTER TABLE "VendorStaff" DROP CONSTRAINT "VendorStaff_vendorId_fkey";

-- DropIndex
DROP INDEX "Product_brandId_idx";

-- AlterTable
ALTER TABLE "Answer" DROP COLUMN "isVendor";

-- AlterTable
ALTER TABLE "Coupon" DROP COLUMN "stackable",
DROP COLUMN "vendorId";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "giftCardTotal",
DROP COLUMN "loyaltyDiscount",
DROP COLUMN "taxAdded",
DROP COLUMN "taxTotal";

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "tax",
DROP COLUMN "taxInclusive",
DROP COLUMN "taxName",
DROP COLUMN "taxRate";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "brandId",
DROP COLUMN "rejectionReason",
DROP COLUMN "taxClass";

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "vendorReply";

-- AlterTable
ALTER TABLE "Vendor" DROP COLUMN "bankAccountName",
DROP COLUMN "bankAccountNumber",
DROP COLUMN "bankName",
DROP COLUMN "bannerUrl",
DROP COLUMN "description",
DROP COLUMN "iban",
DROP COLUMN "logoUrl",
DROP COLUMN "phone",
DROP COLUMN "policies",
DROP COLUMN "ratingAverage",
DROP COLUMN "statusReason";

-- AlterTable
ALTER TABLE "VendorOrder" DROP COLUMN "commissionAmount",
DROP COLUMN "netAmount",
DROP COLUMN "taxAdded",
DROP COLUMN "taxTotal";

-- DropTable
DROP TABLE "BlogCategory";

-- DropTable
DROP TABLE "BlogPost";

-- DropTable
DROP TABLE "Brand";

-- DropTable
DROP TABLE "Campaign";

-- DropTable
DROP TABLE "CartRecovery";

-- DropTable
DROP TABLE "CommissionRule";

-- DropTable
DROP TABLE "Dispute";

-- DropTable
DROP TABLE "EmailTemplate";

-- DropTable
DROP TABLE "GiftCard";

-- DropTable
DROP TABLE "GiftCardTransaction";

-- DropTable
DROP TABLE "Language";

-- DropTable
DROP TABLE "LoyaltyAccount";

-- DropTable
DROP TABLE "Payout";

-- DropTable
DROP TABLE "PayoutItem";

-- DropTable
DROP TABLE "Permission";

-- DropTable
DROP TABLE "PointsTransaction";

-- DropTable
DROP TABLE "ProductTranslation";

-- DropTable
DROP TABLE "Promotion";

-- DropTable
DROP TABLE "Redirect";

-- DropTable
DROP TABLE "Referral";

-- DropTable
DROP TABLE "RolePermission";

-- DropTable
DROP TABLE "Subscriber";

-- DropTable
DROP TABLE "TaxRate";

-- DropTable
DROP TABLE "Tier";

-- DropTable
DROP TABLE "VendorDocument";

-- DropTable
DROP TABLE "VendorStaff";

-- DropEnum
DROP TYPE "CampaignStatus";

-- DropEnum
DROP TYPE "CommissionScope";

-- DropEnum
DROP TYPE "DisputeStatus";

-- DropEnum
DROP TYPE "PayoutStatus";

-- DropEnum
DROP TYPE "PointsTransactionType";

-- DropEnum
DROP TYPE "PromotionType";

