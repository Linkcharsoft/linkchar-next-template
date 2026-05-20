---
name: new-component
description: Create a new reusable component — generates the folder, .tsx, and .sass file following project conventions
---

Create a new reusable component. Arguments: **$ARGUMENTS**

Parse the arguments:
- First word = `ComponentName` (must be PascalCase)
- Second word = Next.js component type: `client` | `server` (default: `server`)

Examples:
- `Button client`
- `Tag server`

---

## Step 0 — Check for existing components

Before creating anything, check the existing components by scanning `src/components/`.

If a similar component already exists, **stop and tell the user** which component they should reuse or extend instead.

---

## Step 1 — Create `src/components/ComponentName/ComponentName.tsx`

Follow this exact template. Adapt only what's in angle brackets:

```tsx
// Include 'use client' ONLY if the component type is `client`
'use client'
import './ComponentName.sass'

interface Props {
  // Define props here — do NOT export this interface unless needed elsewhere
}

const ComponentName = ({}: Props) => {
  return (
    <div className="ComponentName">

    </div>
  )
}

export default ComponentName
```

Rules:
- `'use client'` → only when the component genuinely uses hooks, event handlers, or browser APIs. Default to a Server Component and push `'use client'` to the deepest leaf that needs it — keeping the boundary low preserves SSR and reduces JS shipped to the client.
- Import `./ComponentName.sass`
- No `process.env` — env vars from `@/constants/env`
- Props interface → inline, not exported unless another file will import it
- BEM root class → `.ComponentName` (matches the component name exactly)
- `classNames()` from `primereact/utils` for conditional classes
- Sass Preprocessor: `.sass` uses indented syntax (no `{}`, no `;`)
- Typography: `text-{weight}-{size}` (e.g. `text-bold-24`).
- Colors: `surface-50` to `surface-900` for grays. Semantic Tailwind defaults for others
- Icons: PrimeIcons `pi pi-xxx` for icons (never inline SVGs if an icon exists)

### Accessibility & Lighthouse rules (mandatory)

These rules must hold for the component to pass the project's Lighthouse audits. See "Performance & Lighthouse Rules" in `CLAUDE.md` for the full set.

- **Icon-only interactive elements** (a button or link whose visible content is just an icon) MUST set `aria-label`. Lighthouse "Buttons do not have an accessible name" fails otherwise.
- **External links** (`target='_blank'`) MUST include `rel='noopener noreferrer'`.
- **Form inputs** must set `autocomplete` to the correct token (`email`, `current-password`, `new-password`, `name`, `tel`, `postal-code`, `one-time-code`, etc.).
- **Headings inside the component**: use `<h2>`/`<h3>` only if this component represents a real section of the document outline. For card/item titles inside a list, use `<p>` — let the page own the heading hierarchy.
- **Images** rendered by the component: `next/image` with `alt` (meaningful) and either explicit `width`/`height` or `fill` + `sizes`. Above-the-fold LCP images need `priority` AND `fetchPriority='high'`.
- **Tap targets**: any interactive element you render must be at least `44×44px` on mobile (`min-h-[44px] min-w-[44px]` on icon-only buttons). `CustomButton` size variants already meet this for regular buttons.
- **Heavy client-only deps** (rich text editors, charts, code editors, maps) → import with `dynamic(() => import('...'), { ssr: false })` from `next/dynamic` instead of a top-level import. Reduces bundle on every page that uses the component's parent.

---

## Step 2 — Create `src/components/ComponentName/ComponentName.sass`

Create an empty `.sass` file. Move styles here using BEM + `@apply` whenever:
- Tailwind cannot express the style (custom animations, complex pseudo-elements, PrimeReact overrides)
- An element uses **visual appearance classes**: colors, backgrounds, borders, shadows, `rounded-*`, typography (`text-*`), or interactive states (`hover:`, `focus:`)
- An element accumulates **6 or more classes** of any kind

**Inline exceptions** (these may stay in JSX, skip the `.sass`):
- **Layout-only** combos (`flex items-center gap-4`, `grid grid-cols-2`).
- **One-off mix of 2–3 simple utilities** — even visual ones like `text-bold-18` or `bg-red-600` — when the combination isn't repeated in the component AND doesn't need responsive/state variants.

If styles are needed, use `.sass` indented syntax (no curly braces, no semicolons) with BEM:
```sass
.ComponentName
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

```sass
// ✅ Good
.MyComponent
  display: flex
  gap: 1rem
  padding: 1.5rem
  border-radius: 8px
  @apply bg-white border border-surface-200 text-bold-14 text-surface-900

// ❌ Avoid
.MyComponent
  @apply flex gap-4 p-6 rounded-[8px] bg-white border border-surface-200 text-bold-14 text-surface-900
```

---

## Step 3 — Validate

Run these commands and fix any errors before finishing:

```bash
pnpm run lint-check --fix
pnpm run type-check
```

