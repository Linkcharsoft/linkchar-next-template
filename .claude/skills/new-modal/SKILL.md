---
name: new-modal
description: Create a new modal type — updates modalStore, creates the component, and registers it in ModalsProvider
---

Create a new modal following the project's modal system. The modal name is: **$ARGUMENTS**

Derive from the name:
- `ModalName` = PascalCase (e.g. `ConfirmDelete`)
- `modalKey` = camelCase + "Modal" suffix (e.g. `confirmDeleteModal`)

---

## Step 1 — Read existing files first

Before writing anything, read these files to understand the exact current state:
- `src/stores/modalStore.ts`
- `src/providers/ModalsProvider.tsx`

---

## Step 2 — Update `src/stores/modalStore.ts`

Make three additions to the existing file (do NOT rewrite it, use Edit):

**2a. Add the modal type** — after the existing modal types block, add:
```ts
type ModalName = {
  // Define the props this modal needs
  // Example: title: string, onConfirm: () => void
}
```

**2b. Add to `ModalPayloads`** — add a new entry:
```ts
type ModalPayloads = {
  loadingModal: LoadingModal
  stateModal: StateModal
  modalKey: ModalName   // ← add this
}
```

**2c. Add to `initialModals`** — add a new entry with `show: false` and all fields initialized to empty/default values:
```ts
const initialModals: ModalStateMap = {
  loadingModal: { ... },
  stateModal: { ... },
  modalKey: {           // ← add this
    show: false,
    // all fields initialized
  }
}
```

---

## Step 3 — Create the modal component

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
- Typography: `text-bold-24`, `text-medium-16`, etc. (never `text-xl`, `font-bold`)
- Icons: PrimeIcons `pi pi-xxx` (never inline SVGs)
- Do NOT use `memo()` — modal components are registered once, not reused as props

**`src/components/modals/ModalName/ModalName.sass`**

Create an empty file (or add styles only if Tailwind cannot cover the requirement).

---

## Step 4 — Register in `src/providers/ModalsProvider.tsx`

Add the import and render the component:

```tsx
import ModalName from '@/components/modals/ModalName/ModalName'

const ModalsProvider = () => {
  return (
    <>
      <ToastNotifications/>
      <StateModal/>
      <ModalName/>   {/* ← add this */}
    </>
  )
}
```

---

## Step 5 — Show usage example

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

## Conventions checklist

Before finishing, verify:
- [ ] Single quotes everywhere, no semicolons, 2-space indentation
- [ ] `import type { X }` for type-only imports
- [ ] No `process.env` — env vars from `@/constants/env`
- [ ] No `motion` from framer-motion (use `m` + `LazyMotion` if animations needed)
- [ ] `classNames()` from `primereact/utils` for conditional classes
- [ ] Typography uses `text-{weight}-{size}` pattern
