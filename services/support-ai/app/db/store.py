"""
Read-only access to the store database (the NestJS API's Postgres, tables from Prisma) for the support agent.

Every connection is opened read-only with a statement timeout. Queries are fixed (the model never writes SQL)
and everything about a person is filtered by the signed-in customer's id, so a chat can never reveal
another customer's data. Public catalog / platform data (products, sellers, shipping options) is open to all.
"""
import re

import psycopg
from psycopg.rows import dict_row

from app.core import config

CANCELLABLE = ("PENDING_PAYMENT", "PAID", "COD_CONFIRMED", "PROCESSING", "PACKED")


def _connect():
    url = re.sub(r"([?&])schema=[^&]*&?", r"\1", config.STORE_DATABASE_URL).rstrip("?&")   # Prisma-only param
    return psycopg.connect(url, autocommit=True, row_factory=dict_row, connect_timeout=5,
                           options="-c default_transaction_read_only=on -c statement_timeout=5000")


def store_name():
    """STORE_NAME, else the store name set in Admin → Settings, else "our store"."""
    if config.STORE_NAME:
        return config.STORE_NAME
    try:
        with _connect() as conn:
            row = conn.execute('SELECT value FROM "Setting" WHERE key = %s', ("store.name",)).fetchone()
        return str(row["value"]) if row and row["value"] else "our store"
    except psycopg.Error:
        return "our store"


def _url(path):
    return f"{config.STORE_URL}{path}"


def _rows(conn, sql, params=()):
    return conn.execute(sql, params).fetchall()


def _one(conn, sql, params=()):
    return conn.execute(sql, params).fetchone()


# ------------------------------------------------------------------ orders
_ORDER = ('SELECT o.id, o."orderNumber" AS order_number, o.status, o."paymentStatus" AS payment_status, '
          'o."paymentMethod" AS payment_method, o.currency, o.subtotal, o."discountTotal" AS discount, '
          'o."shippingTotal" AS shipping, o."taxTotal" AS tax, o."giftCardTotal" AS gift_card, '
          'o."loyaltyDiscount" AS points_discount, o."grandTotal" AS total, o."couponCode" AS coupon, '
          'o."placedAt" AS placed_at, o."cancelledAt" AS cancelled_at, o."cancelReason" AS cancel_reason, '
          'o."customerNote" AS customer_note, o."shippingAddress" AS shipping_address FROM "Order" o ')


