#!/usr/bin/env bash
# Starts every app of the platform in one container.
# If any process dies, the others are stopped and the container exits (Docker's restart policy brings it back).
#
# Env:
#   RUN_MIGRATIONS=true   apply Prisma migrations before starting (default true)
#   RUN_SEED=false        run the idempotent seed (first deploy / demo servers)
#   APPS="api worker web admin vendor"   subset to start (e.g. "api worker")
set -uo pipefail
cd /app

DB_DIR=/app/packages/database

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] applying database migrations"
  (cd "$DB_DIR" && ./node_modules/.bin/prisma migrate deploy) || { echo "[entrypoint] migrations failed"; exit 1; }
fi

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "[entrypoint] seeding database"
  (cd "$DB_DIR" && ./node_modules/.bin/tsx prisma/seed.ts) || echo "[entrypoint] WARNING: seed failed - starting the apps anyway"
fi

pids=()

# run <name> <dir> <command...>  — starts a process with prefixed logs
run() {
  local name=$1 dir=$2
  shift 2
  (cd "$dir" && exec "$@") > >(sed -u "s/^/[$name] /") 2>&1 &
  pids+=($!)
  echo "[entrypoint] started $name (pid $!)"
}

next_app() {
  local name=$1 port=$2
  run "$name" "apps/$name/.next/standalone/apps/$name" env PORT="$port" HOSTNAME=0.0.0.0 node server.js
}

for app in ${APPS:-api worker web admin vendor}; do
  case "$app" in
    api)    run api apps/api node dist/main.js ;;
    worker) run worker apps/worker node dist/main.js ;;
    web)    next_app web 3000 ;;
    admin)  next_app admin 3001 ;;
    vendor) next_app vendor 3002 ;;
    *) echo "[entrypoint] unknown app: $app"; exit 1 ;;
  esac
done

shutdown() {
  echo "[entrypoint] stopping all processes"
  kill -TERM "${pids[@]}" 2>/dev/null || true
  wait
}
trap 'shutdown; exit 0' TERM INT

wait -n "${pids[@]}"
code=$?
echo "[entrypoint] a process exited with code $code"
shutdown
exit "$code"
