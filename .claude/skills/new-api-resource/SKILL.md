---
name: new-api-resource
description: Manually scaffold a single API domain (`src/api/{resource}.ts`) with the canonical interleaved layout — types colocated next to their handlers, `customFetch`-based, token-last for authenticated endpoints. Use this when there is NO OpenAPI spec to import (greenfield resource, quick prototype, ad-hoc endpoint not yet in the spec). For spec-driven generation across many endpoints, use `/openapi-import` instead — it parses YAML, handles many tags, merges with existing files, and validates.
---

Manually scaffold an API resource file. Arguments: **$ARGUMENTS**

Single-resource, no-spec, no-merge, no-validation-pass companion to `/openapi-import`. Emits one file at `src/api/{resource}.ts` following the interleaved layout (each handler preceded by its own type block under a `// ── {functionName} ──` header). Token is the LAST positional argument when present, OMITTED entirely when the `no-auth` flag is passed.

> **When to use which skill** — `/new-api-resource` is for the manual case: you know the resource name, you want a clean CRUD scaffold, you'll fill in the field types by hand. `/openapi-import` is for the spec case: you have a YAML file with many tags, it parses schemas + responses + path/query params, infers function names from `operationId`, reuses `PaginatedResponse<T>`, and intelligently merges with existing API files. Do not invoke both — they target different inputs.

---

## Argument parsing

| Position | Name | Required | Default | Notes |
| -------- | ---- | -------- | ------- | ----- |
| 1st | Resource name | yes | — | Free-form input (e.g. `Users`, `order-items`, `OrderItem`). Normalize as below. |
| 2nd | Operations | no | `list,detail,create,update,delete` | Comma-separated subset of the five CRUD operations. |
| flag | `no-auth` | no | (token included) | When present, omit the `token` parameter from every handler. |

### Derivations from the resource name

| Slot | Form | Example (`Users`) | Example (`order-items`) |
| ---- | ---- | ----------------- | ----------------------- |
| `resource` | kebab-case plural — file name + URL path | `users` | `order-items` |
| `ResourceType` | PascalCase singular + `Type` suffix — main entity interface | `UserType` | `OrderItemType` |
| `ResourceName` | PascalCase singular — used inside detail/create/update/delete function names | `User` | `OrderItem` |
| `ResourcesName` | PascalCase plural — used inside the list function name | `Users` | `OrderItems` |

### Examples

- `/new-api-resource Users` → all five CRUD operations with auth
- `/new-api-resource public-posts list,detail no-auth` → only `getPublicPosts` + `getPublicPost`, no `token` parameter
- `/new-api-resource order-items list,create` → only `getOrderItems` + `createOrderItem` with auth
- `/new-api-resource OrderItem` → all five CRUD with auth, file lands at `src/api/order-items.ts`

---

## Step 0 — Recon (check for an existing file)

`Read` `src/api/{resource}.ts`. Three cases:

1. **File does not exist** → proceed to Step 2.
2. **File exists** → STOP and ask the user verbatim:

   > Ya existe `src/api/{resource}.ts`. ¿Qué hago?
   > - **(O) Overwrite** — reemplazo el archivo entero con el scaffold nuevo (perdés todo lo que tenga adentro)
   > - **(N) New file** — escribo al lado en `src/api/{resource}.new.ts` para que lo mergees a mano
   > - **(A) Abort** — no toco nada
   >
   > Si querés mergear contra una spec OpenAPI en vez de scaffold manual, usá `/openapi-import` (entiende los handlers existentes y los preserva).

   Wait for the explicit reply before writing anything. Default on ambiguous input: re-ask, do NOT assume.
3. **Legacy split detected** — if `src/types/api/{resource}.ts` exists from the pre-colocated era, surface it in the same prompt and ask whether to delete it after the new file lands. Do not auto-delete.

Also verify `src/api/customFetch.ts` exists — the generated file imports from it. If missing, STOP and report; do not try to create it.

---

## Step 1 — Mutate registries

