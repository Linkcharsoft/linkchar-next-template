---
name: new-api
description: Create a new API domain from an OpenAPI JSON spec (or a manual scaffold). Generates a single colocated file per tag with types + customFetch-based functions.
---

Create a new API domain. Arguments: **$ARGUMENTS**

This skill works in two modes:

- **Spec mode** — first arg is a path to an OpenAPI JSON file (e.g. `./openapi.json`). Generates one `src/api/{tag}.ts` per OpenAPI `tag`, each containing both the types and the `customFetch`-based functions in a single colocated file.
- **Manual mode** — first arg is a resource name (e.g. `users`, `order-items`). Generates a single `src/api/{resource}.ts` with a CRUD scaffold to fill in by hand.

Both modes accept the optional flag `no-auth` to omit the `token` parameter (public endpoints).

Examples:
- `/new-api ./openapi.json` → spec mode, one file per tag
- `/new-api ./openapi.json --tag users` → spec mode, only the `users` tag
- `/new-api ./openapi.json no-auth` → spec mode, no `token` parameter
- `/new-api users` → manual mode (CRUD scaffold)
- `/new-api public-posts no-auth` → manual mode, no auth
- `/new-api order-items` → manual mode, kebab-case handled

Derive from a resource name (used in both modes for naming):
- `resource` = kebab-case plural (e.g. `order-items`) — used in file names and URL paths
- `ResourceType` = PascalCase singular + `Type` suffix (e.g. `OrderItemType`)
- `ResourceName` = PascalCase singular (e.g. `OrderItem`) — used inside function names
- `ResourcesName` = PascalCase plural (e.g. `OrderItems`) — used in list function names

---

## Mode detection

Look at the first positional argument:

1. If it ends in `.json` → **spec mode**. Verify the file exists with `Read`. If it doesn't, stop and ask the user for the correct path.
2. Otherwise → **manual mode**.

---

# Spec mode

## Step 0 — Validate the spec

Read the JSON file with `Read`. Verify:
- `openapi` field is present and starts with `3.` (OAS 3.x). If `swagger` 2.0 is detected, stop and ask the user to convert it first.
- `paths` object exists and has at least one entry.

Collect all tags:
- Union of `tags[].name` (top-level declarations) and every `tags` array on each operation.
- If the `--tag <name>` flag was passed, filter to that tag only. If no operation references it, stop and report the available tags.
- Operations with no `tags` → group under `default`.

For very large specs, prefer reading `paths` and `components.schemas` selectively in subsequent `Read` calls instead of holding the whole file in context.

## Step 1 — Resolve schemas

For each operation belonging to the selected tags:

- Resolve every `$ref` against `components.schemas` recursively. Cache the resolved shape per ref so cycles are handled.
- Identify the **response model**: pick the first 2xx response that has `content['application/json'].schema`.
- Identify the **request body**: pick `requestBody.content['application/json'].schema` for `POST`/`PUT`/`PATCH`.
- Identify **path params** and **query params** from `parameters[]`.

Map OpenAPI types → TypeScript:

| OpenAPI | TypeScript |
| ------- | ---------- |
| `string` | `string` |
| `string` + `enum: [a, b]` | `'a' \| 'b'` |
| `string` + `format: date-time` / `date` | `string` (NOT `Date`, must stay JSON-serializable) |
| `integer` / `number` | `number` |
| `boolean` | `boolean` |
| `array` items `T` | `Array<T>` |
| `object` (named) | `interface XType { ... }` |
| `object` + `additionalProperties: T` | `Record<string, T>` |
| `nullable: true` | `T \| null` |
| `oneOf` / `anyOf` of primitives | union (`A \| B`) |
| `allOf` | `A & B` (intersection) |
| `oneOf` of complex objects with discriminator | leave as `unknown` and flag in the final summary for manual fix |

**Pagination detection:** if a list-style GET response shape exactly matches `{ count: number, next: string \| null, previous: string \| null, results: Array<T> }`, do NOT redeclare the wrapper. Reuse `PaginatedResponse<Array<T>>` from `@/types/general`.

## Step 2 — Infer function names and signatures

