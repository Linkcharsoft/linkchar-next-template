---
name: new-screen
description: Create a new screen — generates the Screen component, colocated .sass, and the thin page.tsx wrapper in the correct app route. Also updates proxy.ts when needed.
---

Create a new screen. Arguments: **$ARGUMENTS**

Parse the arguments:
- First word = `ScreenName` (must be PascalCase, must end in `Page` — append it if missing)
- Second word = page type: `auth` | `public` | `protected` (default: `protected`)
- Third word = route path, e.g. `/dashboard/users` or `/about` (if omitted, infer kebab-case from the screen name)

Examples:
- `UsersPage protected /dashboard/users`
- `AboutPage public /about`
- `PasswordResetPage auth /password-reset`
- `InvoicesPage` → type=protected, route=/dashboard/invoices

---

## Step 0 — Recon & dedup

Before creating anything:
- Read `src/proxy.ts` to understand the current `AUTH_PATHS` and `PUBLIC_PATHS` sets. You will need this to decide if `proxy.ts` needs to be updated in Step 2.
- Scan `src/app/` and `src/screens/` to detect collisions with the target route or screen name.

If a matching page already exists, **stop and tell the user** which page they should reuse or extend instead. In particular: if the requested screen is a list/table with pagination, filters, or search — STOP and redirect the user to `/new-table`, which scaffolds the full stack (types + API + screen + filters + paginator).

---

## Step 1 — Plan: file locations by page type

The page type determines where files go and whether `src/proxy.ts` needs updating:

### `protected` (default)

- Screen: `src/screens/ScreenName/ScreenName.tsx` + `src/screens/ScreenName/ScreenName.sass`
- Page: `src/app/{route}/page.tsx`
- proxy.ts: **no changes needed** — all unmatched paths are protected by default

### `auth`

- Screen: `src/screens/auth/ScreenName/ScreenName.tsx` + `src/screens/auth/ScreenName/ScreenName.sass`
- Page: `src/app/(auth-layout)/{route}/page.tsx`
- proxy.ts: **add to `AUTH_PATHS`** only if the route is NOT already covered by an existing `pathname.includes(path)` check. For example, `/signup/confirm` is already covered by `/signup`. Check before adding.

### `public`

- Screen: `src/screens/ScreenName/ScreenName.tsx` + `src/screens/ScreenName/ScreenName.sass`
- Page: `src/app/{route}/page.tsx` (root level, no layout group)
- proxy.ts: **add the route to `PUBLIC_PATHS`** — public pages require an explicit entry or they will redirect unauthenticated users to login

---

## Step 2 — Mutate registries: `src/proxy.ts` (if needed)

Use Edit (not rewrite) to add the new entry.

**For `auth`** — add to `AUTH_PATHS` only if not already covered:
```ts
const AUTH_PATHS = new Set([
  '/login',
  '/new-auth-route',  // ← add here if not already covered by includes()
])
```

**For `public`** — always add to `PUBLIC_PATHS`:
```ts
const PUBLIC_PATHS = new Set([
  '/',
  '/new-public-route',  // ← add here
])
```

---

## Step 3 — Create the Screen component

### Protected screen (`src/screens/ScreenName/ScreenName.tsx`)

```tsx
'use client'
import './ScreenName.sass'

interface Props {
  searchParams: { [key: string]: string | string[] | undefined }
}

const ScreenName = ({ searchParams }: Props) => {
  return (
    <main id='main' className='ScreenName'>

    </main>
  )
}

export default ScreenName
```

### Public screen (`src/screens/ScreenName/ScreenName.tsx`)

Same as protected, but without `searchParams` unless needed:

```tsx
'use client'
import './ScreenName.sass'

const ScreenName = () => {
  return (
    <main id='main' className='ScreenName'>

    </main>
  )
}

export default ScreenName
```

### Auth screen (`src/screens/auth/ScreenName/ScreenName.tsx`)

Auth screens follow the SAME folder pattern as protected/public (subfolder + colocated `.sass`). The `.sass` is allowed to stay empty when the visual styling is fully inherited from `AuthLayout`, but the file should still exist so the import stays consistent with the rest of the screens.

```tsx
'use client'
import './ScreenName.sass'

const ScreenName = () => {
  return (
    <main id='main' className='AuthLayout'>

    </main>
  )
}

export default ScreenName
```

The `<main>` className is `AuthLayout` (not `ScreenName`) because auth screens share the layout's BEM scope — the form's visual styling lives in `src/layouts/AuthLayout/AuthLayout.sass` and is shared across login, signup, password recovery, etc. Existing examples on disk: `src/screens/auth/LoginPage/LoginPage.tsx`, `src/screens/auth/SignupPage/SignupPage.tsx`, etc.