Nothing to do. This skill does NOT touch `src/proxy.ts`, `tailwind.config.js`, `figma-tokens-map.md`, or any provider. API files are leaves in the dependency graph and are picked up by consumers (screens, hooks) by import path alone.

---

## Step 2 — Create the colocated file

Write `src/api/{resource}.ts` with the **interleaved** layout: each handler section is preceded by a `// ── {functionName} ──` header and its own type declarations. Shared types (used by more than one handler — most commonly `{Resource}Type`, used by both list and detail) live above the FIRST handler that consumes them (the list endpoint).

Generate ONLY the operations requested in the 2nd positional argument. The full canonical shape (when all five CRUD operations + auth are requested) is below. For partial sets, omit the handler sections that weren't requested AND any type that becomes orphaned as a result.

```ts
import { customFetch } from './customFetch'
import type { PaginatedResponse } from '@/types/general'

const BASE_PATH = '/{resource}/'

// ── get{ResourcesName} ──
export interface {ResourceType} {
  id: number
  // Add fields here
  created_at: string
  updated_at: string
}
export const get{ResourcesName} = async (path: string = BASE_PATH, token: string) => {
  return await customFetch<PaginatedResponse<Array<{ResourceType}>>>({
    path,
    method: 'GET',
    token
  })
}

// ── get{ResourceName} ──
export const get{ResourceName} = async (id: number | string, token: string) => {
  return await customFetch<{ResourceType}>({
    path: `${BASE_PATH}${id}/`,
    method: 'GET',
    token
  })
}

// ── create{ResourceName} ──
export interface Create{ResourceName}PayloadType {
  // Required fields to create this resource
}
export const create{ResourceName} = async (body: Create{ResourceName}PayloadType, token: string) => {
  return await customFetch<{ResourceType}>({
    path: BASE_PATH,
    method: 'POST',
    body,
    token
  })
}

// ── update{ResourceName} ──
export interface Update{ResourceName}PayloadType extends Partial<Create{ResourceName}PayloadType> {}
export const update{ResourceName} = async (id: number | string, body: Update{ResourceName}PayloadType, token: string) => {
  return await customFetch<{ResourceType}>({
    path: `${BASE_PATH}${id}/`,
    method: 'PATCH',
    body,
    token
  })
}

// ── delete{ResourceName} ──
export const delete{ResourceName} = async (id: number | string, token: string) => {
  return await customFetch({
    path: `${BASE_PATH}${id}/`,
    method: 'DELETE',
    token
  })
}
```

### Operation subset rules

