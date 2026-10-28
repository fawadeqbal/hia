# E-Commerce Platform — Scope Document

| Item              | Detail                                                   |
| ----------------- | -------------------------------------------------------- |
| Document version  | 1.0                                                      |
| Date              | 11 October 2026                                          |
| Delivery approach | All phases (MVP + Phase 2 + Phase 3) in a single release |
| Frontend          | Next.js (App Router, TypeScript)                         |
| Backend           | NestJS (modular architecture, TypeScript)                |
| Database          | PostgreSQL                                               |
| ORM               | Prisma                                                   |
| Notifications     | Email only                                               |

---

## 1. Project Overview

### 1.1 Purpose

Build a full-featured, multi-vendor e-commerce platform where customers can browse, purchase, and track products; vendors can manage their own catalog and orders; and platform administrators can manage the entire marketplace, content, promotions, and payouts.

### 1.2 Goals

- Deliver a fast, SEO-friendly, mobile-responsive storefront.
- Provide a complete admin panel and a vendor dashboard.
- Support single-store and multi-vendor operation from one codebase.
- Use email as the single notification channel for all transactional and marketing messages.
- Build on a modular backend so features can be extended or replaced independently.

### 1.3 User Roles

| Role                          | Description                                                             |
| ----------------------------- | ----------------------------------------------------------------------- |
| Guest                         | Browses catalog, adds to cart, checks out as guest                      |
| Customer                      | Registered user with account, orders, wishlist, reviews, loyalty points |
| Vendor (Seller)               | Manages own products, inventory, orders, and payouts                    |
| Vendor Staff                  | Sub-user of a vendor with limited permissions                           |
| Support Agent                 | Handles tickets, returns, and customer queries                          |
| Warehouse / Fulfillment Staff | Picks, packs, ships orders                                              |
| Content Manager               | Manages CMS pages, banners, blog                                        |
| Marketing Manager             | Manages coupons, promotions, email campaigns                            |
| Admin                         | Full platform control                                                   |
| Super Admin                   | Admin + system settings, roles, and permissions                         |

---

## 2. Technology Stack & Architecture

### 2.1 Stack

| Layer                   | Technology                                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Storefront & dashboards | Next.js (App Router, SSR/ISR for SEO), TypeScript, Tailwind CSS                                                            |
| State / data fetching   | TanStack Query (or Next.js server actions where suitable)                                                                  |
| Forms & validation      | React Hook Form + Zod                                                                                                      |
| Backend API             | NestJS, REST (with OpenAPI/Swagger docs)                                                                                   |
| Validation (backend)    | class-validator / class-transformer                                                                                        |
| ORM                     | Prisma                                                                                                                     |
| Database                | PostgreSQL                                                                                                                 |
| Cache & queues          | Redis + BullMQ (emails, reports, imports, scheduled jobs)                                                                  |
| Search                  | PostgreSQL full-text search + `pg_trgm` for fuzzy matching                                                                 |
| File storage            | S3-compatible object storage + CDN                                                                                         |
| Authentication          | JWT (access + refresh tokens), OAuth (Google), email OTP                                                                   |
| Email                   | Transactional email provider via SMTP/API (e.g., Amazon SES, SendGrid, Resend, Postmark) with React Email / MJML templates |
| Payments                | Payment gateway abstraction layer + Cash on Delivery                                                                       |
| Testing                 | Jest (unit), Supertest (API), Playwright (E2E)                                                                             |
| DevOps                  | Docker, CI/CD pipeline, staging + production environments                                                                  |

### 2.2 Application Structure

```
apps/
  web/            → Next.js storefront (customer-facing)
  admin/          → Next.js admin panel
  vendor/         → Next.js vendor dashboard
  api/            → NestJS backend
packages/
  ui/             → shared UI components
  types/          → shared TypeScript types / DTO contracts
  config/         → shared ESLint, TS, Tailwind config
  email-templates → shared email templates
```

Monorepo managed with Turborepo (or Nx) and pnpm workspaces.

> Note: admin and vendor can be a single Next.js app with role-based route groups if a smaller footprint is preferred.

### 2.3 NestJS Module Map

