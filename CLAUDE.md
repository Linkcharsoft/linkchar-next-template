# CLAUDE.md - Project Conventions & Rules

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

> **MANDATORY: For any of the tasks below, ALWAYS invoke the matching skill instead of writing files manually.** Even when the user does not type the slash command explicitly (e.g. "add a screen for settings", "create a modal to confirm deletion"), recognize the intent and invoke the skill. The skills encapsulate every convention in this document and generate files in the correct locations.

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

- `src/app/**/page.tsx` files are **thin wrappers**: they only export metadata and render a Screen component
- All page logic and UI lives in `src/screens/` components
- Route protection is defined in `src/proxy.ts`:
  - `AUTH_PATHS`: routes for unauthenticated users only (login, signup, password recovery)
  - `PUBLIC_PATHS`: routes accessible to everyone (must be added explicitly)
  - Anything else is protected and redirects to `/login` without a valid session

### Route Groups & Layouts

- Use Next.js route groups `(group-name)` for shared layouts (e.g., `(auth-layout)/` wraps login, signup, password recovery)
- Each route group has its own `layout.tsx`
- Layouts in `src/app/` are **thin wrappers** that delegate to layout components in `src/layouts/`
- Layout components live in `src/layouts/LayoutName/LayoutName.tsx` with colocated styles
- `GeneralLayout` handles auth token/user fetching and wraps with `ProvidersContainer`

### Tailwind + PrimeReact Layer Ordering

Do NOT modify this layer order in `src/styles/index.sass` — ensures Tailwind utilities override PrimeReact:

```css
@layer tailwind-base, primereact, tailwind-utilities
```

## Naming Conventions

| Element | Convention | Example |
| ------- | ---------- | ------- |
| Components | PascalCase file & export | `CustomButton.tsx` → `export default CustomButton` |
| Screens | PascalCase with "Page" suffix | `LoginPage.tsx`, `HomePage.tsx` |
| Hooks | camelCase with "use" prefix | `usePressKey.ts` → `export default usePressKey` |
| Stores | camelCase with "Store" suffix | `modalStore.ts` → `export default useModalStore` |
| Types | PascalCase with "Type" suffix | `UserType`, `AuthType`, `SessionType` |
| API functions | camelCase | `getTestData`, `customFetch` |
| Constants | UPPER_SNAKE_CASE | `AUTHENTICATED_HOME_PATH`, `SESSION_COOKIE_NAME` |
| SASS files | PascalCase matching component | `CustomButton.sass`, `AuthLayout.sass` |
| CSS classes (BEM) | PascalCase block, `__` element, `--` modifier | `.AuthLayout__Title`, `.CustomButton--Primary` |

## Component Patterns

> To create a new component, use the `/new-component` skill. It generates the folder, `.tsx`, and `.sass` with the correct template.

Each component lives in its own folder (`src/components/ComponentName/`) with the `.tsx` and a colocated `.sass` imported directly via `import './ComponentName.sass'`.

### Key Patterns

- **`'use client'`**: Only add when the component uses hooks, event handlers, or browser APIs
- **Default exports**: Every component/hook/store uses `export default`
- **No manual `memo()`/`useMemo`/`useCallback`**: this project has React Compiler enabled (`reactCompiler: true` in `next.config.ts` + `babel-plugin-react-compiler`). The compiler handles memoization automatically — wrapping components in `memo()` is unnecessary noise. Default exports without `memo()`.
- **Path alias**: Always use `@/` for imports from `src/` (e.g., `@/components/CustomButton/CustomButton`)
- **Type imports**: Use `import type { X }` for type-only imports (enforced by ESLint)
- **Import order** (enforced by ESLint):
  1. Built-in modules
  2. External packages (alphabetical)
  3. Internal `@/` imports (alphabetical)
  4. Relative imports
  5. Type imports (last)

## Existing Reusable Components

> **MANDATORY: BEFORE creating any new component, ALWAYS check this table AND the `src/components/` directory. If a similar one exists, REUSE it or extend it by adding props/variants. NEVER duplicate functionality.**

| Component | Path | Description |
| --------- | ---- | ----------- |
| `CustomButton` | `components/CustomButton/CustomButton.tsx` | Button with variants (primary, white, transparent, success, info, warn, error), sizes (detail, small, medium, large), and optional `href` for link behavior |
| `InputContainer` | `components/inputs/InputContainer/InputContainer.tsx` | Wraps an input with `Label` + `InputError` |
| `Label` | `components/Label/Label.tsx` | Styled `<label>` element |
| `InputError` | `components/inputs/InputError/InputError.tsx` | Animated error message with icon |
| `SearchInput` | `components/SearchInput/SearchInput.tsx` | Debounced search input with clear button |
| `Filters` | `components/Filters/Filters.tsx` | Filter panel with pill, dropdown, date, and date-range filters |
| `PasswordValidator` | `components/PasswordValidator/PasswordValidator.tsx` | Real-time password strength indicator |
| `Loader` | `components/Loader/Loader.tsx` | CSS spinner loader |
| `SkeletonBlock` | `components/SkeletonBlock/SkeletonBlock.tsx` | Shimmering placeholder rectangle used as the primitive for skeleton loaders. Pass `dark` for use on dark backgrounds. Size and shape via a BEM class passed in `className`. |
| `Waves` | `components/Waves/Waves.tsx` | Decorative SVG wave animation |
| `LoadingModal` | `components/modals/LoadingModal/LoadingModal.tsx` | Full-screen loading overlay with message |
| `StateModal` | `components/modals/StateModal/StateModal.tsx` | State-based modal (success, error, warn, info) |
| `ToastNotifications` | `components/modals/ToastNotifications/ToastNotifications.tsx` | Toast notification display |

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

