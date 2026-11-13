# CLAUDE.md — Project Overview

This file describes **what** this project is: the tech stack, structure, and high-level patterns. The **operational rules** for generating or editing code — styling, accessibility, performance, design translation, naming, component reuse, the sub-agents' STOP protocol — live in `CONVENTIONS.md` of the **`linkchar-next` Claude Code plugin**, together with every skill, sub-agent and pipeline script.

> **Skills, agents and conventions are not in this repo.** `.claude/settings.json` enables `linkchar-next` from the `linkchar` marketplace (`Linkcharsoft/linkchar-claude-plugins`). At session start the plugin injects its own context: its root path, the mandatory skills table and the `CONVENTIONS.md` pointer. To change a skill, agent or convention, edit that repo, not this one. First time on a machine: `gh auth login && gh auth setup-git`, then `claude plugin install linkchar-next@linkchar --scope project`.

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

## Skills & agents

Every slash command (`/new-screen`, `/new-table`, `/figma-design-import`, …) and sub-agent comes from the plugin; sub-agents are namespaced `linkchar-next:<name>`.

> **`/init-project` is enforced on fresh clones.** Until it runs (sentinel: `package.json` `name` is still `linkchar-next-template`), two guards block work: the Husky **`pre-commit`** hook refuses commits, and a Claude **PreToolUse** hook (`.claude/hooks/require-init.mjs`) refuses `Edit`/`Write`. Running `/init-project` renames the app and disarms both. Maintainers working on the **template itself** bypass with `LINKCHAR_TEMPLATE_DEV` — set it once in `.claude/settings.local.json` (`"env"` key, gitignored) and both guards read it (the shell env also works and takes precedence).

### Optional modules

Some features are not wanted by every product. The template ships each one as a **working, inert base** in `src/` — it lints, type-checks and builds on every template change, so it cannot drift, but it does nothing until its env vars are set and nothing mounts it. A dedicated plugin agent (`linkchar-next:init-*`) then **completes** that base for one project (or, for features the template ships by default, **removes** them). Agents are named after the provider or feature they touch (`init-{provider}` completes a base, `init-remove-{feature}` strips a default), so the name says which vendor a project depends on.

| Agent | Kind | What it does |
| ----- | ---- | ------------ |
| `init-resend` | add | Completes the contact-form module (Resend): brand, language, fields, attachments, mount point, env. Base: `src/app/api/contact/route.ts`, `src/constants/contactForms.ts`, `src/utils/contactEmail.ts`, `src/hooks/useContactForm.ts`, `ContactForm` + `HoneypotField` + `TurnstileWidget`. |
| `init-linkchar-cms` | add | Adds Linkchar's CMS (`@linkcharsoft/cms`): schema in `src/cms/schema.ts`, Supabase, the editor panel at `/cms` (its own Supabase Auth, invited users only), site readers and Draft Mode preview. **No base in the template** — the package is private, so its `linkchar-cms init` writes the starting files and the agent adapts them: the site moves into `src/app/(site)/` (see CONVENTIONS > App root), the proxy hands `/cms` to the panel, env constants, CSP, Amplify. Alternative to `init-storyblok`: it removes the Storyblok base. |
| `init-storyblok` | add | Completes the Storyblok CMS layer: editable pages (one singleton story per page, bundled fallback in `src/constants/content/`, field-by-field override) and/or a collection (folder → listing + `[slug]` detail, e.g. a blog), Draft Mode targets, env. Base: `src/api/storyblok.ts` + `cms.ts` + `blog.ts`, `src/utils/storyblok.ts`, `src/types/cms.ts` + `blog.ts`, `StoryblokBridge`, `src/app/api/draft/route.ts`. Screens never import Storyblok — each `page.tsx` fetches and passes domain objects down. |

