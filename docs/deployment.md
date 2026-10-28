# Deployment

One Docker image runs the whole platform (api, worker, web, admin, vendor). Postgres, Redis, S3 storage and SMTP
are external: managed services, or Postgres + Redis containers started by the deploy script.

| File                             | Purpose                                                                     |
| -------------------------------- | --------------------------------------------------------------------------- |
| `docker/Dockerfile`              | Builds the single image                                                     |
| `docker/entrypoint.sh`           | Runs migrations, then starts all five apps; stops the container if one dies |
| `deploy/deploy.sh`               | Generic server deploy: pull → swap → health check → auto-rollback           |
| `deploy/.env.production.example` | Runtime environment (copy to `/opt/ecommerce/.env`)                         |
| `deploy/nginx.conf.example`      | Reverse proxy: one subdomain per app + HTTPS via certbot                    |
| `.github/workflows/ci-cd.yml`    | Verify → build & push image to GHCR → deploy over SSH                       |

Container ports: `3000` storefront, `3001` admin, `3002` seller center, `4000` API (`/health` is the health check).

## 1. Server setup (once)

```bash
# Any Linux server with Docker
curl -fsSL https://get.docker.com | sh
sudo mkdir -p /opt/ecommerce && sudo chown $USER /opt/ecommerce
# copy deploy/.env.production.example → /opt/ecommerce/.env and fill in real values
```

DNS: point `example.com`, `admin.`, `seller.`, `api.` to the server. Install nginx, use
`deploy/nginx.conf.example`, then `sudo certbot --nginx -d …` for HTTPS.

## 2. GitHub settings

Settings → Secrets and variables → Actions:

| Type     | Name                                                                        | Example                                                 |
| -------- | --------------------------------------------------------------------------- | ------------------------------------------------------- |
| Variable | `NEXT_PUBLIC_API_URL`                                                       | `https://api.example.com/api/v1`                        |
| Variable | `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_ADMIN_URL` / `NEXT_PUBLIC_VENDOR_URL` | `https://example.com` …                                 |
| Variable | `DEPLOY_HOST`                                                               | server IP or hostname (empty = skip deploy)             |
| Variable | `DEPLOY_USER`                                                               | `deploy` (must be able to run `docker`)                 |
| Variable | `DEPLOY_PORT` / `DEPLOY_PATH`                                               | `22` / `/opt/ecommerce` (optional)                      |
| Variable | `DEPLOY_INFRA`                                                              | `true` to run Postgres + Redis containers on the server |
| Secret   | `DEPLOY_SSH_KEY`                                                            | private SSH key for `DEPLOY_USER`                       |
| Secret   | `GHCR_PULL_TOKEN`                                                           | optional PAT with `read:packages`                       |

Pipeline: every push / PR runs **verify**. Pushes to `main`, `v*` tags or a manual run also **build the image**
(`ghcr.io/<owner>/<repo>:sha-xxxxxxx` + `latest`) and **deploy** it (environment `production`, so you can add
required reviewers).

## 3. First deploy

The first deploy should also seed the admin account and settings:

```bash
ssh deploy@server
cd /opt/ecommerce
RUN_SEED=true IMAGE=ghcr.io/<owner>/<repo>:latest DEPLOY_INFRA=true bash deploy.sh
```

Later deploys come from the pipeline. Migrations run automatically on every start (`RUN_MIGRATIONS=true`).

## 4. Day-to-day

```bash
bash /opt/ecommerce/deploy.sh status     # running container + current image
bash /opt/ecommerce/deploy.sh logs       # all apps, prefixed [api] [web] [worker] …
bash /opt/ecommerce/deploy.sh rollback   # previous image
```

## Without GitHub (any CI or by hand)

```bash
docker build -f docker/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api/v1 \
  --build-arg NEXT_PUBLIC_SITE_URL=https://example.com \
  --build-arg NEXT_PUBLIC_ADMIN_URL=https://admin.example.com \
  --build-arg NEXT_PUBLIC_VENDOR_URL=https://seller.example.com \
  -t registry.example.com/ecommerce:1.0.0 .
docker push registry.example.com/ecommerce:1.0.0
ssh deploy@server "IMAGE=registry.example.com/ecommerce:1.0.0 bash /opt/ecommerce/deploy.sh"
```

Run it locally against `pnpm infra:up` services:

```bash
docker run --rm --env-file .env --network host ecommerce-app   # Linux; on Windows/macOS use host.docker.internal in DATABASE_URL etc.
```

## Notes

- `NEXT_PUBLIC_*` are baked in at build time: changing a domain means rebuilding the image.
- Start a subset with `-e APPS="api worker"` to split the platform across several containers later.
- Old images are pruned after a healthy deploy; the last 10 deployed tags are kept in `/opt/ecommerce/.deployed-images`.
