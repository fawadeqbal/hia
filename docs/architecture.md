# Architecture

## Request flow

```
Browser ──► Next.js app (web / admin / vendor)
              │  storefront server components fetch with ISR / no-store; client components use TanStack Query
              │  all client calls go through packages/api-client (credentials: 'include')
              ▼
           NestJS API  (/api/v1)
              │  Guards: Throttler → JwtAuth (@Public skips the check but still attaches a valid user) → Roles (@Roles)
              │  ValidationPipe (class-validator) → Controller → Service → PrismaService
              │  Response interceptor wraps everything as { success, data }
              ▼
           PostgreSQL                       Redis
                                              ▲   BullMQ queues
                    NotificationsService ─────┘   (email, marketing, reports, imports, media, maintenance)
                                              │
                                              ▼
                                         Worker (apps/worker)
                                           EmailProcessor → renderEmail() → MailProvider (SMTP/SES/…)
                                           MaintenanceProcessor → cron jobs
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
  └── web / admin / vendor (types, api-client, ui)
ui (no deps on types: pure React + Tailwind)
config ◄── everything (devDependency)
```

`types`, `database` and `email-templates` compile to `dist/` (CommonJS) so NestJS can consume them.
`ui` and `api-client` are consumed as TypeScript source and transpiled by Next.js (`transpilePackages`).
Turborepo builds packages before apps (`dependsOn: ["^build"]`).

## Auth & sessions

- Login sets HttpOnly cookies `access_token` (15 min) and `refresh_token` (30 days). The api-client sends cookies;
  Swagger can use `Authorization: Bearer`.
- Roles (`Role` in `packages/types/src/enums.ts`): `SUPER_ADMIN` (passes every `@Roles` check), `ADMIN`,
  `CONTENT_MANAGER`, `MARKETING_MANAGER`, `SUPPORT_AGENT`, `WAREHOUSE_STAFF`, `VENDOR`, `VENDOR_STAFF`, `CUSTOMER`
  (given at registration).
- Admin and seller apps gate their dashboards client-side (redirect to `/login` on 401/403). A seller whose store
  is not `APPROVED` can only open onboarding, store profile and payout settings.
- Storefront account pages (`/account/*`) show a sign-in card to guests (`AccountShell`).
- Guest cart: `cart_session` cookie. At sign-in the guest cart is merged into the user's cart.

## Business flows

### Vendor

```
apply (register) ──► PENDING ──approve──► APPROVED ──suspend──► SUSPENDED ──approve──► APPROVED
                        └──reject──► REJECTED (reason)
```

Each decision writes `statusReason`, an audit log and an email. Products of non-approved vendors are hidden
from the storefront.

### Product

```
DRAFT ──submit──► PENDING_REVIEW ──approve──► PUBLISHED ──reject (unpublish)──► REJECTED
  ▲                    └──reject──► REJECTED (rejectionReason) ──edit + submit──┘
  └── archive / restore ── ARCHIVED
```

Every product has ≥ 1 variant (a default one when it has no options). Variants are the sellable unit: SKU, price,
compare-at price, stock. `marketplace.productApprovalRequired` controls whether submit goes to review.

### Stock

Per variant per warehouse: `StockLevel { quantity, reserved }`. **Available = Σ(quantity − reserved)** over active
warehouses (`availableByVariant()` in `apps/api/src/common/utils/stock-availability.ts`).

| Event                       | quantity | reserved | Records                                                     |
| --------------------------- | -------- | -------- | ----------------------------------------------------------- |
| Seller adjusts stock        | ±n       | –        | `StockMovement` (ADJUSTMENT / RESTOCK / …)                  |
| Order placed                | –        | +n       | `StockReservation` (re-checked atomically, never oversells) |
| Sub-order shipped           | −n       | −n       | `StockMovement` type `SALE`, reservation committed          |
| Sub-order / order cancelled | –        | −n       | reservation released                                        |

Low-stock and back-in-stock emails fire from stock changes. Unpaid online orders hold their stock for
`checkout.reservationMinutes`; after that the order is cancelled and the reservation released (see Payments).

### Order (multi-vendor)

One `Order` → one `VendorOrder` per seller → `OrderItem`s. Each vendor order has its own status, shipment and
(later) payout item. The parent `Order.status` is **derived** from its vendor orders (`deriveOrderStatus()` in
`orders/order-rules.ts`).

