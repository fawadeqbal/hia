# @ecommerce/config

Shared configuration used across the monorepo.

| Path                          | Use                                                   |
| ----------------------------- | ----------------------------------------------------- |
| `tsconfig/base.json`          | Base compiler options                                 |
| `tsconfig/library.json`       | CommonJS libraries (types, database, email-templates) |
| `tsconfig/nestjs.json`        | NestJS apps (api, worker)                             |
| `tsconfig/nextjs.json`        | Next.js apps (web, admin, vendor)                     |
| `tsconfig/react-library.json` | React component library (ui)                          |
| `eslint/base.mjs`             | Flat ESLint config for TS packages and Nest apps      |
| `tailwind/preset.js`          | Shared Tailwind theme tokens                          |