| Module                  | Responsibility                                          |
| ----------------------- | ------------------------------------------------------- |
| `AuthModule`            | Registration, login, OAuth, OTP, tokens, password reset |
| `UsersModule`           | Customer profiles, addresses                            |
| `RbacModule`            | Roles, permissions, guards                              |
| `VendorsModule`         | Vendor onboarding, verification, profiles, staff        |
| `CatalogModule`         | Products, variants, attributes, categories, brands      |
| `InventoryModule`       | Stock, warehouses, reservations, alerts                 |
| `SearchModule`          | Full-text search, filters, autocomplete                 |
| `CartModule`            | Cart, save for later, guest cart merge                  |
| `CheckoutModule`        | Checkout orchestration, totals, validation              |
| `PricingModule`         | Price rules, tax calculation                            |
| `PromotionsModule`      | Coupons, flash sales, BOGO, gift cards                  |
| `OrdersModule`          | Orders, sub-orders per vendor, status lifecycle         |
| `PaymentsModule`        | Gateway abstraction, webhooks, refunds, COD             |
| `ShippingModule`        | Zones, rates, courier integrations, tracking            |
| `ReturnsModule`         | Returns, exchanges, refunds (RMA)                       |
| `ReviewsModule`         | Ratings, reviews, moderation, Q&A                       |
| `WishlistModule`        | Wishlists                                               |
| `LoyaltyModule`         | Points, tiers, referrals                                |
| `RecommendationsModule` | Related, frequently bought together, recently viewed    |
| `CmsModule`             | Pages, banners, menus, blog, FAQs                       |
| `MediaModule`           | Uploads, image processing, storage                      |
| `NotificationsModule`   | Email dispatch, templates, preferences, logs            |
| `MarketingModule`       | Email campaigns, abandoned cart, newsletters            |
| `SupportModule`         | Tickets, dispute handling                               |
| `PayoutsModule`         | Vendor commissions, settlements, payouts                |
| `AnalyticsModule`       | Reports, dashboards, exports                            |
| `SeoModule`             | Sitemaps, meta, redirects, structured data              |
| `SettingsModule`        | Store settings, currencies, languages, taxes            |
| `AuditModule`           | Audit logs of admin/vendor actions                      |
| `JobsModule`            | Queues, scheduled tasks (BullMQ)                        |

---

## 3. Functional Scope — Storefront (Customer)

### 3.1 Home & Navigation

- Configurable home page: hero banners/sliders, featured categories, featured/new/best-selling products, flash sale section, vendor highlights.
- Mega menu for categories; header search; footer menus managed via CMS.
- Announcement bar.

### 3.2 Catalog & Discovery

- Category and subcategory listing pages (unlimited nesting).
- Brand pages and vendor storefront pages.
- Search with autocomplete, typo tolerance, and suggestions.
- Filters: price range, brand, vendor, rating, availability, dynamic attributes (size, color, material, etc.).
- Sorting: relevance, price, newest, popularity, rating.
- Pagination / infinite scroll.

### 3.3 Product Detail Page

- Image gallery with zoom; product video.
- Variants (size, color, etc.) with per-variant price, SKU, stock, and images.
- Price, compare-at price, discount badge, stock status.
- Description, specifications, shipping & return info.
- Seller info with link to vendor store.
- Ratings, reviews (with photos), and product Q&A.
- Related products, frequently bought together, recently viewed.
- Add to cart, buy now, add to wishlist, share.
- Back-in-stock email alert.

### 3.4 Customer Account

- Sign up / login via email + password, email OTP, Google OAuth.
- Email verification.
- Forgot / reset password.
- Profile management; multiple saved addresses with default.
- Order history and order details.
- Wishlist.
- Loyalty points balance and history; referral link.
- Email notification preferences (marketing opt-in/out).
- Account deletion request (data privacy).

### 3.5 Cart

- Add, update quantity, remove, save for later.
- Persistent cart for logged-in users; guest cart merged on login.
- Real-time stock and price validation.
- Coupon and gift card application.
- Estimated shipping and tax.
- Cart split display by vendor (multi-vendor).

### 3.6 Checkout

- Guest checkout and logged-in checkout.
- Address selection / entry with validation.
- Shipping method selection with calculated rates (per vendor where applicable).
- Payment method selection: online gateway(s), bank transfer, Cash on Delivery.
- Apply coupons, gift cards, and loyalty points.
- Order review and place order.
- Inventory reservation during checkout, released on timeout/failure.
- Order confirmation page and confirmation email.

### 3.7 Orders & Post-Purchase