```
place (COD) ──► COD_CONFIRMED ──► PROCESSING ──► PACKED ──► SHIPPED ──► OUT_FOR_DELIVERY ──► DELIVERED
 (online: PENDING_PAYMENT ──webhook──► PAID ──► PROCESSING …; not paid in time ──► CANCELLED)
                   └──────────── CANCELLED (customer, seller or admin, only before shipping) ─────┘
```

- Allowed seller moves: `VENDOR_ORDER_TRANSITIONS` in `packages/types/src/orders/order.ts` (the API and the UI use
  the same table). Cancellable statuses: `CANCELLABLE_STATUSES`.
- **SHIPPED** requires a tracking number, creates a `Shipment`, commits stock.
  **DELIVERED** increments `soldCount`; when every sub-order is delivered, a COD payment is marked `PAID`.
- Every change appends `OrderStatusHistory` and emails the customer (shipped / out for delivery / delivered / cancelled).
- Placing an order emails the customer (`ORDER_CONFIRMATION`) and each seller (`VENDOR_NEW_ORDER`).
- Order numbers: `ORD-YYMMDD-XXXXX` (retry on collision).

### Payments

Gateway-agnostic. A gateway is one class implementing `PaymentProvider`
(`apps/api/src/modules/payments/providers/payment-provider.ts`): `createSession`, `parseWebhook` (verify signature),
`refund`. `PAYMENT_PROVIDER` in `.env` picks it (`createPaymentProvider()`); today only `mock` exists.

```
checkout (CARD / WALLET / BANK_TRANSFER)
  ├─ Order + sub-orders PENDING_PAYMENT, stock reserved for checkout.reservationMinutes, Payment attempt PENDING
  ├─ provider.createSession() → customer redirected to the gateway page
  └─ gateway → POST /payments/webhooks/<provider>  (signature checked, WebhookEvent makes it run once)
        PAID      → Payment PAID, order + sub-orders PAID, stock held until shipping, confirmation + seller emails
        FAILED    → attempt FAILED + "payment failed" email; customer retries (new attempt) until the deadline
        CANCELLED → attempt CANCELLED; customer can retry
deadline passes unpaid → PaymentExpiryService (every minute) cancels the order and releases stock (email)
paid after the order was closed → automatic full refund
cancel a paid order (customer / admin) or sub-order (seller) → refund of the cancelled part (Refund + Transaction rows)
```

- The customer returns to `/checkout/payment-return?payment=<id>`, which only **reads** the status (polls while
  pending). The webhook is the source of truth, never the redirect.
- Sellers only see COD orders and online orders that were paid (`VISIBLE_TO_VENDOR` in `orders.service.ts`).
- Gateway amount ≠ attempt amount → not confirmed (logged).
- Mock gateway: `/pay/mock/<paymentId>` on the storefront; its buttons call `POST /payments/mock/:id/complete`, which
  signs a webhook and runs it through the same `handleWebhook()`. Disabled when `NODE_ENV=production` unless
  `PAYMENT_ALLOW_MOCK_IN_PRODUCTION=true`.
- **Adding a real gateway:** `providers/<name>.provider.ts` implementing `PaymentProvider`, a `case` in
  `createPaymentProvider()`, set `PAYMENT_PROVIDER`, `PAYMENT_API_KEY`, `PAYMENT_WEBHOOK_SECRET`, and register
  `https://api.<domain>/api/v1/payments/webhooks/<name>` in the gateway dashboard. Nothing else changes.

### Shipping

Each seller ships its own parcel. `ShippingService.quote()` (`apps/api/src/modules/shipping`):

```
destination (saved address / typed country + province + city)
  └─ matchZone(): most specific active zone — country + region (city or province) > country > all countries
       └─ rates of that zone that fit the parcel: weight (Σ variant weight, else product weight) and seller subtotal
            price: FREE → 0 · freeAbove reached → 0 · else rate price      → options, cheapest first
no zone matches → store default "Standard delivery" (settings flat rate / free above)
```

- The customer may pick another option per seller (`shippingRateIds: { vendorId: rateId }` on quote and place);
  the sub-order stores a snapshot (`VendorOrder.shippingMethod`, `shippingRateId`), so rates can change later.
- COD: unavailable if a chosen option has `codAvailable = false`; COD fee = `checkout.codFee` + the options' `codFee`.
- A seller with no fitting option blocks checkout ("cannot deliver … to this address").
- Shipping: seller picks the courier (pre-selected from the chosen option); `Courier.trackingUrlTemplate` with
  `{tracking}` becomes the customer's tracking link (order page + "shipped" email).