## Environment Variables

- All env vars are exported from `src/constants/env.ts`
- Never use `process.env.XXX` directly in components — always import from `@/constants/env`
- Public vars use `NEXT_PUBLIC_` prefix
- See `.env.example` for the full list of required variables

## Styling Rules

### TAILWIND-FIRST Approach

> **ALWAYS use Tailwind utilities first** for spacing, layout, flexbox, grid, colors, typography, responsive. Move styles to the colocated `.sass` when:
>
> - The style CANNOT be expressed with Tailwind (custom animations, complex pseudo-elements)
> - The element needs deep nesting or PrimeReact overrides
> - The classes describe **visual appearance**: colors, backgrounds, borders, shadows, `rounded-*`, typography (`text-*`), or interactive states (`hover:`, `focus:`) — even if there are only a few
> - The element accumulates **6 or more classes** of any kind — no exceptions
>
> **Inline exceptions — classes that may stay in JSX (skip the `.sass`):**
>
> 1. **Layout-only**: the element's only classes are layout/spacing/sizing utilities (`flex`, `grid`, `gap-*`, `items-*`, `justify-*`, `w-*`, `h-*`, `p-*`, `m-*`).
> 2. **One-off mix of 2–3 simple utilities** — even if some are visual tokens like `text-bold-18`, `bg-red-600`, `text-surface-700`, or `rounded-lg` — as long as **all three** conditions hold:
>    - The element uses **only 2 or 3 classes** total.
>    - That combination is **not repeated** elsewhere in the component.
>    - It does NOT need **responsive variants** (`md:`, `lg:`, etc.) or **pseudo-state** modifiers (`hover:`, `focus:`).
>
> As soon as the combination starts repeating, needs responsive/state variants, or grows to a fourth class, lift it into the `.sass`. The **6+ classes rule is a hard cap** — it always forces a `.sass` block, regardless of class type. The goal of these exceptions is to avoid `.sass` classes that just wrap two Tailwind utilities used in a single JSX element.

#### Inside `.sass` files: prefer plain CSS, `@apply` only for design tokens

When you move styles into a `.sass` file, write plain CSS for properties that map 1:1 to a single CSS declaration. Reserve `@apply` for design-system tokens that pull from the project's Tailwind config.

- ✅ **Plain CSS** for: `display`, `flex-direction`, `gap`, `padding`, `margin`, `width`, `height`, `border-radius`, `position`, `top/right/bottom/left`, `cursor`, `overflow`, `text-align`, `transition`, `transform`
- ✅ **`@apply`** for: project colors (e.g. `text-surface-700`, `bg-surface-100`), typography tokens (`text-bold-14`, `text-medium-16` — these compose size + weight + letter-spacing), responsive prefixes (`md:flex-row`), and pseudo-state tokens (`hover:bg-surface-100`)
- ⚠️ **`@apply` MUST be the LAST declaration in each block scope** — root selector, `&__Element`, `&--Modifier`, pseudo-state. Plain CSS properties go FIRST, then a single `@apply` line at the end. Putting `@apply` between plain CSS declarations breaks the SASS indented-syntax parser with a confusing "expected selector" error. Nested child blocks (`&__X`, `&--X`, `&:hover`) are fine after `@apply` because they're a deeper scope.

```sass
// ✅ Good — plain CSS first, @apply LAST in each scope
.Card
  display: flex
  flex-direction: column
  gap: 1rem
  padding: 1.5rem
  border-radius: 8px
  @apply bg-white border border-surface-200 text-surface-900

  &__Title
    margin-bottom: 8px
    @apply text-bold-18

  &--Active
    transform: scale(1.02)
    @apply bg-surface-100

// ❌ Avoid — @apply between plain CSS declarations (breaks the SASS parser)
.Card
  display: flex
  @apply bg-white
  border-radius: 8px

// ❌ Avoid — @apply for everything (use plain CSS for layout)
.Card
  @apply flex flex-col gap-4 p-6 rounded-[8px] bg-white border border-surface-200 text-surface-900
```

- **Tailwind CSS**: FIRST choice for everything: layout, spacing, colors, typography, responsive
- **SASS (.sass indented syntax)**: For visual appearance classes, 6+ class combinations, and anything Tailwind cannot express. BEM naming. Plain CSS by default; `@apply` only for design tokens.
- **Colocated styles**: Each component imports its own `.sass` file directly (`import './Component.sass'`)
- `src/styles/index.sass` only contains global styles (fonts, Tailwind layers, general reset)
- SASS mixins are auto-injected globally via `next.config.ts` `sassOptions.additionalData`
- SASS files use `@apply` to integrate Tailwind utilities when needed
- BEM naming in SASS: `.ComponentName`, `.ComponentName__Element`, `.ComponentName--Modifier`
- Use `.sass` indented syntax (no curly braces, no semicolons) — enforced by hook

### Typography System (Tailwind Custom)

Use the custom typography classes defined in `tailwind.config.js`:

- Pattern: `text-{weight}-{size}` where weight = `extrabold|bold|semibold|medium|regular|light` and size = `10|12|14|16|18|20|24|28|32|36|40|44|48|56|64`
- Examples: `text-bold-24`, `text-medium-16`, `text-regular-14`

### Color System

