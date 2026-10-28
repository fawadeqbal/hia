-- Runs once when the Postgres volume is first created.
-- Extensions are NOT created here: Prisma creates them in migrations
-- (schema.prisma -> extensions = [pg_trgm]). Creating them here causes
-- "Drift detected" on the first `prisma migrate dev`.
SELECT 1;
