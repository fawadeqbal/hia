"""
Who the assistant is talking to, for the tools. The API sends X-Customer-Id / X-Customer-Email
(trusted: the request carries the service key). The generate node sets it before the model runs,
so tools called during that answer read it.
"""
from contextvars import ContextVar

_customer = ContextVar("customer", default=None)


def set_customer(customer):
    _customer.set(customer or None)


def customer():
    """{"id": ..., "email": ...} for a signed-in customer, else {}."""
    return _customer.get() or {}
