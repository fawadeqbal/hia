"""The search_products tool: find published products (price, stock, rating, brand, seller, link)."""
from app.db.store import StoreRepository

SPEC = {
    "name": "search_products",
    "description": (
        "Search the catalog by keywords, optionally limited to a category, brand or maximum price. Returns up to 6 "
        "products with price, compare-at price, currency, rating and review count, brand, category, seller, whether "
        "they are in stock, and links. Use it when the customer asks if something is sold, available, what it costs, "
        "or wants a recommendation."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Keywords, e.g. wireless earbuds"},
            "category": {"type": "string"},
            "brand": {"type": "string"},
            "max_price": {"type": "number"},
        },
        "required": ["query"],
    },
}

_store = StoreRepository()


def run(arguments):
    rows = _store.search_products(str(arguments.get("query", ""))[:100], arguments.get("category"),
                                  arguments.get("brand"), arguments.get("max_price"))
    return {"products": rows} if rows else {"products": [], "note": "No matching products in the store."}
