---
name: new-skeleton
description: Create a skeleton loader sibling for an existing component or screen — generates {Name}Skeleton.tsx + .sass that mirrors the target layout using SkeletonBlock
---

Create a skeleton loader for an existing component or screen. Arguments: **$ARGUMENTS**

Parse the arguments:
- First word = `TargetName` (PascalCase, the name of an existing component or screen — do NOT include the `Skeleton` suffix; the skill appends it)

Examples:
- `ProductCard` → creates `src/components/ProductCard/ProductCardSkeleton.tsx` + `.sass`
- `DashboardPage` → creates `src/screens/DashboardPage/DashboardPageSkeleton.tsx` + `.sass`
- `UserProfilePage` → creates `src/screens/UserProfilePage/UserProfilePageSkeleton.tsx` + `.sass`

This skill assumes `src/components/SkeletonBlock/SkeletonBlock.tsx` is the project's skeleton primitive. Every placeholder rectangle goes through it.

---

## Step 0 — Resolve the target and read it

Resolve where the target lives:

1. If `src/components/{TargetName}/{TargetName}.tsx` exists → **component target**, folder = `src/components/{TargetName}/`
2. Else if `src/screens/{TargetName}/{TargetName}.tsx` exists → **screen target**, folder = `src/screens/{TargetName}/`
3. Else → **stop** and ask the user to confirm the name/path
4. If both exist → **stop** and ask which one

Then check if a skeleton already exists at `{targetFolder}/{TargetName}Skeleton.tsx`. If yes → **stop** and tell the user to edit the existing skeleton instead of creating a new one.

Otherwise, **read the target `.tsx` file** (and its `.sass` if present) to understand the layout. You will mirror that layout in the steps below — heights, paddings, border-radius, gaps, grid/flex structure, and any repeated lists.

---

## Step 1 — Create `{targetFolder}/{TargetName}Skeleton.tsx`

Follow this exact template. Replace `{TargetName}` with the target's name (e.g. `ProductCard`, `EquipoDetailPage`):

```tsx
'use client'
import './{TargetName}Skeleton.sass'
import SkeletonBlock from '@/components/SkeletonBlock/SkeletonBlock'

const {TargetName}Skeleton = () => {
  return (
    <div className='{TargetName}Skeleton'>
      {/* mirror the layout of {TargetName}.tsx using SkeletonBlock for each visual leaf */}
    </div>
  )
}

export default {TargetName}Skeleton
```

Rules:
- Always `'use client'` (skeletons are visual-only client components — matches every existing skeleton in this project)
- Import `./{TargetName}Skeleton.sass`
- Import `SkeletonBlock` from `@/components/SkeletonBlock/SkeletonBlock`
- BEM root class → `.{TargetName}Skeleton` (matches the file name exactly)
- Default export, no `memo()` (React Compiler handles memoization)
- No props by default. **Exception**: if the target is rendered as a configurable list (like `ProductCard` rendered N times), accept a `count?: number` prop and wrap with `Array.from({ length: count })`

### How to mirror the target's layout

For every distinct visual element in the target, replace it with a `<SkeletonBlock />` and a sized BEM class:

| Target element | Skeleton replacement |
| -------------- | -------------------- |
| Text line, heading, label | `<SkeletonBlock className='{Name}Skeleton__Line' />` (small rectangle, ~10–14px tall) |
| Image, thumbnail | `<SkeletonBlock className='{Name}Skeleton__Image' />` (matches `aspect-ratio` or fixed `w/h` of the original) |
| Icon | `<SkeletonBlock className='{Name}Skeleton__Icon' />` (square, small) |
| Button | `<SkeletonBlock className='{Name}Skeleton__Btn' />` (matches the button's height + border-radius) |
| Badge, pill, status | `<SkeletonBlock className='{Name}Skeleton__Pill' />` (rounded, small) |
| Toggle, switch | `<SkeletonBlock className='{Name}Skeleton__Toggle' />` |
| Input field | `<SkeletonBlock className='{Name}Skeleton__Input' />` |
| Loop of N items (cards, rows, list) | Replicate the loop: `{Array.from({ length: N }).map((_, i) => <Card key={i} />)}` |
| Container with layout (flex/grid/gap/padding) | Keep the container as a plain `<div>` with the same layout — only swap the **leaves** for `SkeletonBlock` |

For elements on a dark background (dark cards, footers, hero overlays), pass `dark`:
```tsx
<SkeletonBlock dark className='{Name}Skeleton__CtaBtn' />
```

The goal is **visual parity at first glance** — the skeleton should occupy roughly the same space and rhythm as the loaded UI so there is no layout shift when data arrives.

---

## Step 2 — Create `{targetFolder}/{TargetName}Skeleton.sass`

Create the `.sass` file with BEM classes sizing each `SkeletonBlock` to match the equivalent element in the target.

Use `.sass` indented syntax (no curly braces, no semicolons). Plain CSS for layout/sizing; `@apply` only for design tokens.

Template:

```sass
.{TargetName}Skeleton
  // Mirror the target container: display, gap, padding, border, border-radius, background

  &__Line
    height: 12px
    border-radius: 4px

    &--Short
      width: 40%

    &--Long
      width: 80%

  &__Image
    width: 100%
    aspect-ratio: 16 / 9
    border-radius: 6px

  &__Btn
    height: 40px
    border-radius: 6px

  // Add only the classes you actually reference in the .tsx
```

Rules:
- **Sizes** come from observing the target's rendered dimensions (read the target's `.sass` and Tailwind classes for actual heights, paddings, border-radius). Do NOT invent — match what's there.
- **Layout** of the skeleton container should mirror the target's outer container: same `display`, `gap`, `padding`, `flex-direction`, and responsive breakpoints (`@apply lg:flex-row` if the target does that).
- **Border-radius** must match the target (rounded buttons → rounded skeleton button; sharp lines → sharp skeleton).
- **Plain CSS** for: `display`, `flex-direction`, `gap`, `padding`, `margin`, `width`, `height`, `border-radius`, `aspect-ratio`, `position`, `overflow`, `grid-template-columns`.
- **`@apply`** only for design tokens: project colors (`bg-white`, `border-surface-200`, `text-surface-900`), typography (`text-bold-14`), responsive prefixes (`md:flex-row`, `lg:grid-cols-2`), and pseudo-state tokens.
- Do NOT add shimmer or animation styles — `SkeletonBlock` handles its own animation; you only size the rectangle.

---

## Step 3 — Suggest the wiring at the consumer (do NOT auto-modify)

Do NOT modify the target's consumer automatically — the user usually wants to choose the gating condition (`isLoading`, `!data`, suspense boundary, etc.) and the placement of the conditional.

Instead, print a short usage snippet showing how to wire it. Example for a screen:

```tsx
import {TargetName}Skeleton from '@/screens/{TargetName}/{TargetName}Skeleton'
// or '@/components/{TargetName}/{TargetName}Skeleton' for components

const { data, isLoading } = useSWR(...)

if (isLoading) return <{TargetName}Skeleton />
```

If the skeleton accepts `count` (looped variant), include that in the snippet:

```tsx
{isLoading ? <{TargetName}Skeleton count={4} /> : items.map(...)}
```

---

## Step 4 — Show summary

After all files are created, show:
1. Files created (with paths)
2. The one-line usage snippet from Step 3
3. A reminder: **"Open the page in the browser and toggle the loading state (slow network / throttle) to verify visual parity with the loaded UI."**

---

## Step 5 — Validate

Run these commands and fix any errors before finishing:

```bash
pnpm run lint-check --fix
pnpm run type-check
```
