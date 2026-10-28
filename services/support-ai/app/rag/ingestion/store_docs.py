"""
Live store knowledge, read from the store database (read-only) every time the knowledge base is built:
  - store settings an admin can change (contact details, payments, shipping, returns, points)
  - published CMS pages (shipping policy, return policy, about, terms, ...)
  - active FAQs
So answers follow Admin → Settings / Pages / FAQ. Re-run  python -m scripts.ingest  after changing them.
"""
from app.db.store import _connect

SOURCE = "store"


def _money(value, currency):
    return f"{float(value):,.2f} {currency}".replace(".00 ", " ")


def _texts(node):
    """Every "text" string in a block-editor document, in order."""
    if isinstance(node, dict):
        out = [node["text"]] if isinstance(node.get("text"), str) else []
        for key, value in node.items():
            if key != "text":
                out += _texts(value)
        return out
    if isinstance(node, list):
        return [t for item in node for t in _texts(item)]
    return []


def settings_sections(s, currency):
    """Admin settings -> plain-language facts. Only settings that exist are mentioned."""
    get = s.get
    out = []

    contact = [f"Store name: {get('store.name')}." if get("store.name") else ""]
    if get("store.supportEmail"):
        contact.append(f"Support email: {get('store.supportEmail')}.")
    if get("store.phone"):
        contact.append(f"Phone: {get('store.phone')}.")
    if get("store.address"):
        contact.append(f"Address: {get('store.address')}.")
    out.append(("Store Contact Details", " ".join(c for c in contact if c)))

    pay = []
    online = [m.strip() for m in str(get("payments.onlineMethods") or "").split(",") if m.strip()]
    names = {"CARD": "debit / credit card", "WALLET": "mobile wallet", "BANK_TRANSFER": "bank transfer"}
    if online:
        pay.append("Online payment methods offered at checkout: " + ", ".join(names.get(m, m) for m in online) + ".")
    if get("payments.codEnabled"):
        line = "Cash on delivery is available"
        if get("checkout.codMaxOrderTotal"):
            line += f" for orders up to {_money(get('checkout.codMaxOrderTotal'), currency)}"
        fee = float(get("checkout.codFee") or 0)
        line += f"; cash on delivery fee: {_money(fee, currency)}." if fee else "; there is no extra fee for cash on delivery."
        pay.append(line)
    else:
        pay.append("Cash on delivery is currently not offered.")
    if get("checkout.reservationMinutes"):
        pay.append(f"Online payments must be completed within {get('checkout.reservationMinutes')} minutes of placing the order; "
                   "unpaid orders are then cancelled automatically and the items go back on sale.")
    if get("checkout.guestCheckout") is not None:
        pay.append("Guest checkout (without an account) is " + ("allowed." if get("checkout.guestCheckout") else "not allowed: customers must sign in."))
    out.append(("Payment Options and Limits", " ".join(pay)))

    if get("shipping.flatRatePerVendor") is not None:
        ship = (f"Shipping is charged per seller. Where no special delivery zone rate applies, standard shipping costs "
                f"{_money(get('shipping.flatRatePerVendor'), currency)} per seller")
        if get("shipping.freeShippingAbove"):
            ship += f", and it is free when that seller's items add up to {_money(get('shipping.freeShippingAbove'), currency)} or more"
        out.append(("Shipping Charges", ship + ". The exact shipping price for each seller is shown at checkout."))

    if get("returns.windowDays"):
        out.append(("Return Window", f"Returns can be requested within {get('returns.windowDays')} days after the order is delivered."))

    if get("loyalty.pointsPerCurrencyUnit"):
        pts = [f"Customers earn {get('loyalty.pointsPerCurrencyUnit')} point(s) for every 1 {currency} spent."]
        if get("loyalty.pointValue"):
            pts.append(f"Each point is worth {get('loyalty.pointValue')} {currency} at checkout.")
        if get("loyalty.maxRedeemPercent"):
            pts.append(f"Points can pay for up to {get('loyalty.maxRedeemPercent')}% of an order.")
        for key, label in (("loyalty.signupBonus", "for signing up"), ("loyalty.reviewPoints", "for writing a product review"),
                           ("loyalty.referralPoints", "for referring a friend who orders")):
            if get(key):
                pts.append(f"Bonus: {get(key)} points {label}.")
        if get("loyalty.expiryDays"):
            pts.append(f"Points expire {get('loyalty.expiryDays')} days after they are earned.")
        out.append(("Loyalty Points Rules", " ".join(pts)))

    out.append(("Store Currency", f"Prices are set in {currency}. Shoppers can view prices in other currencies; "
                                  "the charge is made in the currency shown at checkout."))
    return [(title, text) for title, text in out if text]


def store_sections():
    """[{"title", "text", "page"}] from the live store database."""
    with _connect() as conn:
        settings = {r["key"]: r["value"] for r in conn.execute('SELECT key, value FROM "Setting"').fetchall()}
        row = conn.execute('SELECT code FROM "Currency" WHERE "isDefault" LIMIT 1').fetchone()
        pages = conn.execute(
            'SELECT title, content FROM "Page" WHERE status = \'PUBLISHED\' AND locale = \'en\' ORDER BY title').fetchall()
        faqs = conn.execute('SELECT question, answer FROM "Faq" WHERE "isActive" ORDER BY position').fetchall()
    sections = settings_sections(settings, row["code"] if row else "USD")
    sections += [(p["title"], "\n".join(_texts(p["content"]))) for p in pages]
    sections += [(f["question"], f["answer"]) for f in faqs]
    return [{"title": t, "text": x.strip(), "page": i + 1} for i, (t, x) in enumerate(sections) if x.strip()]
