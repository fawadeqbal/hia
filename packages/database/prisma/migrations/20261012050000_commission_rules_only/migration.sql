-- Seller commission now lives only in CommissionRule (scope VENDOR, no category).
-- Copy existing per-seller rates into rules, then drop the old column.
INSERT INTO "CommissionRule" ("id", "scope", "vendorId", "categoryId", "rate", "isActive", "createdAt", "updatedAt")
SELECT 'cr' || md5(random()::text || v."id"), 'VENDOR', v."id", NULL, v."commissionRate", true, NOW(), NOW()
FROM "Vendor" v
WHERE v."commissionRate" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "CommissionRule" r
    WHERE r."vendorId" = v."id" AND r."scope" = 'VENDOR' AND r."categoryId" IS NULL AND r."isActive"
  );

ALTER TABLE "Vendor" DROP COLUMN "commissionRate";
