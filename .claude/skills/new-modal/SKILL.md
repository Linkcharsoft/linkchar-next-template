---
name: new-modal
description: Create a new modal type — updates modalStore, creates the component, and registers it in ModalsProvider
---

Create a new modal following the project's modal system. The modal name is: **$ARGUMENTS**

Derive from the name:
- `ModalName` = PascalCase (e.g. `ConfirmDelete`)
- `modalKey` = camelCase + "Modal" suffix (e.g. `confirmDeleteModal`)

---

## Step 0 — Read existing files first and check for existing modals

Before creating anything, read these files to understand the exact current state:
- `src/stores/modalStore.ts`
- `src/providers/ModalsProvider.tsx`
And check the existing modals by scanning `src/components/modals`.

If a similar modal already exists, **stop and tell the user** which modal they should reuse or extend instead.

---

## Step 1 — Update `src/stores/modalStore.ts`

Make three additions to the existing file (do NOT rewrite it, use Edit):

**1a. Add the modal type** — after the existing modal types block, add:
```ts
type ModalName = {
  // Define the props this modal needs
  // Example: title: string, onConfirm: () => void
}
```

**1b. Add to `ModalPayloads`** — add a new entry:
```ts
type ModalPayloads = {
  modalKey: ModalName   // ← add this
}
```

**1c. Add to `initialModals`** — add a new entry with `show: false` and all fields initialized to empty/default values:
```ts
const initialModals: ModalStateMap = {
  modalKey: {           // ← add this
    show: false,
    // all fields initialized
  }
}
```

---

## Step 2 — Create the modal component

Create two files:

**`src/components/modals/ModalName/ModalName.tsx`**

Follow the exact pattern of `src/components/modals/StateModal/StateModal.tsx`:
- `'use client'` directive at top
- Import `./ModalName.sass`
- Use PrimeReact `Dialog` component
- Get state from `useModalStore`: `const { modals: { modalKey }, closeModal } = useModalStore()`
- Set `visible={modalKey.show}`
- Set `onHide={() => closeModal('modalKey')}`
- Use `CustomButton` (not native `<button>`) for actions
- Use `classNames` from `primereact/utils` for conditional classes (never `clsx`)
- Use Tailwind utilities for layout (flex, gap, padding). SASS only if truly needed.
- Typography: `text-{weight}-{size}` (e.g. `text-bold-24`).
- Colors: `surface-50` to `surface-900` for grays. Semantic Tailwind defaults for others
- Icons: PrimeIcons `pi pi-xxx` for icons (never inline SVGs if an icon exists)

**`src/components/modals/ModalName/ModalName.sass`**

Create an empty `.sass` file. Move styles here using BEM + `@apply` whenever:
- Tailwind cannot express the style (custom animations, complex pseudo-elements, PrimeReact overrides)
- An element uses **visual appearance classes**: colors, backgrounds, borders, shadows, `rounded-*`, typography (`text-*`), or interactive states (`hover:`, `focus:`)
- An element accumulates **6 or more classes** of any kind

**Inline exceptions** (these may stay in JSX, skip the `.sass`):
- **Layout-only** combos (`flex items-center gap-4`, `grid grid-cols-2`).
- **One-off mix of 2–3 simple utilities** — even visual ones like `text-bold-18` or `bg-red-600` — when the combination isn't repeated in the modal AND doesn't need responsive/state variants.

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

**Inside `.sass`: prefer plain CSS, `@apply` only for design tokens.**

- ✅ Plain CSS for: `display`, `flex-direction`, `gap`, `padding`, `margin`, `width`, `height`, `border-radius`, `position`, `cursor`, `overflow`, `transition`, `transform`
- ✅ `@apply` for: project colors (`bg-surface-100`, `text-surface-700`), typography tokens (`text-bold-14`, `text-medium-16`), responsive prefixes (`md:flex-row`), pseudo-state tokens (`hover:bg-surface-100`)

```sass
// ✅ Good
.MyModal
  display: flex
  gap: 1rem
  padding: 1.5rem
  border-radius: 8px
  @apply bg-white border border-surface-200 text-bold-14 text-surface-950

// ❌ Avoid
.MyModal
  @apply flex gap-4 p-6 rounded-[8px] bg-white border border-surface-200 text-bold-14 text-surface-950
```

---

## Step 3 — Register in `src/providers/ModalsProvider.tsx`

Add the import and render the component:

```tsx
import ModalName from '@/components/modals/ModalName/ModalName'

const ModalsProvider = () => {
  return (
    <>
      <ModalName/>   {/* ← add this */}
    </>
  )
}
```

---

## Step 4 — Show usage example

After all files are created, show a short usage example in the chat:

```tsx
const { openModal, closeModal } = useModalStore()

// Open
openModal('modalKey', {
  // pass the props defined in the type
})

// Close (usually from inside the modal via onHide or a button)
closeModal('modalKey')
```

---

## Step 5 — Validate

Run these commands and fix any errors before finishing:

```bash
pnpm run lint-check --fix
pnpm run type-check
```