Function name (in priority order):
1. If `operationId` exists, normalize it to camelCase and use it verbatim.
2. Otherwise derive from verb + path:
   - `GET /users/` → `getUsers`
   - `GET /users/{id}/` → `getUser`
   - `POST /users/` → `createUser`
   - `PUT /users/{id}/` → `replaceUser`
   - `PATCH /users/{id}/` → `updateUser`
   - `DELETE /users/{id}/` → `deleteUser`
   - Non-CRUD subpaths → `{verb}{PathSegmentsCamel}` (e.g. `POST /users/{id}/activate/` → `activateUser`)

### Function signature rules:
- **Path params** (`{id}`, `{slug}`) become positional arguments with the type from the spec (default `number | string` if no schema).
- **Body** for POST/PUT/PATCH becomes the `body` argument typed with the corresponding `Create…PayloadType` / `Update…PayloadType`.
- **Token** is always the last argument (omitted entirely when `no-auth` was passed).
- **List endpoints** keep the project's `useTableParams` contract: signature is `(path: string = BASE_PATH, token: string)`. The query string is expected to come pre-built inside `path`. Do NOT add a separate `params` object for list endpoints.
- **Non-list endpoints with declared query params**: add an optional `params?: { ... }` object typed from the spec, passed straight to `customFetch`.

## Step 3 — Emit one file per tag

Write `src/api/{tag}.ts` (kebab-case the tag, pluralize if needed). Each file holds **both** the types and the API functions, separated by visual comment headers:

```ts
import { customFetch } from './customFetch'
import type { PaginatedResponse } from '@/types/general'

// ── Types ────────────────────────────────────────────────

export interface UserType {
  id: number
  email: string
  // ...fields derived from the schema
  created_at: string
  updated_at: string
}

export interface CreateUserPayloadType {
  email: string
  // ...required fields from requestBody
}

export interface UpdateUserPayloadType extends Partial<CreateUserPayloadType> {}

// ── API ──────────────────────────────────────────────────

const BASE_PATH = '/users/'

export const getUsers = async (path: string = BASE_PATH, token: string) => {
  return await customFetch<PaginatedResponse<Array<UserType>>>({
    path,
    method: 'GET',
    token
  })
}

export const getUser = async (id: number | string, token: string) => {
  return await customFetch<UserType>({
    path: `${BASE_PATH}${id}/`,
    method: 'GET',
    token
  })
}

export const createUser = async (body: CreateUserPayloadType, token: string) => {
  return await customFetch<UserType>({
    path: BASE_PATH,
    method: 'POST',
    body,
    token
  })
}

export const updateUser = async (id: number | string, body: UpdateUserPayloadType, token: string) => {
  return await customFetch<UserType>({
    path: `${BASE_PATH}${id}/`,
    method: 'PATCH',
    body,
    token
  })
}

export const deleteUser = async (id: number | string, token: string) => {
  return await customFetch({
    path: `${BASE_PATH}${id}/`,
    method: 'DELETE',
    token
  })
}
```

###Mandatory rules:
- Single quotes, no semicolons, 2-space indentation.
- `customFetch` from `./customFetch` (relative). Shared types from `@/types/general` (alias).
- `import type { X }` for type-only imports, alphabetized.
- `path` never includes the `/api` prefix — `customFetch` adds it.
- Trailing slash on every path.
- `BASE_PATH` is the most common path prefix among the operations of this tag (typically `/{resource}/`).
- For `no-auth`: drop `token` from every function signature and from the `customFetch` call.
- Always reuse `PaginatedResponse<Array<T>>` when the response matches that shape.
- Use the visual comment headers `// ── Types ──` and `// ── API ──` to separate the two halves of the file.

## Step 4 — Handle conflicts

Before writing each `src/api/{tag}.ts`:
- If the file already exists, **stop and ask** the user: overwrite, write to `{tag}.new.ts`, or skip this tag.
- If `src/types/api/{tag}.ts` exists (legacy split), warn that types are now consolidated into `src/api/` and ask whether to delete the legacy file.

## Step 5 — Final summary

