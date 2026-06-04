---
name: new-modal
description: Create a new modal type — updates modalStore, creates the component, and registers it in ModalsProvider (or mounts it locally on a single screen). Use only for new modal patterns — reuse `StateModal` for state-based dialogs (success/error/warn/info), `LoadingModal` for full-screen loaders, and `setNotification()` for transient toasts.
---

Create a new modal following the project's modal system. The modal name is: **$ARGUMENTS**

Derive from the name:
- `ModalName` = PascalCase (e.g. `ConfirmDelete`)
- `modalKey` = camelCase + "Modal" suffix (e.g. `confirmDeleteModal`)

---

## Pre-flight — Read CONVENTIONS.md (mandatory)

Before generating anything, `Read` [`.claude/CONVENTIONS.md`](../../CONVENTIONS.md). The sections that govern this skill:

- **[Naming Conventions](../../CONVENTIONS.md#naming-conventions)** — PascalCase for component, camelCase for the modal key.
- **[Existing Reusable Components](../../CONVENTIONS.md#existing-reusable-components)** — check whether `StateModal`, `LoadingModal`, or `setNotification()` already cover the use case.
- **[Styling Rules — TAILWIND-FIRST](../../CONVENTIONS.md#styling-rules--tailwind-first)** and **[Inside `.sass` files](../../CONVENTIONS.md#inside-sass-files)** — the `@apply` LAST rule.
- **[PrimeReact Usage](../../CONVENTIONS.md#primereact-usage)** — for `Dialog` + `pt` customization.
- **[Framer Motion](../../CONVENTIONS.md#framer-motion)** — reduced-motion is handled globally; do NOT add per-modal `MotionConfig`.
- **[Accessibility](../../CONVENTIONS.md#accessibility)** — generic A11y. The Dialog-specific A11y rules (focus trap, initial focus, blockScroll, etc.) live in Step 3 below.
- **[Bundle & Performance Architecture](../../CONVENTIONS.md#bundle--performance-architecture)** — global vs local modal mounting decides whether the JS ships on every page.

If you cannot read `CONVENTIONS.md`, STOP and report `STOP-BLOCKING / category: INVALID_INPUT / reason: missing CONVENTIONS.md`.

---

## Step 0 — Recon & dedup

Before creating anything, read these files to understand the exact current state:
- `src/stores/modalStore.ts`
- `src/providers/ModalsProvider.tsx`

And check the existing modals by scanning `src/components/modals/`.

If a similar modal already exists, **stop and tell the user** which one to reuse or extend. In particular:
- State-based dialogs (success / error / warn / info) → reuse `StateModal`.
- Full-screen loading overlays → reuse `LoadingModal`.
- Transient toasts → use `setNotification()` from `useModalStore`, no new modal needed.

---

## Step 1 — Plan: global vs local mount

Decide BEFORE touching any file — this drives Step 4.

- **Global** (default) — register in `src/providers/ModalsProvider.tsx`. Use this only if the modal is genuinely opened from MULTIPLE screens (confirmation dialogs reused across the app, global state/success/error modals).
- **Local** — mount inside the consuming screen. Use this when the modal is opened from a SINGLE screen (image galleries, screen-specific wizards, page-scoped flows). A modal registered globally ships its JavaScript on every page, even those that never open it. Mounting it locally keeps that JS out of the initial bundle of unrelated routes — a real Lighthouse "Reduce unused JavaScript" win on multi-page apps.

The store wiring in Step 2 is the same either way; only Step 4 changes based on this decision.

If you can't tell from the user's prompt, **ask now** which one applies — defaulting wrong forces a refactor later.

---

## Step 2 — Mutate registries: `src/stores/modalStore.ts`

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
  modalKey: ModalName   // ← add this
}
```

**2c. Add to `initialModals`** — add a new entry with `show: false` and all fields initialized to empty/default values:
```ts
const initialModals: ModalStateMap = {
  modalKey: {           // ← add this
    show: false,
    // all fields initialized
  }
}
```

---

## Step 3 — Create the modal files

Create two files: `.tsx` first, then `.sass`.

### `src/components/modals/ModalName/ModalName.tsx`

Follow the exact pattern of `src/components/modals/StateModal/StateModal.tsx`:
- `'use client'` directive at top
- Import `./ModalName.sass`
- Use PrimeReact `Dialog` component
- Get state from `useModalStore` with **atomic selectors** (one per value — never destructure the whole store, see [CONVENTIONS.md > Zustand selectors](../../CONVENTIONS.md#zustand-selectors)):
  ```tsx
  const modalKey = useModalStore((s) => s.modals.modalKey)
  const closeModal = useModalStore((s) => s.closeModal)
  ```
- Set `visible={modalKey.show}`
- Set `onHide={() => closeModal('modalKey')}`
- Use `CustomButton` (not native `<button>`) for actions
- Use `classNames` from `primereact/utils` for conditional classes (never `clsx`)
- Use Tailwind utilities for layout (flex, gap, padding). SASS only if truly needed.
- Typography: `text-{weight}-{size}` (e.g. `text-bold-24`).
- Colors: `surface-50` to `surface-900` for grays. Semantic Tailwind defaults for others
- Icons: PrimeIcons `pi pi-xxx` for icons (never inline SVGs if an icon exists)

#### Dialog-specific A11y rules

Generic A11y rules (icon-only buttons, autoComplete on inputs, tap targets, color contrast, etc.) live in [CONVENTIONS.md > Accessibility](../../CONVENTIONS.md#accessibility). The rules below are specific to PrimeReact's `Dialog` and apply only when you build modals with it.

- **Modal title**: use the `Dialog` `header` prop instead of a manual `<h2>` inside the body — `Dialog` renders the heading semantics for you and pairs it with `aria-labelledby` automatically.
- **`role='dialog'` and `aria-modal='true'`**: `Dialog` sets these on the root container automatically. NEVER override them via `pt.root.role` — removing them turns the modal into a non-modal popover for assistive tech.
- **Focus trap & Escape-to-close**: `Dialog` handles both out of the box. Do NOT override `onHide` to disable closing without an explicit accessibility reason.
- **Focus return on close**: `Dialog` returns focus to the element that opened the modal — preserve this behavior. If you close the modal as a side-effect (e.g. after a successful SWR mutation rather than a user click on Cancel), keep a `useRef` on the trigger and call `.focus()` manually so keyboard users don't get dropped at the page root.
- **Initial focus**: `Dialog`'s default sends focus to the first focusable element inside. For **destructive confirmations**, override the initial focus to land on the SAFE action (Cancel), not the destructive one — `useEffect` on `visible: true` + a `ref.current?.focus()` on the Cancel button. Prevents accidental confirms when a user mashes Enter.
- **Body scroll lock**: keep Dialog's `blockScroll` enabled (default). Without it, users can scroll the page behind the modal, breaking the modal-context illusion and confusing screen reader users.
- **Destructive confirmations**: never rely on the backdrop click as the ONLY dismissal — always provide an explicit "Cancel" `CustomButton` so keyboard users have a discoverable action. The destructive action label should be self-descriptive (`Delete account`, not `Yes`).
- **Icon-only Dialog close customization**: PrimeReact's `Dialog` provides an accessible name for its built-in close button — preserve it if you customize `pt.closeButton`. Any extra icon-only action buttons inside the modal MUST set `aria-label` (covered by the generic rule in CONVENTIONS.md).
- **Modal-level error banners** (NOT per-field): when displaying a "Server unreachable" or similar banner inside the modal body, wrap it in `<div role='alert'>...</div>` so SR users hear it on appearance. Per-field errors via `InputContainer`/`InputError` are already announced.

### `src/components/modals/ModalName/ModalName.sass`

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

Apply the [Inside `.sass` files](../../CONVENTIONS.md#inside-sass-files) rules from CONVENTIONS.md — plain CSS for layout/sizing, `@apply` LAST in each block scope for design tokens.

---

## Step 4 — Wire the modal (based on the plan from Step 1)

### Global plan → register in `src/providers/ModalsProvider.tsx`

Add the import and render the component (Edit, do NOT rewrite the provider):

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

### Local plan → mount inside the consuming screen

Do NOT touch `ModalsProvider`. Instead, print the snippet so the user pastes it into the consuming screen themselves (the user owns where the modal sits in their JSX tree):

```tsx
import ModalName from '@/components/modals/ModalName/ModalName'

const ScreenName = () => (
  <>
    <div className='ScreenName'>
      {/* ...screen content... */}
    </div>
    <ModalName/>   {/* ← lives next to the screen, not in the global provider */}
  </>
)
```

---

## Step 5 — Conventions checklist + summary

Before closing, verify:
- [ ] `modalStore.ts` updated in three places: the new type, `ModalPayloads`, and `initialModals`
- [ ] Component at `src/components/modals/{Name}/{Name}.tsx` + `{Name}.sass`
- [ ] `.tsx` uses PrimeReact `Dialog`, `CustomButton`, and `classNames` from `primereact/utils` (never native `<button>`, never `clsx`)
- [ ] Modal subscribed via `useModalStore` with **atomic selectors** (`(s) => s.modals.{modalKey}`, `(s) => s.closeModal`) — never whole-store destructuring
- [ ] Wired according to Step 1 plan: registered in `ModalsProvider` (global) OR snippet shown to the user (local)
- [ ] A11y rules from Step 3 satisfied (aria-label on icon-only buttons, `header` prop for the title, Cancel button for destructive confirmations)

Then post:
1. Files created/modified (markdown links)
2. Usage example:

```tsx
const openModal = useModalStore((s) => s.openModal)
const closeModal = useModalStore((s) => s.closeModal)

// Open
openModal('modalKey', {
  // pass the props defined in the type
})

// Close (usually from inside the modal via onHide or a button)
closeModal('modalKey')
```

---

## Step 6 — Validate

Run these commands and fix any errors before finishing:

```bash
pnpm run lint-check --fix
pnpm run type-check
```
