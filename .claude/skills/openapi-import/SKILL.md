---
name: openapi-import
description: Connects the UI scaffolded by /figma-design-import to a backend by ingesting an OpenAPI YAML spec and generating src/api/{tag}.ts handler files and src/hooks/use{Resource}.ts SWR hooks. Use AFTER /figma-design-import scaffolds the UI. For manual ad-hoc API resources on a single endpoint, prefer /new-api-resource instead.
---

Import an OpenAPI YAML spec and wire the backend layer. Arguments: **$ARGUMENTS**

**First positional arg** (required): local path to a `.yaml` / `.yml` file, OR a URL (`https://...`) pointing to one.
**Optional flags**:
- `--tags=a,b,c` — process only the listed tags (comma-separated, no spaces)
- `--force` — bypass the large-spec gate (tags > 30 OR endpoints > 300)
- `--no-auth` — emit all handlers without a `token` parameter (fully public APIs)

If the first arg is missing, STOP and ask the user for the spec path or URL before doing anything else.

---

## Identity and when to use

This skill is the **API wiring layer** that follows `/figma-design-import`. It:

1. Ingests an OpenAPI 3.x YAML spec (local or remote).
2. Produces one `src/api/{tag}.ts` file per tag — types interleaved with handlers, `customFetch`-based.
3. Produces `src/hooks/use{Resource}.ts` files for every GET handler — SWR-wired, token-gated.
4. Runs lint + type-check and reports the final merge state.

**It does NOT touch screens, layouts, proxy.ts, or routing** — those are owned by `/figma-design-import`.

**Use this skill when:**
- You have an OpenAPI YAML spec and want to generate the full API + hooks layer.
- You just ran `/figma-design-import` and need to connect its screens to real endpoints.
- You need to regenerate or merge-update an existing `src/api/{tag}.ts` as the spec evolves.

**Do NOT use this skill when:**
- You need to scaffold a single endpoint by hand — use `/new-api-resource` instead.
- The spec is a Swagger 2.0 or AsyncAPI file — convert to OAS 3.x first.
- The spec is a `.json` file — convert with `npx -y json2yaml file.json > file.yaml` (or any JSON-to-YAML converter; `js-yaml` is YAML-to-JSON only), then re-invoke.

---

## Workload tracking

Maintain a running ledger of every sub-agent invocation. Append a row after each delegation returns:

```
| Step | Sub-agent | Model | Duration | Tool calls | Notes |
|------|-----------|-------|----------|------------|-------|
| 2 | openapi-handlers | Sonnet | 45s | ≈18 | 3 tags, 14 ADDED, 2 MODIFIED |
| 3 | openapi-hooks | Haiku | 20s | ≈8 | 6 GET hooks generated |
| 4 | openapi-validation | Haiku | 15s | ≈6 | lint ✅, type-check ✅ |
```

**Column sources:**
- `Model` — read from the sub-agent's frontmatter `model:` field. Do NOT trust the footer string (it's the agent's self-reported declaration and can drift). **Before Phase 5 ledger emission, `Read` `.claude/agents/openapi-handlers.md`, `.claude/agents/openapi-hooks.md`, and `.claude/agents/openapi-validation.md` (just the frontmatter — first ~6 lines is enough) to source this column.**
- `Duration` — measured by the orchestrator from wall-clock time around the `Agent(...)` call.
- `Tool calls` — `Workload: tool_calls≈...` from the sub-agent's standardized footer.
- `Notes` — `Notes:` line from the footer, used verbatim.

Show the ledger in the Phase 5 final summary so cost-per-step is visible.

**Orchestrator model**: this skill itself runs under whichever model the calling session uses (the parent context, not the sub-agents). The Phase 0/1 work — spec ingest, gap analysis, STOP confirmation — needs Opus-grade judgment; if invoking from a Haiku session, results will degrade. There is no `model:` field in the skill frontmatter to enforce this (skills inherit), so it's a soft expectation. The cost ledger should NOT show the parent's model — only the sub-agent rows are tracked there.

---

## How this skill manages models

| Step | Sub-agent | Model | Why this model |
|------|-----------|-------|----------------|
| 0–1 | (you, the parent) | Opus | Spec ingest, gap analysis, STOP confirmation — needs judgment |
| 2 | `openapi-handlers` | Sonnet | Schema-to-TS mapping, intelligent merge — moderate decisions |
| 3 | `openapi-hooks` | Haiku | Mechanical SWR boilerplate from handler imports |
| 4 | `openapi-validation` | Haiku | Run commands + categorized report |

