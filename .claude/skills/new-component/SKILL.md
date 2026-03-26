---
name: new-component
description: Create a new reusable component — generates the folder, .tsx, and .sass file following project conventions
---

Create a new reusable component. Arguments: **$ARGUMENTS**

Parse the arguments:
- First word = `ComponentName` (must be PascalCase)
- If the word `client` appears → add `'use client'` directive
- Anything after the component name that isn't `client` = ignore

---

## Step 0 — Check for existing components

Before creating anything, check the existing components table in CLAUDE.md and scan `src/components/` with a Glob.

If a similar component already exists, **stop and tell the user** which component they should reuse or extend instead.

---

## Step 1 — Create `src/components/ComponentName/ComponentName.tsx`

Follow this exact template. Adapt only what's in angle brackets:

```tsx
// Include 'use client' ONLY if the `client` argument was passed
'use client'
import './ComponentName.sass'
import { memo } from 'react'

interface Props {
  // Define props here — do NOT export this interface unless needed elsewhere
}

const ComponentName = ({}: Props) => {
  return (
    <div className="ComponentName">

    </div>
  )
}

export default memo(ComponentName)
```

Rules:
- `'use client'` → only if `client` argument was passed
- `memo()` → always wrap the export
- Props interface → inline, not exported unless another file will import it
- BEM root class → `.ComponentName` (matches the component name exactly)
- Single quotes, no semicolons, 2-space indentation
- `import type { X }` for type-only imports
- `classNames()` from `primereact/utils` for conditional classes (never `clsx`)
- `m` from framer-motion + `LazyMotion` if animations needed (never `motion`)
- PrimeIcons `pi pi-xxx` for icons (never inline SVGs if an icon exists)
- Typography: `text-{weight}-{size}` (e.g. `text-bold-24`). Never `text-xl`, `font-bold`
- Colors: `surface-50` to `surface-900` for grays. Semantic Tailwind defaults for others

---

## Step 2 — Create `src/components/ComponentName/ComponentName.sass`

Create an empty `.sass` file. Only add styles if Tailwind truly cannot cover the requirement.

If styles are needed, use `.sass` indented syntax (no curly braces, no semicolons) with BEM:
```sass
.ComponentName
  // styles

  &__Element
    // styles

  &--Modifier
    // styles
```

---

## Step 3 — Show usage

After creating both files, show a short example of how to import and use the component:

```tsx
import ComponentName from '@/components/ComponentName/ComponentName'

<ComponentName />
```

---

## Conventions checklist

Before finishing, verify:
- [ ] Single quotes everywhere, no semicolons, 2-space indentation
- [ ] `import type { X }` for type-only imports
- [ ] `memo()` wraps the default export
- [ ] `'use client'` present only if `client` argument was passed
- [ ] No `motion` (use `m` + `LazyMotion`)
- [ ] `classNames()` from `primereact/utils` for conditional classes
- [ ] Typography uses `text-{weight}-{size}` pattern
- [ ] `.sass` uses indented syntax (no `{}`, no `;`)