- **Surface colors**: `text-surface-50` through `text-surface-900` / `bg-surface-50` through `bg-surface-900`
- **Semantic colors**: Use Tailwind defaults (`text-red-600`, `bg-blue-600`, `text-green-600`, etc.)
- Custom surface palette: 50(#FAFAFA) 100(#F5F5F5) 200(#EEEE) 300(#E0E0E0) 400(#BDBDBD) 500(#9E9E9E) 600(#757575) 700(#616161) 800(#424242) 900(#212121)

### Breakpoints

```text
2xs: 375px | xs: 480px | sm: 640px | md: 768px | lg: 1024px | xl: 1280px | 2xl: 1420px
```

### Global Container

Use `container-custom` class for centered content with responsive max-widths AND a built-in responsive lateral gutter:

- **Max-width tiers**: Default: 1600px | <=1920px: 1440px | <=1640px: 1200px | <=1440px: 1000px
- **Lateral padding (built-in)**: 16px on every viewport. This guarantees a safe edge gutter and prevents content from touching the screen edges on mobile.

Because the lateral padding is part of the class itself, NEVER add `px-*` (e.g. `px-4`) on the same element that already has `container-custom` — it's redundant. If a specific section truly needs a different inner padding than the global gutter, nest a child `<div>` and apply `px-*` there instead of duplicating it on the container.

`container-custom` ONLY handles **horizontal** concerns (max-width + lateral gutter). It does NOT set any vertical padding — and that's on purpose. Each section is responsible for its OWN vertical rhythm (`py-*`, `pt-*`, `pb-*`), and you MUST translate the vertical spacing from the Figma design (or pick a reasonable default like `py-16` / `py-20` when designing from scratch). NEVER strip vertical padding "to keep the section minimal" — sections without `py-*` collapse against each other and look broken.

**MANDATORY**: every top-level `<section>` of any screen (and the inner content of every layout: navbar, footer, sidebar) MUST anchor its content with `container-custom` so that ALL sections share the same horizontal alignment and lateral padding. If the section has a full-bleed background, keep the background on `<section>` and nest a `<div className='container-custom ...'>` for the content; otherwise apply `container-custom` directly on the `<section>`. NEVER substitute it with `max-w-[1600px]`, `max-w-7xl`, or custom horizontal per-section paddings — that's the #1 cause of misaligned sections in Figma-driven screens. (Vertical per-section paddings — `py-*` — are NOT covered by this rule; honor the Figma design.)

## PrimeReact Usage

- PrimeReact is configured with Tailwind passthrough (`pt: Tailwind`) in ProvidersContainer
- Use PrimeReact components for inputs: `InputText`, `Password`, `Calendar`, `Dropdown`, `MultiSelect`
- Use PrimeIcons for icons: `<i className="pi pi-{icon-name}" />`
- Customize PrimeReact components via the `pt` (passthrough) prop
- Use `classNames` from `primereact/utils` for conditional classes (NOT `clsx`)

## Framer Motion

- **NEVER** import `motion` from `framer-motion` (enforced by ESLint)
- **ALWAYS** use `m` from `framer-motion` with `LazyMotion` (already set up in ProvidersContainer)
- Use `AnimatePresence` for enter/exit animations

## State Management (Zustand)

> To create a new store, use the `/new-store` skill — it generates the file with the correct naming (`xxxStore.ts` / `useXxxStore`), the `'use client'` directive, the `create<StoreType>()` boilerplate, and the conventions checklist (initial state as `undefined`, no derived data, optional `persist` middleware).

- Stores are in `src/stores/` with `create<StoreType>()` pattern
- Stores use `'use client'` directive
- Named `useXxxStore` and exported as default

## Forms (Formik + Yup)

- Use `useFormik<FormType>()` hook pattern
- Validation with `Yup.object({})` schema
- `validateOnChange: false` to validate only on submit
- Use `InputContainer` component to wrap inputs with label and error display

## API Layer

- API functions in `src/api/` use the `customFetch` wrapper
- `customFetch` handles auth token injection, auto-refresh on 401, and error handling
- API routes live in `src/app/api/`

## Code Style (ESLint Enforced)

- **Indentation**: 2 spaces
- **Quotes**: Single quotes (`'`)
- **Semicolons**: None
- **Trailing commas**: None
- **Object spacing**: `{ key: value }` (spaces inside braces)
- **Space before function parens**: Always (`function () {}`, `async () => {}`)
- **Type imports**: `import type { X }` (consistent-type-imports)
- **No `any`**: Warn on `@typescript-eslint/no-explicit-any`

## Git Workflow

### Commit Convention

After each significant implementation (new screen, new component, new feature, bug fix, refactor), create a commit with this format:

```text
[ TYPE ] Description of the change
```

**Types:**

- `FEATURE` - New functionality or screen
- `ADD` - Add a new file, config, or asset (not a full feature)
- `UPDATE` - Enhancement to existing functionality
- `FIX` - Bug fix
- `REFACTOR` - Code restructuring without behavior change
- `STYLE` - Visual/styling changes only
- `CHORE` - Config, dependencies, tooling changes

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

1. Finish the implementation
2. Run `pnpm run lint-check --fix` to auto-fix lint issues
3. Run `pnpm run type-check` to verify types
4. Stage the relevant files
5. Commit with the `[ TYPE ] description` format

<!-- ## Figma-to-Code Workflow

### Slash Commands (automation)
- `/figma-screen {frame}` - Generate a complete screen from a Figma frame (screen + page + assets + styles)
- `/figma-component {component}` - Generate a reusable component from a Figma element
- `/optimize-asset {hash.ext Name}` - Download and optimize a Figma asset (SVG->React, PNG->WebP)

### File Rules
1. Screen component in `src/screens/{Name}/{Name}.tsx` + `.sass` (NEVER in `src/app/`)
2. Thin page wrapper in `src/app/{route}/page.tsx` with metadata + canonical
3. Extract reusable parts into `src/components/` — **but FIRST check the existing components table** -->

### Styling Checklist

1. **TAILWIND-FIRST**: Use Tailwind for all layout and structure. Move to SASS (BEM + `@apply`) any element with visual appearance classes (colors, borders, shadows, `rounded-*`, `text-*`, `hover:`) or 6+ classes of any kind. Pure layout combos (`flex items-center gap-4`) and one-off 2–3-class mixes that don't repeat or need responsive variants may stay inline.
2. **Typography**: ALWAYS `text-{weight}-{size}` (e.g., `text-bold-24`). NEVER loose `text-xl`, `font-bold`.
3. **Colors**: `surface-50` to `surface-900` for grays. Semantic colors with Tailwind defaults.
4. **Responsive**: Custom breakpoints: `2xs:`, `xs:`, `sm:`, `md:`, `lg:`, `xl:`, `2xl:`
5. **Container**: `container-custom` is MANDATORY on every top-level `<section>` (or the inner `<div>` when the `<section>` is full-bleed) so all sections share the same horizontal alignment. Brings a built-in 16px lateral gutter — do NOT add `px-*` next to it. Also required on layout chrome (Navbar, Footer). NEVER substitute with `max-w-[Xpx]` or custom horizontal per-section paddings. **Vertical padding (`py-*`) is YOUR call** — `container-custom` does not set any, so always add the vertical rhythm Figma specifies (or sensible defaults like `py-16` / `py-20`).
6. **SASS**: `.sass` indented syntax (NO semicolons, NO curly braces). BEM: `.Name__Element--Modifier`. Plain CSS for layout/spacing/sizing; `@apply` only for design tokens (colors, `text-{weight}-{size}`, pseudo-state tokens).

### Component Rules

1. **REUSE**: Check existing components table BEFORE creating new ones. NEVER duplicate functionality.
2. **PrimeReact** for inputs (InputText, Dropdown, Calendar, MultiSelect). NO native HTML inputs.
3. **PrimeIcons** (`pi pi-xxx`) for icons. NO inline SVGs when a PrimeIcon exists.
4. **Conditional classes**: `classNames()` from `primereact/utils`. NOT `clsx`.
5. **Images**: `next/image` + WebP in `src/assets/images/`. See "Image Performance" in Lighthouse rules for `sizes` / `priority` / `fetchPriority` requirements.
6. **Links**: `next/link` or `CustomButton` with `href` prop. External `target='_blank'` MUST include `rel='noopener noreferrer'`.
7. **Animations**: `m` from framer-motion + `AnimatePresence`. NEVER `motion`.
8. **Modals/Toasts**: `useModalStore` for loading states and notifications. Single-screen-only modals go local — see "Bundle & Performance Architecture".
9. **Env vars**: Import from `@/constants/env`. NEVER `process.env` directly.
10. **Icon-only buttons**: every `<button>` (or `CustomButton`) whose visible content is only an icon MUST receive `aria-label`. Without it, Lighthouse "Buttons do not have an accessible name" fails.
11. **Form inputs**: every text-like input MUST set `autoComplete` (JSX) to the matching token (`email`, `current-password`, `new-password`, `name`, `tel`, `postal-code`, `one-time-code`, etc.). Missing values fail the a11y audit and break password managers.
12. **Heading element choice**: card/list-item titles inside a page that already has h1/h2 use `<p>`, not `<h3>`/`<h4>`. Reserve heading elements for actual document structure.

### Asset Pipeline

- **SVG** -> React component `.tsx` in `src/assets/icons/` (Props: `SVGProps<SVGSVGElement>`, default export — React Compiler handles memoization automatically). Example: `src/assets/icons/GmailIcon.tsx`
- **PNG/JPEG** -> WebP in `src/assets/images/`: `ffmpeg -i input.png -q:v 85 output.webp`
- **Download from Figma MCP**: `curl -s "http://localhost:3845/assets/{hash}.{ext}" -o /tmp/{name}.{ext}`
- **NEVER** save SVGs as loose `.svg` files if they will be used as React components

## Swagger/OpenAPI-to-Code Workflow

### Slash Command

- `/gen-from-spec {resource}` - Generate types + API client from an OpenAPI/Swagger spec

### Conventions

- **Types**: `src/types/api/{resource}.ts` — use `interface` (not `type`), `Type` suffix for models
- **API client**: `src/api/{resource}.ts` — ALWAYS use `customFetch` from `@/api/customFetch`
- **SWR Hooks** (optional): `src/hooks/use{Resource}.ts` — `useSWR` pattern with API client functions

## Figma MCP Integration

These rules govern every Figma-driven implementation. Treat the MCP output (React + Tailwind) as a **representation of design intent**, NEVER as final code — always translate it into this project's stack and conventions before shipping.

### Prerequisites

The repo ships with a `.mcp.json` that wires Claude Code to the Figma Dev Mode MCP server at `http://127.0.0.1:3845/mcp`. For any Figma skill (`/figma-design-import`, `figma:*`) to work, you MUST have:

1. **Figma desktop app running** on the same machine — the web version does not expose the Dev Mode MCP server.
2. **Dev Mode MCP enabled** in Figma: `Preferences → Enable Dev Mode MCP Server` (requires a Figma seat with Dev Mode access).
3. The Figma file open and the relevant node selected (or its URL/nodeId ready to pass to the skill).

If the connection to `127.0.0.1:3845` fails, the skill will error out on the first MCP call — start Figma desktop and re-run.

### Required Flow (do not skip)

1. **Get design context** — call `get_design_context` with the `nodeId` and `fileKey` extracted from the Figma URL (`figma.com/design/:fileKey/...?node-id=:nodeId`, convert `-` to `:` in the nodeId).
2. **If the response is too large or truncated** — call `get_metadata` first to get the high-level node map, then re-fetch only the required node(s) with `get_design_context`.
3. **Get a screenshot** — call `get_screenshot` for visual reference of the variant being implemented.
4. **Only after both** `get_design_context` AND `get_screenshot` are available, download any required assets and start implementation.
5. **Reuse, then build** — check the existing components table BEFORE generating any new component. If a similar one exists, REUSE or extend it via props/variants. NEVER duplicate functionality.
6. **Validate against the screenshot** — verify 1:1 visual parity AND interactive behavior before marking the task complete.

### Translation Rules (Figma React+Tailwind → this project)

- **Stack**: Next.js 16 App Router + React 19 + TypeScript. Use `'use client'` ONLY when hooks/event handlers/browser APIs are required.
- **Layout & spacing**: Use Tailwind utilities first (flex, grid, gap, padding, margin, width, responsive). SASS only for what Tailwind cannot express.
- **Typography**: ALWAYS map to the custom scale `text-{weight}-{size}` where `weight ∈ {extrabold|bold|semibold|medium|regular|light}` and `size ∈ {10|12|14|16|18|20|24|28|32|36|40|44|48|56|64}`. NEVER use loose `text-xl`, `font-bold`, raw `font-size`, or arbitrary px values.
- **Colors**:
  - Grays: `surface-50` → `surface-900` (defined in `tailwind.config.js`).
  - Semantic: Tailwind defaults (`text-red-600`, `bg-blue-600`, `text-green-600`, etc.).
  - Brand/extra tokens: if the Figma design needs new namespaces (e.g. `brand-*`), the `figma-tokens` agent will add them to `tailwind.config.js` first. NEVER hardcode hex — every Figma color must resolve to a token.
- **Breakpoints**: Use the project's custom screens — `2xs:` (375), `xs:` (480), `sm:` (640), `md:` (768), `lg:` (1024), `xl:` (1280), `2xl:` (1420). Do not invent new ones.
- **Container — MANDATORY for every section**: EVERY top-level section/block of a screen MUST anchor its content with the `container-custom` class so that all sections share the same max-width and lateral padding across the page. The Figma MCP returns absolute pixel widths and per-section *horizontal* padding — IGNORE those and replace them with `container-custom`. The class ALREADY brings a built-in 16px lateral gutter, so do NOT add `px-*` on the same element that has `container-custom`. **Vertical padding is different**: translate the `py-*` / `pt-*` / `pb-*` from Figma faithfully — `container-custom` does NOT set any vertical spacing, so omitting it leaves the section visually collapsed. There are two valid patterns:
  - **Section with full-bleed background** (background color/image spans 100vw): put the background on the `<section>` and a child `<div className='container-custom ...'>` wraps the content.

    ```tsx
    <section className='HeroSection'>          // full-bleed background lives here
      <div className='container-custom flex flex-col gap-6 py-16'>
        {/* contenido alineado al ancho del proyecto */}
      </div>
    </section>
    ```

  - **Section without full-bleed background** (background matches page): apply `container-custom` directly on the `<section>`.

    ```tsx
    <section className='container-custom flex flex-col gap-6 py-16'>
      {/* contenido */}
    </section>
    ```

  - NEVER replace `container-custom` with hardcoded `max-w-[1600px]`, `max-w-7xl`, or custom per-section paddings — that breaks alignment between sections. If a section needs a narrower inner column (e.g. centered text block ≤ 800px), still nest it INSIDE `container-custom`.
  - Layouts (`AuthLayout`, `DashboardLayout`, etc.) and their composed parts (Navbar, Footer) must also use `container-custom` for their inner content, so the page chrome aligns with the screen's sections.
- **SASS**: When utilities are not enough, write `.sass` indented syntax (NO semicolons, NO curly braces) using BEM (`.ComponentName__Element--Modifier`) and `@apply` for Tailwind composition. Colocate as `ComponentName.sass` next to the `.tsx`.
- **PrimeReact layer order**: NEVER alter the layer ordering in `src/styles/index.sass` (`@layer tailwind-base, primereact, tailwind-utilities`).

### Component & Reuse Rules (CRITICAL)

- **MANDATORY**: Before generating ANY new component, check `src/components/` and the "Existing Reusable Components" table in this CLAUDE.md. Reuse `CustomButton`, `InputContainer`, `Label`, `InputError`, `SearchInput`, `Filters`, `PasswordValidator`, `Loader`, `Waves`, `LoadingModal`, `StateModal`, `ToastNotifications` whenever the Figma node maps to one of them.
- **Buttons**: Always `CustomButton` (`variant`: primary | white | transparent | success | info | warn | error; `size`: detail | small | medium | large; pass `href` for links). NEVER render a raw `<button>` or another button library.
- **Inputs**: ALWAYS PrimeReact (`InputText`, `Password`, `Calendar`, `Dropdown`, `MultiSelect`) wrapped in `InputContainer`. NEVER native HTML inputs.
- **Icons**: ALWAYS PrimeIcons (`<i className="pi pi-{name}" />`) when the icon exists in the PrimeIcons set. Only fall back to a custom SVG component if PrimeIcons doesn't have it.
- **Conditional classes**: `classNames` from `primereact/utils`. NEVER `clsx` or template-string concatenation.
- **Animations**: `m` from `framer-motion` + `LazyMotion` + `AnimatePresence`. NEVER `motion`. ESLint will reject `motion` imports.
- **Links / navigation**: `next/link` or `CustomButton` with the `href` prop. NEVER raw `<a>` for internal routes.
- **Modals & toasts**: Trigger via `useModalStore` (`openModal`, `closeModal`, `setNotification`). To add a new modal type invoke `/new-modal`.
- **New components / screens / modals**: Invoke the matching skill (`/new-component`, `/new-screen`, `/new-modal`). Do NOT scaffold files manually — the skills enforce folder layout, default exports, colocated `.sass`, and route registration.

### Asset Handling

- **Figma MCP localhost sources**: When the MCP returns a `http://localhost:3845/assets/...` URL for an image or SVG, USE IT DIRECTLY. NEVER replace it with placeholders, stock URLs, or `Image` library imports.
- **Downloaded assets**:
  - **SVG icons** → React component `.tsx` in `src/assets/icons/` following the existing pattern: typed with `SVGProps<SVGSVGElement>`, spreads `...props`, default export, registered in `src/assets/icons/index.ts`. React Compiler handles memoization — no manual `memo()`. NEVER save loose `.svg` files when the asset will be rendered as a React component.
  - **PNG/JPEG images** → MUST be converted to WebP and stored in `src/assets/images/`. Use `ffmpeg -i input.png -q:v 85 output.webp`. Render with `next/image`.
  - Download command for Figma MCP assets: `curl -s "http://localhost:3845/assets/{hash}.{ext}" -o /tmp/{name}.{ext}`.
- **Icon packages**: IMPORTANT — DO NOT install new icon libraries (`lucide-react`, `react-icons`, `heroicons`, etc.). Use PrimeIcons or assets returned by the Figma MCP.

### Imports & Code Style

- Use the `@/` alias for any import from `src/` (e.g. `@/components/CustomButton/CustomButton`). NEVER multi-level relative imports.
- Type-only imports: `import type { X } from '...'` (enforced by ESLint).
- Default exports for components, hooks, and stores.
- React Compiler is enabled — do NOT wrap components in `memo()` / `useMemo` / `useCallback`. The compiler memoizes automatically.
- ESLint formatting: 2 spaces, single quotes, no semicolons, no trailing commas, space inside braces, space before function parens. Run `pnpm run lint-check --fix` and `pnpm run type-check` before committing.

### Forms & State

- **Forms**: `useFormik<FormType>()` + Yup schema, `validateOnChange: false`, inputs wrapped in `InputContainer`.
- **State**: Zustand stores in `src/stores/` named `useXxxStore`, default export, `'use client'` directive.
- **Data fetching**: SWR + `customFetch` from `@/api/customFetch`. NEVER raw `fetch` for app APIs.
- **Env vars**: Always import from `@/constants/env`. NEVER `process.env.X` in components.

### Validation Checklist (before declaring the Figma task done)

1. ✅ Visual parity vs. the `get_screenshot` reference (spacing, colors, typography, states).
2. ✅ Every color/typography/spacing maps to a project token (no hardcoded values).
3. ✅ All reusable components from `src/components/` were used where applicable.
4. ✅ No new icon library was added; assets came from the Figma MCP or PrimeIcons.
5. ✅ Every top-level `<section>` (and the inner content of every layout part: navbar, footer, sidebar) is anchored with `container-custom`. No section uses `max-w-[Xpx]`, `max-w-7xl`, or arbitrary horizontal per-section paddings to define its content width. **AND** every section has explicit vertical padding (`py-*` / `pt-*` / `pb-*`) translated from Figma — `container-custom` does not provide any vertical spacing.
6. ✅ `pnpm run lint-check --fix` and `pnpm run type-check` pass clean.
7. ✅ Interactive behavior (hover, focus, disabled, loading, error) matches the Figma variants.

## Dev Tools

- **React Scan**: Automatically loaded in development (`APP_ENV === 'development'`) via `next/script` in root layout. Highlights unnecessary re-renders.
- **APP_ENV validation**: `constants/env.ts` validates that `APP_ENV` is one of `production`, `staging`, or `development`

## Performance & Lighthouse Rules

These rules exist to prevent specific Lighthouse failures (Performance, Accessibility, SEO, Best Practices). They are mandatory whenever you generate UI code — do NOT ship code that violates them.

### Image Performance (LCP, CLS, "Properly size images")

- **`sizes` is REQUIRED on every `<Image fill>`**. Without it, Next.js serves the largest variant available. Match the rendered width: full-bleed hero → `sizes='100vw'`; half-width content → `sizes='(min-width: 768px) 50vw, 100vw'`; quarter-width card in a 4-col grid → `sizes='(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw'`.
- **LCP image** (hero, above-the-fold) needs BOTH `priority` AND `fetchPriority='high'`. `priority` tells Next to preload; `fetchPriority` tells the browser the resource is high priority. Both are required to pass the Lighthouse LCP audit.
- **Lists/grids**: only the first N items (those visible above the fold) get `priority`. Use `priority={index < N}`. Setting `priority` on every item defeats lazy loading and ships extra preloads.
- **Avoid CLS**: every image container must reserve space — for fixed-size containers set BOTH `height` AND `min-height` (or `aspect-ratio`). Skeleton placeholders must mirror final dimensions exactly.
- **Decorative images use `alt=''`**. Content images need a meaningful `alt`. Never leave `alt=''` on an image that conveys information — Lighthouse flags missing/empty alt as an a11y failure.
- **Mobile/desktop dual `<Image>` pattern**: when using `<Image className='hidden md:block'>` + `<Image className='md:hidden'>`, BOTH variants download by default. Scope each with `sizes`: desktop `sizes='(min-width: 768px) Xvw, 0vw'`, mobile `sizes='(min-width: 768px) 0vw, 100vw'`. The `0vw` tells Next to skip download at that breakpoint.
- **Raster assets (PNG/JPEG)**: convert to WebP at import time with `ffmpeg -i input.png -q:v 85 output.webp`. Render with `next/image` so AVIF/WebP variants are served when supported.
- **Never use `unoptimized` on `next/image`** unless the source is a known optimized image — it defeats Next's image pipeline.

### Font Loading ("Eliminate render-blocking resources", "Ensure text remains visible")

- **NEVER** use `@import url('https://fonts.googleapis.com/...')` in CSS/SASS. It is render-blocking and triggers FOIT.
- **ALL fonts** must be loaded via `next/font/google` or `next/font/local`, with `display: 'swap'` and a CSS variable (`variable: '--font-X'`). Apply the variable to `<html>` via `className`.
- **Tailwind and CSS must reference the variable**, not the literal font name: `font-family: var(--font-merriweather-sans)` (NOT `'Merriweather Sans'`); Tailwind: `fontFamily: { sans: ['var(--font-merriweather-sans)', 'sans-serif'] }`.
- **Variable fonts**: omit `weight` to ship one `.woff2` covering the full weight range. Non-variable fonts: specify ONLY the weights actually used — every weight in the array is an extra file.
- **Icon fonts whose default `@font-face` uses `font-display: block`** MUST be re-hosted via `next/font/local` and forced via `[icon-selector] { font-family: var(--font-X) !important }`. Otherwise icons cause FOIT. The template ships this done for PrimeIcons — see `src/app/layout.tsx` (`localFont({ src: '../../node_modules/primeicons/fonts/primeicons.woff2', display: 'swap', variable: '--font-primeicons' })`) and `src/styles/index.sass` (`.pi { font-family: var(--font-primeicons) !important }`). Referencing the file directly from `node_modules` keeps the font version locked to `package.json` — no manual copy in `src/assets/`, no drift on upgrades.

### SEO & Metadata (Lighthouse "SEO" category)

- **Every public page MUST export metadata** containing: `title`, `description`, `alternates.canonical`, `openGraph`, `twitter`. Missing any of these triggers SEO audit failures.
- **Use the root layout's title template** (`title: { default: '...', template: '%s | App Name' }`). Per-page titles should be the bare title — the template adds the brand suffix. Dashboard/admin pages: short bare title, never manually append `| App`.
- **Dynamic routes** (`[id]`, `[slug]`, etc.): use `generateMetadata` (not static `metadata`) to fetch the resource and return data-driven `title`, `description`, and `og.images`. If the resource is not found, return `robots: { index: false, follow: false }` so error pages do not get indexed.
- **Filtered/paginated listings** (`?search=`, `?page>1`, `?category=`, etc.): set `robots: { index: false, follow: true }` when those params are present. Otherwise every filter combination becomes a duplicate-content URL Google penalizes.
- **`html lang`** must match the actual content language (`"es"`, `"en"`). `openGraph.locale` and any `twitter` locale must match (e.g. `es_AR`, not the Next.js default `en_US`). Mismatched/missing lang fails both SEO and a11y audits.
- **`robots.ts`** must disallow `/api/*`, dashboard/admin routes, and auth-only routes (`/login`, `/signup`, `/password-recovery`, `/change-password`). These should never appear in search results.
- **`sitemap.ts`** with database/API-sourced entries: mark `export const dynamic = 'force-dynamic'` (or use `revalidate`) so it reflects content changes. Hard-coded static sitemaps go stale instantly.
- **NEVER** set `robots: { nocache: true }` in global metadata — it interferes with CDN caching without any SEO benefit (common leftover from Next.js boilerplate templates).
- **`public/manifest.json`** must reflect the real app (`name`, `short_name`, `description`, `theme_color`, `icons`). Template defaults left in production fail the Lighthouse PWA audit.
- **Social card image** (`og:image`, `twitter:image`): 1200×630 WebP, stored under `public/seo/`, referenced as a path. Required for proper sharing previews and "Open Graph" SEO checks.

### Accessibility (Lighthouse "Accessibility")

- **Heading hierarchy** must start with h1 and never skip levels (no `h1 → h3`). If the visual design has no h1, add a visually-hidden one (`<h1 className='sr-only'>{Page Title}</h1>`). Each rendered page must have exactly one h1.
- **Card/list-item titles** inside a page that already has h1/h2 use `<p>` (not `<h3>`/`<h4>`). Heading elements for each card pollute the document outline; Lighthouse flags it as "Heading levels are not in sequential order".
- **Never nest `<main>`**. The convention is: each **screen** owns its own `<main id='main'>` element (the skip-to-content target lives there); **layouts** must NOT render `<main>` themselves — they wrap chrome (navbar, sidebar, footer, decorative side-panels) around the screen slot. Two `<main>` per page = automatic a11y fail. If a layout needs a wrapper around the screen slot, use `<div>`; use `<aside>` for purely decorative side-panels.
- **Icon-only interactive elements** MUST have `aria-label`. `<button><i className='pi pi-times'/></button>` has no accessible name and fails "Buttons do not have an accessible name". Provide one: `aria-label='Close'`.
- **External links** (`target='_blank'`) MUST include `rel='noopener noreferrer'`. Prevents tab-napping (security) and avoids a Lighthouse Best Practices flag.
- **Form inputs need `autoComplete`** (JSX prop — React lowercases it to the `autocomplete` HTML attribute): email → `'email'`, login password → `'current-password'`, signup/reset password → `'new-password'`, full name → `'name'`, phone → `'tel'`, postal code → `'postal-code'`, etc. Missing `autoComplete` is both a Lighthouse a11y failure and a password-manager UX regression.
- **Viewport meta**: never use `user-scalable=no` or `maximum-scale=1`. Both block accessibility zoom and fail Lighthouse. Configure via the Next.js `viewport` export and leave zoom unrestricted.
- **Tap target size**: interactive elements on mobile need at least `44×44px` with 8px gap to neighbors (Lighthouse measures `48×48` effective). Set `min-h-[44px] min-w-[44px]` on icon buttons; rely on `CustomButton` size variants that already meet this for regular buttons.
- **Color contrast** must meet WCAG AA: 4.5:1 for normal text, 3:1 for large text (18pt+ or 14pt+ bold) and UI components. When picking color tokens, verify every text/background pair before shipping — Lighthouse runs `axe-core` contrast checks automatically.
- **Skip-to-content link**: the root layout (`src/app/layout.tsx`) renders `<a href='#main' className='SkipToContent'>...</a>` as the first child of `<body>`, paired with `id='main'` on the screen's `<main>`. Required for the "Bypass blocks of repetitive content" Lighthouse audit.
- **Horizontal-scroll carousels** (mobile `overflow-x-auto` lists): use semantic `<ul role='list' aria-label='...'>` + `<li>` items. Screen readers announce the item count; the label describes what the carousel contains.

### Bundle & Performance Architecture

- **`'use client'` belongs at the deepest leaf that needs it**. Marking a layout or page as `'use client'` opts the entire subtree out of SSR — you lose streaming, bigger JS payload, slower LCP. Default to server; push the directive down to the specific component that uses hooks/events/browser APIs.
- **`generateStaticParams`** for dynamic detail routes when the set of params is bounded (catalog items, blog posts, etc.). Converts dynamic routes to statically pre-rendered HTML at build time → dramatic LCP and TTFB improvement. Combine with `revalidate` for ISR if data changes.
- **Heavy client-only components** (rich text editors, charts, code editors, map libraries, non-critical modals) → `dynamic(() => import('...'), { ssr: false })` from `next/dynamic`. Reduces the initial JS payload that ships with the page.
- **Modals used on a single screen** are NOT registered in the global `ModalsProvider`. Mount them locally inside the screen that uses them. A modal in the global provider ships its JavaScript on every page — even pages that never open it.
- **Third-party scripts** (analytics, tag managers, pixels, heatmap tools): MUST use Next.js `<Script>` with `strategy='afterInteractive'` or `'lazyOnload'`. NEVER `strategy='beforeInteractive'` unless the script is genuinely critical for the first paint — `beforeInteractive` blocks hydration and destroys LCP/TBT.
- **`fetch` calls in Server Components** must set an explicit cache policy: `fetch(url, { next: { revalidate: N } })` for ISR, or `cache: 'no-store'` for always-fresh. Defaults change between Next.js versions — be explicit so the behavior is stable.
- **Browserslist** (in `package.json`) should target modern engines only. Wider ranges (e.g. the Create-React-App default `>0.2%`) ship hundreds of KB of legacy polyfills. The Lighthouse audit "Avoid serving legacy JavaScript to modern browsers" depends on this.
- **`reactStrictMode: true`** must remain enabled in `next.config.ts` — surfaces unsafe patterns during development.

### Lighthouse-driven base configuration (already shipped by this template)

The template ships with these Lighthouse-driven configurations pre-applied in `next.config.ts`, `package.json`, and `src/app/layout.tsx`. Do NOT remove or downgrade them without explicit reason:

- **Security headers**: HSTS (`Strict-Transport-Security`), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.
- **Per-path cache headers** for `/manifest.json`, `/seo/*`, `/sitemap.xml`, `/robots.txt`.
- **`images.minimumCacheTTL: 31536000`** (1 year) and **`images.formats: ['image/avif', 'image/webp']`**.
- **Tight `browserslist`** in `package.json` — modern engines only (>0.5%, not ie 11, not safari < 15.4, etc.).
- **Bundle analysis via Turbopack-native `next experimental-analyze`** (Next 16.1+) — run `pnpm run analyze` when investigating bundle bloat. Output lands in `.next/diagnostics/analyze/`. No extra dependency required (the webpack-based `@next/bundle-analyzer` is not used — Next 16 ships with Turbopack as default, so the webpack analyzer would not reflect the production bundle).

### Cleanup before production

The template ships with `src/app/sentry-example-page/page.tsx` + `src/app/api/sentry-example-api/route.ts` — these exist only to validate that Sentry is correctly wired up and report errors as expected. **Delete both files** (and remove `/sentry-example-page` from `next.config.ts` rewrites / `robots.ts` if applicable) before shipping to production. The page contains inline styles with hardcoded hex colors that intentionally don't follow the project's token system — that's expected for a throwaway test page, but it WILL flag in `figma-validation` if left in. Validating Sentry: open the page, click the buttons, confirm the errors appear in your Sentry dashboard, then delete.

## Testing

- **Framework:** Vitest + @testing-library/react
- Write **unit tests only** (NOT E2E, NOT integration)
- Focus on: utility functions, store logic, hook behavior, component rendering
- Test files live in `__tests__/` folders colocated with the source:
  - `src/utils/__tests__/validateEmail.test.ts`
  - `src/stores/__tests__/modalStore.test.ts`
  - `src/hooks/__tests__/usePressKey.test.ts`
  - `src/components/Label/__tests__/Label.test.tsx`
- Naming: `{Name}.test.ts` for logic, `{Name}.test.tsx` for components
- Commands: `pnpm test` (watch mode), `pnpm test-unit` (single run)
- Mock `.sass` imports and framer-motion when needed
- Use `vi.fn()` and `vi.mock()` for mocking
