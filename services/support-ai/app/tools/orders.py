"""
The lookup_order tool: everything about one order (or the customer's order list), live from the store database.

Signed-in customers: their own orders; without a number they get their recent orders.
Guests: the order number AND the email used at checkout, so nobody can read a stranger's order.
"""
import json
import re

from app.core.caller import customer
from app.db.store import StoreRepository

ORDER_NUMBER = re.compile(r"\bORD-\d{6}-[A-Z0-9]{4,8}\b", re.I)

SPEC = {
    "name": "lookup_order",
    "description": (
        "Everything about the customer's orders. With an order number: status, each seller's part with its own status, "
        "shipments (courier, tracking number and tracking link, shipped / delivered dates), items, price breakdown "
        "(subtotal, discount, coupon, shipping, tax, gift card, points, total), payments and their status, refunds, "
        "returns, invoices, the status timeline, whether it can still be cancelled, the delivery address and the order "
        "page link. Without a number (signed-in customers only): their 10 most recent orders. "
        "Guests must give the order number and the email they used at checkout."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "order_number": {"type": "string", "description": "e.g. ORD-261011-7K2QX (optional when signed in)"},
            "email": {"type": "string", "description": "Checkout email (guests only)"},
        },
    },
}

_store = StoreRepository()


def lookup_order(order_number="", email=""):
    who = customer()
    number = str(order_number or "").strip().upper()
    if not number:
        if who.get("id"):
            return {"recent_orders": _store.recent_orders(who["id"])}
        return {"error": "Ask the customer for the order number and the email used at checkout, or to sign in."}
    if not ORDER_NUMBER.fullmatch(number):
        return {"error": "That doesn't look like an order number. It looks like ORD-261011-7K2QX."}
    if not who.get("id") and not str(email or "").strip():
        return {"error": "Ask the customer for the email used at checkout (or to sign in)."}
    row = _store.order(number, who.get("id"), str(email or "").strip())
    return row or {"error": f"No order {number} found for this customer."}


def run(arguments):
    return lookup_order(arguments.get("order_number", ""), arguments.get("email", ""))


def prefetch(question):
    """For models WITHOUT tool calling: look up an order number found in the message (signed-in customers)."""
    found = ORDER_NUMBER.search(question)
    if not found or not customer().get("id"):
        return ""
    return f"Order lookup result for {found.group(0)}: {json.dumps(lookup_order(found.group(0)), default=str)}"
