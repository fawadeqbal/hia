# @ecommerce/api-client

Typed functions for every API endpoint, shared by the three Next.js apps. Consumed as TypeScript source
(each app lists it in `transpilePackages`).

```ts
import { categoriesApi, queryKeys } from '@ecommerce/api-client';

const { data } = useQuery({
  queryKey: queryKeys.categories.adminList,
  queryFn: categoriesApi.adminList,
});
```

Auth uses HttpOnly cookies set by the API (`access_token`, `refresh_token`), so every request is sent with
`credentials: 'include'`. Add a file under `src/endpoints/` for each new entity.
