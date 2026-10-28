-- 005_store_orders.sql: orders now come from the store database (app/db/store.py); drop the demo table.
DROP TABLE IF EXISTS orders;