Report:
1. Files created with clickable paths (markdown links).
2. Per file: number of endpoints generated and their function names.
3. Schemas that could not be cleanly mapped (complex `oneOf`/`anyOf` with discriminators, deeply nested `allOf`, etc.) — flag them with the file:line and the suggested manual edit.
4. A short usage example with `useTableParams`:

```tsx
import { getUsers, createUser } from '@/api/users'

const { stringParams } = useTableParams({ ... })
const { data, ok } = await getUsers(`/users/?${stringParams}`, token)

const { data: newUser } = await createUser({ email: 'a@b.com' }, token)
```

---

# Manual mode

## Step 0 — Check for existing files

Check whether `src/api/{resource}.ts` already exists. If it does, stop and ask the user whether to overwrite, extend, or abort.

Verify `src/api/customFetch.ts` exists — the generated file imports from it.

If `src/types/api/{resource}.ts` exists from previous (legacy) runs of the skill, warn the user: types now live in the same file as the API client. Offer to delete the legacy file.

## Step 1 — Create the colocated file

Write `src/api/{resource}.ts`:

```ts
import { customFetch } from './customFetch'
import type { PaginatedResponse } from '@/types/general'

// ── Types ────────────────────────────────────────────────

export interface ResourceType {
  id: number
  // Add fields here
  created_at: string
  updated_at: string
}

export interface CreateResourcePayloadType {
  // Fields required to create this resource
}

export interface UpdateResourcePayloadType extends Partial<CreateResourcePayloadType> {}

// ── API ──────────────────────────────────────────────────

const BASE_PATH = '/{resource}/'

export const getResourcesName = async (path: string = BASE_PATH, token: string) => {
  return await customFetch<PaginatedResponse<Array<ResourceType>>>({
    path,
    method: 'GET',
    token
  })
}

export const getResourceName = async (id: number | string, token: string) => {
  return await customFetch<ResourceType>({
    path: `${BASE_PATH}${id}/`,
    method: 'GET',
    token
  })
}

export const createResourceName = async (body: CreateResourcePayloadType, token: string) => {
  return await customFetch<ResourceType>({
    path: BASE_PATH,
    method: 'POST',
    body,
    token
  })
}

export const updateResourceName = async (id: number | string, body: UpdateResourcePayloadType, token: string) => {
  return await customFetch<ResourceType>({
    path: `${BASE_PATH}${id}/`,
    method: 'PATCH',
    body,
    token
  })
}

export const deleteResourceName = async (id: number | string, token: string) => {
  return await customFetch({
    path: `${BASE_PATH}${id}/`,
    method: 'DELETE',
    token
  })
}
```

Same rules as spec mode (single quotes, no semicolons, 2-space indent, `import type`, trailing slashes, `no-auth` drops the `token` param, etc.).

## Step 2 — Show the usage example and summary

```tsx
import { getUsers, createUser } from '@/api/users'

const { data, ok } = await getUsers('/users/', token)

const { stringParams } = useTableParams({ ... })
const { data } = await getUsers(`/users/?${stringParams}`, token)

const { data: newUser } = await createUser({ name: 'John' }, token)
```

Then list:
1. The created file (clickable link).
2. What to fill in next: interface fields, payload types, and which CRUD functions to remove if they don't apply.

---

## Conventions checklist

Before finishing, verify:
- [ ] Output lives in a single file at `src/api/{resource}.ts` (no split into `src/types/api/`).
- [ ] File contains both halves separated by `// ── Types ──` and `// ── API ──`.
- [ ] Types use `interface` (not `type`) for object shapes; every model has the `Type` suffix.
- [ ] (Spec mode) One file per OpenAPI tag.
- [ ] (Spec mode) `operationId` is respected when present; otherwise verb + path inference is used.
- [ ] (Spec mode) `PaginatedResponse<Array<T>>` is reused whenever the response matches that shape.
- [ ] `customFetch` imported from `./customFetch` (relative); shared types from `@/types/general` (alias).
- [ ] No `/api` prefix in any `path` value.
- [ ] Trailing slash on every path.
- [ ] `token` parameter present on every function (unless `no-auth`).
- [ ] Single quotes, no semicolons, 2-space indentation.
- [ ] `import type { X }` for type-only imports.
- [ ] No `process.env` — env vars come from `@/constants/env` via `customFetch`.
