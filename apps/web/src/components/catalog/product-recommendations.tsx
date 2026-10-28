import type { StorefrontProductCard } from '@ecommerce/types';
import { storefrontApi } from '@/lib/api-client';
import { productGrid } from '@/components/home/section-head';
import { ProductCard } from './product-card';

function Row({ title, products }: { title: string; products: StorefrontProductCard[] }) {
  if (products.length === 0) return null;
  return (
    <section className="flex flex-col gap-7">
      <h2 className="type-display text-[clamp(36px,4.4vw,60px)]">{title}</h2>
      <div className={productGrid}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} quickAdd />
        ))}
      </div>
    </section>
  );
}

/** Server component: "frequently bought together" and "related products". Silent if the API fails. */
export async function ProductRecommendations({ slug }: { slug: string }) {
  const recs = await storefrontApi
    .recommendations(slug, { next: { revalidate: 300 } })
    .catch(() => null);
  if (!recs) return null;
  return (
    <>
      <Row title="Frequently bought together" products={recs.boughtTogether} />
      <Row title="You may also like" products={recs.related.slice(0, 6)} />
    </>
  );
}