- **`list` only or `list,create`** → drop the detail/update/delete sections AND the `{ResourceType}` declaration moves into whatever section first uses it (often still the list, since the list returns `Array<{ResourceType}>`).
- **`detail` only** → `{ResourceType}` lives under the `get{ResourceName}` header.
- **`create` only** → keep `{ResourceType}` (it's the response type) and `Create{ResourceName}PayloadType` under `create{ResourceName}`.
- **`update` requested without `create`** → declare `Update{ResourceName}PayloadType` directly (do NOT `extends Partial<Create…>` if `Create…` was not emitted). Use an explicit body shape with all fields optional.
- **`delete` only** → no payload types; just `{ResourceType}` is not needed either (the DELETE response is untyped). Drop the `import type { PaginatedResponse }` since nothing uses it.

### `no-auth` rules

When the `no-auth` flag was passed:

- Drop the `token` parameter from every handler signature.
- Drop the `token` field from every `customFetch` call.
- The list signature becomes `(path: string = BASE_PATH)` — the `useTableParams` contract still works; `customFetch` simply doesn't attach an Authorization header.

---

## Step 3 — Conventions checklist

Before saving, verify every item:

- [ ] Output is a single file at `src/api/{resource}.ts` (no split into `src/types/api/`).
- [ ] **Interleaved layout** — every handler is preceded by a `// ── {functionName} ──` header; types live directly above the handler that uses them, NOT in a separate `// ── Types ──` block.
- [ ] `{ResourceType}` (the shared entity interface) sits above the FIRST handler that consumes it (typically `get{ResourcesName}`).
- [ ] Types use `interface` (not `type`) for object shapes; every model carries the `Type` suffix.
- [ ] `customFetch` imported from `./customFetch` (relative); `PaginatedResponse` from `@/types/general` (alias).
- [ ] `import type { X }` for type-only imports.
- [ ] **Token is the LAST positional argument** when present (e.g. `update{ResourceName}(id, body, token)`), or **omitted entirely** when `no-auth` was passed.
- [ ] No `/api` prefix in any `path` value — `customFetch` prepends it.
- [ ] Trailing slash on every path (`'/users/'`, not `'/users'`).
- [ ] Single quotes, no semicolons, 2-space indentation.
- [ ] No marker comments like `// @openapi-generated` — this skill does NOT emit them.
- [ ] No `process.env` — env vars come from `@/constants/env` via `customFetch`.
- [ ] List endpoint signature is `(path: string = BASE_PATH, token: string)` — matches `useTableParams`'s `stringParams` contract; do NOT add a separate `params` object on list endpoints.

---

## Step 4 — Validate

Run, in order:

```bash
pnpm run lint-check --fix
pnpm run type-check
```

Both must pass. If `lint-check --fix` rewrites the file (import order, quote style), accept the changes silently — the auto-fixer is the authority on formatting. If `type-check` fails because the user's payload interfaces are empty (`Create{ResourceName}PayloadType {}`), surface it in the summary as a known follow-up — it's expected that the user fills in the fields next.

---

## Step 5 — Summary

Post a SHORT report with:

1. **File created** — clickable markdown link: `[src/api/{resource}.ts](src/api/{resource}.ts)`.
2. **Operations emitted** — bullet list of function names (e.g. `getUsers`, `getUser`, `createUser`, …).
3. **Fields to fill** — call out every empty interface (`{ResourceType}` and any `Create…PayloadType`) so the user knows the next concrete step.
4. **Usage example** — a SHORT snippet showing how to call the list endpoint with `useTableParams` and how to call a write endpoint. Mirror this shape:

   ```tsx
   import { get{ResourcesName}, create{ResourceName} } from '@/api/{resource}'

   const { stringParams } = useTableParams({ ... })
   const { data, ok } = await get{ResourcesName}(`/{resource}/?${stringParams}`, token)

   const { data: created } = await create{ResourceName}({ /* fields */ }, token)
   ```

5. **Validation status** — `lint=✅/❌, type-check=✅/❌` (one line, like the orchestrator's footer expects).
6. **Next steps** — one or two suggestions: "Fill in `{ResourceType}` fields", "Wire up a `use{ResourcesName}` hook with `/new-hook`", "Build the table screen with `/new-table`".

Do NOT post the full file contents back in the summary — the clickable link is enough.

---

## Hard rules

- Do NOT support multi-resource batch input. One resource per invocation. For many resources at once, the user should run `/openapi-import` against a YAML spec.
- Do NOT generate a hook. Hook scaffolding belongs to `/new-hook` for manual one-off cases. If you scaffolded the resource here and want a list/detail SWR hook with the same shape `/openapi-import` produces, mirror the canonical hook layout documented in `.claude/agents/openapi-hooks.md` (`'use client'`, atomic `useUserStore` selector, token-gated SWR key, list signature `(stringParams?: string)`, detail signature `(id: string | number | null)`).
- Do NOT touch `src/proxy.ts`, `tailwind.config.js`, or any provider.
- Do NOT invoke `/openapi-import`, `/figma-design-import`, or any other skill from inside this one. This skill is a leaf.
- Do NOT emit marker comments (`// @openapi-generated`, `// @manual`, etc.). The file looks like a hand-written file.
- Do NOT split types and handlers into two halves with `// ── Types ──` / `// ── API ──` headers — that is the legacy `/new-api` layout. The current layout is INTERLEAVED, one `// ── {functionName} ──` header per handler.
- Do NOT put `token` anywhere except the LAST positional argument when it is present. The `customFetch` call inside the body can keep `token` anywhere (shorthand object property), but the function signature is strict: `(…, token: string)`.
