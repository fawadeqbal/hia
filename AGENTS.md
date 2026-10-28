# AGENTS.md — How to work on this codebase

Read this file fully before writing code. It is the contract for any AI agent or developer.
It exists so you do **not** have to explore the whole repo or guess conventions.

---

## 0. Golden rules (read first)

1. **Never guess.** If a file, export, endpoint or column is not shown here or in the code, open the file and check.
   The Prisma schema (`packages/database/prisma/schema.prisma`) is the source of truth for data.
2. **One entity at a time, through every layer** (§3). Do not build half of five things.
3. **Copy the reference implementation** that matches your entity (§4). Do not invent new patterns.
4. **Shared things live in packages**, never duplicated in apps (§2).
5. **Small, verifiable steps.** After each step: typecheck, test, run, update `docs/roadmap.md`.
6. **Do not change the Prisma schema** unless the step requires it. If you do, create a migration
   (`pnpm db:migrate --name <change>`) and say so explicitly.
7. **Never commit secrets.** Local defaults live in `.env.example` / `CREDENTIALS.md` only.
8. **Business rules live in the API.** Frontends never compute totals, stock or allowed status changes themselves;
   they show what the API returns (shared tables like `VENDOR_ORDER_TRANSITIONS` live in `packages/types`).

Current progress and the next entity to build: **`docs/roadmap.md`**.
Business flows (vendor, product, stock, order state machines): **`docs/architecture.md`**.
Full product scope: **`docs/scope.md`**. URLs, logins, demo data: **`CREDENTIALS.md`**.

---

## 1. Project map

```
apps/
  api/        NestJS 11 REST API          http://localhost:4000/api/v1   (Swagger: /api/docs)
  worker/     NestJS BullMQ worker        (emails, cron jobs)
  web/        Next.js 15 storefront       http://localhost:3000
  admin/      Next.js 15 admin panel      http://localhost:3001
  vendor/     Next.js 15 seller center    http://localhost:3002
packages/
  types/            shared interfaces, const enums, zod form schemas, helpers  (compiled to dist, CJS)
  api-client/       typed fetch functions + TanStack query keys               (consumed as TS source)
  ui/               shared React components                                   (consumed as TS source)
  database/         Prisma schema, migrations, seed, Prisma client            (compiled to dist)
  email-templates/  React Email templates + renderEmail()                     (compiled to dist)
  config/           tsconfig / eslint / tailwind presets
docs/        scope.md, roadmap.md, architecture.md
```

Stack: pnpm workspaces + Turborepo, Next.js App Router, NestJS, PostgreSQL + Prisma 6, Redis + BullMQ,
MinIO (S3), Mailpit (SMTP). **Email is the only notification channel.**

### Key folders inside the apps

```
apps/api/src/
  common/guards/        JwtAuthGuard (@Public routes still get the user if a valid token is sent), RolesGuard
  common/utils/         unique-slug.ts, stock-availability.ts (availableByVariant), settings.ts (readSetting), money.ts (toCents/fromCents)
  modules/<domain>/     one Nest module per domain; implemented: auth, users, vendors, catalog/*, media,
                        inventory, cart, checkout, orders, payments (gateways, logs), shipping, returns, reviews, wishlist, promotions, loyalty, payouts, notifications, audit
apps/admin/src/  apps/vendor/src/
  app/(dashboard)/…     thin pages          features/<entity>/…   list / detail / form components
  config/navigation.ts  sidebar             components/sidebar-shell.tsx  auth gate
apps/web/src/
  app/…                 pages (server components where possible)
  components/<domain>/  catalog, cart, checkout, orders, account, auth, layout
  hooks/use-cart.ts     useCart, useMe, useSetCart
```

---

## 2. Where things go (decision table)