- Order tracking with status timeline and courier tracking link.
- Cancel order (before shipment, per policy).
- Download invoice (PDF).
- Return / exchange request with reason and images.
- Refund status tracking.
- Write reviews for delivered items.
- Reorder.

### 3.8 Content Pages

- About, Contact, FAQ, Terms, Privacy, Shipping Policy, Return Policy.
- Blog listing and articles.
- Contact form (submits a support ticket, sends email).

---

## 4. Functional Scope — Vendor Dashboard

### 4.1 Onboarding

- Vendor registration with business details and documents.
- Admin approval / rejection with email notification.
- Store profile: name, logo, banner, description, policies.
- Payout details (bank account).

### 4.2 Product Management

- Create/edit/delete products with variants, attributes, images, SEO fields.
- Bulk import/export via CSV.
- Product status: draft, pending review, published, rejected, archived.
- Admin moderation of new products (configurable).

### 4.3 Inventory

- Stock per variant and per warehouse.
- Low-stock threshold and email alerts.
- Stock adjustment history.

### 4.4 Orders

- View vendor sub-orders.
- Update status: confirmed, packed, shipped (with tracking number), delivered.
- Print packing slips and invoices.
- Handle cancellations and return requests for own items.

### 4.5 Finance

- Earnings dashboard: gross sales, commission, net earnings.
- Settlement statements and payout history.
- Downloadable reports.

### 4.6 Other

- Respond to product reviews and Q&A.
- Vendor-level coupons (if enabled by admin).
- Vendor staff accounts with permissions.
- Vendor analytics: sales, top products, views, conversion.

---

## 5. Functional Scope — Admin Panel

### 5.1 Dashboard

- KPIs: revenue, orders, AOV, conversion rate, new customers, top products, top vendors, abandoned carts.
- Date-range filtering and comparison.

### 5.2 Catalog Management

- Categories (nested), brands, attributes and attribute sets.
- All products across vendors; approve/reject vendor products.
- Bulk import/export.
- Product SEO and URL slugs.

### 5.3 Inventory

- Warehouses / locations.
- Global stock view, low-stock report.

### 5.4 Order Management

- All orders with filters and search.
- Order details, status changes, notes (internal and customer-visible).
- Manual order creation.
- Cancellations, refunds (full/partial), payment status reconciliation.
- Packing slips, invoices, shipping labels.

### 5.5 Returns & Refunds

- RMA queue, approve/reject, receive items, restock, issue refund or store credit.

### 5.6 Customers

- Customer list, profiles, order history, addresses.
- Segments (e.g., new, repeat, high-value, inactive).
- Block/unblock; manual loyalty point adjustments.

### 5.7 Vendors

- Vendor applications, approval, suspension.
- Commission rules (global, per category, per vendor).
- Payout management: settlement cycles, mark paid, payout reports.
- Disputes between customers and vendors.

### 5.8 Promotions

- Coupons: percentage, fixed amount, free shipping; usage limits, per-customer limits, min order, date range, category/product/vendor restrictions.
- Automatic discounts: flash sales, buy-X-get-Y, tiered discounts.
- Gift cards: issue, balance, redemption.

### 5.9 Loyalty & Referrals

- Points earning rules (per spend, signup, review, referral).
- Redemption rules and conversion rate.
- Tiers (e.g., Silver, Gold, Platinum) with benefits.
- Referral rewards for referrer and referee.

### 5.10 Content (CMS)

- Pages with block-based editor.
- Home page sections and banners with scheduling.
- Menus (header, footer).
- Blog: posts, categories, tags, authors.
- FAQs.

### 5.11 Shipping

- Shipping zones and rates (flat, weight-based, price-based, free above threshold).
- Courier integrations (rate fetch, booking, tracking) via adapter pattern.
- Pickup / local delivery options.

### 5.12 Payments

- Enable/disable gateways, configure credentials.
- COD settings: availability by zone, max order value, COD fee.
- Transaction logs and webhook logs.

### 5.13 Taxes, Currencies & Languages

- Tax classes and rates by region; tax-inclusive/exclusive pricing.
- Multi-currency display with exchange rates.
- Multi-language content (i18n) for storefront.

### 5.14 Marketing (Email)

- Newsletter subscribers list.
- Email campaigns to segments with scheduling.
- Abandoned cart email sequences (configurable delays).
- Win-back and post-purchase review request emails.

### 5.15 Support

- Ticket inbox: assign, prioritize, reply (replies sent by email), internal notes.
- Contact form submissions.
- Review moderation and product Q&A moderation.

