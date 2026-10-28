"""
The open_support_ticket tool: the assistant hands the chat to the human support team.

The model calls it when the customer wants a person, or when the handbook says the problem
needs the support team (payment deducted, damaged item, late refund, locked account...).
Nothing is created here: the chat panel shows how to reach the support team
and the ticket opens when the customer sends it (POST /api/handoff).
"""
SPEC = {
    "name": "open_support_ticket",
    "description": (
        "Transfer the customer to the human support team by showing the contact option in the chat. "
        "Use it when the customer asks to talk to a person, human, agent, the support team or customer service "
        "(in any language, e.g. 'agent se baat karni hai'), or when their problem needs store staff according "
        "to the handbook (money deducted but no order after 7 working days, damaged, wrong or missing items, "
        "a late refund, an account they cannot access, or a complaint). After calling it, tell the customer to "
        "use the contact link shown below and to include their order number."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "reason": {"type": "string", "description": "One short sentence: why the customer needs a person."}
        },
        "required": ["reason"],
    },
}


def run(arguments):
    return {
        "contact_shown": True,
        "next_step": "A link to contact the support team is now shown below your reply. Ask the customer to use it "
                     "and to include their order number if they have one.",
        "reason": str(arguments.get("reason", ""))[:200],
    }
