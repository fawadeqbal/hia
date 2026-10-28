# E-Commerce Platform (Monorepo)

Multi-vendor e-commerce platform built with **Next.js**, **NestJS**, **PostgreSQL** and **Prisma**.
Email is the only notification channel.

| Doc                                            | What it is for                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| [`docs/roadmap.md`](docs/roadmap.md)           | What is built, what is next (progress table)                           |
| [`AGENTS.md`](AGENTS.md)                       | How to write code here: recipe, conventions, gotchas (read first)      |
| [`docs/architecture.md`](docs/architecture.md) | Request flow, packages, business flows (vendor, product, stock, order) |
| [`CREDENTIALS.md`](CREDENTIALS.md)             | Local URLs, logins, seeded demo data, test walkthroughs                |
| [`docs/scope.md`](docs/scope.md)               | Full product scope (all phases)                                        |

## Stack

| Layer          | Tech                                                                                   |
| -------------- | -------------------------------------------------------------------------------------- |
| Monorepo       | Turborepo + pnpm workspaces                                                            |
| Frontends      | Next.js 15 (App Router), React 19, Tailwind CSS, TanStack Query, React Hook Form + Zod |
| API            | NestJS 11 (modular), REST + Swagger, class-validator, JWT in HttpOnly cookies          |
| Database       | PostgreSQL 16 + Prisma 6 (`pg_trgm` for fuzzy search)                                  |
| Queues / cache | Redis + BullMQ (separate worker process)                                               |
| Email          | React Email templates, provider-agnostic sender (SMTP → Mailpit locally)               |
| Storage        | S3-compatible (MinIO locally)                                                          |
| Testing        | Jest (API unit tests), Playwright (planned)                                            |
| DevOps         | Docker, GitHub Actions                                                                 |

## Structure

```
apps/
  web/              Next.js storefront (customers)               → http://localhost:3000
  admin/            Next.js admin panel                          → http://localhost:3001
  vendor/           Next.js seller center                        → http://localhost:3002
  api/              NestJS REST API                              → http://localhost:4000/api/v1  (docs: /api/docs)
  worker/           NestJS BullMQ worker (emails, cron jobs)
packages/
  config/           shared tsconfig, ESLint, Tailwind preset
  types/            shared DTO interfaces, enums, zod form schemas, helpers (compiled, CJS)
  api-client/       typed fetch functions + TanStack Query keys used by all three Next apps
  ui/               shared React components (DataTable, Modal, Tabs, Timeline, AppShell, …)
  database/         Prisma schema, migrations, seed, Prisma client
  email-templates/  React Email templates + renderEmail()             → preview http://localhost:3003
docker/             Dockerfiles + Postgres init
docs/               scope, roadmap, architecture
```

## Prerequisites

- Node.js 22+
- pnpm 9+ (`corepack enable` then `corepack prepare pnpm@9.15.4 --activate`)
- Docker Desktop (for Postgres, Redis, Mailpit, MinIO)

## Getting started (fresh machine)

```bash
# 1. Install dependencies
pnpm install

# 2. Environment
cp .env.example .env          # Git Bash / macOS / Linux
# PowerShell: Copy-Item .env.example .env   |   CMD: copy .env.example .env

# 3. Start infrastructure (Postgres, Redis, Mailpit, MinIO)
pnpm infra:up

# 4. Database: apply all migrations, then seed demo data
pnpm db:migrate
pnpm db:seed

# 5. Run everything (web, admin, vendor, api, worker)
pnpm dev
```

### Updating an existing checkout

After pulling new steps:

```bash
pnpm install          # only if a package.json changed
pnpm db:migrate       # applies new migrations (the step notes say when one is needed)
pnpm db:seed          # idempotent: adds new demo data and new settings, never overwrites existing rows
pnpm dev
```

If you changed `schema.prisma` yourself: `pnpm db:migrate --name <what_changed>` and commit the new folder in
`packages/database/prisma/migrations/`.

Logins and demo data: see [`CREDENTIALS.md`](CREDENTIALS.md). Super admin: `admin@example.com` / `Admin@12345`.

| Service               | URL                                          |
| --------------------- | -------------------------------------------- |
| Storefront            | http://localhost:3000                        |
| Admin                 | http://localhost:3001                        |
| Seller center         | http://localhost:3002                        |
| API + Swagger         | http://localhost:4000/api/docs               |
| Mailpit (email inbox) | http://localhost:8025                        |
| MinIO console         | http://localhost:9001                        |
| Prisma Studio         | `pnpm db:studio` → http://localhost:5555     |
| Email preview         | `pnpm email:preview` → http://localhost:3003 |