- Courier APIs (rates / booking / labels) can be added later behind the courier record; today couriers are manual.

### Returns (RMA)

```
customer (signed in), delivered sub-order, within returns.windowDays of delivery
  REQUESTED ─approve─► APPROVED ─receive─► ITEMS_RECEIVED ─refund─► REFUNDED
      ├─reject (reason)─► REJECTED
      └─customer withdraws─► CLOSED
```

- One request = items of **one** seller's sub-order (`ReturnRequest.vendorOrderId`); that seller (or admin / support)
  handles it. Units already in an open return cannot be returned twice (`returnableQuantity` on the order item).
- **Receive**: condition per item; restocked items go back (`StockMovement` RETURN) to the warehouse the SALE came from.
- **Refund**: up to items + that sub-order's shipping. Online payments → `PaymentsService.refundForReturn()` through the
  gateway; COD → recorded as a manual refund with the transfer reference. `Refund.returnRequestId` links them.
- Status changes use a conditional update (`updateMany where status = from`), so a double click cannot apply twice.
- Emails: customer RETURN_RECEIVED / APPROVED / REJECTED / REFUND_PROCESSED, seller VENDOR_RETURN_REQUEST.
- Order status is not changed by returns; payouts (later) must subtract refunds.

### Reviews & Q&A

- **Review** = one per customer per product (saving again edits it), only with a DELIVERED order item of that product
  (`orderItemId` set → "Verified purchase"). `reviews.requireApproval` (default `false`) → new / edited reviews
  start PENDING. Publishing, hiding, editing or deleting recalculates `Product.ratingAverage / ratingCount` and the
  store's `Vendor.ratingAverage` from APPROVED reviews only.
- Seller: one public reply per review (`vendorReply`). Admin / support: publish or hide.
- **Q&A**: signed-in customers ask; `questions.requireApproval` (default `true`) keeps a question hidden until an
  admin publishes it **or** the seller / admin answers it (answering publishes). Hidden questions cannot be answered.
- A delivered sub-order sends the REVIEW_REQUEST marketing email (respects opt-out; signed-in customers only).

### Wishlist & alerts

- One default `Wishlist` per customer; an item is a product (optionally a specific variant) with `priceAtAdd`.
- `WishlistSweepService` (API, every 15 min) emails WISHLIST_PRICE_DROP (marketing → opt-out respected) when the
  current price is ≥ 1 % below the saved price, one email per customer, then re-bases `priceAtAdd`.
- **Move to cart** adds the saved variant (or the cheapest active one) through `CartService` and removes the item.
- **Notify me** (sold-out option): `StockAlert` (variant + email; guests type an email). The existing inventory
  back-in-stock email fires when stock returns; subscribing again re-arms a used alert.

### Coupons & promotions

`PromotionsService.evaluate()` → pure `discount-engine.ts` (cents, unit-tested):

```
lines (seller, product, category, price × qty)
  1. line promotions: FLASH_SALE (% off scoped items) / BUY_X_GET_Y (free units) — best one per line
  2. TIERED: % off the remaining order subtotal, highest tier reached
  3. coupon (code): PERCENTAGE (cap maxDiscount) / FIXED_AMOUNT / FREE_SHIPPING, scoped by seller / products /
     categories, minOrderTotal, dates, usageLimit, usageLimitPerCustomer (user or guest email)
     stackable → added on top · not stackable → the bigger of (coupon) vs (promotions) wins
  → discount lines + per-seller split (items, shipping, seller-funded part)
```

- Order: `discountTotal`, `couponCode`; each `VendorOrder.discountTotal` gets its share. Store promotions and admin
  coupons are paid by the store; **seller coupons reduce the seller's `netAmount`**.
- The coupon use is counted inside the order transaction with a conditional SQL update, so a limit cannot be exceeded
  by two simultaneous orders (`CouponUsage` row per order).
- Refunds use what was paid: cancellations refund subtotal + shipping − discount; returns refund the items' share
  after the sub-order discount (+ shipping).

### Loyalty & gift cards

- **Points ledger** (`PointsTransaction`) + `LoyaltyAccount.points`. EARN on a fully DELIVERED order:
  money paid (sub-order subtotal − discounts − points / gift card share) × `loyalty.pointsPerCurrencyUnit` × tier
  multiplier; welcome bonus at registration, points for each new review, referral reward for both sides when the
  referred customer's first order is delivered (`/register?ref=CODE`). Tiers by lifetime points.
