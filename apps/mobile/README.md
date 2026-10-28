# Ecommerce mobile (Flutter)

Shopping app for the same marketplace: same API, same design system (violet `#6445DF`,
yellow `#FFD32E`, Outfit font, rounded cards), laid out for phones.

## Phase 1 (this folder)
- Home: header + search, hero, categories, Today's deals, Best sellers, New arrivals
- Categories (roots expand to sub-categories) → product grid with search, quick filters
  (On sale, In stock, 4★ & up) and sort
- Product: swipe gallery, Color / Size / Storage options, stock, sticky Add to cart / Buy
- Cart: per-store groups, quantity +/−, remove, total; Checkout opens the web checkout
- Account: sign in / sign out (tokens kept in secure storage, auto refresh), member card

Next phases: native checkout, orders + tracking, wishlist, points, addresses, reviews.

## Run it
```bash
cd apps/mobile
flutter create . --org dev.fawadiqbal --project-name ecommerce_mobile   # once: adds android/ ios/ folders
flutter pub get
flutter run                                  # uses the live API (api.shop.fawadiqbal.dev)
```
Against your local API instead (Android emulator):
```bash
flutter run --dart-define=API_URL=http://192.168.1.119:4000/api/v1 --dart-define=STORE_URL=http://192.168.1.119:3000
```
flutter run --dart-define=API_URL=https://api.shop.fawadiqbal.dev --dart-define=STORE_URL=https://shop.fawadiqbal.dev