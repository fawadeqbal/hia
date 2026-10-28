#!/usr/bin/env bash
# =====================================================================
#  deploy/server.sh — deploy Ecommerce to the shared server (one command)
#
#  From Git Bash, in the repo root:   bash deploy/server.sh
#
#  Same pattern as RAG / LiverLens, so the other sites are never touched:
#    1. pack the repo and upload it to ~/ecommerce, upload .env.server
#    2. start ecommerce-db, ecommerce-redis, ecommerce-minio (private network)
#    3. build + start ecommerce-app (storefront, admin, seller, API, worker)
#       and ecommerce-support — no host ports, only the shared nginx network
#    4. make the media bucket publicly readable
#    5. one certificate for the 5 domains (first time / when domains change)
#    6. add our nginx blocks to chat-nest-nginx between markers, with a backup and
#       `nginx -t` before reloading (restores the backup if the test fails)
#
#  Safe to run again after every change.
# =====================================================================
set -euo pipefail

SERVER="${SERVER:-pingcrood-server}"          # ssh host from ~/.ssh/config (same as RAG)
REMOTE_DIR="ecommerce"
NGINX_CONTAINER="chat-nest-nginx"
NGINX_CONF="/home/opc/chat-nest-backend/nginx/nginx.conf"
CERT_NAME="shop.fawadiqbal.dev"
D_WEB="shop.fawadiqbal.dev"
D_ADMIN="admin.shop.fawadiqbal.dev"
D_SELLER="seller.shop.fawadiqbal.dev"
D_API="api.shop.fawadiqbal.dev"
D_MEDIA="media.shop.fawadiqbal.dev"
DOMAINS=("$D_WEB" "$D_ADMIN" "$D_SELLER" "$D_API" "$D_MEDIA")
BLOCK_START="# >>> ecommerce (written by ecommerce deploy/server.sh — edit there, not here)"
BLOCK_END="# <<< ecommerce"
BLOCK_VERSION="ecommerce-nginx v1"            # bump when nginx_block() changes

say()  { printf '\n\033[1;35m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }
env_value() {
  { grep -E "^$2=" "$1" || true; } | tail -1 | cut -d= -f2- | sed -e 's/[[:space:]]#.*$//' -e 's/\r$//' \
    -e 's/^["'"'"']//' -e 's/["'"'"']$//' | xargs
}

check_env() {
  local f="$1" v
  [ -f "$f" ] || fail "No $f. Create it: cp deploy/env.server.example .env.server and fill it in."
  for key in POSTGRES_PASSWORD JWT_ACCESS_SECRET S3_SECRET_KEY SUPPORT_AI_KEY PAYMENT_ENCRYPTION_KEY SEED_ADMIN_PASSWORD; do
    v="$(env_value "$f" "$key")"
    [ -n "$v" ] || fail "$key is empty in $f."
    case "$v" in CHANGE_ME*) fail "$key in $f is still a placeholder (openssl rand -hex 24).";; esac
    [ "${#v}" -ge 12 ] || fail "$key in $f is too short."
  done
  local pw; pw="$(env_value "$f" POSTGRES_PASSWORD)"
  env_value "$f" DATABASE_URL | grep -qF ":$pw@" || fail "DATABASE_URL in $f must use POSTGRES_PASSWORD."
  echo "$f looks good"
}

