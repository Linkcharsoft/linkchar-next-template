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

## Step 0 — Read CONVENTIONS.md (mandatory)

Before generating anything, `Read` [`.claude/CONVENTIONS.md`](../../CONVENTIONS.md). The sections that govern this skill:

- **[Naming Conventions](../../CONVENTIONS.md#naming-conventions)** — file and export naming.
- **[Component Patterns](../../CONVENTIONS.md#component-patterns)** — `'use client'`, default exports, no `memo()`, path aliases.
- **[Existing Reusable Components](../../CONVENTIONS.md#existing-reusable-components)** — check this table BEFORE creating anything new.
- **[Styling Rules — TAILWIND-FIRST](../../CONVENTIONS.md#styling-rules--tailwind-first)** and **[Inside `.sass` files](../../CONVENTIONS.md#inside-sass-files)** — when to use Tailwind vs SASS, plain CSS vs `@apply`, and the `@apply` LAST rule.
- **[Typography System](../../CONVENTIONS.md#typography-system)**, **[Color System](../../CONVENTIONS.md#color-system)** — the tokens to use.
- **[PrimeReact Usage](../../CONVENTIONS.md#primereact-usage)**, **[Framer Motion](../../CONVENTIONS.md#framer-motion)** — for inputs, icons, and animations.
- **[Accessibility](../../CONVENTIONS.md#accessibility)** — every interactive element this component renders MUST meet these rules.
- **[Image Performance](../../CONVENTIONS.md#image-performance)** — if the component renders `<Image>`, the `sizes` / `priority` / `fetchPriority` rules apply.
- **[Bundle & Performance Architecture](../../CONVENTIONS.md#bundle--performance-architecture)** — `'use client'` placement, dynamic imports for heavy deps, modal scope.

If you cannot read `CONVENTIONS.md`, STOP and report `STOP-BLOCKING / category: INVALID_INPUT / reason: missing CONVENTIONS.md`.

---

## Step 1 — Recon & dedup

Scan `src/components/` and cross-reference with the [Existing Reusable Components](../../CONVENTIONS.md#existing-reusable-components) table in CONVENTIONS.md.

If a similar component already exists, **stop and tell the user** which component they should reuse or extend instead.

---

## Step 2 — Create `src/components/ComponentName/ComponentName.tsx`

Follow this exact template:

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

### Skill-specific rules (in addition to CONVENTIONS.md)

- **`'use client'`** is added ONLY when the user passed `client` as the second arg AND the component genuinely uses hooks/event handlers/browser APIs. Default to a Server Component.
- **BEM root class** matches the component name exactly: `.ComponentName`.
- **Props interface** is inline, NOT exported unless another file imports it.

---

## Step 3 — Create `src/components/ComponentName/ComponentName.sass`

Create an empty `.sass` file. Use BEM + the [Styling Rules from CONVENTIONS.md](../../CONVENTIONS.md#inside-sass-files) — plain CSS for layout/sizing, `@apply` LAST in each block scope for design tokens.

Reference skeleton:

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

---

## Step 4 — Conventions checklist + summary

Before closing, verify:
- [ ] Folder at `src/components/{Name}/` with `{Name}.tsx` + `{Name}.sass`
- [ ] `.tsx` ends with `export default {Name}` — no `memo()` wrapping
- [ ] `.tsx` imports `./{Name}.sass`
- [ ] BEM root class on the JSX root matches the component name exactly (`.{Name}`)
- [ ] `'use client'` is present ONLY if the component uses hooks / event handlers / browser APIs
- [ ] No `process.env` references — env vars come from `@/constants/env`
- [ ] Icons via PrimeIcons (`pi pi-xxx`) or existing entries in `src/assets/icons/` — no new icon library installed
- [ ] If the component is interactive: A11y rules from [CONVENTIONS.md > Accessibility](../../CONVENTIONS.md#accessibility) satisfied (aria-label on icon-only buttons, `rel='noopener noreferrer'` on external links, `autoComplete` on inputs, 44×44 tap targets, focus visibility)

Then post a short summary:
1. Files created (markdown links).
2. One-line import snippet (e.g. `import {Name} from '@/components/{Name}/{Name}'`).
3. What the user should fill in next (props, JSX, styles).

---

## Step 5 — Validate

Run these commands and fix any errors before finishing:

```bash
pnpm run lint-check --fix
pnpm run type-check
```