Always pass enough context in each delegation — sub-agents start with a fresh context. Include tag names, resolved operations, file paths, and merge decisions already made.

---

## Phase 0 — Inline ingest (parent, no delegation)

**Run directly.** No sub-agent. This is the spec parsing pass.

### 0.1 — Source detection

- If the first arg starts with `https://` → use WebFetch to download the spec. Cache the raw text to `/tmp/openapi-{hash}.yaml` via Bash so subsequent steps don't re-fetch.
- Otherwise treat the arg as a local file path. Verify it exists with `Read`. If it doesn't exist, STOP and tell the user.

### 0.2 — Format gate

- If the path ends in `.json` → STOP immediately with:
  > "OpenAPI spec must be YAML for this skill. The `js-yaml` CLI only converts YAML→JSON; to go the other direction, use `npx -y json2yaml file.json > file.yaml` (or a tool of your choice), then re-invoke this skill with the `.yaml` file."
  Do NOT attempt to parse `.json` input.

### 0.3 — YAML parse

Parse the YAML with Bash. Capture stdout ONLY — do NOT redirect stderr into stdout (`2>&1` would corrupt the JSON when `js-yaml` prints any warning):

```bash
npx -y js-yaml <file>
```

The command writes JSON to stdout when it succeeds and writes the parse error to stderr when it fails. Read the Bash result's stdout; if empty AND the exit code is non-zero, STOP and surface the stderr verbatim — do not guess at a fix.

`JSON.parse` the captured stdout into an in-memory object for the rest of Phase 0.

### 0.4 — OpenAPI version check

- Check the `openapi` field. Must start with `"3."` (OAS 3.x).
- If `swagger: "2.0"` is present → STOP: "This skill requires OpenAPI 3.x. Convert the Swagger 2.0 spec with `npx -y swagger2openapi spec.yaml -o spec3.yaml`."
- If `asyncapi` is present → STOP: "AsyncAPI specs are not supported. This skill handles REST/HTTP only."

### 0.5 — $ref resolution

Recursively resolve every `$ref` in `paths` and `requestBody` against `components.schemas`. Cache resolved shapes by ref path to avoid re-expanding cycles. Mark circular refs as `unknown` and flag them in the Phase 1 gap analysis.

---

## Phase 1 — Gap analysis + STOP for user confirmation (parent, Opus)

**Run directly.** No sub-agent. Produce the gap analysis and emit it to chat. Wait for the user to confirm before proceeding.

### 1.1 — Group by tag

For each operation in `paths.*.*`:
- Tag = `operation.tags[0]`. If absent or empty → group under `"default"`.
- If `--tags=a,b,c` was passed → discard all operations whose tag is not in the list.
- Classify each operation:
  - `list` — GET with no path `{id}` param whose response matches `PaginatedResponse` shape (`count`, `next`, `previous`, `results`)
  - `detail` — GET with a path `{id}` or `{slug}` param
  - `mutation` — POST / PUT / PATCH / DELETE
  - `action` — any method on a non-CRUD subpath (e.g. `POST /users/{id}/activate/`)

### 1.2 — Large-spec gate

- If total tags > 30 OR total endpoints > 300 AND `--force` was NOT passed → STOP:
  > "This spec has {N} tags and {M} endpoints, which exceeds the safe processing threshold (30 tags / 300 endpoints). Either scope with `--tags=a,b,c` to limit the run, or pass `--force` to process everything. Large runs may produce very long agent outputs — splitting by tag is recommended."

### 1.3 — Inventory existing files

Glob `src/api/*.ts` and `src/hooks/use*.ts`. Report which tags already have a file (merge candidate) vs which are new.

### 1.4 — Figma context hint (non-blocking)

Check whether `figma-tokens-map.md` exists at the project root. If it does, add a soft note: "Figma UI layer detected — this run wires the backend to an existing UI scaffold." If it doesn't, add: "No Figma import detected — this run generates a standalone API layer."

### 1.5 — Emit the gap analysis to chat

Emit in markdown. Example shape (populate from the actual spec):

