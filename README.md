# Linkchar Next Template

Production-ready Next.js starter template by **Linkchar**, pre-configured with a robust tech stack, strict conventions, and scalable architecture. Includes a complete authentication flow, route protection, error tracking, and analytics out of the box.

## Tech Stack

| Category | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router) + React 19 + React Compiler + TypeScript |
| Styling | Tailwind CSS 3 + SASS (indented `.sass` syntax) |
| UI Library | PrimeReact 10 + PrimeIcons 7 |
| State Management | Zustand 5 |
| Forms | Formik + Yup |
| Animations | Framer Motion (`LazyMotion` + `m`) |
| 3D | Three.js |
| Data Fetching | SWR + custom `customFetch` wrapper |
| Auth | JWT sessions encrypted with AES-GCM via `jose` + Web Crypto API |
| Error Tracking | Sentry (session replays, performance monitoring, source maps) |
| Analytics | Microsoft Clarity |
| Testing | Cypress 15 (E2E) |
| Linting | ESLint 9 (flat config) + Husky git hooks |
| Package Manager | pnpm (>=10.33.0) |
| Node | ^22.22.0 |

## Getting Started

### Prerequisites

- Node.js ^22.22.0
- pnpm >=10.33.0

### Installation

```bash
pnpm install
```

### Environment Variables

Copy the example file and fill in the required values:

```bash
cp .env.example .env.local
```

| Variable | Side | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_DOMAIN` | Client | Frontend URL |
| `NEXT_PUBLIC_API_URL` | Client | Backend API URL |
| `NEXT_PUBLIC_MEDIA_URL` | Client | Media/bucket URL |
| `NEXT_PUBLIC_APP_ENV` | Client | `development`, `staging`, or `production` |
| `NEXT_PUBLIC_CLARITY_ID` | Client | Microsoft Clarity tracking ID |
| `AUTH_SECRET` | Server | 32-char secret for AES-GCM session encryption |
| `AUTH_DEFAULT_USER` | Server | Default test user (dev only) |
| `AUTH_DEFAULT_PASSWORD` | Server | Default test password (dev only) |
| `MAILSLURP_API_KEY` | Server | MailSlurp API key (E2E email testing) |
| `SENTRY_ORG` | Build | Sentry organization slug |
| `SENTRY_PROJECT` | Build | Sentry project name |
| `SENTRY_AUTH_TOKEN` | Build | Sentry auth token (source map upload) |
| `NEXT_PUBLIC_SENTRY_DSN` | Client | Sentry DSN |

### Development

```bash
pnpm start
```

### Build

```bash
pnpm build
```

### Lint & Type Check

```bash
pnpm run lint-check       # ESLint
pnpm run lint-check --fix # ESLint with auto-fix
pnpm run type-check       # TypeScript type checking
pnpm run check            # Both
```

### Testing

```bash
pnpm run test-open  # Cypress interactive mode
pnpm run test-run   # Cypress headless mode
```

### All Scripts

| Script | Description |
| --- | --- |
| `pnpm start` | Start development server |
| `pnpm build` | Production build |
| `pnpm run serve` | Build + start production server |
| `pnpm run check` | Run ESLint + TypeScript type check |
| `pnpm run lint-check` | ESLint only |
| `pnpm run type-check` | TypeScript type check only |
| `pnpm run test-open` | Cypress interactive mode |
| `pnpm run test-run` | Cypress headless mode |
| `pnpm run clean` | Remove `.next`, `node_modules`, and lockfile |
| `pnpm run nuke` | Clean + reinstall + rebuild from scratch |

## Project Structure

```text
src/
├── api/              # API functions using customFetch
├── app/              # Next.js App Router (pages, layouts, API routes)
│   ├── (auth-layout)/    # Auth route group (login, signup, password recovery)
│   ├── api/auth/         # Auth API routes (login, logout, me, refresh)
│   ├── dashboard/        # Protected dashboard routes
│   └── ...
├── assets/           # Static files (fonts/, icons/, images/, videos/)
├── components/       # Reusable UI components (each in its own folder)
│   ├── inputs/           # Input components (InputContainer, InputError)
│   └── modals/           # Modal components (LoadingModal, StateModal, Toasts)
├── constants/        # App constants (auth.ts, env.ts)
├── cypress/          # E2E tests, fixtures, and utilities
├── hooks/            # Custom React hooks (usePressKey, useTableParams, ...)
├── layouts/          # Layout components (AuthLayout, DashboardLayout, GeneralLayout)
├── providers/        # React providers (ProvidersContainer, ModalsProvider)
├── screens/          # Page-level components
│   └── auth/             # Auth screens (Login, Signup, PasswordRecovery, ...)
├── stores/           # Zustand stores (modalStore, userStore)
├── styles/           # Global SASS styles (index.sass, general.sass, mixins.sass)
├── types/            # TypeScript type definitions
└── utils/            # Utility functions (crypto, validation, auth helpers)
```

### Architecture

- **Pages** (`src/app/**/page.tsx`) are thin wrappers — they export metadata and render a Screen component.
- **Screens** (`src/screens/`) contain all page logic and UI.
- **Layouts** (`src/layouts/`) handle shared layout structure, delegated from App Router layout files.
- **Components** (`src/components/`) are reusable, each in its own folder with colocated `.sass` styles.

## Authentication

The template includes a complete, production-ready auth system:

### Auth Screens

| Screen | Route | Description |
| --- | --- | --- |
| Login | `/login` | Email/password login |
| Signup | `/signup` | Account creation |
| Email Validation | `/signup/email-validation/[email]` | Email verification |
| Signup Confirmation | `/signup/confirmation/[token]` | Registration confirmation |
| Password Recovery | `/password-recovery` | Request password reset |
| Password Recovery Confirmation | `/password-recovery/confirmation/[token]/[email]` | Reset with token |
| Change Password | `/change-password` | Change current password |
| Change Password Confirmation | `/change-password/confirmation/[token]` | Confirm password change |

### How It Works

1. **Login**: Credentials are sent to `/api/auth/login`, which calls the backend, receives JWT tokens, encrypts the session with AES-GCM, and sets an httpOnly cookie (`linkchar-session`).
2. **Token Refresh**: On 401 responses, `customFetch` automatically refreshes the access token via `/api/auth/refresh`.
3. **Multi-tab Sync**: A non-httpOnly listener cookie (`linkchar-listener`) is polled every second to detect auth changes across browser tabs.
4. **Route Protection**: Middleware (`src/proxy.ts`) enforces access control:
   - **Auth routes** (`/login`, `/signup`, etc.) — redirect authenticated users to `/dashboard`
   - **Protected routes** (`/dashboard`, etc.) — redirect unauthenticated users to `/login`
   - **Public routes** (`/`, `/sentry-example-page`) — accessible to everyone

## Error Tracking (Sentry)

Sentry is fully integrated with environment-aware configuration:

- **Development**: Disabled entirely
- **Staging**: 100% trace sample rate, session replays enabled, user PII sent
- **Production**: 10% trace sample rate, session replays at 10%, error replays at 100%
- **Ad-blocker bypass**: Tunnel route at `/monitoring`
- **Source maps**: Automatically uploaded during build
- **Privacy**: Text masking and media blocking in production replays

## Git Hooks (Husky)

| Hook | Action |
| --- | --- |
| `pre-commit` | Runs `pnpm run lint-check` — blocks commit on lint errors |
| `pre-push` | Runs `pnpm build` — blocks push if build fails |

## Claude Code Skills

This template ships with a set of [Claude Code](https://claude.com/claude-code) skills under `.claude/skills/` that automate the most common scaffolding tasks. Invoke them with a slash command:

| Skill | Purpose |
| --- | --- |
| `/new-screen` | Generate a Screen component + colocated `.sass` + page wrapper, updating `src/proxy.ts` when needed |
| `/new-table` | Scaffold a full paginated DataTable screen (types + API client + screen with `useTableParams` + filters + page wrapper) |
| `/new-component` | Generate a reusable component folder (`.tsx` + `.sass`) following project conventions |
| `/new-modal` | Wire up a new modal type across `modalStore`, the component file, and `ModalsProvider` |
| `/new-skeleton` | Create a skeleton loader sibling for an existing component or screen using `SkeletonBlock` |
| `/new-api` | Generate an API domain from an OpenAPI JSON spec (or a manual scaffold) — types + `customFetch` functions in a single file per tag |
| `/figma-design-import` | Orchestrate a full Figma-to-code import: tokens → assets → components → layouts → screens → validation |

All conventions enforced by these skills are documented in `CLAUDE.md` — the canonical project guide for any AI-assisted contribution.

### Figma MCP Integration

The repo includes a `.mcp.json` that wires Claude Code to the Figma Dev Mode MCP server at `http://127.0.0.1:3845/mcp`. For any Figma skill (`/figma-design-import`, `figma:*`) to work, you must have:

