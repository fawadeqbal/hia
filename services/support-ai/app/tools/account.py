"""The get_my_account tool: the signed-in customer's profile and account at a glance."""
from app.core.caller import customer
from app.db.store import StoreRepository

SPEC = {
    "name": "get_my_account",
    "description": (
        "The signed-in customer's account: name, email, phone, whether the email is verified, Google sign-in or password, "
        "account status, member since, last sign-in, saved addresses, order count and total spent, loyalty points, tier "
        "and referral code, email / newsletter preferences, current cart, wishlist, and links to each account page. "
        "Use it to greet them by name, answer 'what is my ...' questions, and understand their situation before helping."
    ),
    "parameters": {"type": "object", "properties": {}},
}

_store = StoreRepository()


def run(arguments):
    who = customer()
    if not who.get("id"):
        return {"error": "The customer is not signed in. Ask them to sign in to see account details."}
    return _store.account(who["id"]) or {"error": "Account not found."}