```markdown
## openapi-import — Gap analysis

Spec: {source} — OpenAPI {version}, {N} tags, {M} endpoints

### Tags selected
| Tag | File | Endpoints | New / Merge |
|-----|------|-----------|-------------|
| users | src/api/users.ts (exists) | 5 | MERGE |
| products | src/api/products.ts (new) | 8 | NEW |

### Endpoint inventory
| Tag | Method | Path | Classification | Function name |
|-----|--------|------|----------------|---------------|
| users | GET | /users/ | list | getUsers |
| users | GET | /users/{id}/ | detail | getUser |
| users | POST | /users/ | mutation | createUser |
| users | PATCH | /users/{id}/ | mutation | updateUser |
| users | DELETE | /users/{id}/ | mutation | deleteUser |
| products | GET | /products/ | list | getProducts |
| ... | ... | ... | ... | ... |

### Pagination
- users → PaginatedResponse<Array<UserType>> (DRF standard shape)
- products → {Tag}PageType (non-standard shape — will emit local type + flag)

### Flags
- uploads/binary endpoints (manual review): [list or "none"]
- circular $refs: [list or "none"]

### Merge plan for existing files
| File | ADDED | MODIFIED | UNCHANGED | KEPT | POTENTIAL RENAME |
|------|-------|----------|-----------|------|-----------------|
| src/api/users.ts | 2 | 1 | 2 | 1 | 0 |

Screens, proxy.ts, and layouts are NOT touched by this skill — they belong to /figma-design-import.

Confirm to proceed (y/n).
```

**Do NOT proceed past Phase 1 without user confirmation.** Wait for an explicit "y", "yes", or similar affirmation.

---

## Phase 2 — Delegate openapi-handlers (Sonnet, sequential per tag)

> **Delegate to**: `Agent({ subagent_type: 'openapi-handlers' })` — runs in **Sonnet**.

Run one invocation per tag (not parallel — each invocation may modify the same shared type `PaginatedResponse` import and must complete before the next to avoid write conflicts).

**Pass to the agent per tag:**
- `tagName` — the tag string (used for file naming and BASE_PATH)
- `operations` — array of resolved operation objects: `{ method, path, operationId, pathParams, queryParams, requestBody, responseSchema, classification }`
- `sharedSchemas` — the full `components.schemas` map (needed for $ref resolution within the agent)
- `existingFilePath` — `src/api/{tag}.ts` if the file already exists; `null` if new
- `noAuth` — boolean from the `--no-auth` flag
- `paginatedResponseShape` — the exact `{ count, next, previous, results }` shape to match for DRF pagination detection

**The agent's merge algorithm (Q2):**

For each function derived from the spec, the agent:

1. Greps the existing file for `export const (\w+) = async` to parse present function names.
2. **Function NOT in file** → INSERT; report as `ADDED`.
3. **Function in file, signature matches spec** → SKIP; report as `UNCHANGED`.
4. **Function in file, signature differs** → REGENERATE the signature; preserve any comments inside the body; report as `MODIFIED` with a one-line diff summary.
5. **Function in file but NOT in spec** → PRESERVE entirely; report as `KEPT`.
6. **Same path/method as a spec function but different name** → report as `POTENTIAL RENAME`; do NOT auto-resolve.

**Handler shape rules (mandatory):**
- Token is ALWAYS the LAST positional arg in authenticated handlers (Q0).
- Public endpoints (login, signup, refreshToken, etc.) — omit token entirely.
- With `--no-auth` — omit token from every handler.
- Types are INTERLEAVED with handlers (Q1) — NOT grouped in a separate block:
  - Each handler section is headed with `// ── {functionName} ──`
  - Type(s) used by the handler follow the section header
  - The handler function follows its types
  - Shared types (e.g. `UserType` used by both `getUsers` and `getUser`) are declared above the FIRST handler that uses them
- `BASE_PATH` = the most common path prefix for this tag (typically `/{tag}/`).
- List endpoints: signature `(path: string = BASE_PATH, token: string)` — the query string comes pre-built in `path` via `useTableParams.stringParams`.
- Non-list GET with declared query params: add optional `params?: { ... }` typed from the spec.
- DRF pagination match (`count`, `next`, `previous`, `results`) → reuse `PaginatedResponse<Array<T>>` from `@/types/general`.
- Any other paginated shape → emit local `{Tag}PageType` and flag as `non-standard-pagination`.
- No marker comments (`// @openapi-generated`, `// @generated`, etc.) anywhere in the file (Q2).
- Single quotes, no semicolons, 2-space indentation.
- `customFetch` imported from `'./customFetch'` (relative). Shared types from `'@/types/general'` (alias).
- `import type { X }` for type-only imports, alphabetized.
- No `/api` prefix in any `path` value — `customFetch` adds it.
- Trailing slash on every path.

**Canonical handler shape (reference):**

