# One container for the whole platform: api + worker + web + admin + vendor.
# Postgres, Redis, S3 and SMTP stay outside (managed services, or containers started by deploy/deploy.sh).
#
# docker build -f docker/Dockerfile \
#   --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api/v1 \
#   --build-arg NEXT_PUBLIC_SITE_URL=https://example.com \
#   --build-arg NEXT_PUBLIC_ADMIN_URL=https://admin.example.com \
#   --build-arg NEXT_PUBLIC_VENDOR_URL=https://seller.example.com \
#   -t ecommerce-app .
ARG NODE_VERSION=22-bookworm-slim

FROM node:${NODE_VERSION} AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---------------------------------------------------------------- build
FROM base AS builder
# NEXT_PUBLIC_* are baked into the browser bundles at build time.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_ADMIN_URL=http://localhost:3001
ARG NEXT_PUBLIC_VENDOR_URL=http://localhost:3002
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_ADMIN_URL=${NEXT_PUBLIC_ADMIN_URL} \
    NEXT_PUBLIC_VENDOR_URL=${NEXT_PUBLIC_VENDOR_URL}

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build

# Next standalone servers need their static files and public/ next to server.js.
RUN for app in web admin vendor; do \
      out="apps/$app/.next/standalone/apps/$app"; \
      cp -r "apps/$app/.next/static" "$out/.next/static"; \
      if [ -d "apps/$app/public" ]; then cp -r "apps/$app/public" "$out/public"; fi; \
    done

# ---------------------------------------------------------------- run
FROM base AS runner
ENV NODE_ENV=production
# Full workspace is kept so the Prisma CLI (migrations) and tsx (optional seed) are available.
COPY --from=builder --chown=node:node /app /app
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/entrypoint.sh
USER node

EXPOSE 3000 3001 3002 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
