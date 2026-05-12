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
| Create a new reusable component | `/new-component` | `/new-component CustomTable client` |
| Create a new modal type | `/new-modal` | `/new-modal ConfirmDelete` |

Skills live in `.claude/skills/{skill-name}/SKILL.md`. Do not duplicate their logic in chat — invoke them.

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

```sass
// ✅ Good — plain CSS for layout, @apply for tokens
.Card
  display: flex
  flex-direction: column
  gap: 1rem
  padding: 1.5rem
  border-radius: 8px
  @apply bg-white border border-surface-200 text-surface-950

// ❌ Avoid — @apply for everything
.Card
  @apply flex flex-col gap-4 p-6 rounded-[8px] bg-white border border-surface-200 text-surface-950
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

Use `container-custom` class for centered content with responsive max-widths:

- Default: 1600px | <=1920px: 1440px | <=1640px: 1200px | <=1440px: 1000px

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
5. **Container**: `container-custom` for centered content
6. **SASS**: `.sass` indented syntax (NO semicolons, NO curly braces). BEM: `.Name__Element--Modifier`. Plain CSS for layout/spacing/sizing; `@apply` only for design tokens (colors, `text-{weight}-{size}`, pseudo-state tokens).

### Component Rules

1. **REUSE**: Check existing components table BEFORE creating new ones. NEVER duplicate functionality.
2. **PrimeReact** for inputs (InputText, Dropdown, Calendar, MultiSelect). NO native HTML inputs.
3. **PrimeIcons** (`pi pi-xxx`) for icons. NO inline SVGs when a PrimeIcon exists.
4. **Conditional classes**: `classNames()` from `primereact/utils`. NOT `clsx`.
5. **Images**: `next/image` + WebP in `src/assets/images/`
6. **Links**: `next/link` or `CustomButton` with `href` prop
7. **Animations**: `m` from framer-motion + `AnimatePresence`. NEVER `motion`.
8. **Modals/Toasts**: `useModalStore` for loading states and notifications
9. **Env vars**: Import from `@/constants/env`. NEVER `process.env` directly.

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

## Dev Tools

- **React Scan**: Automatically loaded in development (`APP_ENV === 'development'`) via `next/script` in root layout. Highlights unnecessary re-renders.
- **APP_ENV validation**: `constants/env.ts` validates that `APP_ENV` is one of `production`, `staging`, or `development`

## SEO

- Every page should include `alternates.canonical` in its metadata export
- Use semantic HTML: proper heading hierarchy (`h1` > `h2` > `h3`), `<p>` for text, `<main>` for main content
- `robots.ts` and `sitemap.ts` are configured in `src/app/`

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