1. **Figma desktop app** running on the same machine (web Figma does not expose the MCP server).
2. **Dev Mode MCP enabled** in Figma: `Preferences → Enable Dev Mode MCP Server` (requires a Figma seat with Dev Mode access).

If the connection to `127.0.0.1:3845` fails, the skill errors out on the first MCP call — start Figma desktop and retry.

## Conventions

- **Styling**: Tailwind-first. Move to SASS (`.sass` indented syntax) when an element has visual appearance classes (colors, borders, `text-*`, `hover:`) or accumulates 6+ classes of any kind.
- **Typography**: Custom classes — `text-{weight}-{size}` (e.g., `text-bold-24`, `text-medium-16`).
- **BEM in SASS**: `.ComponentName__Element--Modifier`.
- **React Compiler**: Enabled in `next.config.ts` — never wrap components in `memo()`, `useMemo`, or `useCallback`; the compiler memoizes automatically.
- **Imports**: `@/` path alias. Type imports use `import type { X }`.
- **Exports**: Default exports for components, hooks, and stores.
- **Animations**: `m` from framer-motion with `LazyMotion` (never `motion`).
- **Modals/Toasts**: Managed globally via `useModalStore` (Zustand).
- **Env vars**: Always import from `@/constants/env`, never use `process.env` directly.
- **PrimeReact**: Use PrimeReact components for inputs; PrimeIcons for icons.

## Commit Convention

```text
[ TYPE ] Description
```

| Type | Usage |
| --- | --- |
| `FEATURE` | New functionality or screen |
| `ADD` | New file, config, or asset |
| `UPDATE` | Enhancement to existing functionality |
| `FIX` | Bug fix |
| `REFACTOR` | Code restructuring without behavior change |
| `STYLE` | Visual/styling changes only |
| `CHORE` | Config, dependencies, tooling |

## License

Proprietary — Linkchar.
