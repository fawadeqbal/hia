# HIA Furniture Solutions — Scope

An online shop for **one business**, HIA Furniture Solutions: office chair spare parts (gas lifts, wheels,
bases, armrests, tilt mechanisms, accessories), office chairs, office furniture, general order supplies, and chair
repair & maintenance, for individuals, offices and institutions — retail and wholesale.

> **Quality Products | Competitive Prices | Reliable Service**

| Item          | Detail                                                           |
| ------------- | ---------------------------------------------------------------- |
| Users         | Customers (guest or registered) and one super admin (shop owner) |
| Payment       | Cash on delivery (online payments can be added later)            |
| Currency      | PKR                                                              |
| Notifications | Email only                                                       |
| Stack         | Next.js 15, NestJS 11, PostgreSQL + Prisma 6, Redis + BullMQ     |

## 1. Website (customers)

- **Home**: banners (chair parts, repair, wholesale), categories, new and featured products, motto.
- **Catalog**: category pages, search with suggestions and typo tolerance, filters (category, price, rating,
  in stock, on sale, size / colour), sorting.
- **Product page**: photos, options (size, colour), price and compare-at price, stock, specifications,
  reviews, questions, related and "bought together" products, notify-me when sold out.
- **Cart & checkout**: guest or signed-in, saved addresses, delivery option (zone prices, pick up from shop),
  coupon, **Cash on delivery**, order note.
- **After the order**: confirmation and status emails, order tracking (guests by order number + email),
  invoice PDF, cancel before shipping, returns within the return window, buy again.
- **Account**: orders, returns, wishlist (price-drop emails), addresses, profile, email preferences.
- **Contact page**: repair / maintenance requests, wholesale & institutional quotes, general questions →
  Admin → Inquiries. WhatsApp chat button when a number is set.
- **Content**: About, Products & services, delivery / return policies, terms, privacy, FAQ (all editable).

## 2. Admin panel (shop owner)

| Area                | What it does                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard / Reports | Orders to confirm, new inquiries, open returns, low stock; sales, orders, top products                                                                                                      |
| Orders              | Confirm → Packed → Shipped (courier, tracking optional) → Delivered; cancel; invoice and packing slip; notes; manual (phone) orders                                                         |
| Inquiries           | Repair / quote / general requests: call, WhatsApp, email, notes, status                                                                                                                     |
| Customers           | List, segments, order history, block                                                                                                                                                        |
| Returns             | Approve / reject, receive (restock), refund                                                                                                                                                 |
| Products            | Create, photos, options and variants, specifications, publish, home-page feature, CSV import / export                                                                                       |
| Categories, Options | Category tree; size / colour values                                                                                                                                                         |
| Stock               | Adjust quantities, movement history, low-stock list                                                                                                                                         |
| Coupons             | Percentage, fixed amount or free delivery; limits, dates, product / category scope                                                                                                          |
| Website             | Banners, pages, menus, FAQs, reviews & questions moderation                                                                                                                                 |
| Settings            | Shop details (name, motto, logo, phone, WhatsApp, email, address), maintenance mode, checkout (guest, COD fee / limit), delivery zones & couriers, payments, return window, review approval |

## 3. Emails

Account (welcome, verify email, login code, password reset / changed, account deleted), orders (confirmation,
confirmed, shipped, out for delivery, delivered, cancelled, payment failed), returns (received, approved,
rejected, refunded), customer updates (back in stock, price drop, review request — optional, respect opt-out),
to the shop (new order, low stock, return request, new inquiry), inquiry received (to the customer).

## 4. Out of scope (removed from the original multi-vendor platform)

Multiple sellers (seller sign-up, approval, store pages, seller staff), brands, commissions and payouts,
loyalty points / gift cards / referrals, automatic promotions (flash sales, tiered, buy X get Y), tax, extra
currencies and languages, newsletter and email campaigns, blog, SEO redirects, custom staff roles and
permissions, email-template editor, disputes, AI support assistant.

## 5. Acceptance (critical flows)

1. A guest buys a product with options using Cash on delivery and receives the confirmation email.
2. The admin confirms, packs, ships and delivers the order; stock goes down on shipping; COD is marked paid on delivery.
3. A contact-page repair request appears in Admin → Inquiries and is emailed to the shop.
4. The admin creates and publishes a product with photos, options and stock, and it appears on the website.
5. A signed-in customer returns a delivered item; the admin approves, receives and refunds it.
