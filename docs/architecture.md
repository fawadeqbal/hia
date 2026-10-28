# Architecture

HIA Furniture Solutions is **one shop**: a customer website (`apps/web`), an admin panel for the shop owner
(`apps/admin`), a NestJS API (`apps/api`) and a worker for emails and scheduled jobs (`apps/worker`).

The data model still has a `Vendor` table (the shop) and a `VendorOrder` row per order, because the stock,
shipping and order-status logic is built around them. There is exactly **one** `Vendor` row (slug
`hia-furniture`), owned by the super admin. `SUPER_ADMIN` passes every `@Roles` check, so the admin panel uses
the shop endpoints (`/vendor/products`, `/vendor/inventory`, `/vendor/orders/:id/status`,
`/vendor/shipping/couriers`, `/vendor/products-csv`) directly.

## Request flow

```
Browser ──► Next.js app (web / admin)
              │  storefront server components fetch with ISR / no-store; client components use TanStack Query
              │  all client calls go through packages/api-client (credentials: 'include')
              ▼
           NestJS API  (/api/v1)
              │  Guards: Throttler → JwtAuth (@Public skips the check but still attaches a valid user) → Roles (@Roles)
              │  ValidationPipe (class-validator) → Controller → Service → PrismaService
              │  Response interceptor wraps everything as { success, data }
              ▼
           PostgreSQL                       Redis
                                              ▲   BullMQ queues (email, maintenance)
                    NotificationsService ─────┘
                                              │
                                              ▼
                                         Worker (apps/worker)
                                           EmailProcessor → renderEmail() → MailProvider (SMTP/SES/…)
                                           MaintenanceProcessor → releases expired stock reservations
           MinIO (S3) ◄── MediaService (uploads, public-read bucket)
```

## Package dependency graph

```
types ◄─────────── database (no dep on types)
  ▲                    ▲
  ├── email-templates  │
  │        ▲           │
  ├── api ─┼───────────┤
  ├── worker ──────────┘ (database, email-templates)
  ├── api-client
  │        ▲
  └── web / admin (types, api-client, ui)
ui (no deps on types: pure React + Tailwind)
config ◄── everything (devDependency)
```

`types`, `database` and `email-templates` compile to `dist/` (CommonJS) so NestJS can consume them.
`ui` and `api-client` are consumed as TypeScript source and transpiled by Next.js (`transpilePackages`).
Turborepo builds packages before apps (`dependsOn: ["^build"]`).

## Auth & roles

- Login sets HttpOnly cookies `access_token` (15 min) and `refresh_token` (30 days). Swagger can use
  `Authorization: Bearer`.
- Roles (`Role` in `packages/types/src/enums.ts`): `SUPER_ADMIN` (the shop owner, passes every check), `ADMIN`
  (staff: everything except shop settings), `VENDOR` (the built-in shop account; nobody signs up as one) and
  `CUSTOMER` (given at registration). `STAFF_ROLES` = super admin + admin; only they can log in to the admin panel.
- The admin panel gates its dashboard client-side (redirect to `/login` on 401/403).
- Storefront account pages (`/account/*`) show a sign-in card to guests (`AccountShell`).
- Guest cart: `cart_session` cookie. At sign-in the guest cart is merged into the user's cart.

## Business flows

### Product

```
DRAFT ──publish──► PUBLISHED ──archive──► ARCHIVED ──restore──► DRAFT
```

Every product has ≥ 1 variant (a default one when it has no options). Variants are the sellable unit: SKU, price,
compare-at price, stock. Only PUBLISHED products of the shop appear on the website; "Show on the home page"
(`isFeatured`) only applies to published products.

### Stock

Per variant per warehouse: `StockLevel { quantity, reserved }`. **Available = Σ(quantity − reserved)** over active
warehouses (`availableByVariant()` in `apps/api/src/common/utils/stock-availability.ts`).

| Event               | quantity | reserved | Records                                                     |
| ------------------- | -------- | -------- | ----------------------------------------------------------- |
| Admin adjusts stock | ±n       | –        | `StockMovement` (ADJUSTMENT / RESTOCK / …)                  |
| Order placed        | –        | +n       | `StockReservation` (re-checked atomically, never oversells) |
| Order shipped       | −n       | −n       | `StockMovement` type `SALE`, reservation committed          |
| Order cancelled     | –        | −n       | reservation released                                        |

Low-stock (to the shop) and back-in-stock (to customers who asked) emails fire from stock changes.

### Order