- **Expiry**: EARN rows get `expiresAt` (`loyalty.expiryDays`); `LoyaltySweepService` expires unspent old points
  FIFO (earned-and-expired − already consumed).
- **At checkout** (after discounts): points first (≤ `loyalty.maxRedeemPercent` % of the order, value
  `loyalty.pointValue`), then the gift card. Both are store-funded and split across sellers into
  `VendorOrder.discountTotal`, so refunds never exceed the money paid. Order: `loyaltyDiscount`, `giftCardTotal`.
  Nothing left to pay → payment method GIFT_CARD, order PAID immediately.
- Points and gift card balance are debited atomically in the order transaction and **given back proportionally**
  when sub-orders are cancelled (customer / seller / admin / unpaid expiry).
- Gift cards: admin issues (code `GC-XXXX-XXXX`, emailed), ledger `GiftCardTransaction` ISSUE / REDEEM / REFUND / ADJUST.

### Vendor payouts

- The store collects all money (online and COD via couriers) and pays sellers. Earnings per DELIVERED sub-order:
  sales = net + commission; commission is given back in proportion to refunded items; minus PAID return refunds
  (`payout-rules.ts`, integer cents).
- A sub-order is **available** `payouts.holdDays` after delivery (the return period) and when it has no open
  return; otherwise **on hold** with the reason.
- `POST /admin/payouts/generate`: one PENDING payout per seller whose available total ≥ `payouts.minimumAmount`.
  `PayoutItem.vendorOrderId` is unique, so a sub-order is never paid twice (re-runs are safe).
- Status: PENDING → PROCESSING (transfer sent) → PAID (reference required, seller emailed); FAILED can be retried.
  Cancelling a PENDING / FAILED payout deletes it and frees its sub-orders for the next run. All audited.

### CMS

Pages are stored as typed blocks (heading, paragraph, image, button) validated by `pageContentSchema` on both the
admin form and the API, so no raw HTML is ever rendered. Banners are live when active and inside
`startsAt`/`endsAt`. The storefront reads pages, banners, menus and FAQs through public `/cms/*` endpoints cached
for 60 s, and falls back to built-in links/hero when the CMS is empty or unreachable.

### Reports

- **Counted order** = not `CANCELLED` and not `PENDING_PAYMENT` (an unpaid online order). Gross sales = Σ order
  grand total of counted orders; seller sales = Σ sub-order item subtotal; refunds are dated by the refund itself.
- Days are cut in the `store.timezone` setting (timestamps are stored in UTC); unknown zones fall back to UTC.
- Range up to 366 days, default last 30; buckets switch day → week (Mon) → month by length. Every KPI is compared
  with the equally long period right before. Aggregation runs in Postgres (`reports.service.ts`).

### Taxes, currencies & languages

- **Tax rates** (`TaxRate`): per tax class (`standard` / `reduced` / `zero`, chosen on each product) and country, optionally
  a province / state (a region match beats the country-wide rate). Each rate is **inclusive** (already in the price,
  shown as "includes") or **exclusive** (added at checkout). Settings `tax.enabled`, `tax.defaultCountry` (estimate before
  an address is entered). Maths in `localization/tax-rules.ts`, integer cents.
- Tax is computed per line on the price **after item discounts**; points / gift cards are payments and do not reduce it.
  Order / VendorOrder `taxTotal` = all tax, `taxAdded` = the exclusive part (part of the total). OrderItem keeps the rate
  snapshot (`taxRate`, `taxInclusive`, `taxName`).
- **Tax belongs to the seller**: commission is charged on the price without tax; `VendorOrder.netAmount` includes it
  (included tax is in the subtotal, added tax is added). Cancellation refunds include added tax; a return's default
  refund (`suggestedRefund`) = paid for the items + their added tax; the cap adds shipping.
- **Currencies**: display only. The default currency is the store currency (prices, orders, payments, payouts); other
  active currencies have an exchange rate per 1 store unit, used by the storefront switcher. Checkout notes "you pay in
  …". The store currency can change only before the first order (rates are re-based).
- **Languages**: admin list (default, active, RTL). Storefront text goes through `t()` (`web/src/lib/i18n/messages.ts`,
  English fallback); the switcher appears once more than one language is active; `<html lang dir>` follows the choice.
  Urdu is seeded inactive until its text is added.

