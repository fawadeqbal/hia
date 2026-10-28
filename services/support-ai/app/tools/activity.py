"""The get_my_activity tool: one area of the signed-in customer's history."""
from app.core.caller import customer
from app.db.store import StoreRepository

_store = StoreRepository()

SPEC = {
    "name": "get_my_activity",
    "description": (
        "One area of the signed-in customer's history. kind: returns (RMA number, status, items, refund, seller's note), "
        "refunds, points (loyalty points earned / redeemed / expiring), reviews (with seller replies), questions (with answers), "
        "gift_cards (balance of gift cards sent to them), coupons_used, stock_alerts ('notify me' requests), "
        "tickets (support tickets), disputes."
    ),
    "parameters": {
        "type": "object",
        "properties": {"kind": {"type": "string", "enum": list(StoreRepository.ACTIVITY)}},
        "required": ["kind"],
    },
}


def run(arguments):
    who = customer()
    if not who.get("id"):
        return {"error": "The customer is not signed in. Ask them to sign in to see this."}
    kind = arguments.get("kind")
    if kind not in StoreRepository.ACTIVITY:
        return {"error": f"kind must be one of {', '.join(StoreRepository.ACTIVITY)}"}
    return {kind: _store.activity(who["id"], kind)}