| You need…                                                           | Put it in                                                                                                                 | Example                                                                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| A type the API returns / accepts                                    | `packages/types/src/<domain>/<entity>.ts`                                                                                 | `catalog/brand.ts` → `BrandDto`, `BrandListItem`, `BrandInput`                             |
| A form validation schema (frontend)                                 | `packages/types/src/schemas/<entity>.schema.ts`                                                                           | `brandFormSchema`, `emptyBrandForm`, `brandToForm`, `brandFormToInput`                     |
| A constant list / enum / labels / badge tones / state-machine table | `packages/types` as `const X = … as const`                                                                                | `ATTRIBUTE_TYPES`, `ORDER_STATUS_LABELS`, `ORDER_STATUS_TONES`, `VENDOR_ORDER_TRANSITIONS` |
| Pure helpers shared by API and UI                                   | `packages/types`                                                                                                          | `slugify`, `cartesian`, `findVariant`, `formatAddress`                                     |
| Backend request validation                                          | `apps/api/src/modules/<module>/<entity>/dto/<entity>.dto.ts` (class-validator)                                            | `CreateBrandDto implements BrandInput`                                                     |
| Business rules                                                      | `<entity>.service.ts` in the API; pure rules in `<x>-rules.ts` (unit-testable without Prisma)                             | `BrandsService`, `orders/order-rules.ts`                                                   |
| Prisma include + mapper to DTO                                      | `<entity>.mapper.ts` (`const xInclude = {…} satisfies Prisma.XInclude`, `toXDto()`)                                       | `products/product.mapper.ts`, `orders/order.mapper.ts`                                     |
| HTTP routes                                                         | admin: `admin-<entity>.controller.ts`; seller: `vendor-<entity>.controller.ts`; customer/public: `<entity>.controller.ts` | `AdminOrdersController`, `VendorOrdersController`, `OrdersController`                      |
| A configurable number (fees, limits)                                | a `Setting` row seeded in `seedSettings()`, read with `readSetting(prisma, key, fallback)`                                | `shipping.flatRatePerVendor`                                                               |
| A fetch call from any Next app                                      | `packages/api-client/src/endpoints/<entity>.ts`                                                                           | `brandsApi`, `ordersApi`                                                                   |
| A cache key                                                         | `packages/api-client/src/query-keys.ts`                                                                                   | `queryKeys.brands.adminList`, `queryKeys.orders.detail(n)`                                 |
| A reusable UI component                                             | `packages/ui/src/components/` + export in `index.ts`                                                                      | `DataTable`, `ImageUploadField`, `ReasonDialog`, `Timeline`                                |
| An admin / seller screen                                            | `apps/<app>/src/app/(dashboard)/<route>/page.tsx` (thin) + `apps/<app>/src/features/<entity>/*`                           | `features/brands/brand-list.tsx`                                                           |
| A storefront screen                                                 | `apps/web/src/app/<route>/page.tsx` (thin, metadata) + `apps/web/src/components/<domain>/*`                               | `components/checkout/checkout-view.tsx`                                                    |
| Sample data                                                         | `packages/database/prisma/seed.ts` (idempotent `upsert`)                                                                  | `seedBrands()`                                                                             |

Apps import the client via `@/lib/api-client` (re-exports `@ecommerce/api-client`).

### Shared UI components available (`@ecommerce/ui`)

`Button` (+ `buttonStyles()` for links), `Card`/`CardTitle`/`CardDescription`, `Input`, `Textarea`, `Select`,
`Checkbox`, `Badge` (tones gray/green/yellow/red/blue), `Alert`, `Spinner`, `PageHeader`, `DataTable`, `Tabs`,
`Pagination`, `DetailList`, `EmptyState`, `ConfirmDialog` (yes/no), `ReasonDialog` (needs a written reason),
`Modal` (custom forms), `Timeline` (history), `ImageUploadField`, `ImageGalleryField`, `AppShell`,
`PagePlaceholder` (scaffold for unbuilt screens), `cn`, `formatMoney`, `formatDate`, `formatDateTime`.

---

## 3. The per-entity recipe (follow in this order)

For entity **X** (e.g. `Brand`), module **M** (e.g. `catalog`):