### Payment gateways & logs

- Gateways are defined in code (`PAYMENT_GATEWAYS` in `@ecommerce/types` + a provider class); their settings live in
  `PaymentGateway` (Admin → Settings → Payments): enabled, test mode, methods offered, priority, credentials.
- Credentials are encrypted (AES-256-GCM, key from `PAYMENT_ENCRYPTION_KEY`, required in production), never returned
  (only `••••1234`) and never written to the audit log.
- Checkout uses the first enabled, usable gateway by priority (its chosen methods). Webhooks and refunds go to the
  gateway recorded on the payment, even if it was turned off later. The test gateway is refused in production.
- `payments.codEnabled` turns cash on delivery off; COD per zone / delivery option stays in Shipping.
- Logs: payment attempts (with transactions and refunds) and webhook events (processed / failed / pending + payload).

### Email marketing

- **Newsletter**: double opt-in from the storefront footer (`marketing.newsletter-confirm` email). Links in emails carry
  an HMAC of the address (`marketing-rules.ts`, key `JWT_ACCESS_SECRET`): `/newsletter/confirm`, `/unsubscribe`.
  Unsubscribing also turns off the customer's marketing preference.
- **Campaigns**: draft → scheduled (time or now) → sending → sent; cancel while scheduled. Audience = confirmed
  subscribers and / or active customers (optional segment), deduplicated; unsubscribed, opted-out and suppressed
  addresses are skipped. Each campaign is claimed once (SCHEDULED → SENDING) so it is never sent twice.
- **Automations** (`MarketingSweepService`): due campaigns every minute; abandoned carts every 15 min (signed-in carts,
  one email per delay in `marketing.abandonedCartDelays`, progress in `CartRecovery`, restarts when the cart changes,
  optional coupon in the last one); win-back every 6 h (last order older than `marketing.winBackDays`, once per
  inactive period). Marketing emails respect opt-outs in `NotificationsService`.

### Email templates & log

- Every email is a React Email template (`packages/email-templates`, one entry per `EmailTemplateKey`), rendered by
  the worker. Admins override per template (`EmailTemplate`, locale `en`): subject for all; heading / text / button
  text for generic-layout emails; on / off (security and order-confirmation emails are always on; campaign and
  newsletter content comes from the campaign editor). `{{firstName}}`-style placeholders from `EMAIL_VARIABLES`.
- Preview renders unsaved edits with `SAMPLE_EMAIL_DATA`; test send uses the saved version.
- `EmailLog`: one row per email (queued → sent / failed, or suppressed). `EmailSuppression`: addresses that never
  receive any email (bounce, complaint, manual).

### SEO

- **Redirects** (Admin → SEO, `Redirect` table): old path → path or full URL, 301 / 302. Paths are normalised by the
  shared `normalizePath` (no query, no trailing slash) both when saving and in the storefront middleware
  (`web/src/middleware.ts`, list cached 60 s). The home page and app paths cannot be redirected; loops are refused.
  Bulk import "old new [code]" per line.
- **Sitemap** (`/sitemap.xml`): static routes, CMS pages, blog posts, and from `GET /seo/sitemap` every visible
  product, active category / brand and approved store.
- **Canonical URLs** on product, category, brand and store pages (filters and tracking parameters point to the base
  page). **JSON-LD**: Organization + WebSite search on every page, Product + BreadcrumbList on product pages,
  BreadcrumbList on category pages, FAQ / blog markup from the CMS.

### Documents & bulk tools

- **Invoice PDF** (pdfkit, `orders/documents/`): one invoice per seller sub-order (seller of record), numbered
  `INV-<order>-<n>` and stored in `Invoice` on first issue; available once the order is paid / COD-confirmed.
  Customers (own orders), sellers (own sub-orders, visible orders only), staff. **Packing slip**: no prices.
