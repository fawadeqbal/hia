# Local Development: URLs & Credentials

> **Local development only.** These are the default values from `.env.example`, `docker-compose.yml` and
> `packages/database/prisma/seed.ts`. Never use them in staging or production.

Start everything first:

```bash
pnpm infra:up   # Postgres, Redis, Mailpit, MinIO (Docker)
pnpm db:seed    # demo data (safe to run again)
pnpm dev        # web, admin, vendor, api, worker
```

---

## Applications

| App                     | URL                            | Login                                                                        |
| ----------------------- | ------------------------------ | ---------------------------------------------------------------------------- |
| Storefront (customers)  | http://localhost:3000          | Create an account at http://localhost:3000/register, or check out as a guest |
| Admin panel             | http://localhost:3001/login    | `admin@example.com` / `Admin@12345`                                          |
| Seller center (vendors) | http://localhost:3002/login    | `vendor@example.com` / `Vendor@12345` (approved store)                       |
| Seller registration     | http://localhost:3002/register | New application → shows up in Admin → Vendors                                |
| API base URL            | http://localhost:4000/api/v1   | JWT (cookie or `Authorization: Bearer <token>`)                              |
| API docs (Swagger)      | http://localhost:4000/api/docs | Use `POST /auth/login`, then **Authorize** with the `accessToken`            |
| API health check        | http://localhost:4000/health   | none                                                                         |

### Seeded accounts

| Role                                     | Email                 | Password       | Where to change                                                                           |
| ---------------------------------------- | --------------------- | -------------- | ----------------------------------------------------------------------------------------- |
| Super Admin                              | `admin@example.com`   | `Admin@12345`  | `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env`, then `pnpm db:seed`                 |
| Vendor (approved): Demo Electronics      | `vendor@example.com`  | `Vendor@12345` | `seedVendors()` in `seed.ts`                                                              |
| Vendor (pending review): Pending Fashion | `pending@example.com` | `Vendor@12345` | same                                                                                      |
| Customer                                 | none seeded           | —              | Register at http://localhost:3000/register (e.g. `customer@example.com` / `Customer@123`) |

### Seeded demo catalog (vendor: Demo Electronics)

| Product                                | SKU               | Status                                          | Stock (warehouse `DEMO-ELECTRONICS-MAIN`) |
| -------------------------------------- | ----------------- | ----------------------------------------------- | ----------------------------------------- |
| Galaxy S24 Ultra 256GB (Samsung)       | `SAM-S24U-256`    | Published                                       | 25                                        |
| iPhone 15 128GB (Apple)                | `APL-IP15-128`    | Published                                       | 3 (shows as low stock)                    |
| Dell XPS 13 (Intel Core Ultra 7, 16GB) | `DEL-XPS13-U7-16` | Pending review (approve it in Admin → Products) | 12                                        |
| Sony WH-1000XM5 Wireless Headphones    | `SNY-WH1000XM5`   | Draft                                           | 0                                         |

Plus categories, brands, attributes, currencies (USD default, PKR) and the settings below.

### Store settings (table `Setting`, edit in Prisma Studio)

`pnpm db:seed` only creates missing keys; it never overwrites a value you changed.

| Key                                          | Default                                                      | Effect                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `store.timezone`                             | `Asia/Karachi`                                               | Time zone used to cut days in reports and dashboards                                    |
| `checkout.guestCheckout`                     | `true`                                                       | Allow checkout without an account                                                       |
| `checkout.codFee`                            | `0`                                                          | Cash-on-delivery fee added to the total                                                 |
| `checkout.codMaxOrderTotal`                  | `5000`                                                       | COD hidden above this order total                                                       |
| `checkout.reservationMinutes`                | `15`                                                         | Time to pay an online order before it is cancelled and stock released                   |
| `payments.onlineMethods`                     | `CARD,WALLET`                                                | Online methods offered (add `BANK_TRANSFER`; empty = COD only)                          |
| `returns.windowDays`                         | `7`                                                          | Days after delivery a customer can request a return                                     |
| `reviews.requireApproval`                    | `false`                                                      | New / edited reviews wait for admin approval                                            |
| `questions.requireApproval`                  | `true`                                                       | Questions hidden until approved or answered by the seller                               |
| `loyalty.*`                                  | 1 pt / unit, 0.01 / pt, 50 %, 100 / 20 / 200 bonus, 365 days | Earn rate, point value, max share of an order, signup / review / referral bonus, expiry |
| `payouts.holdDays` / `payouts.minimumAmount` | `10` days / `10`                                             | Days after delivery before earnings can be paid out; smallest payout                    |
| `shipping.flatRatePerVendor`                 | `5`                                                          | Default shipping per seller when no shipping zone matches the address                   |
| `shipping.freeShippingAbove`                 | `50`                                                         | Seller subtotal at which that seller's shipping is free                                 |
| `marketplace.productApprovalRequired`        | `true`                                                       | New products go to admin review before publishing                                       |
| `marketplace.defaultCommissionRate`          | `10`                                                         | % commission when a vendor has no own rate                                              |

