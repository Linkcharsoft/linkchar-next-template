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

## Step 0 — Read proxy.ts first and check for existing pages

Before creating anything, read `src/proxy.ts` to understand the current `AUTH_PATHS` and `PUBLIC_PATHS` sets. You will need this to decide if proxy.ts needs to be updated.

If a matching page already exists, **stop and tell the user** which page they should reuse or extend instead.

---

## Step 1 — Determine file locations

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

## Step 2 — Update `src/proxy.ts` if needed

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
    <main className="ScreenName">

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
    <main className="ScreenName">

    </main>
  )
}

export default ScreenName
```

### Auth screen (`src/screens/auth/ScreenName.tsx`)

Flat file inside `src/screens/auth/` — no subfolder, no `.sass` import:

```tsx
'use client'

const ScreenName = () => {
  return (
    <main className="AuthLayout">

    </main>
  )
}

export default ScreenName
```

Rules for all screen types:
- Always `'use client'` (screens use hooks)
- Root element is `<main>`
- Protected/public use `.ScreenName` BEM root class; auth uses `.AuthLayout`
- No `export const metadata` — metadata belongs in `page.tsx` only

---

## Step 4 — Create the `.sass` file

Create an empty `src/screens/ScreenName/ScreenName.sass` (protected and public) or `src/screens/auth/ScreenName/ScreenName.sass` (auth).

Only add styles if Tailwind truly cannot cover the requirement or if the number of Tailwind classes is excessive.

If styles are needed, use `.sass` indented syntax (no curly braces, no semicolons) with BEM:
```sass
.ModalName
  // styles

  &__Element
    // styles

  &--Modifier
    // styles

  &__Element--Modifier
    // styles
```

Note that auth screens generally share their styles through the `src/layouts/AuthLayout`

---

## Step 5 — Create the `page.tsx` wrapper

The page is a **thin wrapper only** — no logic, no UI.
It only serves to manage the metadata and the parameters returned by Next.js (segmentName, searchParams, etc.)

### Protected page (`src/app/{route}/page.tsx`)

```tsx
import ScreenName from '@/screens/ScreenName/ScreenName'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Page Title',
  alternates: {
    canonical: '/route'
  }
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

### Public page (`src/app/{route}/page.tsx`)

```tsx
import ScreenName from '@/screens/ScreenName/ScreenName'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Page Title',
  alternates: {
    canonical: '/route'
  }
}

const Page = () => (
  <ScreenName/>
)

export default Page
```

### Auth page (`src/app/(auth-layout)/{route}/page.tsx`)

```tsx
import ScreenName from '@/screens/auth/ScreenName/ScreenName'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Page Title',
  alternates: {
    canonical: '/route'
  }
}

const Page = () => (
  <ScreenName/>
)

export default Page
```

Rules:
- `metadata` must always include `title` and `alternates.canonical`
- Protected pages: `async`, awaits `searchParams`
- Auth and public pages: synchronous
- Always named `Page`, always default export

---

## Step 6 — Show summary

After all files are created/updated, show:
1. Files created (with paths)
2. Files modified (proxy.ts if updated, with what was added)
3. A reminder of what to implement next inside the screen

---

## Step 7 — Validate

Run these commands and fix any errors before finishing:

```bash
pnpm run lint-check --fix
pnpm run type-check
```
