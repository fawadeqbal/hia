# HIA Furniture Solutions — online shop

Website + admin panel for **HIA Furniture Solutions**: office chair spare parts (gas lifts, wheels, bases,
armrests, tilt mechanisms, accessories), office chairs, furniture, general order supplies, and chair repair &
maintenance.

> **Quality Products | Competitive Prices | Reliable Service**

This is a **single-shop** copy of [`ecommerce-platform`](https://github.com/fawadeqbal/ecommerce-platform)
(that repository is unchanged). The multi-vendor marketplace parts are switched off: there are no sellers,
no seller sign-up, no commissions or payouts. One **super admin** (the shop owner) manages everything from
the admin panel.

| App      | What it is                        | Local URL                                        |
| -------- | --------------------------------- | ------------------------------------------------ |
| `web`    | The shop website for customers    | http://localhost:3000                            |
| `admin`  | Admin panel for the shop owner    | http://localhost:3001                            |
| `api`    | Backend (NestJS REST API)         | http://localhost:4000/api/v1 (docs: `/api/docs`) |
| `worker` | Sends emails, runs scheduled jobs | —                                                |

## What the shop owner can do (admin panel)

| Menu                   | Use it to…                                                                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard / Reports    | See new orders to confirm, new inquiries, low stock, sales                                                                                                 |
| **Orders**             | Open an order → **Confirm → Packed → Shipped → Delivered** (tracking number optional), invoice PDF, packing slip, cancel                                   |
| **Inquiries**          | Repair requests, wholesale / institutional quotes and questions from the website Contact page. Call / WhatsApp / email the customer, keep notes, mark done |
| Customers / Returns    | Customer list and history; approve and refund returns                                                                                                      |
| **Products**           | Add / edit products: photos, price, options (size, colour), specifications, publish, show on home page                                                     |
| Categories             | Product groups shown in the website menu                                                                                                                   |
| **Stock**              | Add or remove stock quantities, see the history                                                                                                            |
| Options (size, colour) | The option values products can use (e.g. 50 mm / 60 mm, Black / Grey)                                                                                      |
| Coupons                | Discount codes                                                                                                                                             |
| Website                | Home page banners, pages (About, Services, policies), menus, FAQs, reviews & questions                                                                     |
| **Shop settings**      | Shop name, motto, logo, **phone, WhatsApp number**, email, address, COD fee/limit, delivery charge, return window                                          |
| Delivery zones         | Delivery prices and the "pick up from shop" option                                                                                                         |
| Payments               | **Cash on delivery** is on. Online card payments can be switched on later here                                                                             |

New inquiries and new orders are also emailed to the admin.

## Website

Same design as `ecommerce-platform`, rebranded for HIA: home page (chair parts / repair / wholesale slides,
categories, new & featured products, offers, motto), category and product pages, cart, checkout
(**Cash on delivery**, prices in **PKR**), order tracking, customer accounts, About / Services / policy pages,
FAQ, and a **Contact page** whose form sends repair and quote requests into Admin → Inquiries.
When a WhatsApp number is set in Shop settings, a "Chat on WhatsApp" button appears on every page.

The 15 sample products use simple placeholder drawings (`apps/web/public/demo`). Replace them with real
photos in Admin → Products.

## Run it on your computer

Needs **Node.js 22+**, **pnpm 9+** and **Docker Desktop** (for Postgres, Redis, Mailpit and MinIO).

```bash
pnpm install
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
pnpm infra:up                 # Postgres, Redis, Mailpit (emails), MinIO (images)
pnpm db:migrate               # create the database tables
pnpm db:seed                  # HIA shop, super admin, categories, sample products
pnpm dev                      # website :3000, admin :3001, API :4000, worker
```

**Admin login:** http://localhost:3001 — `admin@example.com` / `Admin@12345`
(set your own `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env` **before** the first `pnpm db:seed`).
Emails sent locally appear in Mailpit: http://localhost:8025.

More: [`CREDENTIALS.md`](CREDENTIALS.md) (logins, first steps for the shop owner, test walkthrough).

## First things to do as the shop owner

1. Admin → **Shop settings**: phone, WhatsApp number (e.g. `923001234567`), email, address, logo.
2. Admin → **Delivery zones**: set your delivery price and free-delivery amount (seeded: Rs 500, free above Rs 25,000, plus "Pick up from shop").
3. Admin → **Products**: replace the sample photos and prices with your own, add your real products and stock.
4. Admin → **Pages**: check About, Products & services, delivery and return policies, terms and privacy.

## Put it online

One Docker image runs the website, admin, API and worker (`docker/Dockerfile`); Postgres, Redis, an
S3-compatible bucket (for product photos) and an SMTP service (for emails) are separate.
See [`deploy/deploy.sh`](deploy/deploy.sh) and [`deploy/nginx.conf`](deploy/nginx.conf)
(domains: shop, `admin.` and `api.`). Build-time settings: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`,
`NEXT_PUBLIC_ADMIN_URL`.

## For developers

Same stack and conventions as the original: Turborepo + pnpm, Next.js 15 (web, admin), NestJS 11 (api, worker),
PostgreSQL + Prisma 6, Redis + BullMQ. Read [`AGENTS.md`](AGENTS.md) first.

How the single shop works (short version):

- The seed creates **one store** (`Vendor` row, slug `hia-furniture`) **owned by the super admin**.
  `SUPER_ADMIN` passes every role check, so the admin panel uses the store endpoints
  (`/vendor/products`, `/vendor/inventory`, `/vendor/orders/:id/status`) directly. Every product and order
  belongs to that one store; checkout and stock logic are unchanged.
- Removed: the seller app (`apps/vendor`), the public seller sign-up route, the AI support service
  (`services/support-ai`) and the original server's deploy scripts.
- Switched off by settings (code kept): product review before publishing, commission (0 %), reward points (0),
  tax, abandoned-cart / win-back emails, online card payments.
- Added: **Inquiries** (`Ticket` + migration `ticket_inquiry_fields`; `POST /inquiries`, `/admin/inquiries`),
  WhatsApp / motto settings, optional tracking number, delivery chosen before pickup by default.

```bash
pnpm typecheck && pnpm test && pnpm lint
```
