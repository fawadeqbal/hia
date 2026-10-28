"""Opening database connections."""
import psycopg
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo
from psycopg.rows import dict_row
from pgvector.psycopg import register_vector

from app.core import config


def _open(retry=True):
    try:
        return psycopg.connect(config.DATABASE_URL, autocommit=True, row_factory=dict_row,
                               connect_timeout=5)
    except psycopg.OperationalError as e:
        if retry and "does not exist" in str(e):   # first start: create this service's database, then retry
            ensure_database()
            return _open(retry=False)
        raise SystemExit(f"Can't reach Postgres at SUPPORT_AI_DATABASE_URL ({e}).\n"
                         "Start it from the monorepo root:  pnpm infra:up") from None


def connect():
    """Rows come back as dicts, vectors as numpy arrays. Use as: with connect() as conn: ..."""
    conn = _open()
    register_vector(conn)
    return conn


def ensure_database():
    """Create this service's own database on first start (the dev Postgres user may create databases)."""
    try:
        psycopg.connect(config.DATABASE_URL, connect_timeout=5).close()
        return
    except psycopg.OperationalError as e:
        if "does not exist" not in str(e):
            return   # _open() reports the real problem
    name = conninfo_to_dict(config.DATABASE_URL)["dbname"]
    with psycopg.connect(make_conninfo(config.DATABASE_URL, dbname="postgres"), autocommit=True) as conn:
        conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))


def connect_plain():
    """Without the vector type (used by migrations, before the extension may exist)."""
    return _open()
