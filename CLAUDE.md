# CLAUDE.md — Project Overview

This file describes **what** this project is: the tech stack, structure, and high-level patterns. The **operational rules** an agent must follow when generating or editing code live in [`.claude/CONVENTIONS.md`](./.claude/CONVENTIONS.md) — that file is the source of truth for styling, accessibility, performance, Figma translation, naming conventions, component reuse, and the STOP protocol used by sub-agents.

> **Skills and agents `Read` `.claude/CONVENTIONS.md` at their Step 0 before generating code.** If you're editing a convention, edit it there — not in this file. CLAUDE.md mentions operational rules only as one-line summaries with a link to the canonical section.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS 3 + SASS (`.sass` indented syntax, NOT `.scss`)
- **UI Library:** PrimeReact 10 + PrimeIcons 7
- **State Management:** Zustand
- **Forms:** Formik + Yup
- **Animations:** Framer Motion (use `m` + `LazyMotion`, NEVER `motion`)
- **Data Fetching:** SWR + custom `customFetch` wrapper (`src/api/customFetch.ts`)
- **Package Manager:** pnpm
- **Runtime / toolchain versions:** see **`package.json` → `engines`** (node, pnpm). Read it when the exact constraint matters — e.g. before relying on a runtime API whose availability depends on the node major.

> **Why no version numbers here.** `engines` is machine-enforced and is the single source of truth; a copy in a doc is unenforced and drifts silently. It did — this file and `README.md` each carried their own stale node/pnpm constraints, and had even drifted apart from *each other*. The framework versions above are deliberately **majors only**: those are architectural context an agent needs up front (`Next.js 16 App Router` changes how you write a page; `Tailwind 3` vs 4 changes the config shape), they change rarely, and they stayed accurate while the precise constraints rotted. **Rule: a major is context and may live here; anything more precise is a constraint and belongs only in `package.json`.**

## Automation Skills

> **MANDATORY: For any of the tasks below, ALWAYS invoke the matching skill instead of writing files manually.** Even when the user does not type the slash command explicitly (e.g. "add a screen for settings", "create a modal to confirm deletion"), recognize the intent and invoke the skill. The skills encapsulate every convention in [`.claude/CONVENTIONS.md`](./.claude/CONVENTIONS.md) and generate files in the correct locations.

| Task | Skill | Example invocation |
| ---- | ----- | ------------------ |
| Initialize a fresh template clone into a new product (rename app, gen `.env.local`/`AUTH_SECRET`) — run ONCE first | `/init-project` | `/init-project Acme Dashboard` |
| Create a new screen + page route (+ proxy.ts update) | `/new-screen` | `/new-screen UsersPage protected /dashboard/users` |
| Create a paginated DataTable screen (with `useTableParams`, filters, search, sorting) | `/new-table` | `/new-table UsersPage users /dashboard/users` |
| Create a new reusable component | `/new-component` | `/new-component CustomTable client` |
| Create a new custom React hook | `/new-hook` | `/new-hook useDebounce` |
| Create a new Zustand store | `/new-store` | `/new-store Cart` |
| Create a new modal type | `/new-modal` | `/new-modal ConfirmDelete` |
| Create a skeleton loader for an existing component or screen | `/new-skeleton` | `/new-skeleton ProductCard` |
| Import a full Figma design (orchestrates tokens → assets → components → layouts → screens) | `/figma-design-import` | `/figma-design-import https://figma.com/design/.../?node-id=X-Y` |
| Import a full Claude Design prototype — a "Standalone HTML" export — to code (unpack → tokens → assets → components → layouts → screens) | `/claude-design-import` | `/claude-design-import https://inferencia-demo.s3.amazonaws.com/.../PROTOTIPO.html` |
| Import a full OpenAPI YAML spec and wire the backend layer (handlers + GET hooks, no UI) — typically runs AFTER `/figma-design-import` or `/claude-design-import` | `/openapi-import` | `/openapi-import ./openapi.yaml --tags=users,products` |
| Scaffold a single API resource by hand (no spec) — `src/api/{resource}.ts` with the canonical interleaved layout | `/new-api-resource` | `/new-api-resource Users` |

> **`/init-project` is enforced on fresh clones.** Until it runs (sentinel: `package.json` `name` is still `linkchar-next-template`), two guards block work: the Husky **`pre-commit`** hook refuses commits, and a Claude **PreToolUse** hook (`.claude/hooks/require-init.mjs`) refuses `Edit`/`Write`. Running `/init-project` renames the app and disarms both. Maintainers working on the **template itself** bypass with `LINKCHAR_TEMPLATE_DEV` — set it once in `.claude/settings.local.json` (`"env"` key, gitignored) and both guards read it (the shell env also works and takes precedence).