### Step 1 — Shared types (`packages/types`)

1. `src/<domain>/x.ts`: `XDto` (dates as ISO **strings**, money as numbers), `XListItem` (adds counts), `XInput` (request body).
2. `src/schemas/x.schema.ts`: `xFormSchema` (zod), `XFormValues`, `emptyXForm`, `xToForm(dto)`, `xFormToInput(values)`.
   - Form values use `''` for "empty"; `xFormToInput` converts `''` → `null` (use `emptyToNull`).
   - Reuse `optionalSlugField`, `optionalUrlField` from `schemas/common.ts`.
   - Conditional rules (e.g. guest needs email) → `superRefine` (see `checkout.schema.ts`).
3. Export both from `src/index.ts`.

### Step 2 — API (`apps/api/src/modules/M/x/`)

1. `dto/x.dto.ts`: `CreateXDto implements XInput` with class-validator + `@ApiProperty`;
   `UpdateXDto extends PartialType(CreateXDto)` (from `@nestjs/swagger`). Mirror the zod rules.
2. `x.service.ts`:
   - Inject `PrismaService` and `AuditService` (global).
   - Methods: `list()`, `get(id)`, `create(dto, actorId)`, `update(id, dto, actorId)`, `remove(id, actorId)`.
   - **Every public method has an explicit return type using `@ecommerce/types`** (never return raw Prisma objects — map with `toXDto()`).
   - Slugs/codes: `uniqueSlug()` from `common/utils/unique-slug.ts`.
   - Write `this.audit.log({ actorId, action: 'M.x.create', entityType: 'X', entityId, before, after })` on every mutation.
   - Block destructive actions that would break data with `ConflictException` and a human message
     (e.g. "has 4 products — hide it instead").
   - Multi-row changes: `this.prisma.$transaction(async (tx) => …)`.
   - Ownership: seller endpoints look up the caller's vendor first and filter by `vendorId`; customer endpoints filter by `userId`.
     Return `NotFoundException` (not 403) for someone else's record.
   - Emails: call a private helper that wraps `notifications.sendEmail()` in try/catch — an email failure must never fail the action.
3. Controllers: `@Controller('admin/M/xs')` + `@Roles(Role.ADMIN)`; seller `@Controller('vendor/xs')` + `@Roles(Role.VENDOR)`;
   `@ApiTags(...)`, `@CurrentUser('sub') actorId`. Delete returns 204 (`@HttpCode(HttpStatus.NO_CONTENT)`).
   Declare fixed paths (e.g. `@Post('track')`) **before** parameter paths (`@Get(':orderNumber')`).
4. Public read endpoint (if storefront needs it): add to the module's public controller with `@Public()`.
5. Register controller + service in `M.module.ts` (and the module in `app.module.ts` if new).
6. `x.service.spec.ts`: plain unit tests with a mocked Prisma object (see `brands.service.spec.ts`;
   for transactions see `orders/orders.service.spec.ts`, which mocks `$transaction` with a `tx` object).
   Mock `findFirst` to return `null` when slug lookups happen.

### Step 3 — API client (`packages/api-client`)

1. `src/endpoints/xs.ts`: `xsApi = { adminList, get, create, update, remove, (public list) }`.
2. Add `queryKeys.xs = { all, adminList, detail(id), … }` in `query-keys.ts` (every key starts with the `all` prefix,
   so `invalidateQueries({ queryKey: queryKeys.xs.all })` refreshes everything).
3. Export from `src/index.ts`.

### Step 4 — UI components (`packages/ui`) — only if a NEW reusable piece is needed.

### Step 5 — Screens