## Scripts

| Command                                                 | What it does                                                   |
| ------------------------------------------------------- | -------------------------------------------------------------- |
| `pnpm dev`                                              | Run every app in watch mode                                    |
| `pnpm dev:web` / `dev:admin` / `dev:vendor` / `dev:api` | Run one app (plus its dependencies)                            |
| `pnpm build`                                            | Build everything                                               |
| `pnpm lint` / `pnpm typecheck` / `pnpm test`            | Quality checks                                                 |
| `pnpm --filter @ecommerce/api test`                     | API unit tests only                                            |
| `pnpm db:migrate`                                       | Apply migrations / create one from `schema.prisma` changes     |
| `pnpm db:seed`                                          | Seed roles, admin, settings, catalog, vendors, products, stock |
| `pnpm db:studio`                                        | Open Prisma Studio                                             |
| `pnpm infra:up` / `infra:down`                          | Start / stop local Docker services                             |
| `pnpm format`                                           | Prettier across the repo                                       |

## What works today

Built entity by entity through every layer (types → API → api-client → ui → screens → seed).
Status per entity: [`docs/roadmap.md`](docs/roadmap.md).

**Phase 1: Catalog foundation (done)**

- Admin sign-in (HttpOnly cookies), categories (tree), brands, attributes & values, media upload to MinIO.
- Vendor onboarding: apply → admin approves / rejects / suspends (emails), store profile, payout details, commission.
- Products: seller CRUD with gallery, specs and variants (option combinations); submit for review →
  admin approve / reject / feature (emails); suspended vendors' products are hidden.
- Inventory: warehouses, stock adjustments with a movement log, low-stock and back-in-stock emails, admin low-stock report.

**Phase 2: Buying flow (done)**

- Storefront: home, product listing with filters, category pages, product page with variant picker, sign in / register.
- Cart: guest cart (cookie) merged into the account at sign-in, stock & price checks, save for later.
- Checkout & orders (cash on delivery): quote with per-seller shipping, idempotent order placement, stock reservation,
  one sub-order per seller, confirmation emails; customer order history, detail, cancel, guest order tracking, address book;
  seller order screens with status actions (shipping deducts stock, tracking number); admin order list / detail / cancel.
- Online payments (card / wallet / bank) through a pluggable gateway; a mock gateway is used until a real one
  (Safepay, PayFast, …) is plugged in. Unpaid orders expire, cancellations of paid orders are refunded.
- Shipping zones (country / province / city) with flat, weight and order-value rates, delivery choice per seller,
  couriers with tracking links.

**Phase 3: After-sale & growth (in progress)**

- Returns (RMA): request from a delivered order, seller / admin approve, receive + restock, refund (gateway or
  recorded manual refund for COD).
- Reviews (verified buyers, seller replies, moderation) and product Q&A.
- Wishlist with price-drop emails, back-in-stock alerts.
- Coupons (store and seller) and automatic discounts (sales, buy X get Y, spend tiers) at checkout.
- Loyalty points (tiers, referrals, expiry) and gift cards, usable at checkout.
- **Next:** vendor payouts. See the roadmap.

**Not built yet:** every module that has not reached its roadmap step still exposes `GET /<module>/status`, and
every screen not yet built shows a scaffold card listing the features it needs.

## Backend modules

One NestJS module per domain under `apps/api/src/modules/`:

`auth` · `users` · `rbac` · `vendors` · `catalog` · `inventory` · `search` · `cart` · `checkout` · `pricing` ·
`promotions` · `orders` · `payments` · `shipping` · `returns` · `reviews` · `wishlist` · `loyalty` ·
`recommendations` · `cms` · `media` · `notifications` · `marketing` · `support` · `payouts` · `analytics` · `seo` ·
`settings` · `audit` · `jobs`

Implemented: `auth`, `users` (profile, addresses), `vendors`, `catalog` (categories, brands, attributes, products,
storefront), `media`, `inventory`, `cart`, `checkout`, `orders`, `payments`, `shipping`, `returns`, `reviews`, `wishlist`, `promotions`, `loyalty`, `payouts`, `notifications`, `audit`.

## Deployment

One-container production image, generic server deploy script and CI/CD pipeline: [`docs/deployment.md`](docs/deployment.md).

## Docker (one image per app, optional)

```bash
docker build -f docker/Dockerfile.node --build-arg APP=api    -t ecommerce-api .
docker build -f docker/Dockerfile.node --build-arg APP=worker -t ecommerce-worker .
docker build -f docker/Dockerfile.next --build-arg APP=web    -t ecommerce-web .
```
