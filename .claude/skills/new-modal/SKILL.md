---
name: new-modal
description: Create a new modal type — updates modalStore, creates the component, and registers it in ModalsProvider (or mounts it locally on a single screen). Use only for new modal patterns — reuse `StateModal` for state-based dialogs (success/error/warn/info), `LoadingModal` for full-screen loaders, and `setNotification()` for transient toasts.
---

Create a new modal following the project's modal system. The modal name is: **$ARGUMENTS**

Derive from the name:
- `ModalName` = PascalCase (e.g. `ConfirmDelete`)
- `modalKey` = camelCase + "Modal" suffix (e.g. `confirmDeleteModal`)

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
- Get state from `useModalStore`: `const { modals: { modalKey }, closeModal } = useModalStore()`
- Set `visible={modalKey.show}`
- Set `onHide={() => closeModal('modalKey')}`
- Use `CustomButton` (not native `<button>`) for actions
- Use `classNames` from `primereact/utils` for conditional classes (never `clsx`)
- Use Tailwind utilities for layout (flex, gap, padding). SASS only if truly needed.
- Typography: `text-{weight}-{size}` (e.g. `text-bold-24`).
- Colors: `surface-50` to `surface-900` for grays. Semantic Tailwind defaults for others
- Icons: PrimeIcons `pi pi-xxx` for icons (never inline SVGs if an icon exists)

#### Accessibility & Lighthouse rules (mandatory)

These rules must hold for the modal to pass the project's a11y audits.

<!-- canonical-source: CLAUDE.md > Performance & Lighthouse Rules > Accessibility. The bullets below are a modal-focused subset mirrored from there so this skill works without re-reading CLAUDE.md. Several bullets are specific to PrimeReact's Dialog (focus trap, initial focus, blockScroll, etc.) and don't appear in CLAUDE.md — those are owned here, not mirrored. If you edit a generic bullet here AND the same rule appears in CLAUDE.md, update both. Skills with the same A11y mirror: new-screen, new-component, new-table. -->


- **Icon-only action buttons** inside the modal MUST set `aria-label` (e.g. `aria-label='Close'`). PrimeReact's `Dialog` provides an accessible name for its built-in close button — preserve it if you customize `pt.closeButton`.
- **Modal title**: use the `Dialog` `header` prop instead of a manual `<h2>` inside the body — `Dialog` renders the heading semantics for you and pairs it with `aria-labelledby` automatically.
- **`role='dialog'` and `aria-modal='true'`**: `Dialog` sets these on the root container automatically. NEVER override them via `pt.root.role` — removing them turns the modal into a non-modal popover for assistive tech.
- **Focus trap & Escape-to-close**: `Dialog` handles both out of the box. Do NOT override `onHide` to disable closing without an explicit accessibility reason.
- **Focus return on close**: `Dialog` returns focus to the element that opened the modal — preserve this behavior. If you close the modal as a side-effect (e.g. after a successful SWR mutation rather than a user click on Cancel), keep a `useRef` on the trigger and call `.focus()` manually so keyboard users don't get dropped at the page root.
- **Initial focus**: `Dialog`'s default sends focus to the first focusable element inside. For **destructive confirmations**, override the initial focus to land on the SAFE action (Cancel), not the destructive one — `useEffect` on `visible: true` + a `ref.current?.focus()` on the Cancel button. Prevents accidental confirms when a user mashes Enter.
- **Body scroll lock**: keep Dialog's `blockScroll` enabled (default). Without it, users can scroll the page behind the modal, breaking the modal-context illusion and confusing screen reader users.
- **Destructive confirmations**: never rely on the backdrop click as the ONLY dismissal — always provide an explicit "Cancel" `CustomButton` so keyboard users have a discoverable action. The destructive action label should be self-descriptive (`Delete account`, not `Yes`).
- **Forms inside modals**: every input still needs an `autoComplete` token (JSX prop) and a visible label via `InputContainer`. Per-field validation errors get announced automatically — `InputError` (used via `InputContainer`) already wraps its message in `role='alert'`. For modal-level feedback that does NOT come from a form field (e.g. a "Server unreachable" banner inside the modal body), wrap your own message in `<div role='alert'>...</div>` so SR users hear it on appearance.
- **Reduced motion** is handled globally — `ProvidersContainer` wraps the app in `<MotionConfig reducedMotion='user'>` so every framer-motion animation inside the modal respects the user preference automatically, and the global CSS reset in `general.sass` covers PrimeReact Dialog's built-in fade plus any custom CSS transitions. No per-modal config needed.
- **Tap targets**: every interactive element on mobile must be at least `44×44px`. `CustomButton` size variants `medium`/`large` already meet this; if you need `size='detail'` ensure the parent provides at least 44×44 of effective hit area.

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

**Inside `.sass`: prefer plain CSS, `@apply` only for design tokens.**

- ✅ Plain CSS for: `display`, `flex-direction`, `gap`, `padding`, `margin`, `width`, `height`, `border-radius`, `position`, `cursor`, `overflow`, `transition`, `transform`
- ✅ `@apply` for: project colors (`bg-surface-100`, `text-surface-700`), typography tokens (`text-bold-14`, `text-medium-16`), responsive prefixes (`md:flex-row`), pseudo-state tokens (`hover:bg-surface-100`)
<!-- mirror: CLAUDE.md @apply LAST — keep the bullet below in sync with the canonical wording in CLAUDE.md > Styling Rules > "Inside `.sass` files". -->
- ⚠️ **`@apply` MUST be the LAST declaration in each block scope** — root, `&__Element`, `&--Modifier`, pseudo-state. Plain CSS first, THEN a single `@apply` at the end. Putting `@apply` between plain CSS declarations breaks the SASS indented parser. Nested child blocks (`&__X`, `&--X`) are allowed after `@apply` since they're a deeper scope.

```sass
// ✅ Good — plain CSS first, @apply LAST in each scope
.MyModal
  display: flex
  gap: 1rem
  padding: 1.5rem
  border-radius: 8px
  @apply bg-white border border-surface-200 text-bold-14 text-surface-900

  &__Header
    margin-bottom: 16px
    @apply text-bold-18

  &--Destructive
    border-color: red
    @apply bg-red-50

// ❌ Avoid — @apply between plain CSS declarations (SASS parser breaks)
.MyModal
  display: flex
  @apply bg-white
  border-radius: 8px

// ❌ Avoid — @apply for everything
.MyModal
  @apply flex gap-4 p-6 rounded-[8px] bg-white border border-surface-200 text-bold-14 text-surface-900
```

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
- [ ] Modal subscribed via `useModalStore` with `modals: { {modalKey} }` destructuring
- [ ] Wired according to Step 1 plan: registered in `ModalsProvider` (global) OR snippet shown to the user (local)
- [ ] A11y rules from Step 3 satisfied (aria-label on icon-only buttons, `header` prop for the title, Cancel button for destructive confirmations)

Then post:
1. Files created/modified (markdown links)
2. Usage example:

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

## Step 6 — Validate

Run these commands and fix any errors before finishing:

```bash
pnpm run lint-check --fix
pnpm run type-check
```
