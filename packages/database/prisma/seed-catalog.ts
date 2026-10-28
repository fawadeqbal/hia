/**
 * Demo catalogue for testing the storefront (filters, variants, search, deals) on a real server.
 *
 *   docker exec ecommerce-app sh -c "cd /app/packages/database && ./node_modules/.bin/tsx prisma/seed-catalog.ts"
 *
 * Pulls ~190 real products with public images from dummyjson.com and adds them to the
* two approved stores (Demo Electronics + Style Street): categories + sub-categories, brands, prices with discounts,
 * ratings, stock (some sold out), and Color / Size / Storage / RAM variants.
 * Safe to run again: products that already exist (same slug) are skipped.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

type DJ = {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  discountPercentage: number;
  rating: number;
  stock: number;
  brand?: string;
  images: string[];
  thumbnail: string;
  tags?: string[];
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** dummyjson category → [root category, sub-category] in our tree. */
const MAP: Record<string, [string, string]> = {
  smartphones: ['Electronics', 'Smartphones'],
  laptops: ['Electronics', 'Laptops'],
  tablets: ['Electronics', 'Tablets'],
  'mobile-accessories': ['Electronics', 'Mobile Accessories'],
  'mens-watches': ['Fashion', 'Watches'],
  'womens-watches': ['Fashion', 'Watches'],
  'mens-shirts': ['Fashion', 'Men'],
  tops: ['Fashion', 'Women'],
  'womens-dresses': ['Fashion', 'Women'],
  'mens-shoes': ['Fashion', 'Shoes'],
  'womens-shoes': ['Fashion', 'Shoes'],
  'womens-bags': ['Fashion', 'Bags'],
  'womens-jewellery': ['Fashion', 'Jewellery'],
  sunglasses: ['Fashion', 'Sunglasses'],
  furniture: ['Home & Kitchen', 'Furniture'],
  'home-decoration': ['Home & Kitchen', 'Decor'],
  'kitchen-accessories': ['Home & Kitchen', 'Kitchen Appliances'],
  beauty: ['Health & Beauty', 'Makeup'],
  'skin-care': ['Health & Beauty', 'Skincare'],
  fragrances: ['Health & Beauty', 'Fragrances'],
  'sports-accessories': ['Sports', 'Fitness Equipment'],
  groceries: ['Groceries', 'Pantry'],
  motorcycle: ['Automotive', 'Motorcycles'],
  vehicle: ['Automotive', 'Cars'],
};

/** Which store sells which root category (everything else goes to the electronics store). */
const STYLE_ROOTS = new Set(['Fashion', 'Health & Beauty']);

/** Which options a category's products come in. */
const OPTIONS: Record<string, { code: string; values: string[]; extra?: number[] }[]> = {
  Smartphones: [
    { code: 'storage', values: ['128GB', '256GB'], extra: [0, 100] },
    { code: 'color', values: ['Black', 'Blue'] },
  ],
  Tablets: [{ code: 'storage', values: ['64GB', '256GB'], extra: [0, 120] }],
  Laptops: [{ code: 'ram', values: ['8GB', '16GB'], extra: [0, 150] }],
  Men: [{ code: 'size', values: ['S', 'M', 'L', 'XL'] }],
  Women: [
    { code: 'size', values: ['S', 'M', 'L'] },
    { code: 'color', values: ['Black', 'Red'] },
  ],
  Shoes: [{ code: 'size', values: ['M', 'L', 'XL'] }],
  Watches: [{ code: 'color', values: ['Black', 'Gray'] }],
  Bags: [{ code: 'color', values: ['Black', 'White'] }],
};

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const money = (n: number) => Math.round(n * 100) / 100;

async function category(root: string, child: string): Promise<string> {
  const rootRow =
    (await prisma.category.findFirst({ where: { parentId: null, name: { equals: root, mode: 'insensitive' } } })) ??
    (await prisma.category.upsert({
      where: { slug: slugify(root) },
      update: {},
      create: { name: root, slug: slugify(root), position: 50 },
    }));
  const existing = await prisma.category.findFirst({
    where: { parentId: rootRow.id, name: { equals: child, mode: 'insensitive' } },
  });
  if (existing) return existing.id;
  const slug = (await prisma.category.findUnique({ where: { slug: slugify(child) } }))
    ? `${slugify(root)}-${slugify(child)}`
    : slugify(child);
  return (await prisma.category.create({ data: { name: child, slug, parentId: rootRow.id } })).id;
}

/** An approved store with its owner (password Vendor@12345), a warehouse and a 10% commission. */
async function store(v: { email: string; first: string; last: string; name: string; slug: string; about: string }) {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'VENDOR' } });
  const user = await prisma.user.upsert({
    where: { email: v.email },
    update: {},
    create: {
      email: v.email,
      firstName: v.first,
      lastName: v.last,
      passwordHash: await argon2.hash('Vendor@12345'),
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: { roleId: role.id } },
      emailPreference: { create: {} },
    },
  });
  const vendor = await prisma.vendor.upsert({
    where: { slug: v.slug },
    update: { status: 'APPROVED', approvedAt: new Date() },
    create: {
      ownerId: user.id,
      name: v.name,
      slug: v.slug,
      email: v.email,
      description: v.about,
      status: 'APPROVED',
      approvedAt: new Date(),
      policies: { shipping: 'Ships in 1–2 business days nationwide.', returns: '7-day returns on unused items.' },
    },
  });
  if (!(await prisma.commissionRule.findFirst({ where: { vendorId: vendor.id, scope: 'VENDOR', categoryId: null } })))
    await prisma.commissionRule.create({ data: { scope: 'VENDOR', vendorId: vendor.id, rate: 10 } });
  const code = `${v.slug.toUpperCase()}-MAIN`;
  const warehouse =
    (await prisma.warehouse.findFirst({ where: { vendorId: vendor.id } })) ??
    (await prisma.warehouse.create({
      data: { vendorId: vendor.id, name: 'Main warehouse', code, address: { city: 'Lahore', country: 'Pakistan' } },
    }));
  return { vendor, warehouse };
}