---

## Try it: end-to-end walkthroughs

**Buy as a guest (COD)**

1. http://localhost:3000 → open the Galaxy S24 → Add to cart → Cart → Proceed to checkout.
2. Enter an email and address → Place order → success page with the order number.
3. Mailpit (http://localhost:8025): customer confirmation + "new order" email to the vendor.
4. http://localhost:3000/track-order with the order number + email.

**Pay online (mock gateway, no real money)**

1. Add a product to the cart → Checkout → choose **Card** or **Wallet** → Continue to payment.
2. The test gateway page opens (`/pay/mock/…`): **Pay** → back on the store, "Payment received". Mailpit gets the
   confirmation and the seller's "new order" email; the order shows **Paid** and appears in the seller center.
3. Try **Simulate failure**: "Payment failed" page with **Try again**, plus a "payment failed" email.
   The order waits as "Awaiting payment" (with **Pay now** on the order page) and is cancelled automatically
   after `checkout.reservationMinutes` (15) — stock comes back.
4. Cancel a paid order (customer or admin): a refund is recorded and the "refund processed" email arrives.
   Admin → order detail shows every payment attempt.

**Support assistant (chat bubble on the storefront)**

1. Postgres needs pgvector: `docker compose up -d` (the image is now `pgvector/pgvector:pg16`, data is kept).
2. In `.env`: set `ANTHROPIC_API_KEY` (and keep `SUPPORT_AI_KEY` the same for API and assistant; both read the root `.env`).
3. Once: `cd services/support-ai && python -m venv .venv && source .venv/Scripts/activate && pip install -r requirements.txt`
   then `python -m scripts.ingest`: loads `data/store_handbook.md` plus the live store settings, published pages and FAQs (re-run after changing them).
4. Run: `python -m app.main` (port 5000) next to `pnpm dev`. Click **Support** on the right edge of the store.
5. Signed in, ask "where is my order?"; as a guest it asks for the order number + checkout email.

**Stripe (test mode)**

1. Admin → Settings → Payments → **Stripe**: paste the `sk_test_…` secret key and the `whsec_…` signing secret, enable it,
   and give it a lower priority number than the test gateway (or disable the test gateway).
2. Webhook endpoint: `<API_PUBLIC_URL>/api/v1/payments/webhooks/stripe`, events `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`.
   Locally: `stripe listen --forward-to localhost:4000/api/v1/payments/webhooks/stripe` (use the `whsec_…` it prints).
3. Pay with test card `4242 4242 4242 4242`, any future date / CVC. Refunds on cancel go through Stripe.

**Returns**

1. As a signed-in customer, place an order; in the seller center move it to **Delivered**.
2. My orders → the order → **Return items**: pick quantities + reason → the return page (`RMA-…`). Mailpit: customer
   "return received" + seller "return request".
3. Seller center → Returns → **Approve** → **Mark items received** (condition, restock) → **Refund**. For a COD order
   enter the transfer reference; for a card / wallet order the refund goes through the (mock) gateway.
4. Inventory shows a RETURN movement; the customer sees "Refunded". Admin → Returns sees every return.

**Reviews & Q&A**

1. As a customer with a **delivered** order: open the product → Customer reviews → **Write a review** (stars, title,
   text). The rating shows under the product title and in listings. Others see "Sign in" / "only buyers can review".
2. Ask a question under Questions & answers. Seller center → Questions → **Answer**: it appears on the product page.
3. Seller center → Reviews → **Reply**. Admin → Support → Reviews & Q&A: publish / hide reviews and questions.

**Wishlist & alerts**

1. Signed in: product page → **♡ Save**; header shows Wishlist (n). Wishlist page → **Move to cart** / Remove.
2. Price drop: lower the variant price in the seller center; within 15 minutes (or on API restart + 15 min) a
   "price drop" email arrives and the item shows **Price dropped**.
3. Sold-out option → **Notify me** (guests enter an email). Restock it in the seller center → "back in stock" email.

**Coupons & automatic discounts**

1. Admin → Promotions → Coupons → New: code `WELCOME10`, 10 %, 1 use per customer. Checkout → enter the code → Apply:
   a "Coupon WELCOME10" line; a second order with the same account is refused.
2. Admin → Promotions → Discounts → New sale 15 % on a category: checkout shows the sale by name. A non-stackable
   coupon now competes with it — the better deal is applied and the customer is told.
3. Seller center → Coupons: codes for the seller's own products; the discount is deducted from the seller's net.

**Loyalty & gift cards**

1. Register a new customer: My account → Points shows the 100-point welcome bonus and a referral link.
   Register a friend with `?ref=CODE`; when the friend's first order is delivered, both get 200 points.
2. Deliver an order (seller center): points are earned (1 per unit paid). Checkout → tick **Use my points**.
3. Admin → Promotions → Gift cards → Issue (amount, recipient email). Checkout → Gift card code → Apply. If points +
   gift card cover everything, no payment method is needed. Cancel the order: balance and points come back.
4. Admin → Loyalty: tier thresholds / multipliers, look up a customer and adjust points.

**Vendor payouts**

1. Deliver an order as the seller → Seller center → Finance → Earnings shows it **On hold** until
   `payouts.holdDays` (10) days after delivery (set the setting to `0` to try it now).
2. Admin → Sellers → Payouts → **Generate payouts** → open the payout (seller's bank details shown) →
   Mark transfer sent → Mark paid with a reference: the seller gets an email and sees it under Finance → Payouts.
3. Cancel a payout that is still To pay: its orders are available again for the next run.

**Taxes, currencies & languages**

1. Admin → Settings → Taxes: the seed has **GST 18 %, Pakistan, included in prices**. Checkout shows "Includes … tax";
   the seller's order shows the tax as theirs and commission is on the price without tax.
2. Add a rate with **Prices include this tax** off (e.g. Punjab 16 %): checkout for a Punjab address adds a Tax line.
3. Admin → Settings → Localization: PKR is shown in the storefront currency switcher (header); prices convert, checkout
   says you pay in the store currency. Activate Urdu to see the language switcher (text falls back to English until
   translated in `apps/web/src/lib/i18n/messages.ts`).

**Payment settings & logs**

1. Admin → Settings → Payments → Gateways: the test gateway is active (card, wallet). Untick Wallet and save:
   checkout offers card + COD only. Disable it: checkout is COD only.
2. Enter a webhook secret: it is saved encrypted and shown as `••••` + last 4 characters.
3. Pay an order online (mock page), then open Payment log (attempt, transactions, refunds) and Webhooks (event payload).

**Email marketing**

1. Storefront footer → Newsletter → subscribe; Mailpit (http://localhost:8025) has the confirmation email → confirm.
   Admin → Marketing → Subscribers lists it; Export CSV.
2. Admin → Marketing → Campaigns → New: write it, check the audience count, Send test, then Send now (or schedule).
   Every email has an unsubscribe link (`/unsubscribe`).
3. Abandoned cart: sign in, add to cart, wait past the first delay (Settings → Marketing emails, default 1 h).
   Win-back: customers with no order for 90 days get one email.

**Email templates & log**

1. Admin → Settings → Email templates: open "Shipped", set the subject to `Order {{orderNumber}} is on the way`,
   Show preview, Save, Send test → Mailpit shows it (worker must be running).
2. A generic email (e.g. Gift card received): edit heading / text / button. Reset to default undoes it.
3. Email log: every email with status; Blocked addresses: block an address and no email goes to it.

**SEO**

1. Admin → SEO → New redirect: `/old-shoes` → `/categories/fashion` (301). Open http://localhost:3000/old-shoes
   (within a minute). Import several at once with "old new 301" lines.
2. http://localhost:3000/sitemap.xml lists products, categories, brands, stores, pages and posts.
3. Product page source: canonical link, Product + BreadcrumbList JSON-LD; every page: Organization.

**Documents & bulk tools**

1. Order page (customer): Download invoice (PDF), Buy again. Product page: Buy now.
2. Seller center → order: Packing slip, Invoice, Notes (internal or shown to the customer).
   Products → Export CSV, edit, Import CSV → Check file → Import.
3. Admin → Orders → Manual order: search products, add, customer email + address → Place order (COD).
   Admin → Products → Export CSV.

**Shipping zones and couriers**
Seeded: zones **Karachi** (same-city 3 USD, free over 40, or store pickup) and **Pakistan** (Standard 5, free over 50;
Express 12, no COD; Heavy parcel 15 for 5–30 kg), couriers **Demo Courier** (tracking link) and **Own delivery**.

1. Checkout with a Karachi address: "Same-city delivery" or "Store pickup" per seller. Change the city to Lahore:
   Standard / Express appear. Pick Express: cash on delivery becomes unavailable.
2. Country outside PK: the default flat rate applies (no zone).
3. Seller center → order → Mark as shipped: courier pre-selected from the customer's choice. The customer's order
   page and "shipped" email link to the courier's tracking page.
4. Admin → Settings → Shipping: edit zones, delivery options and couriers.

**Fulfil as the seller**

1. http://localhost:3002/login as `vendor@example.com` → Orders → open the order.
2. Accept → Mark as packed → Mark as shipped (enter a tracking number) → Mark as delivered.
3. Inventory shows stock reduced on shipping; the customer gets an email at each step.

**Moderate as admin**

- Vendors: approve / reject `pending@example.com`'s store.
- Products: approve the Dell XPS 13 (In review tab) → it appears on the storefront.
- Orders: see every order, cancel one that has not shipped (stock is released).
- Inventory: low-stock report (iPhone 15).

**Customer account**

- Register, add to cart, check out with a new address (saved to the account), then
  http://localhost:3000/account/orders and /account/addresses. Cancel an order before it ships.

---

## Infrastructure (Docker)

### PostgreSQL

| Field             | Value                                                                     |
| ----------------- | ------------------------------------------------------------------------- |
| Host              | `localhost`                                                               |
| Port              | `5432`                                                                    |
| Database          | `ecommerce`                                                               |
| Username          | `ecommerce`                                                               |
| Password          | `ecommerce`                                                               |
| Connection string | `postgresql://ecommerce:ecommerce@localhost:5432/ecommerce?schema=public` |

Use with DBeaver, pgAdmin, TablePlus, or:

```bash
docker exec -it ecommerce-postgres psql -U ecommerce -d ecommerce
```

Reset everything (deletes all data): `docker compose down -v && pnpm infra:up && pnpm db:migrate && pnpm db:seed`.

### Prisma Studio (database browser)

| Field | Value                 |
| ----- | --------------------- |
| URL   | http://localhost:5555 |
| Start | `pnpm db:studio`      |
| Login | none                  |

### Redis (cache + job queues)

| Field    | Value                    |
| -------- | ------------------------ |
| Host     | `localhost`              |
| Port     | `6379`                   |
| Password | none                     |
| URL      | `redis://localhost:6379` |

```bash
docker exec -it ecommerce-redis redis-cli
```

### Mailpit (local email inbox)

Every email the platform sends (welcome, vendor decisions, product moderation, low stock, order confirmation,
shipped, delivered, cancelled…) lands here; nothing reaches real inboxes.

| Field                    | Value                 |
| ------------------------ | --------------------- |
| Inbox (web UI)           | http://localhost:8025 |
| SMTP host                | `localhost`           |
| SMTP port                | `1025`                |
| SMTP username / password | none                  |

Emails are sent by the worker; if nothing arrives, check that the `worker` app is running in `pnpm dev`.

### MinIO (S3-compatible file storage)

| Field                 | Value                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------- |
| Console (web UI)      | http://localhost:9001                                                                   |
| S3 API endpoint       | http://localhost:9000                                                                   |
| Username (access key) | `minioadmin`                                                                            |
| Password (secret key) | `minioadmin`                                                                            |
| Bucket                | `ecommerce-media` (created automatically with a public-read policy when the API starts) |

### Email template preview

| Field | Value                 |
| ----- | --------------------- |
| URL   | http://localhost:3003 |
| Start | `pnpm email:preview`  |

---

## Secrets in `.env`

| Variable                                    | Default                                     | Purpose                           |
| ------------------------------------------- | ------------------------------------------- | --------------------------------- |
| `JWT_ACCESS_SECRET`                         | `change-me-access-secret-min-32-characters` | Signs login tokens (min 32 chars) |
| `JWT_ACCESS_TTL_SECONDS`                    | `900`                                       | Access token lifetime (15 min)    |
| `JWT_REFRESH_TTL_DAYS`                      | `30`                                        | Refresh token lifetime            |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | empty                                       | Google sign-in (not wired yet)    |
| `PAYMENT_*`                                 | empty                                       | Payment gateway (roadmap step 10) |

---

## Ports at a glance

| Port        | Service              |
| ----------- | -------------------- |
| 3000        | Storefront           |
| 3001        | Admin                |
| 3002        | Seller center        |
| 3003        | Email preview        |
| 4000        | API                  |
| 5432        | PostgreSQL           |
| 5555        | Prisma Studio        |
| 6379        | Redis                |
| 1025 / 8025 | Mailpit SMTP / inbox |
| 9000 / 9001 | MinIO S3 / console   |