- Admin / seller (`apps/<app>/src/features/xs/`):
  - `x-list.tsx` — `useQuery` (+ `keepPreviousData`) + `Tabs` status filter + search (`useDeferredValue`) + `DataTable` + `Pagination`.
  - `x-form.tsx` — `useForm` + `zodResolver(xFormSchema)` + `useMutation`; images via `<Controller>` + `ImageUploadField` + `mediaApi.uploadUrl(file, '<folder>')`.
  - `x-editor.tsx` — loads data for create/edit, renders the form (`key={id}`).
  - `x-detail.tsx` — status actions in `PageHeader.actions`; confirmations via `ConfirmDialog` / `ReasonDialog`;
    after a mutation `setQueryData(detail, updated)` then `invalidateQueries({ queryKey: all, refetchType: 'none' })`.
  - Pages (thin): `app/(dashboard)/<route>/page.tsx`, `/new/page.tsx`, `/[id]/page.tsx`
    (Next 15: `params` is a **Promise** → `const { id } = await params`).
  - Nav links already exist in `apps/<app>/src/config/navigation.ts`.
- Storefront (`apps/web`): SEO pages fetch on the server (see `app/products/[slug]/page.tsx`); interactive parts are
  client components in `components/<domain>/`. Account pages are gated by `components/account/account-shell.tsx`.

### Step 6 — Seed + docs

- Add `seedXs()` (idempotent `upsert` by unique key) and call it in `main()`.
- Update `docs/roadmap.md` (mark Done, set Next); update `CREDENTIALS.md` if logins/demo data/settings changed,
  and `docs/architecture.md` if a business flow changed.

---

## 4. Reference implementations (copy the closest one)

| Pattern                                                                                           | Copy from                                                                                                                                  |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Simple CRUD (name, slug, image, active)                                                           | **Brand** — `modules/catalog/brands/*`, `admin/features/brands/*`                                                                          |
| Tree / parent-child, cycle prevention                                                             | **Category** — `modules/catalog/categories/*`                                                                                              |
| Parent with editable child list (nested array, `useFieldArray`, transactional sync)               | **Attribute** — `modules/catalog/attributes/*`, `features/attributes/attribute-form.tsx`                                                   |
| File upload                                                                                       | **Media** — `modules/media/*`, `ImageUploadField`                                                                                          |
| Application → admin approval with reasons + emails                                                | **Vendor** — `modules/vendors/*`, `admin/features/vendors/*`, `vendor/app/register`, `vendor/app/onboarding`                               |
| Seller-owned entity + moderation workflow, variant builder                                        | **Product** — `modules/catalog/products/*` (vendor + admin controllers, mapper), `vendor/features/products/*`, `admin/features/products/*` |
| Quantities with a movement log                                                                    | **Inventory** — `modules/inventory/*` (`applyChange`), `vendor/features/inventory/*`                                                       |
| Guest + signed-in state via cookie, merge at sign-in                                              | **Cart** — `modules/cart/*` (`CART_COOKIE`), `web/hooks/use-cart.ts`, `web/components/cart/cart-view.tsx`                                  |
| Big transactional write, idempotency key, settings-driven totals                                  | **Checkout** — `modules/checkout/checkout.service.ts`                                                                                      |
| State machine with per-role actions, history, emails, stock side effects                          | **Orders** — `modules/orders/*` (`order-rules.ts`, `order-stock.ts`, three controllers), `vendor/features/orders/order-detail.tsx`         |
| Customer self-service CRUD in a modal                                                             | **Addresses** — `users.service.ts` (address methods), `web/components/account/addresses-view.tsx`                                          |
| Public SEO page + client island                                                                   | **Product page** — `web/app/products/[slug]/page.tsx` + `components/catalog/product-purchase.tsx`                                          |
| Auth / cookies                                                                                    | `modules/auth/*`, `apps/admin/src/app/login/*`, `web/components/auth/*`                                                                    |
| External gateway adapter, signed idempotent webhooks, timed expiry                                | **Payments** — `modules/payments/*` (`providers/`, `payments.service.ts`)                                                                  |
| Pure calculator + settings fallback, nested child rows                                            | **Shipping** — `modules/shipping/*` (`shipping-rules.ts`, `shipping-zones.service.ts`), `admin/features/shipping/*`                        |
| One service, customer + seller + admin controllers with a scope; staff screens shared by two apps | **Returns** — `modules/returns/*` (`return-rules.ts`, `vendor-` / `admin-returns.controller.ts`), `vendor                                  | admin/features/returns/*` |
| Sending email                                                                                     | `NotificationsService.sendEmail({ template: EmailTemplateKey.X, to, data })` — never send directly                                         |