Rules for all screen types:
- Always `'use client'` (screens use hooks)
- **The screen owns its `<main id='main'>` root** — the skip-to-content link in the root layout points to `#main`. Layouts must NOT render `<main>` themselves (they only render chrome around the screen slot); if you find a layout that does, fix the layout, not the screen. Two `<main>` per rendered page is a Lighthouse a11y failure.
- Protected/public use `.ScreenName` BEM root class; auth uses `.AuthLayout`
- No `export const metadata` — metadata belongs in `page.tsx` only

### Accessibility & Lighthouse rules (mandatory)

These rules must hold for the screen to pass the project's Lighthouse audits. See "Performance & Lighthouse Rules" in `CLAUDE.md` for the full set.

- **Heading hierarchy** must start with `<h1>` and never skip levels (no `h1 → h3`). If the visual design has no h1, add a visually-hidden one: `<h1 className='sr-only'>{Page Title}</h1>`. Each rendered page must have exactly one h1.
- **Card / list-item titles inside the screen** use `<p>` (not `<h3>` / `<h4>`). Heading elements pollute the document outline; reserve them for actual document structure.
- **Single `<main>`**: the screen owns `<main id='main'>` and is the ONLY `<main>` on the rendered page (Lighthouse fails on duplicate `<main>`).
- **Top-level `<section>`s**: every top-level section MUST anchor its content with `container-custom` so all sections share the same horizontal alignment + 16px lateral gutter. Never substitute with `max-w-[Xpx]` or `max-w-7xl`. AND each section must keep its own vertical padding (`py-*`/`pt-*`/`pb-*`) — `container-custom` does NOT provide vertical rhythm.
- **Form inputs** (when present in the screen) set `autoComplete` (JSX prop) to the matching token: email → `'email'`, login password → `'current-password'`, signup/reset password → `'new-password'`, name → `'name'`, phone → `'tel'`, postal code → `'postal-code'`.
- **Form submission errors**: when a server or schema validation error fires on submit, focus MUST move to the first invalid field (call `.focus()` in the Formik `onSubmit` failure path) OR render an error summary wrapped in `<div role='alert' aria-live='assertive'>...</div>`. Without this, screen-reader users don't know the form failed and assume the click did nothing.
- **Icon-only buttons** rendered directly in the screen MUST set `aria-label`. External links (`target='_blank'`) MUST include `rel='noopener noreferrer'`.
- **Focus indicators**: never strip `outline` on interactive elements without replacing it. The project relies on browser defaults + `focus-visible` rings; verify nothing in your `.sass` clobbers them with `outline: none`.
- **Carousels and horizontal scrolling lists** (`overflow-x-auto` on mobile for cards, products, testimonials) MUST use `<ul role='list' aria-label='...'>` + `<li>` children. SR users get the item count announced and a meaningful label for the carousel as a whole.
- **Loading states**: never render the screen blank while data is fetching — use `<{Name}PageSkeleton/>` via `/new-skeleton`, or `<Loader/>` for sub-sections. Wrap the loading container with `aria-busy={isLoading}` so SR users know data is on the way.
- **Color contrast**: WCAG AA — 4.5:1 for normal text, 3:1 for large text and UI. The project's `surface-*` tokens are chosen to meet this against standard pairings; verify custom combinations (e.g. brand color on a tinted background) with axe-core or Lighthouse.
- **Reduced motion** is handled globally — the CSS reset in `general.sass` neutralizes all CSS animations/transitions, and `MotionConfig reducedMotion='user'` in `ProvidersContainer` disables every framer-motion animation. No per-screen config needed. Only override locally if a specific animation is essential to comprehension (e.g. a stepper progress indicator) AND must keep playing for users who opted out.
- **Heavy client-only components** the screen renders (rich text editors, charts, maps) → `dynamic(() => import('...'), { ssr: false })` from `next/dynamic` to keep them out of the initial bundle.

---

## Step 4 — Create the `.sass` file

Create an empty `src/screens/ScreenName/ScreenName.sass` (protected and public) or `src/screens/auth/ScreenName/ScreenName.sass` (auth).

Move styles here using BEM + `@apply` whenever:
- Tailwind cannot express the style (custom animations, complex pseudo-elements, PrimeReact overrides)
- An element uses **visual appearance classes**: colors, backgrounds, borders, shadows, `rounded-*`, typography (`text-*`), or interactive states (`hover:`, `focus:`)
- An element accumulates **6 or more classes** of any kind

**Inline exceptions** (these may stay in JSX, skip the `.sass`):
- **Layout-only** combos (`flex items-center gap-4`, `grid grid-cols-2`).
- **One-off mix of 2–3 simple utilities** — even visual ones like `text-bold-18` or `bg-red-600` — when the combination isn't repeated in the screen AND doesn't need responsive/state variants.