```ts
import { customFetch } from './customFetch'
import type { PaginatedResponse } from '@/types/general'

const BASE_PATH = '/users/'

// ── getUsers ──
export interface UserType {
  id: number
  email: string
  created_at: string
  updated_at: string
}
export const getUsers = async (path: string = BASE_PATH, token: string) => {
  return await customFetch<PaginatedResponse<Array<UserType>>>({
    path,
    method: 'GET',
    token
  })
}

// ── getUser ──
export const getUser = async (id: number | string, token: string) => {
  return await customFetch<UserType>({
    path: `${BASE_PATH}${id}/`,
    method: 'GET',
    token
  })
}

// ── createUser ──
export interface CreateUserPayloadType {
  email: string
}
export const createUser = async (body: CreateUserPayloadType, token: string) => {
  return await customFetch<UserType>({
    path: BASE_PATH,
    method: 'POST',
    body,
    token
  })
}

// ── updateUser ──
export interface UpdateUserPayloadType extends Partial<CreateUserPayloadType> {}
export const updateUser = async (id: number | string, body: UpdateUserPayloadType, token: string) => {
  return await customFetch<UserType>({
    path: `${BASE_PATH}${id}/`,
    method: 'PATCH',
    body,
    token
  })
}

// ── deleteUser ──
export const deleteUser = async (id: number | string, token: string) => {
  return await customFetch({
    path: `${BASE_PATH}${id}/`,
    method: 'DELETE',
    token
  })
}
```

**Capture from each invocation:**
- The agent's standardized footer (ADDED / MODIFIED / UNCHANGED / KEPT / POTENTIAL RENAME counts).
- The list of files actually written.
- **The per-tag list of `POTENTIAL RENAME` entries** (each entry: `{tag, oldName, newName, path, method}`). This list is critical for Phase 3 — see the filter step below.

---

## Phase 3 — Delegate openapi-hooks (Haiku, single run)

> **Delegate to**: `Agent({ subagent_type: 'openapi-hooks' })` — runs in **Haiku**.

Run ONLY AFTER all Phase 2 invocations have completed. Hooks depend on the handler output — they import from `src/api/{tag}.ts` files that must exist first.

### Phase 2 → Phase 3 filter (CRITICAL — prevents broken imports)

**Before** building the payload for `openapi-hooks`, the orchestrator MUST filter out every spec operation whose function name appears in any Phase 2 `POTENTIAL RENAME` entry's `newName` field. The reasoning:

- When `openapi-handlers` detects POTENTIAL RENAME, it does NOT insert the spec-derived function (e.g. `getUsers`) — it leaves the existing function (e.g. `fetchUsers`) in place per Q2.
- If the hooks payload still references `getUsers` from the spec, `openapi-hooks` will emit `import { getUsers } from '@/api/users'` — a broken import that fails type-check, because `getUsers` was never written.

Concrete filter logic:

1. Collect every `newName` across all Phase 2 `POTENTIAL RENAME` entries into a set: `suppressed = { 'users': ['getUsers'], 'orders': ['getOrders'], ... }`.
2. When building `getOperationsByResource` for Phase 3, drop any GET operation whose `handlerName` is in `suppressed[tag]`.
3. After filtering, log to the user: `Skipped hook generation for {N} operation(s) flagged as POTENTIAL RENAME — resolve those manually in src/api/{tag}.ts, then re-run /openapi-import to regenerate the hooks.`

The filter applies at the orchestrator level — `openapi-hooks` itself does not need to know about POTENTIAL RENAME. The orchestrator's responsibility is to never ask hooks to wrap a function that does not exist on disk.

**Pass to the agent:**
- For each tag: list of GET operations (list + detail classifications only) AFTER the POTENTIAL RENAME filter above. Each operation entry includes `handlerName`, `path`, `kind` ('list' or 'detail').
- The `noAuth` flag.

**The agent generates hooks for GET endpoints only (Q3 — no hooks for mutations).**

**Canonical hook shape (reference):**

```ts
'use client'

import useSWR from 'swr'

import { getUsers, getUser } from '@/api/users'
import useUserStore from '@/stores/userStore'

export const useUsers = (stringParams?: string) => {
  const token = useUserStore((s) => s.token)
  const safe = stringParams ?? ''
  const key = token ? `/users/${safe ? `?${safe}` : ''}` : null

  return useSWR(key, () => getUsers(`/users/${safe ? `?${safe}` : ''}`, token!))
}

export const useUser = (id: string | number | null) => {
  const token = useUserStore((s) => s.token)
  const key = token && id != null ? `/users/${id}/` : null

  return useSWR(key, () => getUser(id!, token!))
}
```