Two ways to run one, same result: `/init-project` asks which modules to set up (its Step 9) and delegates; or, any time later, ask Claude to *run the `init-resend` agent* — the main session gathers the brief the agent's `.md` lists and delegates the same way. There is deliberately no wrapper skill per agent: that would be two files to keep in sync for one task. The shared protocol (brief, file boundary, three-gate validation, "the invoker commits, one commit per module", report shape) lives in the plugin's `docs/init-modules-shared.md`; each agent's `.md` holds only its own mechanics. Planned next, in this order: `init-remove-sentry`, `init-remove-auth`.

**A sub-agent can also silently fail to load** — no error, it just never appears in the available-agent list, and every skill that delegates to it breaks at that step. Symptom check, remedy, and the causes already ruled out: the plugin's `docs/agent-loading-troubleshooting.md`. After updating the plugin, **restart and verify the agent appears** (and check `/plugin` for errors) before relying on it.

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
│   └── content/          # Bundled fallback content for the Storyblok module (rendered when a story is missing or empty)
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
  - `SENTRY_TUNNEL_PATH` (`/monitoring`) is exempted in `shouldBypassProxy` and must stay in sync with `tunnelRoute` in `next.config.ts` — without the exemption, error reporting from logged-out users silently dies (envelopes get 307'd to `/login`).

### Route Groups & Layouts

- Use Next.js route groups `(group-name)` for shared layouts (e.g., `(auth-layout)/` wraps login, signup, password recovery).
- Each route group has its own `layout.tsx`.
- Layouts in `src/app/` are **thin wrappers** that delegate to layout components in `src/layouts/`.
- Layout components live in `src/layouts/LayoutName/LayoutName.tsx` with colocated styles.
- `GeneralLayout` handles auth token/user fetching and wraps with `ProvidersContainer`.

### Error Boundaries

- **ONE root boundary, deliberately**: `src/app/error.tsx` → `src/screens/ErrorPage/` (Sentry `captureException` on mount + `reset` retry). It renders inside the root layout, so the shell and providers survive. Per-segment `error.tsx` / `loading.tsx` files are per-project decisions — the template ships none.
- `src/app/global-error.tsx` catches ONLY root-layout failures and **replaces the entire root layout**, so nothing the layout provides exists there: it must import `@/styles/index.sass`, set its title via `<head><title>` (a `metadata` export is inert in a `'use client'` file), and **never load `next/font`** — not even through a shared module (breaks every route in dev under `reactCompiler`; the Google `<link>` + inline CSS variable pattern is the way — see the plugin's `CONVENTIONS.md > Font Loading`).
- Neither screen is visible in dev (the overlay covers them). Production preview: `pnpm run serve`, then `/sentry-example-page` → "Client Break" throws during render and lands on `ErrorPage`; global-error requires a temporary `throw` in `src/app/layout.tsx`.

## Design Tokens (Figma & Claude Design imports)

Color, typography, and breakpoint tokens added through `/figma-design-import` or `/claude-design-import` are tracked in `design-tokens-map.md` at the project root — a **single map shared by both import flows**. That file is the canonical source-variable → Tailwind token mapping (the source variable is a Figma variable for Figma imports, or a Claude Design `THEMES` key / rawScan value for Claude Design imports) — it documents which existing token each source variable was reused into, which new tokens were created, and the reasoning (heuristic match, namespace decision, etc.).

**Consult `design-tokens-map.md` BEFORE manually adding a new color/typography/breakpoint token to `tailwind.config.js`** to avoid duplicate tokens across imports (from either source). If you create a token manually (outside the agent flow), add a row to the map so future imports see it. The `figma-design-tokens` and `claude-design-tokens` sub-agents maintain the map automatically during their runs.

The `surface-50`…`surface-900` namespace is immutable and template-shipped (not import-derived), so it never appears in `design-tokens-map.md`. Same for Tailwind defaults (`red-600`, `blue-600`, etc.).

## Modals & Notifications System

Modals and notifications are managed globally via `useModalStore` (Zustand):

```tsx
// Consume with atomic selectors — never destructure the whole store.
// See CONVENTIONS.md (linkchar-next plugin) > Zustand selectors
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

> Modal scope rules (global `ModalsProvider` vs local mount on a single screen) are documented in the plugin's `CONVENTIONS.md > Bundle & Performance Architecture`.

## State Management (Zustand)

> To create a new store, use the `/new-store` skill — it generates the file with the correct naming (`xxxStore.ts` / `useXxxStore`), the `create<StoreType>()` boilerplate, and the conventions checklist (initial state as `undefined`, no derived data, optional `persist` middleware).

- Stores are in `src/stores/` with `create<StoreType>()` pattern.
- Stores do NOT need a `'use client'` directive — `create()` runs no hooks at import; the store hook only runs inside consumers, which already carry `'use client'`.
- Named `useXxxStore` and exported as default.
- **Consume with atomic selectors** (`useStore((s) => s.field)`), one value per call — never destructure the whole store (`useStore()`), which re-renders on every state change. See the plugin's `CONVENTIONS.md > Zustand selectors`.

## Forms (Formik + Yup)

- Use `useFormik<FormType>()` hook pattern.
- Validation with `Yup.object({})` schema.
- `validateOnChange: false` to validate only on submit.
- Use `InputContainer` component to wrap inputs with label and error display.

> Per-input rules (autoComplete tokens, `aria-label` on icon-only buttons, focus-on-error handling, etc.) live in the plugin's `CONVENTIONS.md > Accessibility`.

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

## Security

- **Headers** live in `next.config.ts`, each with a why-comment. The CSP ships in **Report-Only** mode and is emitted **only outside production** (dev + staging): nothing is blocked; violations log to the browser console and, on staging only, POST to Sentry (`report-uri` derived from the DSN — gated to staging so browser-generated reports don't eat the error quota). In production the header would have no report endpoint, so it was dropped there rather than left spamming users' consoles. Hardening path once reports come back clean: per-request nonces, then switch the header key to `Content-Security-Policy` and emit it in production too.
- **Console output is stripped in production**: `compiler.removeConsole` removes every `console.*` call (client *and* server bundles — SWC has no per-runtime switch). A staging build runs with `NODE_ENV=production`, so `isProduction` in `next.config.ts` excludes `APP_ENV === 'staging'` explicitly; staging keeps its console and its CSP reports, which is the whole point of that environment.
- **Swallowed errors go through `captureError`, never a bare `console`.** `src/utils/captureError.ts` logs to the console *and* reports to Sentry; `removeConsole` drops the console half in production builds only, so development and staging keep the immediate feedback and production reports through Sentry alone. Doing it in one helper is what keeps those two halves from drifting: a hand-written `console.error` is invisible in production, a hand-written `captureException` is invisible in development (Sentry runs with `enabled: !isDev`). Every swallowed `catch` in `proxy.ts`, `utils/auth.ts`, the login route handler, `customFetch` and the auth screens uses it.
- **The `scope` argument replaces the old message.** It prefixes the console line in development and becomes a Sentry tag in production, so one string serves both channels and stays greppable. Pass `'warning'` as the third argument for a condition that is not a crash. Use `captureInfo` for an expected condition that is not a failure at all — a refresh token expiring on schedule is the reference case, and reporting it as an error would eat the quota.
- **`removeConsole` cannot strip a concise arrow body.** `.catch(e => console.error(e))` survives into the production bundle because the call *is* the return value, so SWC can't drop it without changing semantics; `.catch(e => { console.error(e) })` is removed. Verified by grepping `.next/` after a build. One more reason the rule above is "report, don't log".
- **Per-project CSP origins**: when a product adopts a new third-party tool, add its origins to `PROJECT_CSP_SOURCES` in `next.config.ts` (same idiom as `images.remotePatterns`). The Report-Only violation report names the exact origin and directive to add; nothing breaks in the meantime.
- **CSRF**: `isValidOrigin` (`src/utils/validateOrigin.ts`) guards the state-changing auth route handlers (POST/DELETE). GET handlers like `/api/auth/me` skip it on purpose. Origins are compared normalized (`new URL(x).origin`), and `localhost`/`127.0.0.1` pass in development.
- **`/api/contact`** (the Resend contact-form module, see [Optional modules](#optional-modules)) is a public POST, so it stacks every cheap guard: `isValidOrigin`, a honeypot field that fakes success, Cloudflare Turnstile when `TURNSTILE_SECRET_KEY` is set, a per-instance rate limit, server-side re-validation of every field, and attachment caps by size and extension. It refuses with 500 until `RESEND_API_KEY` and `CONTACT_TO` exist. With `CONTACT_FROM` empty it sends from Resend's sandbox address, which Resend documents as test-only and which delivers **solely** to the account owner's inbox — verify the client's domain and set `CONTACT_FROM` as the normal path.
- **`/api/draft`** (the Storyblok module) turns on Next.js Draft Mode for the Visual Editor and answers 401 to any request without the space token. With `STORYBLOK_TOKEN` set, `next.config.ts` swaps `X-Frame-Options: SAMEORIGIN` for an enforced `frame-ancestors 'self' https://app.storyblok.com`, because the editor iframes every page and XFO has no allowlist form. Every CMS-backed page is `revalidate = false`: Storyblok is queried at build time only, a publish reaches production through a rebuild (Storyblok webhook → Amplify build hook), and `BUILD_CV` in `src/api/storyblok.ts` is what stops a warm `.next/cache` from re-emitting the previous build's content.
- **Amplify runtime env**: Amplify hands env vars to the build shell but not to the SSR runtime, so `amplify.yml` copies an explicit allowlist into `.env.production` — `AUTH_SECRET` plus the module secrets (`RESEND_API_KEY`, `CONTACT_*`, `TURNSTILE_SECRET_KEY`, `STORYBLOK_TOKEN`, `STORYBLOK_REGION`). Test credentials (`MAILSLURP_API_KEY`, `AUTH_DEFAULT_*`) never reach the deployed bundle; a module that adds a runtime secret adds it to that list.

## Swagger/OpenAPI-to-Code Workflow

### Slash Commands

- **`/openapi-import {spec-path-or-url} [--tags=a,b,c] [--force] [--no-auth]`** — full orchestrator. Ingests a YAML spec, generates one `src/api/{tag}.ts` per tag and one `src/hooks/use{Resource}.ts` per resource (GET endpoints only), and runs lint + type-check. Use this AFTER `/figma-design-import` or `/claude-design-import` scaffolds the UI (both leave screens rendering `MOCK_*` data with a `// TODO: openapi-import` marker for this flow to replace). Delegates to four plugin sub-agents (`linkchar-next:openapi-*`): `openapi-handlers` (Sonnet), `openapi-hooks` (Haiku), `openapi-spec-validate` (Haiku) for input spec audit, `openapi-code-validate` (Haiku) for emitted code audit.
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

## CI & Dependency Updates

- **`.github/workflows/ci.yml` is a thin caller.** Its jobs live in [`Linkcharsoft/linkchar-frontend-workflows`](https://github.com/Linkcharsoft/linkchar-frontend-workflows) (shared by every frontend project), pinned to a release tag (`@v3.0.0`). Change a job there and release it — never inline steps here. Dependabot bumps the tag, so each release reaches every project as a reviewed PR.
- **CI** = one `Lint and build` job (ESLint, type-check, `next build`) with dummy env values — one job, not two, because each job pays its own install and is billed rounded up to the minute. It skips changes that only touch docs (`docs/**`, `*.md`). A project whose build needs more variables passes them through the `build-env` input.
- **Dependabot PRs** are reviewed by Claude (changelog vs. what `src/` actually uses), and the workflow **squash-merges patch/minor bumps** whose verdict is OK and whose CI is green. The `dependabot` job runs on PRs whose AUTHOR is Dependabot (`github.event.pull_request.user.login`, not `github.actor`), so fix commits pushed by a trusted actor (`inferencia-runner[bot]`) are reviewed too. Majors are not merged by the review (it comments "Not auto-merged: …"): the project's panel sends them to its runner, which tests and merges them — except the `next-react-major` group, which the runner leaves ready for a person to merge. **Merging to `main` deploys to production** — set the repo variable `DEPENDABOT_AUTOMERGE=off` to keep the review but merge by hand.
- **`.github/dependabot.yml` is per repo** (GitHub cannot share it): npm monthly (every bump PR spends Actions minutes), one grouped PR for patch/minor, a 7-day `cooldown`, `next`/`react`/`react-dom` majors grouped into one PR, and hand-migrated libraries ignored (`primereact` entirely; `tailwindcss`, `primeicons`, `@types/node` majors). A project that pins a library of its own adds it to `ignore` there.
- **Setup is per repo**: the `CLAUDE_CODE_OAUTH_TOKEN` secret goes in the **project's** *Settings → Secrets and variables* **twice, same value**: under **Dependabot** (Dependabot-triggered runs read only those) and under **Actions** (runs triggered by the runner's fix pushes read only those), the shared-workflows repo's secrets never reach a caller, and on GitHub Free organization secrets do not reach private repos. Without it the review is skipped with a warning and nothing is merged.

## Dev Tools

- **React Scan**: Automatically loaded in development (`APP_ENV === 'development'`) via `next/script` in root layout. Highlights unnecessary re-renders.
- **Bundle analysis**: `pnpm run analyze` uses Turbopack-native `next experimental-analyze` (Next 16.1+). Output lands in `.next/diagnostics/analyze/`.

## Cleanup before production

The template ships with `src/app/sentry-example-page/`, `src/screens/SentryExamplePage/` + `src/app/api/sentry-example-api/route.ts` — these exist only to validate that Sentry is correctly wired up and report errors as expected. **Delete all three** (and remove `/sentry-example-page` from `next.config.ts` rewrites / `robots.ts` if applicable) before shipping to production. The page contains inline styles with hardcoded hex colors that intentionally don't follow the project's token system — that's expected for a throwaway test page, but it WILL flag in `design-validation` if left in. Validating Sentry: open the page, click the buttons, confirm the errors appear in your Sentry dashboard, then delete.

## Testing

**The only test runner installed is Cypress (E2E). There is no unit-testing setup** — no `vitest`, no `@testing-library/*`, no `__tests__/` folders, and neither `pnpm test` nor `pnpm test-unit` exists. Verify against `package.json` before assuming any other runner is available.

- `cypress` + `cypress-mailslurp` (inbox helpers), `eslint-plugin-cypress`, and `playwright-webkit` for cross-browser runs. Versions: `package.json`.
- **`playwright-webkit` is NOT Cypress-only — removing Cypress must keep it.** The plugin's `scripts/render-audit.mjs` (the runtime sweep `design-validation` runs at its step 15) loads it from the app; without it every design import fails at Step 6 with `Cannot find module 'playwright-webkit'`. Its `allowBuilds` entry in `pnpm-workspace.yaml` stays too.
- Config: `cypress.config.ts` at the repo root — `specPattern: 'src/cypress/e2e/**/*.cy.{ts,tsx}'`, `baseUrl: http://localhost:3000` (so the app must be running).
- Commands: `pnpm run test-open` (interactive) · `pnpm run test-run` (headless).
- **Specs DO exist** — 7 of them, under **`src/cypress/e2e/`** (**not** a root `cypress/`; looking for one is what hides them): the auth flow (`Login`, `SignUp`, `EmailValidation`, `PasswordRecovery`, `ChangePassword`, `Flow`) plus `NavigationProtection.cy.ts`. Alongside them: `src/cypress/support/` (`commands.ts`, `e2e.ts`), `src/cypress/utils/` (shared helpers), and its own `tsconfig.json`.

**`src/cypress/utils/` encodes live DOM contracts — components must not break them.** `checkInputError.ts` selects `.parents('.InputContainer').find('.InputError')`, `checkPasswordErrors.ts` likewise leans on `PasswordValidator`'s markup. Changing or extending those components means keeping the root class and the error element's descendant relationship intact, or the auth specs go red.

**Do NOT scaffold NEW test infrastructure unprompted** — the testing strategy beyond the auth flow is still undecided. Writing specs against a framework that isn't installed produces code that cannot run; if a task seems to need one, ask first.
