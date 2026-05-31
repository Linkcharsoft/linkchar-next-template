# CONVENTIONS.md — Operational Rules

This file is the canonical reference for **how** to write code in this project. `CLAUDE.md` describes what the project is (tech stack, structure, automation skills); this file describes the rules a Claude agent must follow when generating, editing, or validating code.

**Loading model**: Skills and figma-* agents `Read` this file (or specific sections of it) at their Step 0 before generating any code. The Read is mandatory — if it fails, the agent stops and reports.

**Maintenance**: when you edit a rule here, no other file needs to be updated — the skills/agents reference this file directly and do not duplicate its contents. Old `<!-- mirror: ... -->` markers that used to live in those files are obsolete; do not re-introduce them.

---

## Table of contents

- [Naming Conventions](#naming-conventions)
- [Component Patterns](#component-patterns)
- [Existing Reusable Components](#existing-reusable-components)
- [Styling Rules — TAILWIND-FIRST](#styling-rules--tailwind-first)
- [Inside `.sass` files](#inside-sass-files)
- [Typography System](#typography-system)
- [Color System](#color-system)
- [Breakpoints](#breakpoints)
- [Global Container](#global-container)
- [PrimeReact Usage](#primereact-usage)
- [Framer Motion](#framer-motion)
- [Code Style](#code-style)
- [Asset Pipeline](#asset-pipeline)
- [Performance & Lighthouse Rules](#performance--lighthouse-rules)
  - [Image Performance](#image-performance)
  - [Font Loading](#font-loading)
  - [SEO & Metadata](#seo--metadata)
  - [Accessibility](#accessibility)
  - [Bundle & Performance Architecture](#bundle--performance-architecture)
  - [Lighthouse-driven base configuration](#lighthouse-driven-base-configuration)
- [Figma MCP Integration](#figma-mcp-integration)
- [Styling Checklist](#styling-checklist)
- [Component Rules](#component-rules)
- [STOP Protocol](#stop-protocol)

When a skill or agent's pre-flight Read says "Read CONVENTIONS.md > {Section name}", search for that exact heading. Use the Read tool's `offset`/`limit` or read the whole file once and keep the relevant section in mind.

---

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

---

## Component Patterns

Each component lives in its own folder (`src/components/ComponentName/`) with the `.tsx` and a colocated `.sass` imported directly via `import './ComponentName.sass'`.

### Key Patterns

- **`'use client'`**: Only add when the component uses hooks, event handlers, or browser APIs.
- **Default exports**: Every component/hook/store uses `export default`.
- **No manual `memo()`/`useMemo`/`useCallback`**: React Compiler is enabled (`reactCompiler: true` in `next.config.ts` + `babel-plugin-react-compiler`). The compiler handles memoization automatically — wrapping components in `memo()` is unnecessary noise. Default exports without `memo()`.
- **Path alias**: Always use `@/` for imports from `src/` (e.g. `@/components/CustomButton/CustomButton`).
- **Type imports**: Use `import type { X }` for type-only imports (enforced by ESLint).
- **Import order** (enforced by ESLint):
  1. Built-in modules
  2. External packages (alphabetical)
  3. Internal `@/` imports (alphabetical)
  4. Relative imports
  5. Type imports (last)

---

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

---

## Styling Rules — TAILWIND-FIRST

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

---

## Inside `.sass` files

Prefer plain CSS, `@apply` only for design tokens. When you move styles into a `.sass` file, write plain CSS for properties that map 1:1 to a single CSS declaration. Reserve `@apply` for design-system tokens that pull from the project's Tailwind config.

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

Other rules:

- **`.sass` indented syntax** (no curly braces, no semicolons) — enforced by hook.
- **BEM naming**: `.ComponentName`, `.ComponentName__Element`, `.ComponentName--Modifier`.
- **Colocated styles**: each component imports its own `.sass` file directly (`import './Component.sass'`).
- `src/styles/index.sass` only contains global styles (fonts, Tailwind layers, general reset).
- SASS mixins are auto-injected globally via `next.config.ts` `sassOptions.additionalData`.
- **Layer order in `src/styles/index.sass`** is `@layer tailwind-base, primereact, tailwind-utilities` — ensures Tailwind utilities override PrimeReact. **NEVER modify this line.**

---

## Typography System

Use the custom typography classes defined in `tailwind.config.js`:

- Pattern: `text-{weight}-{size}` where `weight ∈ {extrabold | bold | semibold | medium | regular | light}` and `size ∈ {10 | 12 | 14 | 16 | 18 | 20 | 24 | 28 | 32 | 36 | 40 | 44 | 48 | 56 | 64}`
- Examples: `text-bold-24`, `text-medium-16`, `text-regular-14`
- **NEVER** use loose Tailwind defaults (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, …, `text-9xl`) — banned in favor of the project scale.
- **NEVER** use loose weight utilities (`font-thin`, `font-extralight`, …, `font-black`) — banned, weights live inside `text-{weight}-{size}`.
- **NEVER** use a standalone `text-{size}` without a weight (e.g. `text-24` alone) — the convention is strict; every size must be paired with a weight.

---

## Color System

- **Surface colors**: `text-surface-50` through `text-surface-900` / `bg-surface-50` through `bg-surface-900`.
- **Semantic colors**: Use Tailwind defaults (`text-red-600`, `bg-blue-600`, `text-green-600`, etc.).
- **Custom surface palette**: `50(#FAFAFA) 100(#F5F5F5) 200(#EEEEEE) 300(#E0E0E0) 400(#BDBDBD) 500(#9E9E9E) 600(#757575) 700(#616161) 800(#424242) 900(#212121)`.
- **Brand/extra tokens** added via Figma imports live as new namespaces (e.g. `brand-*`, `accent-*`). Never reuse `surface-*` for them. See `figma-tokens-map.md` for the canonical mapping.
- **NEVER hardcode hex** in screens, components, layouts, or stylesheets. Every color must resolve to a Tailwind token. The only exception is multi-color brand glyphs inside `src/assets/icons/*.tsx` where the hex IS the brand identity.

---

## Breakpoints

``` text
2xs: 375px | xs: 480px | sm: 640px | md: 768px | lg: 1024px | xl: 1280px | 2xl: 1420px
```

Do not invent new breakpoints. When responsive variants are needed in SASS, use `@apply md:flex-row` etc.

---

## Global Container

Use `container-custom` class for centered content with responsive max-widths AND a built-in responsive lateral gutter:

- **Max-width tiers**: Default: 1600px | <=1920px: 1440px | <=1640px: 1200px | <=1440px: 1000px
- **Lateral padding (built-in)**: 16px on every viewport. This guarantees a safe edge gutter and prevents content from touching the screen edges on mobile.

Because the lateral padding is part of the class itself, NEVER add `px-*` (e.g. `px-4`) on the same element that already has `container-custom` — it's redundant. If a specific section truly needs a different inner padding than the global gutter, nest a child `<div>` and apply `px-*` there instead of duplicating it on the container.

`container-custom` ONLY handles **horizontal** concerns (max-width + lateral gutter). It does NOT set any vertical padding — and that's on purpose. Each section is responsible for its OWN vertical rhythm (`py-*`, `pt-*`, `pb-*`), and you MUST translate the vertical spacing from the Figma design (or pick a reasonable default like `py-16` / `py-20` when designing from scratch). NEVER strip vertical padding "to keep the section minimal" — sections without `py-*` collapse against each other and look broken.

**MANDATORY**: every top-level `<section>` of any screen (and the inner content of every layout: navbar, footer, sidebar) MUST anchor its content with `container-custom` so that ALL sections share the same horizontal alignment and lateral padding. If the section has a full-bleed background, keep the background on `<section>` and nest a `<div className='container-custom ...'>` for the content; otherwise apply `container-custom` directly on the `<section>`. NEVER substitute it with `max-w-[1600px]`, `max-w-7xl`, or custom horizontal per-section paddings — that's the #1 cause of misaligned sections in Figma-driven screens. (Vertical per-section paddings — `py-*` — are NOT covered by this rule; honor the Figma design.)

**When `container-custom` does NOT apply**: layouts whose visual structure defines its own width by design, with no shared content grid expectation. Two examples in this codebase:

- **Auth flow layouts** (`AuthLayout`): split-screen with the form on one side and a branding panel on the other (`w-[45%]` + `w-[55%]`). The form panel has its own internal width logic; the branding panel is decorative. Neither aligns with a "page section grid" — there is none. Wrapping with `container-custom` would actually break the split.
- **Private dashboard layouts** (`DashboardLayout`): typically render a sidebar + main work area where the main area expands to fill available width inside its parent container. Sections inside the dashboard SCREENS still use `container-custom` (per screen-level rules), but the LAYOUT shell itself uses raw flex/grid sizing because dashboard chrome is functional (resizable sidebar, full-bleed work area) rather than aligned to a marketing grid.

**Heuristic**: ask "does the user perceive a horizontal rhythm shared between this chrome and the screen sections below/around it?" If yes → `container-custom`. If the layout's job is functional partitioning (auth split, dashboard panes) rather than marketing alignment → leave the layout chrome on raw Tailwind sizing.

---

## PrimeReact Usage

- PrimeReact is configured with Tailwind passthrough (`pt: Tailwind`) in `ProvidersContainer`.
- Use PrimeReact components for inputs: `InputText`, `Password`, `Calendar`, `Dropdown`, `MultiSelect`. **NO native HTML inputs.**
- Use PrimeIcons for icons: `<i className="pi pi-{icon-name}" />`. **NO inline SVGs when a PrimeIcon exists.**
- Customize PrimeReact components via the `pt` (passthrough) prop.
- Use `classNames` from `primereact/utils` for conditional classes — **NEVER `clsx`**.

---

## Framer Motion

- **NEVER** import `motion` from `framer-motion` (enforced by ESLint).
- **ALWAYS** use `m` from `framer-motion` with `LazyMotion` (already set up in `ProvidersContainer`).
- Use `AnimatePresence` for enter/exit animations.
- **Reduced motion is handled globally** — `ProvidersContainer` wraps the app in `<MotionConfig reducedMotion='user'>` AND `src/styles/general.sass` ships a `@media (prefers-reduced-motion: reduce)` reset for CSS animations. **Do NOT add per-component `<MotionConfig>` wrappers or `useReducedMotion()` checks** — the global config handles the opt-out for users who have `prefers-reduced-motion: reduce` set.

---

## Code Style

ESLint-enforced rules:

- **Indentation**: 2 spaces
- **Quotes**: Single quotes (`'`)
- **Semicolons**: None
- **Trailing commas**: None
- **Object spacing**: `{ key: value }` (spaces inside braces)
- **Space before function parens**: Always (`function () {}`, `async () => {}`)
- **Type imports**: `import type { X }` (consistent-type-imports)
- **No `any`**: Warn on `@typescript-eslint/no-explicit-any`

---

## Asset Pipeline

- **SVG icons** → React component `.tsx` in `src/assets/icons/`. Props: `SVGProps<SVGSVGElement>`, default export — React Compiler handles memoization automatically. Set `aria-hidden='true'` and `focusable='false'` by default on the root `<svg>` (consumers can override when the icon is genuinely informative). Register the export in `src/assets/icons/index.ts`. Example: `src/assets/icons/GmailIcon.tsx`.
- **Large/decorative SVGs** (≥ 15KB, > 30 path nodes, contains `<animate>`) → loose `.svg` file at `src/assets/images/{kebab-case-name}.svg`. Imported as a static asset and rendered with `<Image>`.
- **PNG/JPEG** → convert to WebP and store in `src/assets/images/`: `ffmpeg -i input.png -q:v 85 output.webp`. Render with `next/image`.
- **Per-screen images** live under `src/assets/images/{screenSlug}/{name}.webp` (kebab-case slug); shared/global assets stay flat at `src/assets/images/{name}.webp`.
- **Download from Figma MCP**: `curl -s "http://localhost:3845/assets/{hash}.{ext}" -o /tmp/{name}.{ext}` (POSIX) or `Invoke-WebRequest -Uri "..." -OutFile "$env:TEMP\{name}.{ext}"` (PowerShell).
- **NEVER** install new icon libraries (`lucide-react`, `react-icons`, `heroicons`, `@fortawesome`, etc.). Use PrimeIcons or assets returned by the Figma MCP.
- **NEVER** save SVGs as loose `.svg` files when they will be used as React components.
- **NEVER** inline large SVGs via `atob` + `dangerouslySetInnerHTML` — that pattern is brittle and forbidden.
- **NEVER** use `unoptimized` on `next/image` unless the source is a known optimized image — defeats Next's image pipeline.

---

## Performance & Lighthouse Rules

These rules exist to prevent specific Lighthouse failures (Performance, Accessibility, SEO, Best Practices). They are mandatory whenever you generate UI code — do NOT ship code that violates them.

### Image Performance

LCP, CLS, "Properly size images".

- **`sizes` is REQUIRED on every `<Image fill>`**. Without it, Next.js serves the largest variant available. Match the rendered width: full-bleed hero → `sizes='100vw'`; half-width content → `sizes='(min-width: 768px) 50vw, 100vw'`; quarter-width card in a 4-col grid → `sizes='(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw'`.
- **LCP image** (hero, above-the-fold) needs BOTH `priority` AND `fetchPriority='high'`. `priority` tells Next to preload; `fetchPriority` tells the browser the resource is high priority. Both are required to pass the Lighthouse LCP audit.
- **Lists/grids**: only the first N items (those visible above the fold) get `priority`. Use `priority={index < N}`. Setting `priority` on every item defeats lazy loading and ships extra preloads.
- **Avoid CLS**: every image container must reserve space — for fixed-size containers set BOTH `height` AND `min-height` (or `aspect-ratio`). Skeleton placeholders must mirror final dimensions exactly.
- **Decorative images use `alt=''`**. Content images need a meaningful `alt`. Never leave `alt=''` on an image that conveys information — Lighthouse flags missing/empty alt as an a11y failure.
- **Mobile/desktop dual `<Image>` pattern**: when using `<Image className='hidden md:block'>` + `<Image className='md:hidden'>`, BOTH variants download by default. Scope each with `sizes`: desktop `sizes='(min-width: 768px) Xvw, 0vw'`, mobile `sizes='(min-width: 768px) 0vw, 100vw'`. The `0vw` tells Next to skip download at that breakpoint.
- **Raster assets (PNG/JPEG)**: convert to WebP at import time with `ffmpeg -i input.png -q:v 85 output.webp`. Render with `next/image` so AVIF/WebP variants are served when supported.

### Font Loading

"Eliminate render-blocking resources", "Ensure text remains visible".

- **NEVER** use `@import url('https://fonts.googleapis.com/...')` in CSS/SASS. It is render-blocking and triggers FOIT.
- **ALL fonts** must be loaded via `next/font/google` or `next/font/local`, with `display: 'swap'` and a CSS variable (`variable: '--font-X'`). Apply the variable to `<html>` via `className`.
- **Tailwind and CSS must reference the variable**, not the literal font name: `font-family: var(--font-merriweather-sans)` (NOT `'Merriweather Sans'`); Tailwind: `fontFamily: { sans: ['var(--font-merriweather-sans)', 'sans-serif'] }`.
- **Variable fonts**: omit `weight` to ship one `.woff2` covering the full weight range. Non-variable fonts: specify ONLY the weights actually used — every weight in the array is an extra file.
- **Icon fonts whose default `@font-face` uses `font-display: block`** MUST be re-hosted via `next/font/local` and forced via `[icon-selector] { font-family: var(--font-X) !important }`. Otherwise icons cause FOIT. The template ships this done for PrimeIcons — see `src/app/layout.tsx` (`localFont({ src: '../../node_modules/primeicons/fonts/primeicons.woff2', display: 'swap', variable: '--font-primeicons' })`) and `src/styles/index.sass` (`.pi { font-family: var(--font-primeicons) !important }`). Referencing the file directly from `node_modules` keeps the font version locked to `package.json` — no manual copy in `src/assets/`, no drift on upgrades.

### SEO & Metadata

Lighthouse "SEO" category.

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

### Accessibility

Lighthouse "Accessibility".

- **Heading hierarchy** must start with h1 and never skip levels (no `h1 → h3`). If the visual design has no h1, add a visually-hidden one (`<h1 className='sr-only'>{Page Title}</h1>`). Each rendered page must have exactly one h1.
- **Card/list-item titles** inside a page that already has h1/h2 use `<p>` (not `<h3>`/`<h4>`). Heading elements for each card pollute the document outline; Lighthouse flags it as "Heading levels are not in sequential order".
- **Never nest `<main>`**. The convention is: each **screen** owns its own `<main id='main'>` element (the skip-to-content target lives there); **layouts** must NOT render `<main>` themselves — they wrap chrome (navbar, sidebar, footer, decorative side-panels) around the screen slot. Two `<main>` per page = automatic a11y fail. If a layout needs a wrapper around the screen slot, use `<div>`; use `<aside>` for purely decorative side-panels.
- **Icon-only interactive elements** MUST have `aria-label`. `<button><i className='pi pi-times'/></button>` has no accessible name and fails "Buttons do not have an accessible name". Provide one: `aria-label='Close'`.
- **Decorative icons inside text or interactive content** (the `<i className='pi pi-X'>` next to a button label, the icon paired with a heading, etc.) MUST set `aria-hidden='true'`. Without it, screen readers announce PrimeIcons glyph codes as garbage characters next to the visible label.
- **External links** (`target='_blank'`) MUST include `rel='noopener noreferrer'`. Prevents tab-napping (security) and avoids a Lighthouse Best Practices flag.
- **Form inputs need `autoComplete`** (JSX prop — React lowercases it to the `autocomplete` HTML attribute): email → `'email'`, login password → `'current-password'`, signup/reset password → `'new-password'`, full name → `'name'`, phone → `'tel'`, postal code → `'postal-code'`, etc. Missing `autoComplete` is both a Lighthouse a11y failure and a password-manager UX regression.
- **Form/input error display components** (`InputError`-likes, `FormError`, `FieldError`, alert banners on inputs) MUST wrap the visible message in an element with `role='alert'`. The existing `src/components/inputs/InputError/InputError.tsx` already does this on its `<m.div role='alert'>` root — preserve the pattern when extending.
- **Form submission errors**: when a server or schema validation error fires on submit, focus MUST move to the first invalid field (call `.focus()` in the Formik `onSubmit` failure path) OR render an error summary wrapped in `<div role='alert' aria-live='assertive'>...</div>`. Without this, screen-reader users don't know the form failed.
- **Loading states**: never render the screen blank while data is fetching — use a `{Name}PageSkeleton` (generated by `/new-skeleton`) or `<Loader/>` for sub-sections. Wrap the loading container with `aria-busy={isLoading}` so SR users hear that data is on the way.
- **Viewport meta**: never use `user-scalable=no` or `maximum-scale=1`. Both block accessibility zoom and fail Lighthouse. Configure via the Next.js `viewport` export and leave zoom unrestricted.
- **Tap target size**: interactive elements on mobile need at least `44×44px` with 8px gap to neighbors (Lighthouse measures `48×48` effective). Set `min-h-[44px] min-w-[44px]` on icon buttons; rely on `CustomButton` size variants that already meet this for regular buttons.
- **Color contrast** must meet WCAG AA: 4.5:1 for normal text, 3:1 for large text (18pt+ or 14pt+ bold) and UI components. When picking color tokens, verify every text/background pair before shipping — Lighthouse runs `axe-core` contrast checks automatically.
- **Skip-to-content link**: the root layout (`src/app/layout.tsx`) renders `<a href='#main' className='SkipToContent'>...</a>` as the first child of `<body>`, paired with `id='main'` on the screen's `<main>`. Required for the "Bypass blocks of repetitive content" Lighthouse audit.
- **Horizontal-scroll carousels** (mobile `overflow-x-auto` lists): use semantic `<ul role='list' aria-label='...'>` + `<li>` items. Screen readers announce the item count; the label describes what the carousel contains.
- **Focus visibility**: NEVER `outline: none` (or `box-shadow: none` on `:focus`) without providing a visible replacement (`focus-visible:ring-*`, a custom `&:focus-visible` block, or PrimeReact's default ring). Keyboard users navigate by sight of focus — removing the indicator fails WCAG 2.4.7.
- **Clickable non-button elements** need `role="button"`, `tabIndex={0}`, and `onKeyDown` for Enter/Space — or just use a `<button>`.

### Bundle & Performance Architecture

- **`'use client'` belongs at the deepest leaf that needs it**. Marking a layout or page as `'use client'` opts the entire subtree out of SSR — you lose streaming, bigger JS payload, slower LCP. Default to server; push the directive down to the specific component that uses hooks/events/browser APIs.
- **`generateStaticParams`** for dynamic detail routes when the set of params is bounded (catalog items, blog posts, etc.). Converts dynamic routes to statically pre-rendered HTML at build time → dramatic LCP and TTFB improvement. Combine with `revalidate` for ISR if data changes.
- **Heavy client-only components** (rich text editors, charts, code editors, map libraries, non-critical modals) → `dynamic(() => import('...'), { ssr: false })` from `next/dynamic`. Reduces the initial JS payload that ships with the page.
- **Modals used on a single screen** are NOT registered in the global `ModalsProvider`. Mount them locally inside the screen that uses them. A modal in the global provider ships its JavaScript on every page — even pages that never open it.
- **Third-party scripts** (analytics, tag managers, pixels, heatmap tools): MUST use Next.js `<Script>` with `strategy='afterInteractive'` or `'lazyOnload'`. NEVER `strategy='beforeInteractive'` unless the script is genuinely critical for the first paint — `beforeInteractive` blocks hydration and destroys LCP/TBT.
- **`fetch` calls in Server Components** must set an explicit cache policy: `fetch(url, { next: { revalidate: N } })` for ISR, or `cache: 'no-store'` for always-fresh. Defaults change between Next.js versions — be explicit so the behavior is stable.
- **Browserslist** (in `package.json`) should target modern engines only. Wider ranges (e.g. the Create-React-App default `>0.2%`) ship hundreds of KB of legacy polyfills. The Lighthouse audit "Avoid serving legacy JavaScript to modern browsers" depends on this.
- **`reactStrictMode: true`** must remain enabled in `next.config.ts` — surfaces unsafe patterns during development.

### Lighthouse-driven base configuration

The template ships with these Lighthouse-driven configurations pre-applied in `next.config.ts`, `package.json`, and `src/app/layout.tsx`. Do NOT remove or downgrade them without explicit reason:

- **Security headers**: HSTS (`Strict-Transport-Security`), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.
- **Per-path cache headers** for `/manifest.json`, `/seo/*`, `/sitemap.xml`, `/robots.txt`.
- **`images.minimumCacheTTL: 31536000`** (1 year) and **`images.formats: ['image/avif', 'image/webp']`**.
- **Tight `browserslist`** in `package.json` — modern engines only (`>0.5%`, not ie 11, not safari < 15.4, etc.).
- **Bundle analysis via Turbopack-native `next experimental-analyze`** (Next 16.1+) — run `pnpm run analyze` when investigating bundle bloat. Output lands in `.next/diagnostics/analyze/`.

---

## Figma MCP Integration

These rules govern every Figma-driven implementation. Treat the MCP output (React + Tailwind) as a **representation of design intent**, NEVER as final code — always translate it into this project's stack and conventions before shipping.

### Prerequisites

The repo ships with a `.mcp.json` that wires Claude Code to the Figma Dev Mode MCP server at `http://127.0.0.1:3845/mcp`. For any Figma skill (`/figma-design-import`, `figma:*`) to work, you MUST have:

1. **Figma desktop app running** on the same machine — the web version does not expose the Dev Mode MCP server.
2. **Dev Mode MCP enabled** in Figma: `Preferences → Enable Dev Mode MCP Server` (requires a Figma seat with Dev Mode access).
3. The Figma file open and the relevant node selected (or its URL/nodeId ready to pass to the skill).

### Required Flow

1. **Get design context** — call `get_design_context` with the `nodeId` and `fileKey` extracted from the Figma URL (`figma.com/design/:fileKey/...?node-id=:nodeId`, convert `-` to `:` in the nodeId).
2. **If the response is too large or truncated** — call `get_metadata` first to get the high-level node map, then re-fetch only the required node(s) with `get_design_context`.
3. **Get a screenshot** — call `get_screenshot` for visual reference of the variant being implemented.
4. **Only after both** `get_design_context` AND `get_screenshot` are available, download any required assets and start implementation.
5. **Reuse, then build** — check the existing components table BEFORE generating any new component. If a similar one exists, REUSE or extend it via props/variants. NEVER duplicate functionality.
6. **Validate against the screenshot** — verify 1:1 visual parity AND interactive behavior before marking the task complete.

### Translation Rules (Figma React+Tailwind → this project)

- **Stack**: Next.js 16 App Router + React 19 + TypeScript. Use `'use client'` ONLY when hooks/event handlers/browser APIs are required.
- **Layout & spacing**: Use Tailwind utilities first (flex, grid, gap, padding, margin, width, responsive). SASS only for what Tailwind cannot express.
- **Typography**: ALWAYS map to the custom scale `text-{weight}-{size}` (see [Typography System](#typography-system)). NEVER use loose `text-xl`, `font-bold`, raw `font-size`, or arbitrary px values.
- **Colors**: see [Color System](#color-system). NEVER hardcode hex — every Figma color must resolve to a token.
- **Breakpoints**: use the project's custom screens (see [Breakpoints](#breakpoints)).
- **Container**: mandatory `container-custom` on every top-level `<section>` (see [Global Container](#global-container)).
- **SASS**: when utilities are not enough, write `.sass` indented syntax (see [Inside `.sass` files](#inside-sass-files)).
- **PrimeReact layer order**: NEVER alter the layer ordering in `src/styles/index.sass`.

### Asset Handling

- **Figma MCP localhost sources**: When the MCP returns a `http://localhost:3845/assets/...` URL for an image or SVG, USE IT DIRECTLY. NEVER replace it with placeholders, stock URLs, or `Image` library imports.
- **Downloaded assets**: see [Asset Pipeline](#asset-pipeline) for the full rules (SVG → icon component, raster → WebP via ffmpeg, etc.).

### Component & Reuse Rules

- **MANDATORY**: Before generating ANY new component, check `src/components/` and the [Existing Reusable Components](#existing-reusable-components) table. Reuse `CustomButton`, `InputContainer`, `Label`, `InputError`, `SearchInput`, `Filters`, `PasswordValidator`, `Loader`, `Waves`, `LoadingModal`, `StateModal`, `ToastNotifications` whenever the Figma node maps to one of them.
- **Buttons**: Always `CustomButton`. NEVER render a raw `<button>` or another button library.
- **Inputs**: ALWAYS PrimeReact wrapped in `InputContainer`. NEVER native HTML inputs.
- **Icons**: ALWAYS PrimeIcons (`<i className="pi pi-{name}" />`) when the icon exists in the PrimeIcons set. Only fall back to a custom SVG component if PrimeIcons doesn't have it.
- **Conditional classes**: `classNames` from `primereact/utils`. NEVER `clsx` or template-string concatenation.
- **Animations**: `m` from `framer-motion` + `LazyMotion` + `AnimatePresence`. NEVER `motion`.
- **Links / navigation**: `next/link` or `CustomButton` with the `href` prop. NEVER raw `<a>` for internal routes.
- **Modals & toasts**: trigger via `useModalStore` (`openModal`, `closeModal`, `setNotification`). To add a new modal type invoke `/new-modal`.
- **New components / screens / modals**: invoke the matching skill (`/new-component`, `/new-screen`, `/new-modal`). Do NOT scaffold files manually — the skills enforce folder layout, default exports, colocated `.sass`, and route registration.

---

## Styling Checklist

1. **TAILWIND-FIRST**: Use Tailwind for all layout and structure. Move to SASS (BEM + `@apply`) any element with visual appearance classes (colors, borders, shadows, `rounded-*`, `text-*`, `hover:`) or 6+ classes of any kind. Pure layout combos (`flex items-center gap-4`) and one-off 2–3-class mixes that don't repeat or need responsive variants may stay inline.
2. **Typography**: ALWAYS `text-{weight}-{size}` (e.g., `text-bold-24`). NEVER loose `text-xl`, `font-bold`.
3. **Colors**: `surface-50` to `surface-900` for grays. Semantic colors with Tailwind defaults.
4. **Responsive**: Custom breakpoints: `2xs:`, `xs:`, `sm:`, `md:`, `lg:`, `xl:`, `2xl:`
5. **Container**: `container-custom` is MANDATORY on every top-level `<section>` (or the inner `<div>` when the `<section>` is full-bleed) so all sections share the same horizontal alignment. Brings a built-in 16px lateral gutter — do NOT add `px-*` next to it. Also required on layout chrome (Navbar, Footer). NEVER substitute with `max-w-[Xpx]` or custom horizontal per-section paddings. **Vertical padding (`py-*`) is YOUR call** — `container-custom` does not set any, so always add the vertical rhythm Figma specifies (or sensible defaults like `py-16` / `py-20`).
6. **SASS**: `.sass` indented syntax (NO semicolons, NO curly braces). BEM: `.Name__Element--Modifier`. Plain CSS for layout/spacing/sizing; `@apply` only for design tokens (colors, `text-{weight}-{size}`, pseudo-state tokens). **`@apply` LAST in each block scope**.

---

## Component Rules

1. **REUSE**: Check the [Existing Reusable Components](#existing-reusable-components) table BEFORE creating new ones. NEVER duplicate functionality.
2. **PrimeReact** for inputs (`InputText`, `Dropdown`, `Calendar`, `MultiSelect`). NO native HTML inputs.
3. **PrimeIcons** (`pi pi-xxx`) for icons. NO inline SVGs when a PrimeIcon exists.
4. **Conditional classes**: `classNames()` from `primereact/utils`. NOT `clsx`.
5. **Images**: `next/image` + WebP in `src/assets/images/`. See [Image Performance](#image-performance) for `sizes` / `priority` / `fetchPriority` requirements.
6. **Links**: `next/link` or `CustomButton` with `href` prop. External `target='_blank'` MUST include `rel='noopener noreferrer'`.
7. **Animations**: `m` from framer-motion + `AnimatePresence`. NEVER `motion`.
8. **Modals/Toasts**: `useModalStore` for loading states and notifications. Single-screen-only modals go local — see [Bundle & Performance Architecture](#bundle--performance-architecture).
9. **Env vars**: Import from `@/constants/env`. NEVER `process.env` directly.
10. **Icon-only buttons**: every `<button>` (or `CustomButton`) whose visible content is only an icon MUST receive `aria-label`. Without it, Lighthouse "Buttons do not have an accessible name" fails.
11. **Form inputs**: every text-like input MUST set `autoComplete` (JSX) to the matching token (`email`, `current-password`, `new-password`, `name`, `tel`, `postal-code`, `one-time-code`, etc.). Missing values fail the a11y audit and break password managers.
12. **Heading element choice**: card/list-item titles inside a page that already has h1/h2 use `<p>`, not `<h3>`/`<h4>`. Reserve heading elements for actual document structure.

---

## STOP Protocol

Sub-agents (especially the figma-* family) emit STOPs when they cannot proceed without input from the orchestrator. STOPs come in two severities:

- **`STOP-BLOCKING`** — the agent CANNOT continue. The orchestrator MUST resolve the issue (typically by delegating to another sub-agent, asking the user, or fixing the input) before the original agent is re-invoked.
- **`STOP-ADVISORY`** — the agent CAN continue with a documented default, but flagged the situation as worth surfacing. The orchestrator MUST display every advisory to the user at the next checkpoint, even if the batch keeps running.

### Standardized format

Sub-agents emit STOPs as a fenced block at the end of their report:

``` text
STOP-BLOCKING
category: <ONE_OF_THE_CATEGORIES_BELOW>
reason: <one line — what's broken>
resolution: <1–2 lines — what the orchestrator must do>
next_agent: <agent name to re-delegate to | "user_decision" | "manual">
details:
  <optional key: value lines for context the orchestrator may need>
```

`STOP-ADVISORY` has the same shape plus a `default_applied:` field naming the fallback the agent already used.

### Categories

| Category | Severity | When | Next agent |
| -------- | -------- | ---- | ---------- |
| `TOKENS_MISSING` | BLOCKING | A Figma value has no Tailwind token (color, typography size, weight, family) | `figma-tokens` |
| `OVERRIDE_BLOCKED` | BLOCKING | Token override on a non-surface token without `confirmOverride: true` | `user_decision` (then `figma-tokens` with confirmation) |
| `REJECTED_SURFACE` | BLOCKING | Token proposal would extend/override the immutable `surface-*` namespace | `figma-tokens` (re-invoke with a non-surface namespace) |
| `INVALID_INPUT` | BLOCKING | A required input is missing or malformed (e.g. empty `screenSlug`, missing `figmaNodeId`) | `manual` (orchestrator re-invokes with valid input) |
| `NAMING_NEEDED` | BLOCKING | Asset name is a generic Figma default (`img-image-21`, `frame-1234`, `vector copy 2`) and no semantic context is available | `user_decision` |
| `DATA_SCOPE_LEAK` | BLOCKING | A `figma-components` node intrinsically requires data loading (API, SWR) | `manual` (move the node to a screen via `figma-screen`) |
| `COMPONENT_GAP` | ADVISORY when the variant is used 1× in the screen, otherwise BLOCKING | Existing component does not cover a Figma variant/state | `figma-components` |
| `CONTAINER_CUSTOM_DECISION` | ADVISORY | Hybrid layout: ambiguous whether `container-custom` should anchor the chrome | `user_decision` (default = no `container-custom`) |

### Defaults applied by ADVISORY STOPs

When `COMPONENT_GAP` fires as advisory (variant used once), the screen agent inlines a bespoke version with a `// TODO: refactor into <ComponentName> variant` comment. The orchestrator surfaces the advisory; the user can decide to delegate to `figma-components` post-batch or accept the inline.

When `CONTAINER_CUSTOM_DECISION` fires as advisory, the layout agent renders the chrome WITHOUT `container-custom` (the safer default — does not break alignment but also does not enforce it). The orchestrator surfaces the question; the user can re-invoke `figma-layouts` with an explicit decision.

### Orchestrator handler

The `figma-design-import` skill includes a "Handling agent STOPs" section that describes the exact decision tree: for each `STOP-BLOCKING`, the orchestrator must delegate or ask the user; for each `STOP-ADVISORY`, the orchestrator continues the flow but always shows the advisory in the next per-screen checkpoint.

---

## Quick lookup — which section does my work belong to?

| If your task is… | Section |
| ---------------- | ------- |
| Naming a new file / type / store / hook | [Naming Conventions](#naming-conventions) |
| Picking a component or extending one | [Component Patterns](#component-patterns), [Existing Reusable Components](#existing-reusable-components) |
| Writing JSX classes vs `.sass` | [Styling Rules — TAILWIND-FIRST](#styling-rules--tailwind-first), [Inside `.sass` files](#inside-sass-files) |
| Picking a font size or weight | [Typography System](#typography-system) |
| Picking a color | [Color System](#color-system) |
| Adding a top-level section | [Global Container](#global-container) |
| Adding an input or icon | [PrimeReact Usage](#primereact-usage) |
| Adding an animation | [Framer Motion](#framer-motion) |
| Linting / formatting | [Code Style](#code-style) |
| Saving a new image / icon | [Asset Pipeline](#asset-pipeline) |
| Rendering `<Image>` | [Image Performance](#image-performance) |
| Loading a font | [Font Loading](#font-loading) |
| Writing `metadata` / `generateMetadata` | [SEO & Metadata](#seo--metadata) |
| Writing semantic HTML, aria-* attrs, focus, keyboard | [Accessibility](#accessibility) |
| Deciding `'use client'`, dynamic imports, modal scope | [Bundle & Performance Architecture](#bundle--performance-architecture) |
| Implementing a Figma node | [Figma MCP Integration](#figma-mcp-integration) |
| Pre-commit review of styles | [Styling Checklist](#styling-checklist) |
| Pre-commit review of components | [Component Rules](#component-rules) |
| Emitting an early-exit from a sub-agent | [STOP Protocol](#stop-protocol) |