---

## 5. Conventions & gotchas (all learned the hard way — do not repeat)

**API**

- Every route needs a JWT unless `@Public()`. Roles via `@Roles(...)`; `SUPER_ADMIN` passes all checks.
  On `@Public()` routes the guard still attaches the user when a valid token is sent (used by cart/checkout).
- Responses are wrapped as `{ success, data }` by a global interceptor; the api-client unwraps it.
- Login sets HttpOnly cookies `access_token` / `refresh_token`; frontends call with `credentials: 'include'`.
- **Explicit return types** on services/controllers. Inferred Prisma types caused `TS2742` errors.
  Type Prisma results with `const xInclude = {…} satisfies Prisma.XInclude` + `Prisma.XGetPayload<{ include: typeof xInclude }>`.
- Money = Prisma `Decimal` in the DB; do arithmetic in integer cents (`toCents`/`fromCents`), never raw float sums.
- Stock: always use `availableByVariant()` (Σ quantity − reserved over active warehouses); reserve/release/commit only
  through `orders/order-stock.ts` or `inventory.applyChange()` so movements are logged.
- `mode: 'insensitive'` inside a spread conditional needs `as const` (`{ contains: q, mode: 'insensitive' as const }`).
- `apps/api` & `apps/worker` tsconfig: `incremental: false` and `declaration: false` — **keep them**.
  (Incremental + Nest's `deleteOutDir` produced a `dist` missing files → "Cannot find module './config/env'".)
- Uploads: file type is detected from bytes (`detect-image.ts`), never trust the filename/MIME.
- Query DTOs extend `PaginationQueryDto`, which has a `skip` getter. `{ ...dto }` loses getters, so internal helpers
  must accept a plain type (e.g. `Pick<Dto, 'page' | 'limit' | …>`), not the DTO class.
- Seeded settings use `upsert` with `update: {}` — changing a default in `seed.ts` does **not** change an existing DB
  value. Change it in Prisma Studio, or read it with a code fallback.
- When a stub file (e.g. an old `x.controller.ts` placeholder) is replaced by new files, delete the stub if it no longer compiles.

**Frontend**

- Server page files stay thin; client logic lives in `features/*` (admin/vendor) or `components/*` (web) with `'use client'`.
- `useSearchParams()` must be inside `<Suspense>`.
- In `useFieldArray`, do not name a field `id` (RHF reserves it) — use `valueId` etc.
- Number inputs: `register('x', { valueAsNumber: true })` + `z.number()`.
- Radio groups: `{...register('field')}` on each `<input type="radio" value=…>`.
- Status badges: `<Badge tone={ORDER_STATUS_TONES[s]}>{ORDER_STATUS_LABELS[s]}</Badge>` — labels/tones come from `packages/types`.
- After a mutation that returns the updated record: `setQueryData` for the detail, invalidate the list with `refetchType: 'none'`.
- Order URLs for customers use the **order number** (`/account/orders/ORD-…`); admin/seller URLs use the id.
- New workspace package used by Next → add it to `transpilePackages` in each `next.config.ts`.

**Environment (Windows + Git Bash)**

- Use `cp .env.example .env` (not `copy`).
- `.npmrc` has `public-hoist-pattern[]=*prisma*` — needed so apps resolve Prisma types. Keep it.
- `docker/postgres/init.sql` must NOT create extensions — Prisma migrations do (otherwise "Drift detected").
- After adding dependencies run `pnpm install` (answer **Y** if it asks to reinstall `node_modules`).
- pnpm build-script allowlist lives in `pnpm-workspace.yaml` (`onlyBuiltDependencies`), not `package.json`.

---

## 6. Commands

```bash
pnpm infra:up                 # Postgres, Redis, Mailpit, MinIO
pnpm dev                      # all apps (or dev:admin / dev:api / dev:web / dev:vendor)
pnpm db:migrate               # apply pending migrations
pnpm db:migrate --name <x>    # after schema changes
pnpm db:seed                  # idempotent sample data
pnpm db:studio                # browse DB
pnpm typecheck && pnpm test && pnpm lint
pnpm --filter @ecommerce/api test        # API unit tests only
```

URLs, logins and walkthroughs: `CREDENTIALS.md`. Admin: `admin@example.com` / `Admin@12345`;
seller: `vendor@example.com` / `Vendor@12345`; customers register at http://localhost:3000/register.

---

## 7. Definition of done (per entity)

- [ ] Types + zod schema in `packages/types`, exported
- [ ] API DTOs mirror the zod rules; service has typed returns, audit logs, ownership checks, conflict rules
- [ ] Controller registered; visible in Swagger
- [ ] Unit tests for the business rules pass
- [ ] `xsApi` + `queryKeys.xs` in `packages/api-client`
- [ ] Every screen the roadmap row lists (admin / seller / storefront) works in the browser
- [ ] Emails (if any) arrive in Mailpit
- [ ] Seed data added; `pnpm db:seed` runs twice without errors
- [ ] `pnpm typecheck` passes
- [ ] `docs/roadmap.md` updated (and `CREDENTIALS.md` / `docs/architecture.md` if affected)

---

## 8. The generator-script workflow (how every step so far was written)

Every step in the roadmap was written by **Python generator scripts**, not by hand-editing files one at a time.
A script writes new files in full and changes existing files by exact text replacement, failing loudly if the
text isn't found. This keeps changes reproducible, reviewable and safe to re-check. Keep the scripts **outside**
the repo (e.g. a `scratch/gen/` folder that is not committed). Use this workflow, or at least its discipline,
for every new step.

### 8.1 One step = three scripts, run in this order

| Script            | Writes                                                                                                    | Typical content                                                                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stepN_shared.py` | `packages/types`, `packages/api-client`, `packages/database/prisma/seed.ts` (+ `schema.prisma` if needed) | DTO interfaces, labels/tones/state tables, zod form schemas + `emptyXForm`/`xToForm`/`xFormToInput`, index exports, `xsApi` endpoints, `queryKeys.xs`, seed functions/settings                              |
| `stepN_api.py`    | `apps/api/src/...`                                                                                        | `common/utils/*` helpers, DTOs (class-validator mirroring zod), `x-rules.ts` (pure logic), `x.mapper.ts` (`include` + `toXDto`), service, admin/vendor/public controllers, module registration, `*.spec.ts` |
| `stepN_ui.py`     | `packages/ui`, `apps/web`, `apps/vendor`, `apps/admin`, `docs/roadmap.md`                                 | new shared components + `index.ts` export, `features/<x>/*` (admin/vendor), `components/<domain>/*` (web), thin `page.tsx` files, nav/header/cart patches, roadmap row → Done and next row → Next           |

Shared runs first because API and UI import from it. Large steps can split further (`step6a_*`, `step6b_*`).

### 8.2 Script skeleton

```python
"""Step N — <entity>: what this script writes."""
import os

ROOT = "/path/to/repo"          # repo root
CHANGED = []                    # every touched path, for formatting + delivery

def w(path, content):
    """Write a whole file (new or fully replaced). Content is a triple-quoted string, LF line endings."""
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    text = content.lstrip("\n")
    with open(full, "w", newline="\n") as f:
        f.write(text if text.endswith("\n") else text + "\n")
    CHANGED.append(path)

def patch(path, old, new):
    """Change part of an existing file. `old` must match EXACTLY once-or-first (prettier-formatted text)."""
    full = os.path.join(ROOT, path)
    src = open(full).read()
    assert old in src, f"pattern not found in {path}: {old[:60]!r}"
    open(full, "w", newline="\n").write(src.replace(old, new, 1))
    CHANGED.append(path)

# ---- new files: always write the COMPLETE file
w("packages/types/src/orders/order.ts", """
export interface OrderDto { ... }
""")

# ---- existing files: small, anchored patches
patch("packages/types/src/index.ts",
      "export * from './cart/cart';\n",
      "export * from './cart/cart';\nexport * from './orders/order';\n")

open("changedN_shared.txt", "w").write("\n".join(sorted(set(CHANGED))) + "\n")
print(len(set(CHANGED)), "files")
```

Rules for writing the content:

- **New file → `w()` with the whole file.** Never patch a file you are creating.
- **Existing file → `patch()` with the smallest unique anchor** (an import line, a closing `];`, a table row).
  Open the file first and copy the anchor **exactly as prettier formatted it** (multi-line imports, trailing commas).
- Replacing a placeholder page (`PagePlaceholder` stub) → `w()` the whole page; delete stubs that no longer compile.
- Inside Python triple-quoted strings, JS template literals (`${x}`) are fine; escape only `\` and `"""`.
- Each script writes its own changed-list file (`changedN_shared.txt`, `changedN_api.txt`, `changedN_ui.txt`).

### 8.3 Run, check, deliver

```bash
python3 stepN_shared.py && python3 stepN_api.py && python3 stepN_ui.py
cat changedN_*.txt | sort -u > changedN.txt

# format exactly the touched files
grep -E '\.(ts|tsx|md|json|yml)$' changedN.txt | xargs npx prettier --write

# syntax check (no node_modules needed) — syntax.js:
#   const ts = require('typescript');
#   const p = ts.createProgram(files, { noResolve: true, jsx: ts.JsxEmit.Preserve, experimentalDecorators: true });
#   print p.getSyntacticDiagnostics(sf) for each file
node syntax.js $(grep -E '\.tsx?$' changedN.txt)

# full checks when dependencies are installed
pnpm typecheck && pnpm test
```

Delivering to another machine: `tar -czf stepN.tgz -T changedN.txt`, copy, `tar -xzf stepN.tgz --overwrite` in the repo root.
Only the changed files travel, so earlier fixes on that machine are never overwritten.

### 8.4 If a script fails halfway

`patch()` is **not idempotent**: patches before the failing one are already applied.

1. Read the assertion message. It names the file and the anchor that didn't match.
2. Open that file, copy the real (prettier-formatted) text, fix the anchor.
3. Before re-running, check which earlier patches already landed (grep for the new text). Either revert them
   or guard them (`if new not in src:`), then run again.

### 8.5 Order of thinking for each step (before writing any script)

1. Read the roadmap row and `schema.prisma` → list fields, statuses, rules, endpoints, screens, emails, settings.
2. Decide the shared contract first (DTOs + labels + state tables) because API and all three apps use it.
3. Write the API so every rule lives there (totals, stock, allowed transitions, ownership).
4. Write the screens against the api-client only. Screens never compute business results.
5. Seed data, roadmap update, then the user's run commands: `pnpm db:migrate` (only if the schema changed) →
   `pnpm db:seed` → `pnpm dev`, plus a short click-through test.

If you can run commands directly (dependencies installed), you may edit files directly instead of using scripts,
but keep the same order (shared → API → UI), the same file locations, and run `pnpm typecheck && pnpm test` before
saying a step is done.

---

## 9. Prompt template for the next agent

> Read `AGENTS.md`, `docs/roadmap.md` and `docs/architecture.md`. Build the next entity marked **Next** following §3
> exactly (written with the §8 shared → API → UI scripts), copying the closest reference from §4. Do not modify unrelated files. When done, list the files you
> changed, the commands I must run, and update the roadmap (plus CREDENTIALS/architecture if affected).

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
