import { Prisma } from '@ecommerce/database';
import type { PrismaService } from '../../prisma/prisma.service';
import { likePattern } from './search-rules';

/** word_similarity above this counts as a (typo-tolerant) match. */
const MATCH = 0.3;
const MAX_MATCHES = 1000;

/**
 * Products matching `q` with a relevance score (0–1+). Matches the product name, brand, category,
 * short description and variant SKUs; trigram similarity makes it tolerant to typos ("samsng").
 */
export async function searchScores(prisma: PrismaService, q: string): Promise<Map<string, number>> {
  const like = likePattern(q);
  const rows = await prisma.$queryRaw<{ id: string; score: number }[]>(Prisma.sql`
    SELECT p."id",
           GREATEST(
             CASE WHEN p."name" ILIKE ${like} THEN 1 ELSE 0 END,
             word_similarity(${q}, p."name"),
             COALESCE(word_similarity(${q}, b."name"), 0) * 0.9,
             COALESCE(word_similarity(${q}, c."name"), 0) * 0.7,
             CASE WHEN p."shortDescription" ILIKE ${like} THEN 0.5 ELSE 0 END,
             CASE WHEN EXISTS (SELECT 1 FROM "ProductVariant" sv WHERE sv."productId" = p."id" AND sv."sku" ILIKE ${like}) THEN 0.95 ELSE 0 END
           )::float AS "score"
    FROM "Product" p
    JOIN "Vendor" v ON v."id" = p."vendorId"
    LEFT JOIN "Brand" b ON b."id" = p."brandId"
    LEFT JOIN "Category" c ON c."id" = p."categoryId"
    WHERE p."status" = 'PUBLISHED' AND p."deletedAt" IS NULL AND v."status" = 'APPROVED'
      AND (
        p."name" ILIKE ${like}
        OR word_similarity(${q}, p."name") > ${MATCH}
        OR word_similarity(${q}, b."name") > ${MATCH}
        OR word_similarity(${q}, c."name") > ${MATCH}
        OR p."shortDescription" ILIKE ${like}
        OR EXISTS (SELECT 1 FROM "ProductVariant" sv WHERE sv."productId" = p."id" AND sv."sku" ILIKE ${like})
      )
    ORDER BY "score" DESC
    LIMIT ${MAX_MATCHES}`);
  return new Map(rows.map((r) => [r.id, Number(r.score)]));
}

/** Closest known product / brand / category name, for "Did you mean …?" when nothing matched. */
export async function closestTerm(prisma: PrismaService, q: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ term: string }[]>(Prisma.sql`
    SELECT "term" FROM (
      SELECT p."name" AS "term", word_similarity(${q}, p."name") AS "s"
      FROM "Product" p JOIN "Vendor" v ON v."id" = p."vendorId"
      WHERE p."status" = 'PUBLISHED' AND p."deletedAt" IS NULL AND v."status" = 'APPROVED'
      UNION ALL
      SELECT b."name", similarity(b."name", ${q}) FROM "Brand" b WHERE b."isActive" = true
      UNION ALL
      SELECT c."name", similarity(c."name", ${q}) FROM "Category" c WHERE c."isActive" = true
    ) t
    WHERE "s" > 0.2 AND lower("term") <> lower(${q})
    ORDER BY "s" DESC
    LIMIT 1`);
  return rows[0]?.term ?? null;
}

/** Products that have sellable stock in at least one active warehouse. */
export async function inStockProductIds(prisma: PrismaService): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ productId: string }[]>(Prisma.sql`
    SELECT DISTINCT pv."productId"
    FROM "StockLevel" sl
    JOIN "ProductVariant" pv ON pv."id" = sl."variantId"
    JOIN "Warehouse" w ON w."id" = sl."warehouseId"
    WHERE pv."isActive" = true AND w."isActive" = true AND (sl."quantity" - sl."reserved") > 0`);
  return new Set(rows.map((r) => r.productId));
}
