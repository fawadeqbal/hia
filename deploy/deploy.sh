#!/usr/bin/env bash
# Generic deploy for any Linux server with Docker (Ubuntu, Debian, CentOS, …).
#
#   IMAGE=ghcr.io/<owner>/<repo>:<tag> ./deploy.sh          deploy (pull, swap, health check, auto-rollback)
#   ./deploy.sh rollback                                     go back to the previous image
#   ./deploy.sh status | logs                                inspect
#
# Server setup (once):
#   1. Install Docker.
#   2. mkdir -p /opt/ecommerce && copy deploy/.env.production.example to /opt/ecommerce/.env and fill it in.
#   3. Put a reverse proxy in front (deploy/nginx.conf.example) or set BIND_ADDR=0.0.0.0.
#
# Options (env):
#   APP_DIR=/opt/ecommerce        where .env and state live
#   CONTAINER=ecommerce-app
#   BIND_ADDR=127.0.0.1           host address the ports are published on
#   DEPLOY_INFRA=false            true = also run Postgres + Redis containers on this server
#   HEALTH_TIMEOUT=180            seconds to wait for the container to become healthy
#   RUN_SEED=false                pass true on the very first deploy for demo data
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/ecommerce}
CONTAINER=${CONTAINER:-ecommerce-app}
NETWORK=${NETWORK:-ecommerce}
BIND_ADDR=${BIND_ADDR:-127.0.0.1}
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-180}
ENV_FILE="$APP_DIR/.env"
STATE_FILE="$APP_DIR/.deployed-images"   # one image per line, newest last

log() { echo "[deploy] $*"; }
die() { echo "[deploy] ERROR: $*" >&2; exit 1; }

command -v docker >/dev/null || die "docker is not installed"
mkdir -p "$APP_DIR"
docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create "$NETWORK" >/dev/null

start_infra() {
  # Simple single-server Postgres + Redis. Use managed services for serious production.
  set -a; . "$ENV_FILE"; set +a
  if ! docker ps -a --format '{{.Names}}' | grep -qx ecommerce-postgres; then
    log "starting postgres"
    docker run -d --name ecommerce-postgres --network "$NETWORK" --restart unless-stopped \
      -e POSTGRES_USER="${POSTGRES_USER:-ecommerce}" \
      -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}" \
      -e POSTGRES_DB="${POSTGRES_DB:-ecommerce}" \
      -v ecommerce-pgdata:/var/lib/postgresql/data postgres:16-alpine >/dev/null
  fi
  if ! docker ps -a --format '{{.Names}}' | grep -qx ecommerce-redis; then
    log "starting redis"
    docker run -d --name ecommerce-redis --network "$NETWORK" --restart unless-stopped \
      -v ecommerce-redisdata:/data redis:7-alpine redis-server --appendonly yes >/dev/null
  fi
}

run_container() {
  local image=$1
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  docker run -d --name "$CONTAINER" --network "$NETWORK" --restart unless-stopped \
    --env-file "$ENV_FILE" \
    -e RUN_SEED="${RUN_SEED:-false}" \
    -p "$BIND_ADDR:3000:3000" -p "$BIND_ADDR:3001:3001" \
    -p "$BIND_ADDR:3002:3002" -p "$BIND_ADDR:4000:4000" \
    --log-opt max-size=20m --log-opt max-file=5 \
    "$image" >/dev/null
}

wait_healthy() {
  local waited=0 status
  while [ "$waited" -lt "$HEALTH_TIMEOUT" ]; do
    status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$CONTAINER" 2>/dev/null || echo missing)
    case "$status" in
      healthy) return 0 ;;
      exited|dead|missing) return 1 ;;
    esac
    sleep 5; waited=$((waited + 5))
  done
  return 1
}

previous_image() { [ -f "$STATE_FILE" ] && tail -n 2 "$STATE_FILE" | head -n 1 || true; }
current_image() { [ -f "$STATE_FILE" ] && tail -n 1 "$STATE_FILE" || true; }

deploy() {
  local image=${IMAGE:?set IMAGE=registry/repo:tag}
  [ -f "$ENV_FILE" ] || die "$ENV_FILE not found (copy deploy/.env.production.example)"
  [ "${DEPLOY_INFRA:-false}" = "true" ] && start_infra

  log "pulling $image"
  docker pull "$image"

  local last; last=$(current_image)
  log "starting new container"
  run_container "$image"

  if wait_healthy; then
    echo "$image" >> "$STATE_FILE"
    tail -n 10 "$STATE_FILE" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
    log "healthy: $image"
    docker image prune -f >/dev/null || true
  else
    log "new container is NOT healthy — last logs:"
    docker logs --tail 80 "$CONTAINER" || true
    if [ -n "$last" ]; then
      log "rolling back to $last"
      run_container "$last"
      wait_healthy && log "rollback healthy" || log "rollback also unhealthy, check the server"
    fi
    exit 1
  fi
}

rollback() {
  local prev; prev=$(previous_image)
  [ -n "$prev" ] && [ "$prev" != "$(current_image)" ] || die "no previous image recorded"
  log "rolling back to $prev"
  run_container "$prev"
  wait_healthy || die "rollback container is not healthy"
  sed -i '$ d' "$STATE_FILE"
  log "rolled back"
}

case "${1:-deploy}" in
  deploy)   deploy ;;
  rollback) rollback ;;
  status)   docker ps --filter "name=$CONTAINER"; echo "current: $(current_image)" ;;
  logs)     docker logs -f --tail 200 "$CONTAINER" ;;
  *) die "usage: deploy.sh [deploy|rollback|status|logs]" ;;
esac
