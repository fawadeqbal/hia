# Support assistant (services/support-ai)

The customer-support chat of the store: Flask API + LangGraph workflow + RAG (PostgreSQL + pgvector).
Imported from the standalone RAG project; the browser never calls it directly. The NestJS API proxies it at
`/api/v1/support/assistant/*` (see `docs/architecture.md` → Support assistant) and the storefront shows the chat
widget (`apps/web/src/components/support`). Models are replaceable: Claude, Ollama, OpenAI, ... see [docs/PROVIDERS.md](docs/PROVIDERS.md).

## What it knows

| Source | What | Updated |
| --- | --- | --- |
| `data/store_handbook.md` | How the store works: accounts, ordering, payments, statuses, tracking, cancelling, returns, refunds, points … | Edit the file, re-run ingest |
| Store database (read at ingest) | Admin settings (contact, payment limits, shipping, return window, points), published CMS pages, active FAQs | Re-run ingest after changing them |
| Tools (live, per question) | `get_my_account` (profile, addresses, points, cart, wishlist, preferences), `lookup_order` (everything about an order; guests: number + checkout email), `get_my_activity` (returns, refunds, points, reviews, questions, gift cards, coupons used, stock alerts, tickets, disputes), `search_products`, `get_product`, `store_info` (categories, brands, sellers, shipping options, currencies, promotions), `check_coupon` | Always current |

Store data is only read: fixed, customer-scoped queries over a read-only connection (`app/db/store.py`).
Any `.pdf` or `.md` file added to `data/` is ingested too.

## Layout

```
services/support-ai/
├── app/
│   ├── main.py                 Flask app factory: create_app()
│   ├── core/                   config.py (settings) · container.py (builds the real parts) · logging.py · security.py
│   ├── api/                    HTTP only: parse request -> run graph / repository -> respond
│   │   ├── chat.py             POST /api/chat, /api/chat/stream
│   │   ├── conversations.py    list / open / delete chats
│   │   ├── feedback.py         feedback + "talk to a person"
│   │   ├── admin.py            health + stats
│   │   ├── schemas.py          request validation (Pydantic)
│   │   └── common.py           shared helpers
│   ├── graph/                  the LangGraph workflow (docs/WORKFLOW.md)
│   │   ├── state.py · deps.py · events.py · edges.py · graph.py · studio.py
│   │   └── nodes/              memory · router · retrieval · generation · handoff
│   ├── prompts/                system.md · rewrite_query.md · summarize.md · handoff_reply.md
│   ├── tools/                  registry.py · account · orders · activity · products · product_detail · platform · coupons · support
│   ├── rag/
│   │   ├── ingestion/          loaders (PDF, Markdown) · cleaning · chunking · store_docs (live store facts) · pipeline
│   │   ├── retrieval.py        embed -> hybrid search -> filter -> rerank
│   │   └── generation.py       query rewriting, streamed answers with tools, summaries
│   ├── providers/              replaceable models: base interfaces, factory, Claude, OpenAI-compatible, embeddings, rerankers
│   ├── stores/pgvector.py      the knowledge-base table + hybrid search
│   └── db/
│       ├── connection.py · migrate.py
│       ├── store.py            read-only store look-ups (orders, products, settings)
│       ├── migrations/         numbered SQL files
│       └── repositories/       conversations · feedback · tickets
├── scripts/                    ingest · evaluate · chat · migrate
├── tests/                      pytest: chunking, graph routes, API contract, providers
├── data/ · eval/ · docs/
├── langgraph.json              LangGraph Studio
├── pyproject.toml · requirements.txt · requirements-dev.txt
└── Dockerfile · .env
```

## Run locally

Everything is configured in the monorepo `.env` (see `.env.example` → Support assistant). Postgres must have
pgvector: the root `docker compose up -d` uses `pgvector/pgvector:pg16`. From this folder:

```bash
python -m venv .venv && source .venv/Scripts/activate   # Windows Git Bash (Linux/macOS: .venv/bin/activate)
pip install -r requirements-dev.txt
pytest                               # no database or API key needed
python -m scripts.ingest --preview   # look at the chunks
python -m scripts.ingest             # build the knowledge base (re-run when the handbook or store settings change)
python -m scripts.evaluate --sweep   # how well does retrieval work? (eval/questions.json)
python -m app.main                   # API on http://localhost:5000 (internal; the NestJS API calls it)
python -m scripts.chat               # or chat in the terminal
```

Its own tables live in a separate database (`SUPPORT_AI_DATABASE_URL`, created on first start); migrations run on startup.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Status, number of chunks, active providers |
| GET | `/api/conversations` | This visitor's chats |
| GET | `/api/conversations/<id>/messages` | Messages of one chat |
| DELETE | `/api/conversations/<id>` | Delete a chat |
| POST | `/api/chat/stream` | Ask a question; answer streams back (SSE: step, meta, tool, delta, done) |
| POST | `/api/chat` | Same, whole answer at once |
| POST | `/api/messages/<id>/feedback` | `{"value": "up" \| "down" \| null}` |
| POST | `/api/handoff` | "Talk to a person" ticket |
| GET | `/api/admin/stats` | Usage numbers (`Authorization: Bearer ADMIN_TOKEN`) |

Every request comes from the NestJS API with `X-Service-Key` (= `SUPPORT_AI_KEY`), `X-Visitor-Id` (guest browser id, or a stable id
per signed-in customer) and `X-Customer-Id` / `X-Customer-Email` for signed-in customers. Requests without the key get 401.