# ---------------------------------------------------------------------
#  PART A — your PC
# ---------------------------------------------------------------------
local_part() {
  cd "$(dirname "$0")/.."
  [ -f deploy/docker-compose.server.yml ] || fail "Run this from the Ecommerce repo."
  check_env .env.server

  say "Packing the project"
  local pkg; pkg="$(mktemp -t ecommerce-XXXX).tgz"
  tar --exclude=node_modules --exclude=.next --exclude=dist --exclude=.turbo --exclude=.git \
      --exclude='.env*' --exclude='*.exe' --exclude=__pycache__ --exclude=.venv --exclude=coverage \
      -czf "$pkg" .
  say "Uploading to $SERVER:~/$REMOTE_DIR ($(du -h "$pkg" | cut -f1))"
  ssh "$SERVER" "mkdir -p ~/$REMOTE_DIR"
  scp -q "$pkg" "$SERVER:~/ecommerce-upload.tgz"
  rm -f "$pkg"
  ssh "$SERVER" "tar xzf ~/ecommerce-upload.tgz -C ~/$REMOTE_DIR && rm ~/ecommerce-upload.tgz"

  say "Uploading .env.server"
  local envtmp; envtmp="$(mktemp)"
  tr -d '\r' < .env.server > "$envtmp"
  scp -q "$envtmp" "$SERVER:~/$REMOTE_DIR/.env.server.new"
  rm -f "$envtmp"
  ssh "$SERVER" "chmod 600 ~/$REMOTE_DIR/.env.server.new"

  say "Running the deployment on the server"
  ssh -t "$SERVER" "bash ~/$REMOTE_DIR/deploy/server.sh --remote"
}

# ---------------------------------------------------------------------
#  PART B — the server
# ---------------------------------------------------------------------
dc() { docker compose -f deploy/docker-compose.server.yml --env-file .env.server "$@"; }