### 5.16 Reports & Analytics

- Sales, orders, products, categories, vendors, customers, coupons, taxes, refunds, inventory.
- Abandoned cart report.
- CSV / Excel export; scheduled report emails.

### 5.17 SEO

- Meta titles/descriptions, canonical URLs, Open Graph.
- Auto-generated XML sitemap and robots.txt.
- 301 redirect manager.
- Structured data (Product, Breadcrumb, Review, Organization).

### 5.18 System & Security

- Roles and granular permissions.
- Admin users management.
- Audit logs.
- Store settings (name, logo, contact, policies, maintenance mode).
- Email template editor and email logs.

---

## 6. Email Integration (Only Notification Channel)

### 6.1 Infrastructure

- `NotificationsModule` with a provider-agnostic email interface (swap providers without code changes).
- All emails sent asynchronously via BullMQ queue with retries and exponential backoff.
- Templates built with React Email or MJML, responsive, branded, and multi-language.
- Admin-editable subject lines and content blocks.
- Email logs: recipient, template, status (queued, sent, delivered, bounced, failed), timestamps.
- Bounce and complaint handling via provider webhooks; suppression list.
- Unsubscribe link and preference center for marketing emails (transactional always sent).
- SPF, DKIM, and DMARC configured on the sending domain.

### 6.2 Email Catalogue

**Account**

- Welcome email
- Email verification
- Login OTP
- Password reset
- Password changed confirmation
- Account deletion confirmation

**Orders (Customer)**

- Order confirmation
- Payment received / payment failed
- Order confirmed by vendor
- Order shipped (with tracking)
- Out for delivery / delivered
- Order cancelled
- Invoice email

**Returns & Refunds**

- Return request received
- Return approved / rejected
- Refund processed

**Engagement & Marketing**

- Abandoned cart reminders (sequence)
- Back-in-stock alert
- Price drop on wishlist item
- Review request after delivery
- Loyalty points earned / expiring
- Referral reward earned
- Newsletter and campaign emails
- Gift card received

**Vendor**

- Application received / approved / rejected
- New order received
- Product approved / rejected
- Low-stock alert
- Payout processed
- Return request on vendor item

**Admin / Staff**

- New vendor application
- New support ticket
- Daily / weekly sales summary
- Scheduled report delivery
- System alerts (failed payments spike, job failures)

**Support**

- Ticket created confirmation
- Ticket reply
- Ticket resolved

---

## 7. Order Lifecycle

```
Pending Payment → Paid / COD Confirmed → Processing → Packed → Shipped
→ Out for Delivery → Delivered → (Return Requested → Return Approved
→ Item Received → Refunded)
Any pre-shipment state → Cancelled
```

- In multi-vendor mode, a parent order is split into vendor sub-orders, each with its own status lifecycle.
- Each status change is logged and triggers the relevant email.

---

## 8. Core Data Model (Prisma — High Level)

| Domain        | Main Entities                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| Identity      | User, Role, Permission, Session, RefreshToken, OtpCode, Address                                       |
| Vendors       | Vendor, VendorStaff, VendorDocument, CommissionRule, Payout, PayoutItem                               |
| Catalog       | Category, Brand, Product, ProductVariant, Attribute, AttributeValue, ProductImage, ProductTranslation |
| Inventory     | Warehouse, StockLevel, StockMovement, StockReservation                                                |
| Cart          | Cart, CartItem, SavedItem                                                                             |
| Orders        | Order, VendorOrder, OrderItem, OrderStatusHistory, OrderNote, Invoice                                 |
| Payments      | Payment, Transaction, Refund, WebhookEvent                                                            |
| Shipping      | ShippingZone, ShippingRate, Shipment, Courier                                                         |
| Returns       | ReturnRequest, ReturnItem                                                                             |
| Promotions    | Coupon, CouponUsage, Promotion, GiftCard, GiftCardTransaction                                         |
| Loyalty       | LoyaltyAccount, PointsTransaction, Tier, Referral                                                     |
| Engagement    | Review, ReviewImage, Question, Answer, Wishlist, WishlistItem, StockAlert                             |
| CMS           | Page, Banner, Menu, MenuItem, BlogPost, BlogCategory, Faq                                             |
| Notifications | EmailTemplate, EmailLog, EmailPreference, Subscriber, Campaign                                        |
| Support       | Ticket, TicketMessage, Dispute                                                                        |
| System        | Setting, Currency, Language, TaxRate, Redirect, AuditLog, Media                                       |