def _order_details(conn, order, full_address):
    oid = order.pop("id")
    address = order.pop("shipping_address") or {}
    order["ship_to"] = address if full_address else {"city": address.get("city")}
    order["items"] = _rows(conn,
        'SELECT oi."productName" AS product, oi."variantName" AS variant, oi.sku, oi.quantity, '
        'oi."unitPrice" AS unit_price, oi.total, p.slug FROM "OrderItem" oi '
        'JOIN "ProductVariant" v ON v.id = oi."variantId" JOIN "Product" p ON p.id = v."productId" '
        'WHERE oi."orderId" = %s ORDER BY oi.id', (oid,))
    for it in order["items"]:
        it["product_url"] = _url(f"/products/{it.pop('slug')}")
    sellers = _rows(conn,
        'SELECT vo.id, ve.name AS seller, ve.slug, vo.status, vo."shippingMethod" AS shipping_method, '
        'vo."shippingTotal" AS shipping FROM "VendorOrder" vo JOIN "Vendor" ve ON ve.id = vo."vendorId" '
        'WHERE vo."orderId" = %s', (oid,))
    for s in sellers:
        s["seller_url"] = _url(f"/stores/{s.pop('slug')}")
        s["shipments"] = _rows(conn,
            'SELECT sh.status, sh."trackingNumber" AS tracking_number, c.name AS courier, '
            'c."trackingUrlTemplate" AS tpl, sh."shippedAt" AS shipped_at, sh."deliveredAt" AS delivered_at '
            'FROM "Shipment" sh LEFT JOIN "Courier" c ON c.id = sh."courierId" WHERE sh."vendorOrderId" = %s',
            (s.pop("id"),))
        for sh in s["shipments"]:
            tpl = sh.pop("tpl")
            sh["tracking_url"] = tpl.replace("{tracking}", sh["tracking_number"]) if tpl and sh["tracking_number"] else None
    order["sellers"] = sellers
    order["can_cancel"] = bool(sellers) and all(s["status"] in CANCELLABLE for s in sellers)
    order["payments"] = _rows(conn,
        'SELECT method, provider, status, amount, currency, "createdAt" AS at FROM "Payment" '
        'WHERE "orderId" = %s ORDER BY "createdAt"', (oid,))
    order["refunds"] = _rows(conn,
        'SELECT r.amount, r.status, r.reason, r."createdAt" AS at FROM "Refund" r '
        'JOIN "Payment" p ON p.id = r."paymentId" WHERE p."orderId" = %s ORDER BY r."createdAt"', (oid,))
    order["timeline"] = _rows(conn,
        'SELECT "toStatus" AS status, note, "createdAt" AS at FROM "OrderStatusHistory" '
        'WHERE "orderId" = %s ORDER BY "createdAt"', (oid,))
    order["returns"] = _rows(conn,
        'SELECT "rmaNumber" AS rma, status, "refundAmount" AS refund_amount FROM "ReturnRequest" '
        'WHERE "orderId" = %s ORDER BY "createdAt"', (oid,))
    order["invoices"] = _rows(conn, 'SELECT number, total, "issuedAt" AS issued_at FROM "Invoice" WHERE "orderId" = %s', (oid,))
    order["order_page"] = _url(f"/account/orders/{order['order_number']}")
    return order


# ------------------------------------------------------------------ products
_PRODUCT_COLS = (
    'p.id, p.name, p.slug, p.currency, p."shortDescription" AS summary, p."ratingAverage" AS rating, '
    'p."ratingCount" AS reviews, p."compareAtPrice" AS compare_at_price, b.name AS brand, c.name AS category, '
    've.name AS seller, ve.slug AS seller_slug, '
    'COALESCE((SELECT MIN(v.price) FROM "ProductVariant" v WHERE v."productId" = p.id AND v."isActive"), p."basePrice") AS price, '
    'COALESCE((SELECT SUM(sl.quantity - sl.reserved) FROM "ProductVariant" v '
    'JOIN "StockLevel" sl ON sl."variantId" = v.id JOIN "Warehouse" wh ON wh.id = sl."warehouseId" '
    'WHERE v."productId" = p.id AND v."isActive" AND wh."isActive"), 0) AS available ')
_PRODUCT_FROM = ('FROM "Product" p JOIN "Category" c ON c.id = p."categoryId" JOIN "Vendor" ve ON ve.id = p."vendorId" '
                 'LEFT JOIN "Brand" b ON b.id = p."brandId" WHERE p.status = \'PUBLISHED\' AND p."deletedAt" IS NULL ')


def _product_card(r):
    r.pop("id", None)
    r["in_stock"] = (r.pop("available") or 0) > 0
    r["url"] = _url(f"/products/{r.pop('slug')}")
    r["seller_url"] = _url(f"/stores/{r.pop('seller_slug')}")
    return r


