# KADAM — storefront design system

KADAM (Urdu for "step") is the storefront's footwear identity. Everything below lives in
`apps/web/tailwind.config.ts` and `apps/web/src/app/globals.css`; components only use these tokens.
Admin and vendor apps keep the base preset.

## Colour

| Token                    | Value                          | Use                                                       |
| ------------------------ | ------------------------------ | --------------------------------------------------------- |
| `gray-900` (ink)         | `#171513`                      | Text, primary buttons, active states, footer, drawer CTAs |
| `gray-50` (bone)         | `#F6F3EE`                      | Page canvas                                               |
| `gray-200`               | `#E4DED4`                      | Hairlines, dividers                                       |
| `gray-500`               | `#756D62`                      | Secondary text                                            |
| `canvas` / `canvas-deep` | `#EFEBE4` / `#E7E1D8`          | Behind product photos (photos are `mix-blend-multiply`)   |
| `brand-600` (clay)       | `#B6461C`                      | Hover of primary buttons, campaign bands, links, focus    |
| `accent` (marigold)      | `#F0BD3F`                      | Highlights on ink, eyebrows on dark, sale price on ink    |
| `sale` / `sale-soft`     | `#C8321E` / `#FBE3DD`          | Discount labels and sale prices (kept apart from clay)    |
| `tint-*`                 | stone, straw, sage, clay wash… | Category and campaign tiles                               |

Rules: ink is the default action colour; clay is the brand moment (hover, campaign, rewards).
Never put ink text on clay or sale red — use bone.

## Type

Archivo (variable weight + width) via `next/font`.

- `.type-display` — 800 weight, `font-stretch: 68%`, uppercase, 0.9 line height. Hero, section
  titles, campaign tiles, drawer title.
- `h1, h2` default to `font-stretch: 82%`; `h3` to 92%.
- `.type-eyebrow` — 11.5px, bold, 0.12em tracking, uppercase. Labels above titles, filter groups,
  brand names on cards.
- Buttons: 12–13px, bold, uppercase, 0.08–0.1em tracking.

## Shape, depth, motion

- Radii: `sm 2px` (badges) · `md 4px` (buttons, inputs, tiles) · `lg 6px` (panels, menus) ·
  `xl 8px`. Pills (`rounded-full`) only for chips, icon buttons and avatars.
- Shadows: `shadow-pop` (menus/dropdowns), `shadow-drawer`, `shadow-card` (rare).
- One easing curve: `ease-out` = `cubic-bezier(.22,1,.36,1)`. 150–300ms for UI, 500–900ms for
  imagery and hero copy. Everything respects `prefers-reduced-motion`.
- Helpers: `.link-grow` (underline grows from the left), `.skeleton` (moving sheen),
  `animate-rise-in`, `animate-ticker`, `animate-bump`, `animate-slide-in-right`.

## Interaction patterns

| Pattern               | Where                                             | Behaviour                                                                                                                                              |
| --------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Announcement ticker   | `layout/announcement-bar.tsx`                     | Rotates every 4.5s, pauses on hover/focus, arrow buttons, `aria-live` polite.                                                                          |
| Hide-on-scroll header | `layout/header-shell.tsx`                         | Hides after 10px down past 160px, returns on 6px up; never hides while a menu is open or focus is inside. Publishes `--header-h`.                      |
| Mega menu             | `layout/category-nav.tsx`                         | 110ms open intent, instant switch while open, 180ms close grace, height glides, columns stagger in, Esc/scroll/route close, keyboard focus opens.      |
| Product card          | `catalog/product-card.tsx`                        | Pointer devices: second photo cross-fades in, quick-add bar slides up, name underlines. Touch devices: still card.                                     |
| Quick add             | `catalog/quick-add.tsx`                           | Single-variant products add and open the bag; products with sizes go to the product page.                                                              |
| Filters               | `catalog/product-listing.tsx`, `filter-panel.tsx` | GET form synced to the URL, re-submits on change, results dim while loading, size values as tiles, plus→minus section toggles, bottom sheet on phones. |
| Size picker           | `catalog/product-purchase.tsx`                    | No size pre-selected; "Add to bag" without one shakes the grid and asks. Sold-out sizes stay visible with a diagonal strike and offer "Notify me".     |
| Sticky add-to-bag     | `catalog/product-purchase.tsx`                    | Slides up once the main button scrolls off; the support button steps above it.                                                                         |
| Bag drawer            | `cart/cart-drawer.tsx`, `lib/cart-drawer.ts`      | `openCartDrawer({ justAdded })` from anywhere. Slide-in, focus trap, Esc/backdrop/route close, scroll lock, focus returns, just-added line glows.      |
| Hero                  | `home/hero-carousel.tsx`                          | Numbered progress bars, line-by-line headline reveal, shoe glides in and follows the pointer slightly, swipe on phones, pause on hover/focus.          |
| Tabs                  | `catalog/product-tabs.tsx`                        | Underline glides to the active tab, ←/→ keys move between tabs, `#reviews` opens its tab.                                                              |

## Data

`StorefrontProductCard.hoverImageUrl` (second product photo, or `null`) powers the card swap. It is
set in `apps/api/src/modules/catalog/product-cards.ts`.