remote_part() {
  cd ~/"$REMOTE_DIR"

  # ---- 1. settings ----
  if [ -f .env.server.new ]; then
    if [ -f .env.server ] && docker volume inspect ecommerce_pgdata >/dev/null 2>&1 \
       && [ "$(env_value .env.server POSTGRES_PASSWORD)" != "$(env_value .env.server.new POSTGRES_PASSWORD)" ]; then
      rm -f .env.server.new
      fail "POSTGRES_PASSWORD changed, but the database was created with the old one. Put the old value back
(server: grep POSTGRES_PASSWORD ~/$REMOTE_DIR/.env.server)."
    fi
    mv .env.server.new .env.server
    chmod 600 .env.server
  fi
  [ -f .env.server ] || fail "No .env.server on the server."
  docker network inspect chat-nest-backend_default >/dev/null 2>&1 \
    || fail "Network chat-nest-backend_default not found — is chat-nest-nginx running?"

  # ---- 2. data services ----
  say "Starting ecommerce-db, ecommerce-redis, ecommerce-minio"
  dc up -d ecommerce-db ecommerce-redis ecommerce-minio
  for c in ecommerce-db ecommerce-redis; do
    for _ in $(seq 1 40); do
      [ "$(docker inspect -f '{{.State.Health.Status}}' "$c" 2>/dev/null)" = healthy ] && break
      sleep 3
    done
    [ "$(docker inspect -f '{{.State.Health.Status}}' "$c")" = healthy ] || fail "$c is not healthy. See: docker logs $c"
  done
  # minio: checked over HTTP so it works with any MinIO image
  for _ in $(seq 1 40); do
    docker exec "$NGINX_CONTAINER" wget -qO- http://ecommerce-minio:9000/minio/health/live >/dev/null 2>&1 && break
    sleep 3
  done
  docker exec "$NGINX_CONTAINER" wget -qO- http://ecommerce-minio:9000/minio/health/live >/dev/null 2>&1 \
    || fail "ecommerce-minio is not ready. See: docker logs ecommerce-minio"
  # support assistant's own database (once)
  docker exec ecommerce-db psql -U ecommerce -d ecommerce -tAc "SELECT 1 FROM pg_database WHERE datname='support_ai'" | grep -q 1 \
    || docker exec ecommerce-db psql -U ecommerce -d ecommerce -c "CREATE DATABASE support_ai" >/dev/null

  # ---- 4. build + start the apps ----
  say "Building ecommerce-app and ecommerce-support (slow the first time)"
  # one at a time (shares the server's bandwidth), retried on network hiccups
  local svc try
  for svc in ecommerce-support ecommerce-app; do
    for try in 1 2 3; do
      dc build "$svc" && break
      [ "$try" = 3 ] && fail "Building $svc failed 3 times. Re-run the deploy; finished steps are cached."
      echo "Build of $svc failed (attempt $try) - retrying in 15s..."; sleep 15
    done
  done
  say "Starting everything"
  dc up -d
  local ok=""
  # migrations + seed + 5 processes on 2 cores: allow up to 6 minutes
  for _ in $(seq 1 120); do
    if docker exec "$NGINX_CONTAINER" wget -qO- http://ecommerce-app:4000/health >/dev/null 2>&1; then ok=1; break; fi
    sleep 3
  done
  if [ -z "$ok" ]; then
    echo "---- last 60 lines of ecommerce-app ----"
    docker logs --tail 60 ecommerce-app 2>&1 || true
    fail "ecommerce-app is not answering (log above)."
  fi

  # ---- media bucket, publicly readable (uses the API's S3 client, no mc needed) ----
  local js
  js=$(cat <<'JS'
const { S3Client, CreateBucketCommand, PutBucketPolicyCommand } = require('@aws-sdk/client-s3');
const e = process.env, b = e.S3_BUCKET;
const s3 = new S3Client({ endpoint: e.S3_ENDPOINT, region: e.S3_REGION || 'us-east-1', forcePathStyle: true,
  credentials: { accessKeyId: e.S3_ACCESS_KEY, secretAccessKey: e.S3_SECRET_KEY } });
(async () => {
  try { await s3.send(new CreateBucketCommand({ Bucket: b })); }
  catch (x) { if (!/BucketAlready/.test(x.name)) throw x; }
  await s3.send(new PutBucketPolicyCommand({ Bucket: b, Policy: JSON.stringify({ Version: '2012-10-17',
    Statement: [{ Effect: 'Allow', Principal: { AWS: ['*'] }, Action: ['s3:GetObject'], Resource: ['arn:aws:s3:::' + b + '/*'] }] }) }));
  console.log('Bucket ' + b + ' ready (public read)');
})().catch((x) => { console.error(x); process.exit(1); });
JS
)
  docker exec -w /app/apps/api ecommerce-app node -e "$js" || fail "Could not set up the media bucket"
  echo "API health: $(docker exec "$NGINX_CONTAINER" wget -qO- http://ecommerce-app:4000/health)"

  # ---- 5. certificate (one cert for all 5 domains) ----
  local have=""
  have="$(sudo sh -c "openssl x509 -noout -text -in /etc/letsencrypt/live/$CERT_NAME/fullchain.pem 2>/dev/null" || true)"
  local missing=()
  for d in "${DOMAINS[@]}"; do echo "$have" | grep -q "DNS:$d" || missing+=("$d"); done
  if [ "${#missing[@]}" -gt 0 ]; then
    say "Getting an SSL certificate for: ${DOMAINS[*]}"
    for d in "${DOMAINS[@]}"; do
      # ask public DNS (what Let's Encrypt sees), not the server's possibly stale cache
      local ip=""
      for ns in 1.1.1.1 8.8.8.8; do
        ip="$(dig +short A "$d" @"$ns" 2>/dev/null | tail -n1)"
        [ -z "$ip" ] && ip="$(nslookup "$d" "$ns" 2>/dev/null | awk '/^Address: /{a=$2} END{print a}')"
        [ -n "$ip" ] && break
      done
      [ -z "$ip" ] && ip="$(getent hosts "$d" | awk '{print $1; exit}')"
      [ -n "$ip" ] || fail "$d does not resolve yet. Add the A record in Namecheap, wait, run again."
      echo "  $d -> $ip"
    done
    local auth
    auth="$(sudo sh -c 'grep -h "^authenticator" /etc/letsencrypt/renewal/*.conf 2>/dev/null' | head -1 | awk -F'= *' '{print $2}')"
    [ -z "$auth" ] || [ "$auth" = standalone ] || fail "Existing certificates use '$auth', not standalone."
    echo "nginx stops for ~30 seconds while the certificate is issued (all sites briefly offline)."
    local args=(); for d in "${DOMAINS[@]}"; do args+=(-d "$d"); done
    trap 'docker start '"$NGINX_CONTAINER"' >/dev/null' EXIT
    sudo certbot certonly --standalone --cert-name "$CERT_NAME" --expand "${args[@]}" \
      --non-interactive --agree-tos --register-unsafely-without-email \
      --pre-hook "docker stop $NGINX_CONTAINER" --post-hook "docker start $NGINX_CONTAINER"
    docker start "$NGINX_CONTAINER" >/dev/null
    trap - EXIT
  fi

  # ---- 6. nginx: our blocks between markers (other sites untouched) ----
  if ! grep -qF "$BLOCK_VERSION" "$NGINX_CONF"; then
    local backup tmp
    backup="$HOME/nginx.conf.backup-$(date +%Y%m%d-%H%M%S)"
    cp "$NGINX_CONF" "$backup"
    tmp="$(mktemp)"
    awk -v s="$BLOCK_START" -v e="$BLOCK_END" '
      index($0, s) == 1 { skip = 1; next }
      skip && index($0, e) == 1 { skip = 0; next }
      !skip { print }
    ' "$NGINX_CONF" > "$tmp"
    nginx_block >> "$tmp"
    cat "$tmp" > "$NGINX_CONF"         # same file: keeps the container's bind mount
    rm -f "$tmp"
    if ! docker exec "$NGINX_CONTAINER" nginx -t; then
      cat "$backup" > "$NGINX_CONF"
      fail "nginx config test failed — restored the backup ($backup). Nothing was reloaded."
    fi
    docker exec "$NGINX_CONTAINER" nginx -s reload
    echo "nginx updated ($BLOCK_VERSION). Backup: $backup"
  fi

  say "Done"
  for d in "${DOMAINS[@]}"; do
    printf '  https://%-32s %s\n' "$d" "$(curl -s -o /dev/null -w '%{http_code}' "https://$d/" || echo '---')"
  done
  [ "$(env_value .env.server RUN_SEED)" = true ] && echo "Tip: set RUN_SEED=false in .env.server for the next deploys."
  dc ps
}