One `Order` → one `VendorOrder` (the shop's parcel) → `OrderItem`s. `Order.status` is derived from the parcel
(`deriveOrderStatus()` in `orders/order-rules.ts`).

```
place (COD) ──► COD_CONFIRMED ──► PROCESSING ──► PACKED ──► SHIPPED ──► OUT_FOR_DELIVERY ──► DELIVERED
                   └──────────── CANCELLED (customer or admin, only before shipping) ──────────┘
```

- Allowed moves: `VENDOR_ORDER_TRANSITIONS` in `packages/types/src/orders/order.ts` (the API and the UI use the same
  table). Cancellable statuses: `CANCELLABLE_STATUSES`.
- **SHIPPED** creates a `Shipment` (courier; tracking number optional) and commits stock.
  **DELIVERED** increments `soldCount` and marks the COD payment `PAID`.
- Every change appends `OrderStatusHistory` and emails the customer (confirmed / shipped / out for delivery /
  delivered / cancelled). Placing an order emails the customer (`ORDER_CONFIRMATION`) and the shop
  (`VENDOR_NEW_ORDER`).
- Order numbers: `ORD-YYMMDD-XXXXX` (retry on collision).

### Payments

Checkout offers **Cash on delivery** (`payments.codEnabled`). Online payments are prepared but off: a gateway is
one class implementing `PaymentProvider` (`apps/api/src/modules/payments/providers/payment-provider.ts`:
`createSession`, `parseWebhook`, `refund`), picked by `PAYMENT_PROVIDER` (only `mock` exists) and switched on in
Admin → Settings → Payments (`PaymentGateway` rows; credentials encrypted with `PAYMENT_ENCRYPTION_KEY`).

When a gateway is on: the order waits in `PENDING_PAYMENT` with stock reserved for `checkout.reservationMinutes`;
the webhook (`POST /payments/webhooks/<provider>`, made idempotent by `WebhookEvent`) is the source of truth;
`PaymentExpiryService` cancels unpaid orders; cancelling a paid order refunds it through the gateway.
**Adding a real gateway:** `providers/<name>.provider.ts`, a `case` in `createPaymentProvider()`, the env keys, and
the webhook URL `https://api.<domain>/api/v1/payments/webhooks/<name>` in the gateway dashboard.

### Shipping

`ShippingService.quote()` (`apps/api/src/modules/shipping`):

```
destination (saved address / typed country + province + city)
  └─ matchZone(): most specific active zone — country + region (city or province) > country > all countries
       └─ rates of that zone that fit the parcel (weight, subtotal)
            price: FREE → 0 · freeAbove reached → 0 · else rate price      → options, cheapest first
no zone matches → default delivery (settings shipping.flatRatePerVendor / shipping.freeShippingAbove)
```

- The customer picks an option at checkout (paid delivery is pre-selected before "Pick up from shop"); the parcel
  stores a snapshot (`VendorOrder.shippingMethod`, `shippingRateId`).
- COD: unavailable if the chosen option has `codAvailable = false`; COD fee = `checkout.codFee` + the option's fee.
- When shipping, the admin picks the courier; `Courier.trackingUrlTemplate` with `{tracking}` becomes the customer's
  tracking link.

### Returns (RMA)

```
customer (signed in), delivered order, within returns.windowDays of delivery
  REQUESTED ─approve─► APPROVED ─receive─► ITEMS_RECEIVED ─refund─► REFUNDED
      ├─reject (reason)─► REJECTED
      └─customer withdraws─► CLOSED
```

- Units already in an open return cannot be returned twice (`returnableQuantity` on the order item).
- **Receive**: condition per item; restocked items go back (`StockMovement` RETURN) to the warehouse they shipped from.
- **Refund**: default = what was paid for the items (price less their share of the coupon discount), shipping can be
  added. COD → recorded as a manual refund with the transfer reference.
- Emails: customer RETURN_RECEIVED / APPROVED / REJECTED / REFUND_PROCESSED, shop VENDOR_RETURN_REQUEST.

### Reviews & questions

- **Review** = one per customer per product, only with a DELIVERED order item of that product ("Verified
  purchase"). `reviews.requireApproval` → new / edited reviews start PENDING. Changes recalculate
  `Product.ratingAverage / ratingCount` from APPROVED reviews.
- **Questions**: signed-in customers ask; `questions.requireApproval` keeps a question hidden until the admin
  publishes or answers it (answering publishes).
- A delivered order sends the REVIEW_REQUEST email (respects the customer's opt-out).

### Wishlist & alerts

- One wishlist per customer; items keep `priceAtAdd`. `WishlistSweepService` (every 15 min) emails
  WISHLIST_PRICE_DROP when the price drops ≥ 1 %.
- **Notify me** (sold-out option): `StockAlert`; the back-in-stock email fires when stock returns.

### Coupons

`PromotionsService.evaluate()` → pure `discount-engine.ts` (integer cents, unit-tested): one coupon code —
PERCENTAGE (cap `maxDiscount`) / FIXED_AMOUNT / FREE_SHIPPING — scoped by products / categories, with
`minOrderTotal`, dates, `usageLimit`, `usageLimitPerCustomer`. The use is counted inside the order transaction
with a conditional SQL update (`CouponUsage` row per order), so a limit cannot be exceeded.

### Inquiries (contact page)

The website Contact page posts to `POST /inquiries`, stored as `Ticket` (`topic` REPAIR | QUOTE | GENERAL,
`name`, `phone`, `email`, message). The shop gets ADMIN_NEW_TICKET, the customer TICKET_CREATED. Admin →
Inquiries: New (`OPEN`) → In progress (`PENDING`) → Done (`RESOLVED`), internal notes as `TicketMessage`s.

### CMS

Pages are typed blocks (heading, paragraph, image, button) validated by `pageContentSchema` on both the admin form
and the API, so no raw HTML is ever rendered. Banners are live when active and inside `startsAt`/`endsAt`. The
website reads pages, banners, menus and FAQs through public `/cms/*` endpoints and falls back to built-in links when
the CMS is empty.

### Reports

- **Counted order** = not `CANCELLED` and not `PENDING_PAYMENT`. Sales = Σ grand total of counted orders; refunds are
  dated by the refund.
- Days are cut in `store.timezone`; range up to 366 days, default last 30; every KPI is compared with the period
  before. Dashboard "attention": orders to confirm, new inquiries, open returns, low stock.

### Documents & tools

- **Invoice PDF** (pdfkit, `orders/documents/`): numbered `INV-<order>-<n>` and stored in `Invoice` on first issue;
  for customers (own orders) and the admin. **Packing slip**: no prices.
- **Order notes**: written by the admin; internal or visible to the customer ("Messages about your order").
- **Manual orders** (Admin → Orders → Manual order): a temporary cart + the normal checkout, COD.
- **Product CSV**: export / import (check first, then import; new SKUs → draft products).

### Checkout totals

Computed by the API only (`POST /checkout/quote`); the UI never calculates totals:
**subtotal + delivery − coupon (+ COD fee)**. COD is allowed while the total ≤ `checkout.codMaxOrderTotal`
(0 = no limit). Guest checkout: `checkout.guestCheckout`. Prices and orders are in the store currency (PKR,
`Currency.isDefault`). Settings are rows in `Setting`, read with `readSetting(prisma, key, fallback)`; the editable
ones are `SETTING_DEFINITIONS` in `packages/types/src/settings/settings.ts`.

### SEO

`/sitemap.xml`: static routes plus `GET /seo/sitemap` (published products, active categories, published pages).
JSON-LD: Organization + WebSite search on every page, Product + BreadcrumbList on product pages.

## Conventions

- **Email only through `NotificationsService.sendEmail()`.** It checks the suppression list and the customer's
  opt-out for optional emails (`MARKETING_EMAILS`), writes an `EmailLog` and enqueues the job; the worker renders the
  React Email template and updates the log. Email failures never fail the business action.
- **Adding an email:** a key in `EmailTemplateKey` (packages/types) + a registry entry (packages/email-templates).
  TypeScript fails the build if a key has no template.
- **Money:** `Decimal(12,2)` in Postgres; API math uses integer cents (`toCents` / `fromCents`); DTOs carry plain numbers.
- **Idempotency:** `Order.idempotencyKey` and `WebhookEvent (provider, eventId)` are unique.
- **Transactions:** multi-row changes (order placement, status changes with stock, variant sync) run in
  `prisma.$transaction`.
- **Audit:** admin mutations call `AuditService.log()`.
- **Snapshots:** orders store the shipping address and item names, SKUs, prices and images at purchase time.

## Ports

| App           | Port                       |
| ------------- | -------------------------- |
| web           | 3000                       |
| admin         | 3001                       |
| email preview | 3003                       |
| api           | 4000                       |
| postgres      | 5432                       |
| prisma studio | 5555                       |
| redis         | 6379                       |
| mailpit       | 1025 (SMTP) / 8025 (UI)    |
| minio         | 9000 (S3) / 9001 (console) |