class StoreRepository:
    # ---------------- orders
    def order(self, order_number, customer_id=None, email=None):
        """One order of this customer (by account), or of this guest (order number + checkout email)."""
        with _connect() as conn:
            if customer_id:
                row = _one(conn, _ORDER + 'WHERE o."orderNumber" = %s AND o."userId" = %s', (order_number, customer_id))
            else:
                row = _one(conn, _ORDER + 'WHERE o."orderNumber" = %s AND lower(o.email) = lower(%s)', (order_number, email))
            return _order_details(conn, row, full_address=bool(customer_id)) if row else None

    def recent_orders(self, customer_id, limit=10):
        with _connect() as conn:
            rows = _rows(conn,
                'SELECT "orderNumber" AS order_number, status, "paymentStatus" AS payment_status, "grandTotal" AS total, '
                'currency, "placedAt" AS placed_at, (SELECT count(*) FROM "OrderItem" oi WHERE oi."orderId" = o.id) AS items '
                'FROM "Order" o WHERE "userId" = %s ORDER BY "placedAt" DESC LIMIT %s', (customer_id, limit))
        for r in rows:
            r["order_page"] = _url(f"/account/orders/{r['order_number']}")
        return rows

    # ---------------- the customer
    def account(self, customer_id):
        with _connect() as conn:
            user = _one(conn,
                'SELECT "firstName" AS first_name, "lastName" AS last_name, email, phone, status, '
                '"emailVerifiedAt" IS NOT NULL AS email_verified, "googleId" IS NOT NULL AS google_sign_in, '
                '"passwordHash" IS NOT NULL AS has_password, locale, "createdAt" AS member_since, '
                '"lastLoginAt" AS last_login FROM "User" WHERE id = %s AND "deletedAt" IS NULL', (customer_id,))
            if not user:
                return None
            user["addresses"] = _rows(conn,
                'SELECT label, "fullName" AS full_name, phone, line1, line2, city, state, "postalCode" AS postal_code, '
                '"countryCode" AS country, "isDefault" AS is_default FROM "Address" WHERE "userId" = %s '
                'ORDER BY "isDefault" DESC, "createdAt"', (customer_id,))
            user["orders_summary"] = _one(conn,
                'SELECT count(*) AS orders, COALESCE(sum("grandTotal") FILTER (WHERE status NOT IN '
                '(\'CANCELLED\', \'PENDING_PAYMENT\')), 0) AS total_spent, max("placedAt") AS last_order '
                'FROM "Order" WHERE "userId" = %s', (customer_id,))
            user["loyalty"] = _one(conn,
                'SELECT la.points, la."lifetimePoints" AS lifetime_points, la."referralCode" AS referral_code, '
                't.name AS tier, (SELECT count(*) FROM "Referral" r WHERE r."referrerId" = la."userId") AS friends_referred '
                'FROM "LoyaltyAccount" la LEFT JOIN "Tier" t ON t.id = la."tierId" '
                'WHERE la."userId" = %s', (customer_id,))
            user["email_preferences"] = _one(conn,
                'SELECT marketing, "productUpdates" AS product_updates, "unsubscribedAt" AS unsubscribed_at '
                'FROM "EmailPreference" WHERE "userId" = %s', (customer_id,))
            user["newsletter"] = _one(conn,
                'SELECT "isConfirmed" AS confirmed, "unsubscribedAt" AS unsubscribed_at FROM "Subscriber" '
                'WHERE "userId" = %s OR lower(email) = lower(%s) LIMIT 1', (customer_id, user["email"]))
            user["cart"] = _rows(conn,
                'SELECT p.name AS product, v.name AS variant, ci.quantity, ci."unitPrice" AS unit_price '
                'FROM "Cart" ca JOIN "CartItem" ci ON ci."cartId" = ca.id JOIN "ProductVariant" v ON v.id = ci."variantId" '
                'JOIN "Product" p ON p.id = v."productId" WHERE ca."userId" = %s LIMIT 20', (customer_id,))
            user["wishlist"] = _rows(conn,
                'SELECT p.name AS product FROM "Wishlist" wl JOIN "WishlistItem" wi ON wi."wishlistId" = wl.id '
                'JOIN "Product" p ON p.id = wi."productId" WHERE wl."userId" = %s LIMIT 20', (customer_id,))
            user["pages"] = {"profile": _url("/account/profile"), "addresses": _url("/account/addresses"),
                             "orders": _url("/account/orders"), "returns": _url("/account/returns"),
                             "wishlist": _url("/account/wishlist"), "loyalty": _url("/account/loyalty"),
                             "email_preferences": _url("/account/preferences")}
            return user

    ACTIVITY = ("returns", "refunds", "points", "reviews", "questions", "gift_cards", "coupons_used",
                "stock_alerts", "tickets", "disputes")

    def activity(self, customer_id, kind):
        with _connect() as conn:
            email = (_one(conn, 'SELECT email FROM "User" WHERE id = %s', (customer_id,)) or {}).get("email", "")
            if kind == "returns":
                rows = _rows(conn,
                    'SELECT rr.id, rr."rmaNumber" AS rma, o."orderNumber" AS order_number, rr.status, rr.resolution, '
                    'rr.reason, rr.comments, rr."refundAmount" AS refund_amount, rr."decisionNote" AS decision_note, '
                    'rr."refundedAt" AS refunded_at, rr."createdAt" AS requested_at FROM "ReturnRequest" rr '
                    'JOIN "Order" o ON o.id = rr."orderId" WHERE o."userId" = %s ORDER BY rr."createdAt" DESC LIMIT 10',
                    (customer_id,))
                for r in rows:
                    r["items"] = _rows(conn,
                        'SELECT oi."productName" AS product, ri.quantity, ri.condition FROM "ReturnItem" ri '
                        'JOIN "OrderItem" oi ON oi.id = ri."orderItemId" WHERE ri."returnRequestId" = %s', (r.pop("id"),))
                    r["return_page"] = _url(f"/account/returns/{r['rma']}")
                return rows
            if kind == "refunds":
                return _rows(conn,
                    'SELECT o."orderNumber" AS order_number, r.amount, o.currency, r.status, r.reason, p.method, '
                    'r."createdAt" AS at FROM "Refund" r JOIN "Payment" p ON p.id = r."paymentId" '
                    'JOIN "Order" o ON o.id = p."orderId" WHERE o."userId" = %s ORDER BY r."createdAt" DESC LIMIT 10',
                    (customer_id,))
            if kind == "points":
                return _rows(conn,
                    'SELECT pt.type, pt.points, pt.description, pt."expiresAt" AS expires_at, pt."createdAt" AS at '
                    'FROM "PointsTransaction" pt JOIN "LoyaltyAccount" la ON la.id = pt."accountId" '
                    'WHERE la."userId" = %s ORDER BY pt."createdAt" DESC LIMIT 15', (customer_id,))
            if kind == "reviews":
                return _rows(conn,
                    'SELECT p.name AS product, r.rating, r.title, r.status, r."vendorReply" AS seller_reply, '
                    'r."createdAt" AS at FROM "Review" r JOIN "Product" p ON p.id = r."productId" '
                    'WHERE r."userId" = %s ORDER BY r."createdAt" DESC LIMIT 10', (customer_id,))
            if kind == "questions":
                return _rows(conn,
                    'SELECT p.name AS product, q.body AS question, q.status, '
                    '(SELECT json_agg(json_build_object(\'answer\', a.body, \'by_seller\', a."isVendor")) '
                    'FROM "Answer" a WHERE a."questionId" = q.id) AS answers, q."createdAt" AS at '
                    'FROM "Question" q JOIN "Product" p ON p.id = q."productId" WHERE q."userId" = %s '
                    'ORDER BY q."createdAt" DESC LIMIT 10', (customer_id,))
            if kind == "gift_cards":
                return _rows(conn,
                    'SELECT \'…\' || right(code, 4) AS code_ending, balance, "initialBalance" AS initial_balance, currency, '
                    '"expiresAt" AS expires_at, "isActive" AS active FROM "GiftCard" '
                    'WHERE lower("recipientEmail") = lower(%s)', (email,))
            if kind == "coupons_used":
                return _rows(conn,
                    'SELECT c.code, cu.discount, o."orderNumber" AS order_number, cu."createdAt" AS at '
                    'FROM "CouponUsage" cu JOIN "Coupon" c ON c.id = cu."couponId" JOIN "Order" o ON o.id = cu."orderId" '
                    'WHERE cu."userId" = %s ORDER BY cu."createdAt" DESC LIMIT 10', (customer_id,))
            if kind == "stock_alerts":
                return _rows(conn,
                    'SELECT p.name AS product, v.name AS variant, sa."notifiedAt" AS notified_at FROM "StockAlert" sa '
                    'JOIN "ProductVariant" v ON v.id = sa."variantId" JOIN "Product" p ON p.id = v."productId" '
                    'WHERE sa."userId" = %s OR lower(sa.email) = lower(%s) LIMIT 10', (customer_id, email))
            if kind == "tickets":
                return _rows(conn,
                    'SELECT number, subject, status, priority, "createdAt" AS at FROM "Ticket" '
                    'WHERE "customerId" = %s OR lower(email) = lower(%s) ORDER BY "createdAt" DESC LIMIT 10',
                    (customer_id, email))
            if kind == "disputes":
                return _rows(conn,
                    'SELECT o."orderNumber" AS order_number, ve.name AS seller, d.reason, d.status, d.resolution, '
                    'd."createdAt" AS at FROM "Dispute" d JOIN "Order" o ON o.id = d."orderId" '
                    'JOIN "Vendor" ve ON ve.id = d."vendorId" WHERE d."customerId" = %s ORDER BY d."createdAt" DESC LIMIT 10',
                    (customer_id,))
        raise ValueError(kind)

    # ---------------- catalog (public)
    def search_products(self, query, category=None, brand=None, max_price=None, limit=6):
        words = [w for w in re.findall(r"\w+", query or "")[:4] if len(w) > 1]
        where, params = [], []
        for w in words:
            where.append('(p.name ILIKE %s OR p."shortDescription" ILIKE %s OR b.name ILIKE %s OR c.name ILIKE %s)')
            params += [f"%{w}%"] * 4
        if category:
            where.append("c.name ILIKE %s")
            params.append(f"%{category}%")
        if brand:
            where.append("b.name ILIKE %s")
            params.append(f"%{brand}%")
        if not where:
            return []
        sql = 'SELECT * FROM (SELECT ' + _PRODUCT_COLS + _PRODUCT_FROM + 'AND ' + ' AND '.join(where) + \
              ' ORDER BY p."soldCount" DESC LIMIT 30) x'
        if max_price:
            sql += " WHERE price <= %s"
            params.append(max_price)
        sql += " LIMIT %s"
        with _connect() as conn:
            return [_product_card(r) for r in _rows(conn, sql, (*params, limit))]

    def product(self, name_or_url):
        slug = name_or_url.rstrip("/").rsplit("/products/", 1)[-1] if "/products/" in name_or_url else None
        with _connect() as conn:
            row = _one(conn, 'SELECT ' + _PRODUCT_COLS + ', p.description, p.specifications, ve.policies AS seller_policies, '
                       've."ratingAverage" AS seller_rating ' + _PRODUCT_FROM +
                       ('AND p.slug = %s' if slug else 'AND p.name ILIKE %s ORDER BY p."soldCount" DESC') + ' LIMIT 1',
                       (slug or f"%{name_or_url}%",))
            if not row:
                return None
            pid = row["id"]
            row["description"] = (row["description"] or "")[:800]
            row["variants"] = _rows(conn,
                'SELECT v.name, v.sku, v.price, v."compareAtPrice" AS compare_at_price, '
                'COALESCE((SELECT SUM(sl.quantity - sl.reserved) FROM "StockLevel" sl JOIN "Warehouse" wh '
                'ON wh.id = sl."warehouseId" AND wh."isActive" WHERE sl."variantId" = v.id), 0) > 0 AS in_stock '
                'FROM "ProductVariant" v WHERE v."productId" = %s AND v."isActive" ORDER BY v.position', (pid,))
            row["latest_reviews"] = _rows(conn,
                'SELECT rating, title, left(body, 200) AS body FROM "Review" WHERE "productId" = %s '
                'AND status = \'APPROVED\' ORDER BY "createdAt" DESC LIMIT 3', (pid,))
            return _product_card(row)

    # ---------------- platform (public)
    def platform(self, topic):
        with _connect() as conn:
            if topic == "categories":
                rows = _rows(conn, 'SELECT c.name, c.slug, pc.name AS parent FROM "Category" c LEFT JOIN "Category" pc '
                             'ON pc.id = c."parentId" WHERE c."isActive" ORDER BY pc.name NULLS FIRST, c.position LIMIT 60')
                return [{**r, "url": _url(f"/categories/{r.pop('slug')}")} for r in rows]
            if topic == "brands":
                rows = _rows(conn, 'SELECT name, slug FROM "Brand" WHERE "isActive" ORDER BY name LIMIT 60')
                return [{**r, "url": _url(f"/brands/{r.pop('slug')}")} for r in rows]
            if topic == "sellers":
                rows = _rows(conn, 'SELECT name, slug, "ratingAverage" AS rating, left(description, 160) AS about '
                             'FROM "Vendor" WHERE status = \'APPROVED\' ORDER BY name LIMIT 60')
                return [{**r, "url": _url(f"/stores/{r.pop('slug')}")} for r in rows]
            if topic == "shipping":
                return _rows(conn,
                    'SELECT z.name AS zone, r.name AS option, r.type, r.price, r."freeAbove" AS free_above, '
                    'r."minOrderTotal" AS min_order, r."maxOrderTotal" AS max_order, r."codAvailable" AS cash_on_delivery, '
                    'r."codFee" AS cod_fee, r."estimatedDays" AS estimated_days, c.name AS courier '
                    'FROM "ShippingRate" r JOIN "ShippingZone" z ON z.id = r."zoneId" LEFT JOIN "Courier" c ON c.id = r."courierId" '
                    'WHERE r."isActive" AND z."isActive" ORDER BY z.name, r.price LIMIT 60')
            if topic == "currencies":
                return _rows(conn, 'SELECT code, "isDefault" AS is_base FROM "Currency" WHERE "isActive" ORDER BY "isDefault" DESC, code')
            if topic == "promotions":
                return _rows(conn, 'SELECT name, type, "startsAt" AS starts_at, "endsAt" AS ends_at FROM "Promotion" '
                             'WHERE "isActive" AND "startsAt" <= now() AND ("endsAt" IS NULL OR "endsAt" > now()) '
                             'ORDER BY priority DESC LIMIT 20')
        raise ValueError(topic)

    def coupon(self, code, customer_id=None):
        with _connect() as conn:
            row = _one(conn,
                'SELECT c.id, c.code, c.description, c."discountType" AS discount_type, c.value, '
                'c."minOrderTotal" AS min_order_total, c."maxDiscount" AS max_discount, c."usageLimit" AS usage_limit, '
                'c."usageLimitPerCustomer" AS per_customer_limit, c."usedCount" AS used, c."startsAt" AS starts_at, '
                'c."endsAt" AS ends_at, c."isActive" AS active, ve.name AS only_for_seller, '
                'c."isActive" AND (c."startsAt" IS NULL OR c."startsAt" <= now()) AND (c."endsAt" IS NULL OR c."endsAt" > now()) '
                'AND (c."usageLimit" IS NULL OR c."usedCount" < c."usageLimit") AS valid_now '
                'FROM "Coupon" c LEFT JOIN "Vendor" ve ON ve.id = c."vendorId" WHERE upper(c.code) = upper(%s)', (code,))
            if row and customer_id:
                row["times_you_used_it"] = _one(conn, 'SELECT count(*) AS n FROM "CouponUsage" WHERE "couponId" = %s '
                                                'AND "userId" = %s', (row["id"], customer_id))["n"]
            if row:
                row.pop("id")
            return row
