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

Skills live in `.claude/skills/{skill-name}/SKILL.md` — **all 12 at ONE level, never nested**. Do not duplicate their logic in chat — invoke the skill.

> ⚠️ **Keep this directory FLAT. Skill discovery is NOT recursive**: Claude Code loads only `.claude/skills/{name}/SKILL.md` at one level, so grouping them into subfolders silently unloads every one it moves — the slash command just returns `Unknown command`.
>
> This is not hypothetical. Commit `4d30140` (2026-07-08) grouped the skills into `orchestrators/` and `scaffold/` on the unverified assumption that discovery recursed; **11 of 12 skills were dead for twelve days** and nobody noticed, because the workflows kept working: when the intent is recognized the `SKILL.md` gets read from disk and followed by hand, producing the same output as a loaded skill. Confirmed across 7 project transcripts — the `Skill` tool was invoked **zero** times. Flattened again on 2026-07-22, which also meant rewriting 105 relative links (`../../../` → `../../`) and 8 external references. The failure mode is silent in exactly the way [a stuck sub-agent](#when-a-sub-agent-silently-doesnt-load) is.
>
> **Agents, in the same `.claude/` tree, DO recurse** (`.claude/agents/figma/*.md`, `.claude/agents/claude-design/*.md` all load from subfolders). That asymmetry is the trap — it makes it natural to assume skills behave the same. They do not: **agents may nest, skills may not.**

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

**The shared substance lives in ONE place, so it can't drift — there is no manual "mirror it to the twin in the same commit" step.** Two single sources of truth, both `Read` at pre-flight by every step agent of both flows:

- **Code conventions** — what valid *output* looks like (tokens, typography, color/no-hex, a11y, `container-custom`, SASS) → [`.claude/CONVENTIONS.md`](./.claude/CONVENTIONS.md).
- **Import-translation rules** — how to translate a design into that code (color clustering, typography snapping, radius, brand gradients, mock-data, forms) — **plus the agent protocol** (delegation contract, STOP emission, workload footer, report shape) → [`.claude/docs/design-import-shared.md`](./.claude/docs/design-import-shared.md).

Edit either file **once** and both flows inherit automatically; `design-validation` is likewise one shared agent, and **`.claude/scripts/` holds EVERY executable of the import flows**, whether shared or single-owner: `render-audit.mjs` (the runtime invariant sweep `design-validation` runs at its step 15, called by both flows) and `unpack.mjs` (the Claude Design extractor, called only by `claude-design-import`). The folder is organised by KIND, not by ownership — a script lives here even when one flow owns it, so there is one place to look for "what code, as opposed to prose, does this pipeline run". A script is the right home for anything that must be *measured* rather than judged: it is deterministic across runs, it costs no tokens beyond its own output, and — unlike an agent — it cannot report a check as passing without having performed it. **Each agent's own `.md` holds ONLY its source-ingestion mechanics** — which diverge *by design* and are never synced to the twin.

**Decision test when you change something:**

- Shared **convention / translation rule / protocol** (would apply to both flows)? → edit the shared file (`CONVENTIONS.md` or `design-import-shared.md`) **once**; touch neither agent. Both inherit.
- **Source-ingestion mechanics** of one format? → edit only that agent's `.md`; the twin is unaffected. These diverge by design: how the design context is read (Figma `get_design_context` / screenshots / asset URLs vs `unpack.mjs`'s source tree, `tokens.json`, `nav-graph.json`, local `assets/img/`), the "spec gate" (a Figma `nodeId` vs a source-file path/region), asset acquisition (download vs decode-from-manifest), navigation (Figma frames → screens vs the prototype's stack-router → hybrid route/step/modal mapping), and responsive strategy (Figma desktop+mobile frames vs target detection).
- A **new format-specific rule** (e.g. dclogic's empty-`components.json` handling, or a Figma-variable quirk) lives in that flow's agent only — it has no counterpart to sync.

**The one documented exception: `## Workload tracking` is duplicated in both `SKILL.md` files ON PURPOSE.** By the test above it is protocol and belongs in `design-import-shared.md` — but that file is `Read` at pre-flight by **every step agent of both flows**, and the workload ledger is instruction only the *orchestrator* ever acts on. Moving it there would load it into ~7 sub-agent contexts per import to serve a single reader. So it stays duplicated, and both copies carry a banner saying so.

> This exception is **not** a precedent for "duplicating is fine when it's convenient" — it is narrowly about *audience*: orchestrator-only content in a file whose readers are the step agents. Anything a step agent acts on still goes in the shared file, once. And the cost is real, not theoretical: within days of being written the two copies had already diverged (one was missing a verification command the other had). **If you edit one, edit the other in the same commit.**

The old rigid 1:1 map is now just a **navigation aid** (find your twin to compare), NOT a "move them together" mandate:

| figma-design-import | claude-design-import |
| ------------------- | -------------------- |
| `skills/figma-design-import/SKILL.md` | `skills/claude-design-import/SKILL.md` |
| `agents/figma/figma-tokens.md` | `agents/claude-design/claude-design-tokens.md` |
| `agents/figma/figma-assets.md` | `agents/claude-design/claude-design-assets.md` |
| `agents/figma/figma-components.md` | `agents/claude-design/claude-design-components.md` |
| `agents/figma/figma-layouts.md` | `agents/claude-design/claude-design-layouts.md` |
| `agents/figma/figma-scaffold.md` | `agents/claude-design/claude-design-scaffold.md` |
| `agents/figma/figma-screen.md` | `agents/claude-design/claude-design-screen.md` |
| `agents/shared/design-validation.md` + `docs/design-import-shared.md` | *(same files — already shared; a change benefits both automatically)* |

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
- Config: `cypress.config.ts` at the repo root — `specPattern: 'src/cypress/e2e/**/*.cy.{ts,tsx}'`, `baseUrl: http://localhost:3000` (so the app must be running).
- Commands: `pnpm run test-open` (interactive) · `pnpm run test-run` (headless).
- **Specs DO exist** — 8 of them, under **`src/cypress/e2e/`** (not a root `cypress/`): the auth flow (`Login`, `SignUp`, `EmailValidation`, `PasswordRecovery`, `ChangePassword`, `Flow`, `DeleteTestUser`) plus `NavigationProtection.cy.ts`. Alongside them: `src/cypress/support/` (`commands.ts`, `e2e.ts`), `src/cypress/utils/` (shared helpers), and its own `tsconfig.json`.
  > This bullet previously read *"No specs exist yet — there is no `cypress/` directory. The runner is configured but unused."* That was false on both counts, in a section whose whole purpose was to purge fiction. The directory is `src/cypress/`, and looking for a root `cypress/` is what hid it.

**`src/cypress/utils/` encodes live DOM contracts — components must not break them.** `checkInputError.ts` selects `.parents('.InputContainer').find('.InputError')`, `checkPasswordErrors.ts` likewise leans on `PasswordValidator`'s markup. Changing or extending those components means keeping the root class and the error element's descendant relationship intact, or the auth specs go red.

**Do NOT scaffold NEW test infrastructure unprompted** (the testing strategy beyond the auth flow is still undecided), and do not follow the removed Vitest conventions — writing `src/**/__tests__/*.test.ts` against a framework that isn't installed produces code that cannot run.