**Hook rules:**
- File: `src/hooks/use{Resource}.ts` where `{Resource}` is the **PascalCase plural** derived from the tag (e.g. tag `users` → file `src/hooks/useUsers.ts`; tag `order-items` → `src/hooks/useOrderItems.ts`). This is the same form used by the list hook name. The orchestrator passes this name verbatim to the agent; do NOT derive plurals inside the agent.
- Each named export corresponds to one GET handler — hook name = handler name with `get` swapped for `use` (handler `getUsers` → hook `useUsers`, handler `getUser` → hook `useUser`). Never append `s` to compute a plural.
- `'use client'` directive at top — hooks run in client components.
- Token from `useUserStore((s) => s.token)` — atomic selector, no destructuring.
- SWR key is `null` when token is absent — disables the fetch.
- List hooks accept `stringParams?: string` (output of `useTableParams.stringParams`).
- Detail hooks accept `id: string | number | null` — key is `null` when `id` is `null`.
- With `--no-auth` — omit token from the key and the handler call; key is always the path string.
- If `src/hooks/use{Resource}.ts` already exists, apply the same merge logic as Phase 2 (ADDED / UNCHANGED / MODIFIED / KEPT per hook function).

**Capture from the invocation:**
- Hook file count, function count per file.
- Agent footer.

---

## Phase 4 — Delegate openapi-validation (Haiku, single run)

> **Delegate to**: `Agent({ subagent_type: 'openapi-validation' })` — runs in **Haiku**.

**Pass to the agent:**
- List of all files emitted in Phases 2–3 (absolute paths).
- List of POTENTIAL RENAME entries collected from Phase 2.
- List of `non-standard-pagination` flags from Phase 2.
- List of `schema-todos` (complex `oneOf`/`anyOf` left as `unknown`).
- List of `uploads/binary` endpoints flagged in Phase 1.

**The agent runs:**

1. `pnpm run lint-check --fix` — captures output, lists errors.
2. `pnpm run type-check` — captures output, lists errors.
3. **Consumption check**: for each generated `src/api/{tag}.ts` function, grep `src/screens/` and `src/hooks/` to determine if it is:
   - **wired** — imported and called somewhere
   - **hook-only** — imported via `use{Resource}.ts` SWR hook (indirect consumption)
   - **orphaned** — not referenced anywhere (candidate for deletion or future wiring)
4. **TODO census**: count `// TODO` comments in all emitted files.
5. **POTENTIAL RENAME census**: list each flagged rename with its file:line and the two conflicting names.
6. **MOCK_* sweep**: grep `src/screens/**/*.tsx` for `MOCK_*` constants — if any match a resource also in the spec, flag it as a candidate for replacement with the generated API call.

**Agent footer format (standardized):**

```
---
Workload: model=haiku, tool_calls≈{N}, files_touched=0
Validation: lint=✅/❌, type-check=✅/❌
Notes: {one-line count summary}
```

---

## Phase 5 — Final summary to user

After Phase 4 returns, emit the full summary to chat. Use this exact template:

```
openapi-import — run {timestamp}
Spec: {source} ({endpointCount} endpoints, {tagCount} tags)

Generated:
  src/api/{tag}.ts ......................... {N} handlers
  src/hooks/use{Resource}.ts ............... {N} GET hooks

Reused:
  PaginatedResponse<T> ..................... {N} endpoints
  customFetch .............................. all handlers

Merge results:
  ADDED .................................... {N} handlers
  MODIFIED ................................. {N} handlers (signature changed)
  UNCHANGED ................................ {N} handlers
  KEPT (preserved user-added) .............. {N} handlers
  POTENTIAL RENAME ......................... {list} (review manually)

Flags:
  manual-review (uploads/binary) ........... {list or "none"}
  non-standard-pagination .................. {list or "none"}
  schema-todos ............................. {N}
  orphaned-handlers ........................ {list or "none"}
  hook-only-handlers ....................... {list or "none"}

Figma context: {detected | not-detected}

Validation: lint=✅/❌, type-check=✅/❌

Workload ledger:
| Step | Sub-agent | Model | Duration | Tool calls | Notes |
| 2    | openapi-handlers | Sonnet | {d} | ≈{N} | {notes} |
| 3    | openapi-hooks | Haiku | {d} | ≈{N} | {notes} |
| 4    | openapi-validation | Haiku | {d} | ≈{N} | {notes} |
```

---

## STOP-BLOCKING signals from sub-agents