If styles are needed, use `.sass` indented syntax (no curly braces, no semicolons) with BEM:
```sass
.ScreenName
  // styles

  &__Element
    // styles

  &--Modifier
    // styles

  &__Element--Modifier
    // styles
```

**Inside `.sass`: prefer plain CSS, `@apply` only for design tokens.**

- ✅ Plain CSS for: `display`, `flex-direction`, `gap`, `padding`, `margin`, `width`, `height`, `border-radius`, `position`, `cursor`, `overflow`, `transition`, `transform`
- ✅ `@apply` for: project colors (`bg-surface-100`, `text-surface-700`), typography tokens (`text-bold-14`, `text-medium-16`), responsive prefixes (`md:flex-row`), pseudo-state tokens (`hover:bg-surface-100`)
- ⚠️ **`@apply` MUST be the LAST declaration in each block scope** — root, `&__Element`, `&--Modifier`, pseudo-state. Plain CSS first, THEN a single `@apply` at the end. Putting `@apply` between plain CSS declarations breaks the SASS indented parser. Nested child blocks (`&__X`, `&--X`) are allowed after `@apply` since they're a deeper scope.

```sass
// ✅ Good — plain CSS first, @apply LAST in each scope
.MyScreen
  display: flex
  gap: 1rem
  padding: 1.5rem
  border-radius: 8px
  @apply bg-white border border-surface-200 text-bold-14 text-surface-900

  &__Hero
    min-height: 480px
    @apply bg-surface-50

  &--Compact
    padding: 0.75rem
    @apply text-bold-14

// ❌ Avoid — @apply between plain CSS declarations (SASS parser breaks)
.MyScreen
  display: flex
  @apply bg-white
  border-radius: 8px

// ❌ Avoid — @apply for everything
.MyScreen
  @apply flex gap-4 p-6 rounded-[8px] bg-white border border-surface-200 text-bold-14 text-surface-900
```

Note that auth screens generally share their styles through the `src/layouts/AuthLayout`

---

## Step 5 — Create the `page.tsx` wrapper

The page is a **thin wrapper only** — no logic, no UI. It owns the page-level metadata and the parameters returned by Next.js (segmentName, searchParams, etc.).

Pick the variant by page type:

- **Public (indexable) page** → full metadata: `title`, `description`, `alternates.canonical`, `openGraph`, `twitter`. Lighthouse SEO requires all of these.
- **Dynamic route** (`[id]`, `[slug]`, etc.) → use `generateMetadata` so the metadata reflects the actual resource.
- **Listing with filters/pagination** → if the page handles `?search=`, `?page=`, `?category=`, etc., set `robots: { index: false, follow: true }` when those params are present (or use `generateMetadata` to switch dynamically).
- **Protected dashboard/admin** → minimal metadata (`title` + `canonical` is enough). Robots already blocks dashboard via `robots.ts`, and no social previews are needed.
- **Auth** → minimal metadata; these routes are disallowed by `robots.ts` too.

### Public page — static metadata (`src/app/{route}/page.tsx`)

```tsx
import ScreenName from '@/screens/ScreenName/ScreenName'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Page Title',
  description: 'One-sentence description of this page (~155 chars). Used for the SERP snippet and social cards.',
  alternates: { canonical: '/route' },
  openGraph: {
    title: 'Page Title | App Name',
    description: 'One-sentence description of this page.',
    url: '/route',
    images: [{ url: '/seo/social-banner.webp', width: 1200, height: 630, alt: 'Page Title — App Name' }]
  },
  twitter: {
    title: 'Page Title | App Name',
    description: 'One-sentence description of this page.',
    images: [{ url: '/seo/social-banner.webp', alt: 'Page Title — App Name' }]
  }
}

const Page = () => (
  <ScreenName/>
)

export default Page
```

### Public page — dynamic listing with optional filters/pagination

When the screen accepts `searchParams` and the params reflect filter/pagination state, switch to `generateMetadata` so filtered URLs return `robots: { index: false }`:

```tsx
import ScreenName from '@/screens/ScreenName/ScreenName'
import type { Metadata } from 'next'

type SearchParams = { [key: string]: string | string[] | undefined }

interface Props {
  searchParams: Promise<SearchParams>
}

export async function generateMetadata ({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams
  const hasFilter = !!params.search || (Number(params.page) > 1) || !!params.category
  return {
    title: 'Page Title',
    description: 'One-sentence description of this listing.',
    alternates: { canonical: '/route' },
    robots: hasFilter
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      title: 'Page Title | App Name',
      description: 'One-sentence description of this listing.',
      url: '/route',
      images: [{ url: '/seo/social-banner.webp', width: 1200, height: 630, alt: 'Page Title — App Name' }]
    },
    twitter: {
      title: 'Page Title | App Name',
      description: 'One-sentence description of this listing.',
      images: [{ url: '/seo/social-banner.webp', alt: 'Page Title — App Name' }]
    }
  }
}

const Page = async ({ searchParams }: Props) => {
  const params = await searchParams
  return <ScreenName searchParams={params}/>
}

export default Page
```

