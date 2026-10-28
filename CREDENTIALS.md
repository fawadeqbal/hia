# Logins, URLs and test walkthrough

Local development only. Never use these passwords on a real server.

## URLs

| What                  | URL                                             |
| --------------------- | ----------------------------------------------- |
| Shop website          | http://localhost:3000                           |
| Admin panel           | http://localhost:3001                           |
| API + Swagger docs    | http://localhost:4000/api/docs                  |
| Emails (Mailpit)      | http://localhost:8025                           |
| Image storage (MinIO) | http://localhost:9001 (minioadmin / minioadmin) |

## Logins

| Who                      | Email / password                                                | Where       |
| ------------------------ | --------------------------------------------------------------- | ----------- |
| Super admin (shop owner) | `admin@example.com` / `Admin@12345`                             | Admin panel |
| Customers                | register at http://localhost:3000/register, or order as a guest | Website     |

The super admin comes from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env`. Change them before the
first `pnpm db:seed`. After that, change the password in the database or create a new admin; the seed never
overwrites an existing user.

## What the seed creates (`pnpm db:seed`, safe to run again)

- The shop **HIA Furniture Solutions** (one store, owned by the super admin) with warehouse "Main store".
- Categories: **Chair Parts** (Gas Lifts, Wheels & Castors, Chair Bases, Armrests, Tilt Mechanisms,
  Chair Accessories), **Office Chairs** (Executive, Staff & Mesh, Visitor), **Office Furniture**
  (Office Tables), **General Order Supplies**.
- Options: Colour (Black, Grey, Brown, Blue, Chrome) and Size (50 mm, 60 mm, 320 mm, 350 mm, Standard, Heavy-duty).
- 15 sample products with stock, prices in **PKR**, placeholder drawings.
- Delivery: zone "Pakistan" — Standard delivery Rs 500 (free above Rs 25,000), Pick up from shop (free).
  Couriers: Own delivery, TCS, Leopards Courier (no tracking links; add them in Delivery zones → Couriers).
- Payments: **Cash on delivery only** (no fee, no limit). The test card gateway exists but is off.
- Pages: About, Products & Services, Delivery policy, Return policy, Terms, Privacy. Header/footer menus. FAQs.
- Settings: motto, 7-day returns, guest checkout on, reviews published straight away, questions approved first.

## Test walkthrough (5 minutes)

1. **Website** → open a product (e.g. _Chair Castor Wheels_), pick **60 mm**, **Add to cart** → **Checkout**
   as a guest → address → delivery (Standard is pre-selected) → **Cash on delivery** → **Place order**.
2. **Website → Contact us** → choose _Chair repair / maintenance_ → name, phone, message → **Send message**.
3. **Admin → Dashboard** shows _New orders to confirm: 1_ and _New inquiries: 1_.
4. **Admin → Orders** → open the order → **Confirm order → Mark as packed → Mark as shipped**
   (pick "Own delivery", tracking number optional) **→ Mark as delivered**. The customer gets an email at each
   step (Mailpit) and the COD payment is marked paid on delivery. Stock goes down when shipped.
5. **Admin → Inquiries** → open the request → **Call / WhatsApp / Email**, add a note (it moves to
   _In progress_), then **Mark done**.
6. **Admin → Products → Add product** → name, price, category → **Save as draft** → add photos and
   options → **Publish on the website** → tick **Show on the home page** → **Stock** → add quantity.
7. **Admin → Stock → Upload Excel** → choose **Add** → **Download template** → type how many arrived for
   one or two products → choose the file → check the preview → **Confirm and save**. The stock and its
   history update. (**Download Excel** on any list gives you the list as an Excel file.)
8. **Admin → Shop settings** → set the WhatsApp number → the website shows a _Chat on WhatsApp_ button.

## Useful commands

```bash
pnpm infra:up        # start Postgres, Redis, Mailpit, MinIO (Docker)
pnpm db:migrate      # apply database migrations
pnpm db:seed         # HIA shop + sample data (idempotent)
pnpm db:studio       # browse the database
pnpm dev             # run everything
pnpm typecheck && pnpm test && pnpm lint
```
