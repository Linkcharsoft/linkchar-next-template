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

## Step 0 — Recon & dedup

Before creating anything, scan `src/components/` and cross-reference with the "Existing Reusable Components" table in `CLAUDE.md`.

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

### Rules:
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

These rules must hold for the component to pass the project's Lighthouse audits.

<!-- canonical-source: CLAUDE.md > Performance & Lighthouse Rules > Accessibility. The bullets below are a component-focused subset mirrored from there so this skill works without re-reading CLAUDE.md. If you edit a bullet here AND the same rule appears in CLAUDE.md, update both — drift between them produces inconsistent agent behavior. Skills with the same A11y mirror: new-screen, new-modal, new-table. -->


- **Icon-only interactive elements** (a button or link whose visible content is just an icon) MUST set `aria-label`. Lighthouse "Buttons do not have an accessible name" fails otherwise.
- **External links** (`target='_blank'`) MUST include `rel='noopener noreferrer'`.
- **Form inputs** must set `autoComplete` (JSX prop) to the correct token (`email`, `current-password`, `new-password`, `name`, `tel`, `postal-code`, `one-time-code`, etc.).
- **Headings inside the component**: use `<h2>`/`<h3>` only if this component represents a real section of the document outline. For card/item titles inside a list, use `<p>` — let the page own the heading hierarchy.
- **Images** rendered by the component: `next/image` with `alt` (meaningful) and either explicit `width`/`height` or `fill` + `sizes`. Above-the-fold LCP images need `priority` AND `fetchPriority='high'`.
- **Tap targets**: any interactive element you render must be at least `44×44px` on mobile (`min-h-[44px] min-w-[44px]` on icon-only buttons). `CustomButton` size variants already meet this for regular buttons.
- **Focus visibility**: every interactive element must show a visible `:focus-visible` outline. NEVER set `outline: none` without providing a replacement — use Tailwind's `focus-visible:ring-2 focus-visible:ring-offset-2` or a SASS `&:focus-visible` block. Keyboard users navigate by sight of focus; removing the ring fails WCAG 2.4.7.
- **Keyboard interaction**: any element that triggers an action MUST be `<button>`, `<a>`, or `CustomButton` — these get keyboard handling for free. If you must use a `<div>` (rare), add `role='button'`, `tabIndex={0}`, AND `onKeyDown` handlers for Enter and Space. Otherwise the action is mouse-only and fails WCAG 2.1.1.
- **Reduced motion** is handled globally — no per-component guard needed. `general.sass` ships a `@media (prefers-reduced-motion: reduce)` reset that neutralizes every CSS animation/transition (including PrimeReact and `SkeletonBlock` shimmer), and `MotionConfig reducedMotion='user'` in `ProvidersContainer` disables every framer-motion `m.*` animation automatically. Only override locally if an animation is GENUINELY essential (e.g. a progress indicator that conveys state) AND must keep playing for users who opted out — wrap that specific subtree with a nested `<MotionConfig reducedMotion='never'>` or use `!important` on the CSS duration.
- **Color contrast**: WCAG AA — 4.5:1 for normal text, 3:1 for large text (18pt+ / 14pt bold+) and UI controls. The project tokens are chosen so `text-surface-900` on `bg-surface-50/100/200` and `text-surface-50` on `bg-surface-800/900` pass; verify any custom pairing with axe-core or Lighthouse before shipping.
- **Decorative icons** inside text or interactive content use `aria-hidden='true'`. Without it, screen readers announce `.pi pi-X` glyphs as garbage characters next to the label.
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
<!-- mirror: CLAUDE.md @apply LAST — keep the bullet below in sync with the canonical wording in CLAUDE.md > Styling Rules > "Inside `.sass` files". -->
- ⚠️ **`@apply` MUST be the LAST declaration in each block scope** — root, `&__Element`, `&--Modifier`, pseudo-state. Plain CSS first, THEN a single `@apply` at the end. Putting `@apply` between plain CSS declarations breaks the SASS indented parser. Nested child blocks (`&__X`, `&--X`) are allowed after `@apply` since they're a deeper scope.

```sass
// ✅ Good — plain CSS first, @apply LAST in each scope
.MyComponent
  display: flex
  gap: 1rem
  padding: 1.5rem
  border-radius: 8px
  @apply bg-white border border-surface-200 text-bold-14 text-surface-900

  &__Title
    margin-bottom: 8px
    @apply text-bold-18

  &--Active
    transform: scale(1.02)
    @apply bg-surface-100

// ❌ Avoid — @apply between plain CSS declarations (SASS parser breaks)
.MyComponent
  display: flex
  @apply bg-white
  border-radius: 8px

// ❌ Avoid — @apply for everything
.MyComponent
  @apply flex gap-4 p-6 rounded-[8px] bg-white border border-surface-200 text-bold-14 text-surface-900
```

---

## Step 3 — Conventions checklist + summary

Before closing, verify:
- [ ] Folder at `src/components/{Name}/` with `{Name}.tsx` + `{Name}.sass`
- [ ] `.tsx` ends with `export default {Name}` — no `memo()` wrapping (React Compiler is enabled)
- [ ] `.tsx` imports `./{Name}.sass`
- [ ] BEM root class on the JSX root matches the component name exactly (`.{Name}`)
- [ ] `'use client'` is present ONLY if the component uses hooks / event handlers / browser APIs
- [ ] No `process.env` references — env vars come from `@/constants/env`
- [ ] Icons via PrimeIcons (`pi pi-xxx`) or existing entries in `src/assets/icons/` — no new icon library installed
- [ ] If the component is interactive: a11y rules from Step 1 satisfied (aria-label on icon-only buttons, `rel='noopener noreferrer'` on external links, `autoComplete` on inputs, 44×44 tap targets)

Then post a short summary:
1. Files created (markdown links)
2. One-line import snippet (e.g. `import {Name} from '@/components/{Name}/{Name}'`)
3. What the user should fill in next (props, JSX, styles)

---

## Step 4 — Validate

Run these commands and fix any errors before finishing:

```bash
pnpm run lint-check --fix
pnpm run type-check
```

