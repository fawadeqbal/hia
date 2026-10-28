"""The store_info tool: public platform data (categories, brands, sellers, shipping options, currencies, promotions)."""
from app.db.store import StoreRepository

TOPICS = ("categories", "brands", "sellers", "shipping", "currencies", "promotions")

SPEC = {
    "name": "store_info",
    "description": (
        "Live public information about the platform. topic: categories, brands, sellers (approved shops with rating and "
        "link), shipping (delivery zones and options: price, free-above amount, cash on delivery and its fee, estimated "
        "days, courier), currencies (base and display currencies), promotions (running now)."
    ),
    "parameters": {
        "type": "object",
        "properties": {"topic": {"type": "string", "enum": list(TOPICS)}},
        "required": ["topic"],
    },
}

_store = StoreRepository()


def run(arguments):
    topic = arguments.get("topic")
    if topic not in TOPICS:
        return {"error": f"topic must be one of {', '.join(TOPICS)}"}
    return {topic: _store.platform(topic)}
