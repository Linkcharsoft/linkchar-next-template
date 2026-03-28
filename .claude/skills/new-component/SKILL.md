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
- `'use client'` → if the component type is `client`
- Import `./ComponentName.sass`
- No `process.env` — env vars from `@/constants/env`
- Props interface → inline, not exported unless another file will import it
- BEM root class → `.ComponentName` (matches the component name exactly)
- `classNames()` from `primereact/utils` for conditional classes
- Sass Preprocessor: `.sass` uses indented syntax (no `{}`, no `;`)
- Typography: `text-{weight}-{size}` (e.g. `text-bold-24`).
- Colors: `surface-50` to `surface-900` for grays. Semantic Tailwind defaults for others
- Icons: PrimeIcons `pi pi-xxx` for icons (never inline SVGs if an icon exists)

---

## Step 2 — Create `src/components/ComponentName/ComponentName.sass`

Create an empty `.sass` file. Only add styles if Tailwind truly cannot cover the requirement or if the number of Tailwind classes is excessive.

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

---

## Step 3 — Validate

Run these commands and fix any errors before finishing:

```bash
pnpm run lint-check --fix
pnpm run type-check
```