- **Order notes**: staff (whole order or one seller's part) and sellers (own sub-order); internal or visible to the
  customer ("Messages about your order"). Sellers delete only their own notes; staff any.
- **Manual orders** (Admin → Orders → Manual order): a temporary cart + the normal checkout (staff flag skips the
  guest-checkout and maintenance checks), COD, linked to the account with that email, internal note added.
- **Buy again** puts an order's still-available items in the cart; **Buy now** adds the item and opens checkout.
- **Product CSV**: sellers export / import (check first, then import; new SKUs → draft products, simple products
  updated, empty cells unchanged; through ProductsService so all product rules apply); staff export all.

### Checkout totals

Computed by the API only (`POST /checkout/quote`); the UI never calculates totals.

- Shipping: per seller parcel from the matching shipping zone (see Shipping); no zone → `shipping.flatRatePerVendor`,
  free when that seller's subtotal ≥ `shipping.freeShippingAbove`.
- Cash on delivery: allowed while the total ≤ `checkout.codMaxOrderTotal`; fee `checkout.codFee` (only when COD is chosen).
- Online methods: the gateway's methods ∩ setting `payments.onlineMethods` (`CARD,WALLET`; empty = COD only).
- Guest checkout: `checkout.guestCheckout`. Commission is worked out per item (Step 25,
  `resolveCommissionRate` in `@ecommerce/types`): seller+category rule (nearest category) → seller
  rule → category rule (inherited from parents) → GLOBAL rule →
  `marketplace.defaultCommissionRate`. Rules are managed at admin Sellers → Commissions
  (`/admin/vendors/commissions`). The seller rate on the seller detail page and in the approve dialog
  is the seller's own rule (there is no `Vendor.commissionRate` column). Placed orders keep the
  commission they were charged.
- Rewards tracking (admin): `RewardsActivityService` unions `PointsTransaction`, `CouponUsage` and
  `GiftCardTransaction` into one ledger. Admin Loyalty → Rewards activity (`/loyalty/activity`) lists it
  with filters, CSV and totals (points earned/redeemed/held + their value, coupon discounts, gift card
  redeemed/balance left). The same ledger shows on the order page (Discounts & rewards), the coupon
  page (Usage) and the customer page (Points & rewards history).
- Settings are rows in the `Setting` table, read with `readSetting(prisma, key, fallback)`.

## Support assistant

- `services/support-ai` (Python: Flask, LangGraph, pgvector) answers. It is internal: only the API calls it, at
  `SUPPORT_AI_URL` with the shared `SUPPORT_AI_KEY`; browsers use `/api/v1/support/assistant/*`.
- Owner of a chat: signed-in customer → a stable UUID derived from the user id; guest → `X-Visitor-Id` (browser UUID).
- Own tables (chats, messages, knowledge chunks) live in a separate database (`SUPPORT_AI_DATABASE_URL`), so Prisma
  never sees them. Store data is read with fixed, customer-scoped queries (`app/db/store.py`) over a read-only connection:
  everything about the signed-in customer (`get_my_account`, `lookup_order`, `get_my_activity`), the public catalog
  (`search_products`, `get_product`), platform data (`store_info`) and `check_coupon`. Guests: an order by number + checkout
  email only. The model never writes SQL and has no write access; for actions it links the customer to the right page.
- Knowledge: PDFs in `services/support-ai/data/` → `python -m scripts.ingest`.

## Conventions

- **Email only through `NotificationsService.sendEmail()`.** It checks the suppression list and marketing
  preferences, writes an `EmailLog`, and enqueues the job. The worker renders the React Email template and updates the log.
  Services wrap email sending so a mail failure never fails the business action.
- **Adding an email:** add a key to `EmailTemplateKey` (packages/types), add a template + registry entry
  (packages/email-templates). TypeScript fails the build if a key has no template.
- **Money:** `Decimal(12,2)` in Postgres; API math uses integer cents (`toCents` / `fromCents` in
  `common/utils/money.ts`); DTOs carry plain numbers.
- **Idempotency:** `Order.idempotencyKey` (one random key per checkout visit) and `WebhookEvent (provider, eventId)` are unique.
- **Transactions:** any multi-row change (order placement, status changes with stock, variant sync) runs in
  `prisma.$transaction`.
- **Audit:** admin and vendor mutations call `AuditService.log()` to write `AuditLog`.
- **Snapshots:** orders store the shipping address and item names, SKUs, prices and images at purchase time.

## Ports

| App           | Port                       |
| ------------- | -------------------------- |
| web           | 3000                       |
| admin         | 3001                       |
| vendor        | 3002                       |
| email preview | 3003                       |
| api           | 4000                       |
| postgres      | 5432                       |
| prisma studio | 5555                       |
| redis         | 6379                       |
| mailpit       | 1025 (SMTP) / 8025 (UI)    |
| minio         | 9000 (S3) / 9001 (console) |