# Upstreams use variables + Docker DNS: if an ecommerce container is down, nginx still
# starts and the other sites keep working (this one just answers 502).
nginx_block() {
  local proxy='proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";'
  local ssl="ssl_certificate     /etc/letsencrypt/live/$CERT_NAME/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$CERT_NAME/privkey.pem;
    resolver 127.0.0.11 valid=30s ipv6=off;"
  cat <<EOF

$BLOCK_START
# $BLOCK_VERSION
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAINS[*]};
    return 301 https://\$host\$request_uri;
}
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name $D_WEB;
    $ssl
    location / { set \$ec_up http://ecommerce-app:3000; proxy_pass \$ec_up; $proxy }
}
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name $D_ADMIN;
    $ssl
    client_max_body_size 25m;
    location / { set \$ec_up http://ecommerce-app:3001; proxy_pass \$ec_up; $proxy }
}
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name $D_SELLER;
    $ssl
    client_max_body_size 25m;
    location / { set \$ec_up http://ecommerce-app:3002; proxy_pass \$ec_up; $proxy }
}
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name $D_API;
    $ssl
    client_max_body_size 25m;
    location / {
        set \$ec_up http://ecommerce-app:4000;
        proxy_pass \$ec_up;
        $proxy
        proxy_read_timeout 300s;
        proxy_buffering off;    # support assistant streams its answers
    }
}
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name $D_MEDIA;
    $ssl
    location / {
        limit_except GET HEAD { deny all; }   # read-only: uploads go through the API
        set \$ec_up http://ecommerce-minio:9000;
        proxy_pass \$ec_up;
        proxy_set_header Host \$http_host;
        expires 30d;
    }
}
$BLOCK_END
EOF
}

# ---------------------------------------------------------------------
if [ "${1:-}" = "--remote" ]; then remote_part; else local_part; fi
