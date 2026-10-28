# Roadmap

## Done

1. **Single-shop conversion** (from `ecommerce-platform`): one store owned by the super admin, seller app and AI
   support service removed, admin menu trimmed to the shop owner's work, product / stock / order-status screens in
   the admin panel, COD only, PKR, HIA branding and seed.
2. **Inquiries**: website Contact page → Admin → Inquiries (migration `ticket_inquiry_fields`).
3. **Cleanup**: every marketplace-only feature deleted — code, endpoints, screens, emails, settings and database
   tables / columns (migrations `single_shop_cleanup` and `single_shop_cleanup_2`). See `docs/scope.md` §4.

## Possible next steps (when the shop owner asks)

- Online payments: add a real gateway (`docs/architecture.md` → Payments) and switch it on in Admin → Settings → Payments.
- Courier integration (booking, labels, live tracking) behind the existing `Courier` records.
- Real product photos and the full product list (Admin → Products or CSV import).

## How to build a feature

One entity at a time through every layer (details in `AGENTS.md` §3):

1. `packages/types`: interfaces + zod form schemas + helpers
2. `apps/api`: DTOs, service with business rules, controller, unit tests (+ migration if the schema changes)
3. `packages/api-client`: endpoint functions + query keys
4. `packages/ui`: only if a new reusable component is needed
5. Screens in `apps/admin` / `apps/web`
6. Seed data, then update this file and `CREDENTIALS.md` / `docs/architecture.md` if needed