Skills live in `.claude/skills/{skill-name}/SKILL.md`, grouped into subfolders by purpose (`scaffold/` for the `/new-*` generators, `orchestrators/` for the Figma / Claude Design / OpenAPI orchestrators, `init-project/` at the root). Subfolders are for organization only — Claude Code discovers skills recursively and the slash command is still the skill's own directory name (e.g. `/new-component`), independent of the parent folder. Do not duplicate their logic in chat — invoke them.

### When a sub-agent silently doesn't load

Sub-agents live in `.claude/agents/**` (scanned recursively). **A project agent can silently fail to load**: no error, no warning — it just never appears in the available-agent list, and every skill that delegates to it breaks at that step. This cost two full debugging rounds; 4 of this repo's 17 agents were stuck for weeks, which meant **`/openapi-import` was dead** (missing 3 of its 4 agents) without anyone noticing.

**The remedy that works: make a real content change to the file, then restart Claude Code.**

That is the only thing that reliably revives a stuck agent. Established by controlled experiment:

| What was done to the file | Result |
| --- | --- |
| content edited | ✅ loads |
| `touch` only (mtime changes, bytes identical) | ❌ still missing |
| nothing (control, across two restarts) | ❌ still missing |

So it behaves like a cache that **remembers a failed parse and is keyed on content, not mtime** — restarting alone does not clear it. The trigger for the initial failure is unknown and looks non-deterministic (upstream: [#14018](https://github.com/anthropics/claude-code/issues/14018)); the stuck files were valid and byte-identical in frontmatter structure to the ones that loaded.

**Do NOT waste time on these — all were tested and ruled out as causes:** a colon-space in `description:` (an agent carrying two of them loads fine; re-adding one to a working agent did not break it), description length, `model:` value, mtime, BOM/CRLF, invisible unicode, an agent cap, `permissions.deny`, managed-settings, `~/.claude/agents`.

**Still worth doing on hygiene grounds — `.claude/agents/` is for agent files ONLY.** A `.md` there without valid `name:`/`description:` frontmatter is not an agent; shared docs that agents merely `Read` belong in **`.claude/docs/`** (that's why `design-import-shared.md` lives there). This was once believed to poison the scan of its own directory — that turned out to be confounded with a content change and is **not** established. Keep the separation because it's correct, not as a fix.

After adding or renaming an agent, **restart and verify it appears** before relying on it.

### Keep `figma-design-import` and `claude-design-import` in sync

These two orchestrators are deliberately parallel: the **same** bottom-up pipeline (tokens → assets → components → layouts → screens → validation), the same conventions, and the same output quality — only the **source-ingestion front-end** differs (Figma MCP vs the local `unpack.mjs` extractor). The goal is that a design lands with equal fidelity no matter which flow produced it.

**When you change or improve one flow — the orchestrator `SKILL.md` OR any of its sub-agents — apply the equivalent change to its counterpart in the same commit**, so the two do not drift. Counterpart map:

| figma-design-import | claude-design-import |
| ------------------- | -------------------- |
| `skills/orchestrators/figma-design-import/SKILL.md` | `skills/orchestrators/claude-design-import/SKILL.md` |
| `agents/figma/figma-tokens.md` | `agents/claude-design/claude-design-tokens.md` |
| `agents/figma/figma-assets.md` | `agents/claude-design/claude-design-assets.md` |
| `agents/figma/figma-components.md` | `agents/claude-design/claude-design-components.md` |
| `agents/figma/figma-layouts.md` | `agents/claude-design/claude-design-layouts.md` |
| `agents/figma/figma-scaffold.md` | `agents/claude-design/claude-design-scaffold.md` |
| `agents/figma/figma-screen.md` | `agents/claude-design/claude-design-screen.md` |
| `agents/shared/design-validation.md` | *(same file — already shared; a validation change benefits both automatically)* |

**Sync the SHARED concerns**: styling / token / accessibility / performance rules, the STOP protocol, the workload-ledger footer, `container-custom` handling, the mock-data (`MOCK_*` + `// TODO: openapi-import`) convention, the output/report format, and any bug fix or quality improvement to a step's logic.

**Do NOT force-sync the source-ingestion mechanics**, which diverge *by design*: how the design context is read (Figma `get_design_context` / screenshots / asset URLs vs `unpack.mjs`'s `jsx/`, `tokens.json`, `nav-graph.json`, local `assets/img/`), the "spec gate" (a Figma `nodeId` vs a source-JSX file path), asset acquisition (download vs decode-from-manifest), navigation (Figma frames → screens vs the prototype's stack-router → hybrid route/step/modal mapping), and responsive strategy (Figma desktop+mobile frames vs target detection). Improving one of these does not require touching the other.

> **Screen vs DataTable**: when the requested screen is a list/table with pagination, filters, search or sorting, prefer `/new-table` over `/new-screen` — the latter generates a blank screen, the former scaffolds the full stack (types + API + screen + SASS + page wrapper) wired to `useTableParams`.

## Project Structure

```text
src/
├── api/              # API functions using customFetch
├── app/              # Next.js App Router (pages, layouts, API routes)
├── assets/           # Static files (fonts/, icons/, images/, videos/)
├── components/       # Reusable UI components (each in its own folder)
│   ├── ComponentName/    # ComponentName.tsx + ComponentName.sass
│   ├── inputs/           # Input-related components (InputContainer, InputError)
│   └── modals/           # Modal components (LoadingModal, StateModal, ToastNotifications)
├── constants/        # App constants (auth.ts, env.ts)
├── hooks/            # Custom React hooks (camelCase: useXxx.ts)
├── layouts/          # Layout components (each in its own folder)
│   ├── AuthLayout/       # AuthLayout.tsx + AuthLayout.sass
│   ├── DashboardLayout/  # DashboardLayout.tsx + DashboardLayout.sass
│   └── GeneralLayout/    # GeneralLayout.tsx + GeneralLayout.sass
├── providers/        # React context/providers
├── screens/          # Page-level components (each in its own folder)
│   ├── ScreenName/       # ScreenName.tsx + ScreenName.sass
│   └── auth/             # Authentication screen components
├── stores/           # Zustand stores (camelCase: xxxStore.ts)
├── styles/           # Global SASS styles only
│   ├── index.sass        # Entry point (fonts, Tailwind layers, global import)
│   ├── general.sass      # Global reset and base styles
│   └── mixins.sass       # Shared SASS mixins
├── types/            # TypeScript type definitions
└── utils/            # Utility functions
```

## Architecture Pattern: Pages vs Screens

> To create a new screen, use the `/new-screen` skill — it supports `auth`, `public`, and `protected` page types and updates `src/proxy.ts` when needed.

- `src/app/**/page.tsx` files are **thin wrappers**: they only export metadata and render a Screen component.
- All page logic and UI lives in `src/screens/` components.
- Route protection is defined in `src/proxy.ts`:
  - `AUTH_PATHS`: routes for unauthenticated users only (login, signup, password recovery).
  - `PUBLIC_PATHS`: routes accessible to everyone (must be added explicitly).
  - Anything else is protected and redirects to `/login` without a valid session.

### Route Groups & Layouts

- Use Next.js route groups `(group-name)` for shared layouts (e.g., `(auth-layout)/` wraps login, signup, password recovery).
- Each route group has its own `layout.tsx`.
- Layouts in `src/app/` are **thin wrappers** that delegate to layout components in `src/layouts/`.
- Layout components live in `src/layouts/LayoutName/LayoutName.tsx` with colocated styles.
- `GeneralLayout` handles auth token/user fetching and wraps with `ProvidersContainer`.

## Design Tokens (Figma & Claude Design imports)

Color, typography, and breakpoint tokens added through `/figma-design-import` or `/claude-design-import` are tracked in `design-tokens-map.md` at the project root — a **single map shared by both import flows**. That file is the canonical source-variable → Tailwind token mapping (the source variable is a Figma variable for Figma imports, or a Claude Design `THEMES` key / rawScan value for Claude Design imports) — it documents which existing token each source variable was reused into, which new tokens were created, and the reasoning (heuristic match, namespace decision, etc.).

**Consult `design-tokens-map.md` BEFORE manually adding a new color/typography/breakpoint token to `tailwind.config.js`** to avoid duplicate tokens across imports (from either source). If you create a token manually (outside the agent flow), add a row to the map so future imports see it. The `figma-tokens` and `claude-design-tokens` sub-agents maintain the map automatically during their runs.

The `surface-50`…`surface-900` namespace is immutable and template-shipped (not import-derived), so it never appears in `design-tokens-map.md`. Same for Tailwind defaults (`red-600`, `blue-600`, etc.).

## Modals & Notifications System

Modals and notifications are managed globally via `useModalStore` (Zustand):

```tsx
// Consume with atomic selectors — never destructure the whole store.
// See .claude/CONVENTIONS.md > Zustand selectors
const openModal = useModalStore((s) => s.openModal)
const closeModal = useModalStore((s) => s.closeModal)
const setNotification = useModalStore((s) => s.setNotification)

// Open a loading modal
openModal('loadingModal', { title: 'Loading...', content: 'Please wait' })

// Close it
closeModal('loadingModal')

// Show a toast notification
setNotification({ severity: 'success', summary: 'Done!' })
setNotification({ severity: 'error', summary: 'Error', detail: 'Something failed', life: 5000 })
```

To add a new modal type, use the `/new-modal` skill — it handles all four steps (type declaration in `modalStore.ts`, `ModalPayloads` entry, component in `components/modals/`, and registration in `providers/ModalsProvider.tsx`).

> Modal scope rules (global `ModalsProvider` vs local mount on a single screen) are documented in [`.claude/CONVENTIONS.md > Bundle & Performance Architecture`](./.claude/CONVENTIONS.md#bundle--performance-architecture).

## State Management (Zustand)

> To create a new store, use the `/new-store` skill — it generates the file with the correct naming (`xxxStore.ts` / `useXxxStore`), the `create<StoreType>()` boilerplate, and the conventions checklist (initial state as `undefined`, no derived data, optional `persist` middleware).

- Stores are in `src/stores/` with `create<StoreType>()` pattern.
- Stores do NOT need a `'use client'` directive — `create()` runs no hooks at import; the store hook only runs inside consumers, which already carry `'use client'`.
- Named `useXxxStore` and exported as default.
- **Consume with atomic selectors** (`useStore((s) => s.field)`), one value per call — never destructure the whole store (`useStore()`), which re-renders on every state change. See [`.claude/CONVENTIONS.md > Zustand selectors`](./.claude/CONVENTIONS.md#zustand-selectors).

## Forms (Formik + Yup)

- Use `useFormik<FormType>()` hook pattern.
- Validation with `Yup.object({})` schema.
- `validateOnChange: false` to validate only on submit.
- Use `InputContainer` component to wrap inputs with label and error display.

> Per-input rules (autoComplete tokens, `aria-label` on icon-only buttons, focus-on-error handling, etc.) live in [`.claude/CONVENTIONS.md > Accessibility`](./.claude/CONVENTIONS.md#accessibility).

## API Layer

- API functions in `src/api/` use the `customFetch` wrapper.
- `customFetch` handles auth token injection, auto-refresh on 401, and error handling.
- API routes live in `src/app/api/`.
- Cache controls: `customFetch` defaults to `cache: 'no-store'`. Override per call with `next: { revalidate: N }` for ISR or `cache: 'force-cache'` for full caching.

## Environment Variables

- All env vars are exported from `src/constants/env.ts`.
- Never use `process.env.XXX` directly in components — always import from `@/constants/env`.
- Public vars use `NEXT_PUBLIC_` prefix.
- See `.env.example` for the full list of required variables.
- `APP_ENV` is validated in `constants/env.ts` to be one of `production`, `staging`, or `development`.

## Swagger/OpenAPI-to-Code Workflow

### Slash Commands

- **`/openapi-import {spec-path-or-url} [--tags=a,b,c] [--force] [--no-auth]`** — full orchestrator. Ingests a YAML spec, generates one `src/api/{tag}.ts` per tag and one `src/hooks/use{Resource}.ts` per resource (GET endpoints only), and runs lint + type-check. Use this AFTER `/figma-design-import` or `/claude-design-import` scaffolds the UI (both leave screens rendering `MOCK_*` data with a `// TODO: openapi-import` marker for this flow to replace). Delegates to four sub-agents in `.claude/agents/openapi/`: `openapi-handlers` (Sonnet), `openapi-hooks` (Haiku), `openapi-spec-validate` (Haiku) for input spec audit, `openapi-code-validate` (Haiku) for emitted code audit.
- **`/new-api-resource {ResourceName} [list,detail,create,update,delete] [no-auth]`** — single-file manual scaffold. No spec input, no merge logic. Use for ad-hoc endpoints not yet in the spec or for quick prototyping.

### Conventions

- **Layout** (current): types are **interleaved** with handlers in `src/api/{resource}.ts`. Each handler section starts with a `// ── {functionName} ──` header followed by the type(s) the handler needs, then the handler itself. Shared response types (e.g. `UserType` used by both list and detail) sit above the first handler that consumes them.
- **Types**: use `interface` (not `type alias`) for object shapes; every model carries the `Type` suffix (`UserType`, `CreateUserPayloadType`).
- **API client**: `src/api/{resource}.ts` — ALWAYS use `customFetch` from `@/api/customFetch`. Token is the LAST positional argument in authenticated handlers; OMITTED entirely for public endpoints.
- **SWR Hooks** (GET only): `src/hooks/use{Resource}.ts` — `useSWR(token ? key : null, fetcher)` pattern with atomic `useUserStore((s) => s.token)` selector. Mutations stay imperative inside `onSubmit` handlers, matching the auth flow.

## Git Workflow

### Commit Convention

After each significant implementation (new screen, new component, new feature, bug fix, refactor), create a commit with this format:

```text
[ TYPE ] Description of the change
```

**Types:**

- `FEATURE` — New functionality or screen.
- `ADD` — Add a new file, config, or asset (not a full feature).
- `UPDATE` — Enhancement to existing functionality.
- `FIX` — Bug fix.
- `REFACTOR` — Code restructuring without behavior change.
- `STYLE` — Visual/styling changes only.
- `CHORE` — Config, dependencies, tooling changes.

**Examples:**

```text
[ FEATURE ] Add login screen with form validation
[ UPDATE ] Add loading state to dashboard table
[ FIX ] Correct token refresh loop on expired sessions
[ REFACTOR ] Extract date filters into reusable component
[ STYLE ] Update button variants to match new design system
[ CHORE ] Add style-dictionary for design tokens
```

**Keep the message SHORT — single line, no body, no bullet list.** One terse phrase that names the change (under ~70 characters). Examples to mirror from this repo's history: `[ ADD ] Cache & Security Headers`, `[ UPDATE ] Improve Sentry replayIntegration loading`, `[ UPDATE ] Migrate Node engine 22 -> 24`. Detail belongs in the PR description, not the commit subject. If a change is too large to summarize in one line, it should be split into multiple commits.

### Pre-Commit Steps

Before every commit, **always** run ESLint with auto-fix to ensure code quality:

```bash
pnpm run lint-check --fix
```

This will auto-fix: import order, formatting, unused imports, type imports, and other fixable rules.

### Commit Flow

1. Finish the implementation.
2. Run `pnpm run lint-check --fix` to auto-fix lint issues.
3. Run `pnpm run type-check` to verify types.
4. Stage the relevant files.
5. Commit with the `[ TYPE ] description` format.

## Dev Tools

- **React Scan**: Automatically loaded in development (`APP_ENV === 'development'`) via `next/script` in root layout. Highlights unnecessary re-renders.
- **Bundle analysis**: `pnpm run analyze` uses Turbopack-native `next experimental-analyze` (Next 16.1+). Output lands in `.next/diagnostics/analyze/`.

## Cleanup before production

The template ships with `src/app/sentry-example-page/page.tsx` + `src/app/api/sentry-example-api/route.ts` — these exist only to validate that Sentry is correctly wired up and report errors as expected. **Delete both files** (and remove `/sentry-example-page` from `next.config.ts` rewrites / `robots.ts` if applicable) before shipping to production. The page contains inline styles with hardcoded hex colors that intentionally don't follow the project's token system — that's expected for a throwaway test page, but it WILL flag in `design-validation` if left in. Validating Sentry: open the page, click the buttons, confirm the errors appear in your Sentry dashboard, then delete.

## Testing

> ⚠️ **This section is pending review — treat it as a description of the tooling, not as guidance.** It previously documented a Vitest + `@testing-library/react` unit-testing setup, in detail, that **does not exist in this project**: no `vitest`, no `@testing-library/*`, no `vitest.config.*`, no `__tests__/` folders, and neither `pnpm test` nor `pnpm test-unit` is a real script. It also said "unit tests only (NOT E2E)" while the only thing installed is an E2E runner. All of it was fiction. Cut back to what's verifiable until the testing strategy is decided.

**What's actually installed: Cypress (E2E).**

- `cypress` + helpers (`cypress-dotenv`, `cypress-file-upload`, `cypress-mailslurp`), `eslint-plugin-cypress`, and `playwright-webkit` for cross-browser runs. Versions: `package.json`.
- Config: `cypress.config.ts` at the repo root.
- Commands: `pnpm run test-open` (interactive) · `pnpm run test-run` (headless).
- **No specs exist yet** — there is no `cypress/` directory. The runner is configured but unused.

**Until this is decided, do NOT scaffold tests unprompted**, and do not follow the removed Vitest conventions — writing `src/**/__tests__/*.test.ts` against a framework that isn't installed produces code that cannot run.
