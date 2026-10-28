"""The check_coupon tool: is a coupon code valid, and what are its rules? (Codes are never listed.)"""
from app.core.caller import customer
from app.db.store import StoreRepository

SPEC = {
    "name": "check_coupon",
    "description": (
        "Check a coupon code the customer gives: whether it is valid right now, discount type and value, minimum order, "
        "maximum discount, dates, usage limits, whether it only works for one seller, and how often this customer used it. "
        "Use it when a code does not work at checkout."
    ),
    "parameters": {
        "type": "object",
        "properties": {"code": {"type": "string"}},
        "required": ["code"],
    },
}

_store = StoreRepository()


def run(arguments):
    code = str(arguments.get("code", "")).strip()[:50]
    if not code:
        return {"error": "Ask the customer for the coupon code."}
    return _store.coupon(code, customer().get("id")) or {"error": f"There is no coupon {code}."}