---

## 9. Non-Functional Requirements

### 9.1 Performance

- Storefront pages: LCP under 2.5s on 4G; product/category pages via SSR/ISR with caching.
- API p95 response time under 300ms for read endpoints.
- Images optimized (WebP/AVIF) and served via CDN.
- Redis caching for catalog, settings, and sessions.

### 9.2 Scalability

- Stateless API instances behind a load balancer.
- Background jobs isolated in worker processes.
- Database indexing on search, filters, and foreign keys; read replicas when needed.

### 9.3 Security

- HTTPS everywhere; secure, HttpOnly cookies for tokens.
- Password hashing (argon2/bcrypt).
- Rate limiting on auth, OTP, checkout, and public APIs.
- Input validation on frontend and backend; protection against XSS, CSRF, SQL injection.
- Card data never stored; handled by payment gateway (PCI DSS via gateway).
- Webhook signature verification.
- Role-based access control on every endpoint.
- Audit logs for admin and vendor actions.
- Regular automated database backups with tested restore.

### 9.4 Reliability & Observability

- Health checks, structured logging, error tracking (e.g., Sentry).
- Uptime monitoring and alerting.
- Idempotent payment and order creation endpoints.

### 9.5 SEO & Accessibility

- Server-rendered, crawlable pages; clean URLs.
- WCAG 2.1 AA accessibility target.

### 9.6 Compatibility

- Responsive: mobile, tablet, desktop.
- Latest two versions of Chrome, Safari, Firefox, Edge.

---

## 10. Third-Party Integrations

| Integration                   | Purpose                                |
| ----------------------------- | -------------------------------------- |
| Payment gateway(s)            | Online payments, refunds, webhooks     |
| Email provider                | All transactional and marketing emails |
| Courier API(s)                | Rates, booking, tracking               |
| Object storage + CDN          | Media storage and delivery             |
| Google OAuth                  | Social login                           |
| Google Analytics / Meta Pixel | Tracking and conversion measurement    |
| Error monitoring              | Application error tracking             |

---

## 11. Out of Scope

- SMS, WhatsApp, and push notifications (email only).
- Native mobile apps (APIs will be mobile-ready for future apps).
- Live chat / chatbot.
- ERP / accounting software integration.
- POS (in-store point of sale).
- AI-based personalization beyond rule-based recommendations.
- Content migration from an existing platform (unless agreed separately).

---

## 12. Deliverables

1. Next.js storefront, admin panel, and vendor dashboard.
2. NestJS modular API with Swagger documentation.
3. PostgreSQL database with Prisma schema, migrations, and seed data.
4. Email templates and notification system.
5. Background worker for queues and scheduled jobs.
6. Docker setup and CI/CD pipeline; staging and production environments.
7. Automated test suites (unit, API, E2E for critical flows).
8. Technical documentation (setup, architecture, deployment) and admin/vendor user guides.

---

## 13. Acceptance Criteria (Critical Flows)

- A guest and a registered customer can complete checkout with online payment and with COD, and receive the correct emails.
- A multi-vendor cart creates correct vendor sub-orders, commissions, and vendor notifications.
- Inventory is reserved at checkout and correctly decremented/restored on payment, cancellation, and return.
- Coupons, gift cards, and loyalty points apply correctly together according to stacking rules.
- Returns flow results in correct refund and restock.
- Vendor payouts calculate correctly from delivered orders minus commission and refunds.
- All emails in Section 6.2 trigger on their events and are logged.
- Role permissions prevent unauthorized access across admin, vendor, and customer areas.

---

## 14. Assumptions & Open Questions

**Assumptions**

- Marketplace mode (multi-vendor) is enabled; can operate as a single store by using one vendor.
- Client provides branding assets, policy content, and gateway/courier/email provider accounts.

**Open questions**

1. Which payment gateway(s) and couriers must be integrated?
2. Which email provider is preferred?
3. Which currencies and languages are required at launch?
4. Commission model: flat percentage, per category, or per vendor?
5. Payout cycle: weekly, bi-weekly, or monthly? Manual or automated payouts?
6. Should vendor products require admin approval before publishing?
7. Hosting preference (AWS, GCP, Azure, VPS)?
8. Expected traffic and catalog size at launch?
