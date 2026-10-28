"""The get_product tool: full details of one product."""
from app.db.store import StoreRepository

SPEC = {
    "name": "get_product",
    "description": (
        "Full details of one product by name or product link: description, specifications, every variant with price and "
        "stock, brand, category, seller with rating and the seller's own policies (returns, warranty), rating and the "
        "latest reviews. Use it for questions about a specific product."
    ),
    "parameters": {
        "type": "object",
        "properties": {"product": {"type": "string", "description": "Product name or its /products/... link"}},
        "required": ["product"],
    },
}

_store = StoreRepository()


def run(arguments):
    row = _store.product(str(arguments.get("product", ""))[:200])
    return row or {"error": "No published product matches that name."}
