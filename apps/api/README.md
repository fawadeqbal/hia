# @ecommerce/api

NestJS modular REST API. Base URL `http://localhost:4000/api/v1`, Swagger at `/api/docs`, health at `/health`.

## Layout

```
src/
  main.ts                bootstrap (helmet, CORS, validation, versioning, Swagger)
  app.module.ts          wires every module + global guards
  config/                env validation (zod), redis helper
  common/                decorators (@Public, @Roles, @CurrentUser), guards, filters, interceptors, DTOs
  prisma/                PrismaService (global)
  jobs/                  BullMQ queue registration (producers)
  health/                liveness/readiness
  modules/<name>/        one folder per domain module (scope section 2.3)
```

## Conventions

- Every route requires a JWT unless marked `@Public()`.
- Restrict by role with `@Roles(Role.ADMIN)`; `SUPER_ADMIN` passes every role check.
- Send email only through `NotificationsService.sendEmail()`; the worker renders and delivers.
- Long-running work goes to a queue (`@InjectQueue(QUEUE_NAMES.X)`), consumed in `apps/worker`.
- Generate a new module: `pnpm nest g resource modules/<name>` (from `apps/api`).

## Implemented so far

`auth` (register, login, refresh, logout), `users/me`, `catalog` (products, product detail, categories, brands),
`search/autocomplete`, `notifications` (queue + logs), `health`. All other modules are scaffolded with a
`GET /<module>/status` endpoint and their scope responsibilities documented in the service file.
