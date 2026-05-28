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
- **Package Manager:** pnpm (>=10.30.0)
- **Node Version:** ^22.22.0

## Automation Skills

> **MANDATORY: For any of the tasks below, ALWAYS invoke the matching skill instead of writing files manually.** Even when the user does not type the slash command explicitly (e.g. "add a screen for settings", "create a modal to confirm deletion"), recognize the intent and invoke the skill. The skills encapsulate every convention in [`.claude/CONVENTIONS.md`](./.claude/CONVENTIONS.md) and generate files in the correct locations.

| Task | Skill | Example invocation |
| ---- | ----- | ------------------ |
| Create a new screen + page route (+ proxy.ts update) | `/new-screen` | `/new-screen UsersPage protected /dashboard/users` |
| Create a paginated DataTable screen (with `useTableParams`, filters, search, sorting) | `/new-table` | `/new-table UsersPage users /dashboard/users` |
| Create a new reusable component | `/new-component` | `/new-component CustomTable client` |
| Create a new custom React hook | `/new-hook` | `/new-hook useDebounce` |
| Create a new Zustand store | `/new-store` | `/new-store Cart` |
| Create a new modal type | `/new-modal` | `/new-modal ConfirmDelete` |
| Create a skeleton loader for an existing component or screen | `/new-skeleton` | `/new-skeleton ProductCard` |
| Import a full Figma design (orchestrates tokens → assets → components → layouts → screens) | `/figma-design-import` | `/figma-design-import https://figma.com/design/.../?node-id=X-Y` |

Skills live in `.claude/skills/{skill-name}/SKILL.md`. Do not duplicate their logic in chat — invoke them.

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

## Design Tokens (Figma imports)

Color, typography, and breakpoint tokens added through `/figma-design-import` are tracked in `figma-tokens-map.md` at the project root. That file is the canonical Figma variable → Tailwind token mapping — it documents which existing token a Figma variable was reused into, which new tokens were created, and the reasoning (heuristic match, namespace decision, etc.).

**Consult `figma-tokens-map.md` BEFORE manually adding a new color/typography/breakpoint token to `tailwind.config.js`** to avoid duplicate tokens across Figma imports. If you create a token manually (outside the agent flow), add a row to the map so future imports see it. The `figma-tokens` sub-agent maintains the map automatically during its runs.

The `surface-50`…`surface-900` namespace is immutable and template-shipped (not Figma-derived), so it never appears in `figma-tokens-map.md`. Same for Tailwind defaults (`red-600`, `blue-600`, etc.).

## Modals & Notifications System

Modals and notifications are managed globally via `useModalStore` (Zustand):

```tsx
const { openModal, closeModal, setNotification } = useModalStore()

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

> To create a new store, use the `/new-store` skill — it generates the file with the correct naming (`xxxStore.ts` / `useXxxStore`), the `'use client'` directive, the `create<StoreType>()` boilerplate, and the conventions checklist (initial state as `undefined`, no derived data, optional `persist` middleware).

- Stores are in `src/stores/` with `create<StoreType>()` pattern.
- Stores use `'use client'` directive.
- Named `useXxxStore` and exported as default.

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

### Slash Command

- `/gen-from-spec {resource}` — Generate types + API client from an OpenAPI/Swagger spec.

### Conventions

- **Types**: `src/types/api/{resource}.ts` — use `interface` (not `type`), `Type` suffix for models.
- **API client**: `src/api/{resource}.ts` — ALWAYS use `customFetch` from `@/api/customFetch`.
- **SWR Hooks** (optional): `src/hooks/use{Resource}.ts` — `useSWR` pattern with API client functions.

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

The template ships with `src/app/sentry-example-page/page.tsx` + `src/app/api/sentry-example-api/route.ts` — these exist only to validate that Sentry is correctly wired up and report errors as expected. **Delete both files** (and remove `/sentry-example-page` from `next.config.ts` rewrites / `robots.ts` if applicable) before shipping to production. The page contains inline styles with hardcoded hex colors that intentionally don't follow the project's token system — that's expected for a throwaway test page, but it WILL flag in `figma-validation` if left in. Validating Sentry: open the page, click the buttons, confirm the errors appear in your Sentry dashboard, then delete.

## Testing

- **Framework:** Vitest + @testing-library/react
- Write **unit tests only** (NOT E2E, NOT integration).
- Focus on: utility functions, store logic, hook behavior, component rendering.
- Test files live in `__tests__/` folders colocated with the source:
  - `src/utils/__tests__/validateEmail.test.ts`
  - `src/stores/__tests__/modalStore.test.ts`
  - `src/hooks/__tests__/usePressKey.test.ts`
  - `src/components/Label/__tests__/Label.test.tsx`
- Naming: `{Name}.test.ts` for logic, `{Name}.test.tsx` for components.
- Commands: `pnpm test` (watch mode), `pnpm test-unit` (single run).
- Mock `.sass` imports and framer-motion when needed.
- Use `vi.fn()` and `vi.mock()` for mocking.