async function main() {
  console.log('Fetching demo products from dummyjson.com…');
  const res = await fetch('https://dummyjson.com/products?limit=0');
  if (!res.ok) throw new Error(`dummyjson.com answered ${res.status}`);
  const { products } = (await res.json()) as { products: DJ[] };

  const currency = (await prisma.currency.findFirst({ where: { isDefault: true } }))?.code ?? 'USD';
  const electronics = await store({
    email: 'vendor@example.com',
    first: 'Demo',
    last: 'Seller',
    name: 'Demo Electronics',
    slug: 'demo-electronics',
    about: 'Phones, laptops, home and sports gear from trusted brands.',
  });
  const style = await store({
    email: 'style@example.com',
    first: 'Sara',
    last: 'Khan',
    name: 'Style Street',
    slug: 'style-street',
    about: 'Fashion, shoes, bags, beauty and fragrances.',
  });

  const valueId = new Map<string, string>();
  for (const v of await prisma.attributeValue.findMany({ include: { attribute: true } }))
    valueId.set(`${v.attribute.code}:${v.value}`, v.id);

  let created = 0;
  let skipped = 0;
  for (const p of products) {
    const place = MAP[p.category];
    if (!place) continue;
    const slug = `${slugify(p.title)}-${p.id}`;
    const owner = STYLE_ROOTS.has(place[0]) ? style : electronics;
    const vendor = owner.vendor;
    const warehouse = owner.warehouse;
    const existing = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (existing) {
      // Re-run: make sure it belongs to the right store and is live.
      await prisma.product.update({
        where: { id: existing.id },
        data: { vendorId: vendor.id, status: 'PUBLISHED', deletedAt: null },
      });
      skipped++;
      continue;
    }
    const categoryId = await category(place[0], place[1]);
    const brandId = p.brand
      ? (
          await prisma.brand.upsert({
            where: { slug: slugify(p.brand) },
            update: {},
            create: { name: p.brand, slug: slugify(p.brand) },
          })
        ).id
      : null;

    const price = money(p.price);
    const onSale = p.discountPercentage >= 8;
    const compareAt = onSale ? money(price / (1 - p.discountPercentage / 100)) : null;

    // Variant combinations (cartesian product of the category's options).
    const opts = (OPTIONS[place[1]] ?? []).filter((o) => o.values.every((v) => valueId.has(`${o.code}:${v}`)));
    let combos: { values: string[]; extra: number; label: string[] }[] = [{ values: [], extra: 0, label: [] }];
    for (const o of opts) {
      combos = combos.flatMap((c) =>
        o.values.map((v, i) => ({
          values: [...c.values, valueId.get(`${o.code}:${v}`)!],
          extra: c.extra + (o.extra?.[i] ?? 0),
          label: [...c.label, v],
        })),
      );
    }

    const product = await prisma.product.create({
      data: {
        vendorId: vendor.id,
        categoryId,
        brandId,
        name: p.title,
        slug,
        shortDescription: p.description.slice(0, 180),
        description: p.description,
        specifications: [
          ...(p.brand ? [{ label: 'Brand', value: p.brand }] : []),
          { label: 'Category', value: place[1] },
          ...(p.tags?.length ? [{ label: 'Tags', value: p.tags.join(', ') }] : []),
        ],
        basePrice: price,
        compareAtPrice: compareAt,
        currency,
        status: 'PUBLISHED',
        publishedAt: new Date(Date.now() - rand(0, 60) * 86_400_000),
        isFeatured: p.rating >= 4.7,
        ratingAverage: Math.min(5, Math.round(p.rating * 100) / 100),
        ratingCount: rand(3, 320),
        soldCount: rand(0, 900),
        images: { create: p.images.slice(0, 6).map((url, i) => ({ url, altText: p.title, position: i })) },
      },
    });

    for (const [i, c] of combos.entries()) {
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: `DJ-${p.id}${c.label.length ? `-${c.label.join('-')}` : ''}`.toUpperCase().replace(/[^A-Z0-9-]/g, ''),
          name: c.label.length ? c.label.join(' / ') : null,
          price: money(price + c.extra),
          compareAtPrice: compareAt ? money(compareAt + c.extra) : null,
          isDefault: i === 0,
          position: i,
          attributes: c.values.length
            ? { create: c.values.map((attributeValueId) => ({ attributeValueId })) }
            : undefined,
        },
      });
      if (warehouse) {
        // About 1 in 8 products sold out, so the "In stock" filter has something to hide.
        const qty = p.id % 8 === 0 ? 0 : rand(3, 40);
        await prisma.stockLevel.create({
          data: { variantId: variant.id, warehouseId: warehouse.id, quantity: qty },
        });
      }
    }
    created++;
  }
  console.log(`Done: ${created} products added, ${skipped} already there (updated).`);
  console.log('Stores: Demo Electronics (vendor@example.com) and Style Street (style@example.com), password Vendor@12345');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
