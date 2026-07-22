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

## Step 0 — Read CONVENTIONS.md (mandatory)

Before generating anything, `Read` [`.claude/CONVENTIONS.md`](../../CONVENTIONS.md). The sections that govern this skill:

- **[Naming Conventions](../../CONVENTIONS.md#naming-conventions)** — Screens use PascalCase + `Page` suffix.
- **[Component Patterns](../../CONVENTIONS.md#component-patterns)** — `'use client'`, default exports, no `memo()`.
- **[Styling Rules — TAILWIND-FIRST](../../CONVENTIONS.md#styling-rules--tailwind-first)** and **[Inside `.sass` files](../../CONVENTIONS.md#inside-sass-files)** — when to use Tailwind vs SASS, plain CSS vs `@apply`, the `@apply` LAST rule.
- **[Typography System](../../CONVENTIONS.md#typography-system)**, **[Color System](../../CONVENTIONS.md#color-system)**, **[Breakpoints](../../CONVENTIONS.md#breakpoints)** — the tokens to use.
- **[Global Container](../../CONVENTIONS.md#global-container)** — `container-custom` is MANDATORY on every top-level `<section>`.
- **[Accessibility](../../CONVENTIONS.md#accessibility)** — every interactive element MUST meet these rules. The screen owns `<main id='main'>`.
- **[Image Performance](../../CONVENTIONS.md#image-performance)** — when the screen renders `<Image>`.
- **[SEO & Metadata](../../CONVENTIONS.md#seo--metadata)** — for the metadata exports in `page.tsx`.
- **[Bundle & Performance Architecture](../../CONVENTIONS.md#bundle--performance-architecture)** — `'use client'` placement, modal scope, `dynamic` imports.

If you cannot read `CONVENTIONS.md`, STOP and report `STOP-BLOCKING / category: INVALID_INPUT / reason: missing CONVENTIONS.md`.

---

## Step 1 — Recon & dedup

Before creating anything:
- Read `src/proxy.ts` to understand the current `AUTH_PATHS` and `PUBLIC_PATHS` sets. You will need this to decide if `proxy.ts` needs to be updated in Step 3.
- Scan `src/app/` and `src/screens/` to detect collisions with the target route or screen name.

If a matching page already exists, **stop and tell the user** which page they should reuse or extend instead. In particular: if the requested screen is a list/table with pagination, filters, or search — STOP and redirect the user to `/new-table`, which scaffolds the full stack (types + API + screen + filters + paginator).

---

## Step 2 — Plan: file locations by page type

The page type determines where files go and whether `src/proxy.ts` needs updating:

### `protected` (default)

- Screen: `src/screens/ScreenName/ScreenName.tsx` + `src/screens/ScreenName/ScreenName.sass`
- Page: `src/app/{route}/page.tsx`
- proxy.ts: **no changes needed** — all unmatched paths are protected by default.

### `auth`

- Screen: `src/screens/auth/ScreenName/ScreenName.tsx` + `src/screens/auth/ScreenName/ScreenName.sass`
- Page: `src/app/(auth-layout)/{route}/page.tsx`
- proxy.ts: **add to `AUTH_PATHS`** only if the route is NOT already covered by an existing `pathname.includes(path)` check. For example, `/signup/confirm` is already covered by `/signup`. Check before adding.

### `public`

- Screen: `src/screens/ScreenName/ScreenName.tsx` + `src/screens/ScreenName/ScreenName.sass`
- Page: `src/app/{route}/page.tsx` (root level, no layout group)
- proxy.ts: **add the route to `PUBLIC_PATHS`** — public pages require an explicit entry or they will redirect unauthenticated users to login.

---

## Step 3 — Mutate registries: `src/proxy.ts` (if needed)

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

## Step 4 — Create the Screen component

### Protected screen (`src/screens/ScreenName/ScreenName.tsx`)

**Default — no `searchParams`** (settings, profile, account, dashboard summaries — most protected screens have no URL state):

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

**Only add `searchParams` if the screen actually reads URL state** (filters, pagination, search, tabs). When you do:
1. Use the `searchParams` Prop shape below in the screen.
2. Switch the `page.tsx` wrapper to `async` so it awaits `searchParams` before passing them (see Step 6 — public dynamic listing variant).
3. **Stop and reconsider**: if the screen is a paginated list with pagination + filters + search + sorting, use `/new-table` instead.

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

Same as protected — default to no `searchParams`, add only if the screen reads URL state:

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

### Skill-specific rules (in addition to CONVENTIONS.md)

- Always `'use client'` (screens use hooks).
- **The screen owns `<main id='main'>` root** — the skip-to-content link in the root layout points to `#main`. Layouts MUST NOT render `<main>` themselves; if you find a layout that does, fix the layout, not the screen.
- Protected/public use `.ScreenName` BEM root class; auth uses `.AuthLayout`.
- No `export const metadata` on the screen — metadata belongs in `page.tsx` only.

---

## Step 5 — Create the `.sass` file

Create an empty `src/screens/ScreenName/ScreenName.sass` (protected and public) or `src/screens/auth/ScreenName/ScreenName.sass` (auth).

Apply the [Styling Rules from CONVENTIONS.md](../../CONVENTIONS.md#inside-sass-files) — plain CSS for layout/spacing, `@apply` LAST in each block scope for design tokens. Reference skeleton:

```sass
.ScreenName
  // styles

  &__Element
    // styles

  &--Modifier
    // styles
```

Auth screens generally inherit their styles from `src/layouts/AuthLayout/` — the colocated `.sass` can stay empty.

---

## Step 6 — Create the `page.tsx` wrapper

The page is a **thin wrapper only** — no logic, no UI. It owns the page-level metadata and the parameters returned by Next.js (segmentName, searchParams, etc.).

Pick the variant by page type. See [CONVENTIONS.md > SEO & Metadata](../../CONVENTIONS.md#seo--metadata) for the full metadata rules.

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

Use `generateMetadata` to fetch the resource and derive metadata from it. If the resource is not found, return `robots: { index: false, follow: false }`.

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

**Default — sync wrapper, no `searchParams`** (matches the default Protected screen template):

```tsx
import ScreenName from '@/screens/ScreenName/ScreenName'
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

**If the screen reads URL state**, switch to the async wrapper that awaits `searchParams` before passing them down (same shape as the public dynamic listing variant above).

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

### Skill-specific page-wrapper rules

- `metadata` (or `generateMetadata`) MUST always include `title` and `alternates.canonical`.
- Public pages MUST include `description`, `openGraph`, and `twitter` (see [CONVENTIONS.md > SEO & Metadata](../../CONVENTIONS.md#seo--metadata)).
- Dynamic routes use `generateMetadata` with not-found handling.
- Listings with filter/pagination params return `robots: { index: false, follow: true }` when those params are present.
- Protected/auth pages can skip `openGraph`/`twitter` (they are disallowed by `robots.ts`).
- **`async` only when the page reads URL state**: any page (protected, public, or auth) that takes `searchParams` or `params` MUST be `async` and await them before passing them down. Any page that does NOT read URL state stays synchronous (`const Page = () => <ScreenName/>`).
- Always named `Page`, always default export.
- **Optional but recommended for bounded sets**: when the dynamic route's set of params is finite (e.g. a product catalog under ~10k items), also export `generateStaticParams` — Next.js will pre-render the routes at build time, drastically improving LCP/TTFB.

---

## Step 7 — Conventions checklist + summary

Before closing, verify:
- [ ] Screen at the correct location per page type (`src/screens/{Name}/` for protected/public, `src/screens/auth/{Name}/` for auth)
- [ ] Screen owns `<main id='main'>` and is the ONLY `<main>` on the rendered page
- [ ] `'use client'` is on the Screen component, NOT on the `page.tsx` wrapper
- [ ] `page.tsx` is a thin wrapper — metadata only, no logic, no UI
- [ ] Public pages export full metadata (`title`, `description`, `alternates.canonical`, `openGraph`, `twitter`)
- [ ] Dynamic routes use `generateMetadata` with not-found handling
- [ ] Listings with filter/pagination params return `robots: { index: false, follow: true }` when those params are present
- [ ] Protected/auth pages have at least `title` + `alternates.canonical`
- [ ] `proxy.ts` updated only if needed
- [ ] Heading hierarchy starts at `<h1>` (visually-hidden `sr-only` if no visible h1)
- [ ] Every top-level `<section>` is anchored with `container-custom` and has explicit vertical padding (`py-*`/`pt-*`/`pb-*`)
- [ ] A11y rules from [CONVENTIONS.md > Accessibility](../../CONVENTIONS.md#accessibility) satisfied (`autoComplete` on inputs, `aria-label` on icon-only buttons, `rel='noopener noreferrer'` on external links)

Then post a short summary:
1. Files created (markdown links).
2. Files modified (`proxy.ts` if updated, with what was added).
3. A reminder of what to implement next inside the screen.

---

## Step 8 — Validate

Run these commands and fix any errors before finishing:

```bash
pnpm run lint-check --fix
pnpm run type-check
```