Any sub-agent may emit a single-line `STOP-BLOCKING / category: {CATEGORY} / reason: {detail}` instead of (or above) its normal output. Categories you should expect:

- `INVALID_INPUT` — the payload from the orchestrator is malformed, missing a required field, or the agent's pre-flight reads failed. Most common cause: the orchestrator skipped a Phase 1 sub-step.
- `INVALID_SPEC` — a schema in the spec cannot be processed even with the tiered fallback (e.g. truly circular `oneOf` with no discriminator at any depth).
- `MISSING_FILE` — a file the agent must read (`customFetch.ts`, `auth.ts`, `CONVENTIONS.md`) is absent. The project is not the expected template; abort and surface the missing file.
- `LINT_FATAL` or `TYPECHECK_FATAL` — the validation pass cannot even RUN the commands (toolchain broken). Distinct from "lint failed with N findings", which is reported in the normal report.

**Orchestrator handling rule**: when a sub-agent returns a STOP-BLOCKING line, surface it verbatim to the user, halt the current phase, and do NOT auto-retry. The user resolves the underlying issue (provides the missing field, fixes the spec, restores the file) and re-invokes the skill. Never silently retry — the failure mode is almost always a structural problem that another retry will hit identically.

If the STOP-BLOCKING fires in Phase 2 for one tag out of many, you MAY ask the user whether to continue with the remaining tags or abort the whole run. Default to abort.

---

## Anti-patterns (do NOT do this)

- Do NOT auto-invoke `/new-screen` or `/new-table` during this skill — screens are `/figma-design-import`'s job.
- Do NOT modify `src/proxy.ts` — also `/figma-design-import`'s domain.
- Do NOT add marker comments to generated files (`// @openapi-generated`, `// @generated`, etc.) — the intelligent merge uses function-name regex, not markers (Q2).
- Do NOT accept `.json` spec input — YAML only (Q6). Reject with the one-line convert hint.
- Do NOT generate hooks for mutation endpoints (POST / PUT / PATCH / DELETE) — GET only (Q3).
- Do NOT place `token` anywhere other than the last positional arg in authenticated handlers — token is always last (Q0).
- Do NOT group all types above all handlers in a `// ── Types ──` block — use the interleaved `// ── {functionName} ──` layout (Q1).
- Do NOT run openapi-handlers and openapi-hooks in parallel — hooks depend on handler files being written first. Always run hooks AFTER all handler invocations complete.
- Do NOT proceed past Phase 1 without user confirmation — the gap analysis STOP is mandatory.
- Do NOT process specs larger than 30 tags / 300 endpoints without `--force` or `--tags` scoping.
- Do NOT silently overwrite `src/api/{tag}.ts` without merge analysis — always read the existing file first.
- Do NOT add a `/api` prefix to any `path` value in `customFetch` calls — `customFetch` adds it internally.

---

## OpenAPI → TypeScript type mapping

| OpenAPI | TypeScript |
|---------|-----------|
| `string` | `string` |
| `string` + `enum: [a, b]` | `'a' \| 'b'` |
| `string` + `format: date-time` or `date` | `string` (NOT `Date` — must stay JSON-serializable) |
| `integer` / `number` | `number` |
| `boolean` | `boolean` |
| `array` with items `T` | `Array<T>` |
| `object` (named) | `interface XType { ... }` |
| `object` + `additionalProperties: T` | `Record<string, T>` |
| `nullable: true` | `T \| null` |
| `oneOf` / `anyOf` of primitives | union `A \| B` |
| `allOf` | intersection `A & B` |
| `oneOf` of complex objects with discriminator | `unknown` — flag in schema-todos |

---

## Quick reference

| Phase | What | Sub-agent | Model | Input from parent |
|-------|------|-----------|-------|-------------------|
| 0 | Spec ingest (URL or local, YAML parse, $ref resolution) | (parent) | Opus | First positional arg + flags |
| 1 | Gap analysis, classification, large-spec gate, STOP | (parent) | Opus | Parsed spec object |
| 2 | Handler generation + intelligent merge, one run per tag (sequential) | `openapi-handlers` | Sonnet | tagName, operations (resolved), sharedSchemas, existingFilePath, noAuth |
| 3 | SWR hook generation (single run, after Phase 2) | `openapi-hooks` | Haiku | GET operations per tag, handler import map, noAuth |
| 4 | Lint + type-check + consumption check + census | `openapi-validation` | Haiku | Emitted file paths, POTENTIAL RENAME list, flag lists |