### Dynamic detail route (`src/app/{route}/[id]/page.tsx`)

Use `generateMetadata` to fetch the resource and derive metadata from it. If the resource is not found, return `robots: { index: false, follow: false }` so 404-equivalent pages don't get indexed.

```tsx
import { getResource } from '@/api/resources'
import ScreenName from '@/screens/ScreenName/ScreenName'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata ({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const res = await getResource(id)
  if (!res.ok) {
    return {
      title: 'Not found',
      robots: { index: false, follow: false }
    }
  }
  const item = res.data
  const description = (item.description ?? '').slice(0, 160) || `${item.name} — App Name.`
  return {
    title: item.name,
    description,
    alternates: { canonical: `/route/${id}` },
    openGraph: {
      title: item.name,
      description,
      url: `/route/${id}`,
      images: item.imageUrl ? [{ url: item.imageUrl, alt: item.name }] : undefined
    },
    twitter: {
      title: item.name,
      description,
      images: item.imageUrl ? [{ url: item.imageUrl, alt: item.name }] : undefined
    }
  }
}

const Page = async ({ params }: Props) => {
  const { id } = await params
  return <ScreenName id={id}/>
}

export default Page
```

### Protected page (`src/app/{route}/page.tsx`)

```tsx
import ScreenName from '@/screens/ScreenName/ScreenName'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Page Title',
  alternates: { canonical: '/route' }
}

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const Page = async ({ searchParams }: Props) => {
  const params = await searchParams

  return (
    <ScreenName searchParams={params}/>
  )
}

export default Page
```

### Auth page (`src/app/(auth-layout)/{route}/page.tsx`)

```tsx
import ScreenName from '@/screens/auth/ScreenName/ScreenName'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Page Title',
  alternates: { canonical: '/route' }
}

const Page = () => (
  <ScreenName/>
)

export default Page
```

### Rules:
- `metadata` (or `generateMetadata`) MUST always include `title` and `alternates.canonical`.
- Public pages MUST include `description`, `openGraph`, and `twitter` — Lighthouse SEO requires them.
- Dynamic routes use `generateMetadata`. Return `robots: { index: false, follow: false }` when the resource is not found.
- Listings that accept filter/pagination params return `robots: { index: false, follow: true }` when those params are present.
- Protected/auth pages can skip `openGraph`/`twitter` (they are disallowed by `robots.ts`).
- Protected pages: `async`, await `searchParams`. Auth and public pages: synchronous unless they take params.
- Always named `Page`, always default export.
- **Optional but recommended for bounded sets**: when the dynamic route's set of params is finite (e.g. a product catalog under ~10k items), also export `generateStaticParams` — Next.js will pre-render the routes at build time, drastically improving LCP/TTFB.

---

## Step 6 — Conventions checklist + summary

Before closing, verify:
- [ ] Screen at the correct location per page type (`src/screens/{Name}/` for protected/public, `src/screens/auth/{Name}/` for auth)
- [ ] Screen owns `<main id='main'>` and is the ONLY `<main>` on the rendered page
- [ ] `'use client'` is on the Screen component, NOT on the `page.tsx` wrapper
- [ ] `page.tsx` is a thin wrapper — metadata only, no logic, no UI
- [ ] Public pages export full metadata: `title`, `description`, `alternates.canonical`, `openGraph`, `twitter` (Lighthouse SEO requires all of these)
- [ ] Dynamic routes use `generateMetadata` with not-found handling (`robots: { index: false, follow: false }` when the resource is missing)
- [ ] Listings with filter/pagination params return `robots: { index: false, follow: true }` when those params are present
- [ ] Protected/auth pages have at least `title` + `alternates.canonical` (they can skip `openGraph`/`twitter` since `robots.ts` disallows them)
- [ ] `proxy.ts` updated only if needed (auth route not covered by an existing `includes()` check, OR new public route)
- [ ] Heading hierarchy starts at `<h1>` (visually-hidden `sr-only` if no visible h1)
- [ ] Every top-level `<section>` is anchored with `container-custom` and has explicit vertical padding (`py-*`/`pt-*`/`pb-*`)
- [ ] A11y rules from Step 3 satisfied (`autoComplete` on inputs, `aria-label` on icon-only buttons, `rel='noopener noreferrer'` on external links)

Then post a short summary:
1. Files created (markdown links)
2. Files modified (`proxy.ts` if updated, with what was added)
3. A reminder of what to implement next inside the screen

---

## Step 7 — Validate

Run these commands and fix any errors before finishing:

```bash
pnpm run lint-check --fix
pnpm run type-check
```
