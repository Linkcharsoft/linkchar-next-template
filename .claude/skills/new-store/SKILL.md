---
name: new-store
description: Create a new Zustand store at `src/stores/{xxx}Store.ts` following project conventions (`use{Xxx}Store` default export, `'use client'` directive, `create<StoreType>()` pattern). For modal/toast state use `/new-modal` instead — modals share a single global `modalStore` with a dedicated skill that wires type + payload + provider. For auth/session/token state, extend the existing `userStore` rather than creating a parallel store.
---

Create a new Zustand store. Arguments: **$ARGUMENTS**

Parse the arguments:
- First word = `StoreName` (PascalCase, the domain noun — do NOT include the `Store` suffix or the `use` prefix; the skill derives them)

Examples:
- `Cart` → creates `src/stores/cartStore.ts` exporting `useCartStore`
- `Filters` → creates `src/stores/filtersStore.ts` exporting `useFiltersStore`
- `Theme` → creates `src/stores/themeStore.ts` exporting `useThemeStore`

Derive from the name:
- `storeFile` = camelCase + `Store` suffix (e.g. `cartStore`) — used in the file name
- `useStoreName` = `use` + PascalCase + `Store` suffix (e.g. `useCartStore`) — used as the export
- `StoreNameStoreType` = PascalCase + `StoreType` suffix (e.g. `CartStoreType`) — used as the TS type

---

## Pre-flight — Read CONVENTIONS.md (mandatory)

Before generating anything, `Read` [`.claude/CONVENTIONS.md`](../../CONVENTIONS.md). The sections that govern this skill:

- **[Naming Conventions](../../CONVENTIONS.md#naming-conventions)** — stores use camelCase + `Store` suffix; export is `use{Name}Store`.
- **[Component Patterns](../../CONVENTIONS.md#component-patterns)** — `'use client'` directive, default exports, no `memo()` (React Compiler).
- **[Code Style](../../CONVENTIONS.md#code-style)** — imports, quotes, semicolons.

If you cannot read `CONVENTIONS.md`, STOP and report `STOP-BLOCKING / category: INVALID_INPUT / reason: missing CONVENTIONS.md`.

---

## Step 0 — Recon & dedup

Before creating anything:
- Scan `src/stores/` to list existing stores: `userStore` (current user + token), `modalStore` (global modal visibility + payloads + toasts).
- Check if the requested store would duplicate either:
  - **Auth / current user / token state** → reuse `useUserStore`. Add new auth-related fields to it instead of forking.
  - **Modal visibility / payloads / toasts** → use `/new-modal` (which extends `modalStore`). Do NOT create a parallel modal store — the global `ModalsProvider` only listens to `modalStore`.

If the requested store overlaps with an existing one, **stop and tell the user** which to extend instead.

---

## Step 1 — Create `src/stores/{storeFile}.ts`

Follow this exact template. Adapt the state shape and actions:

```ts
'use client'
import { create } from 'zustand'

type StoreNameStoreType = {
  // state
  value?: string

  // actions
  setValue: (value: string) => void
  removeValue: () => void
}

const useStoreNameStore = create<StoreNameStoreType>((set) => ({
  // initial state
  value: undefined,

  // action implementations
  setValue: (value) => set({ value }),
  removeValue: () => set({ value: undefined })
}))

export default useStoreNameStore
```

### Rules:
- **`'use client'`** at the top — MANDATORY. Zustand stores subscribe to React state on the client; without `'use client'` they fail when imported by a server component. This is also the convention across every existing store in `src/stores/`.
- **File naming**: `{storeFile}.ts` — camelCase, ending in `Store` (e.g. `cartStore.ts`). NEVER `useCartStore.ts` (the `use` prefix belongs to the export, not the file).
- **Export naming**: `use{StoreName}Store` — `use` prefix, PascalCase noun, `Store` suffix. Matches the React-hook convention so it's recognized by the `react-hooks/exhaustive-deps` ESLint rule.
- **Type definition**: declare `{StoreName}StoreType` as a `type` (not `interface`) above the `create<>()` call. Group state fields first, then actions, for readability.
- **Default export**: `export default use{StoreName}Store` at the bottom — NEVER named export.
- **Initial state**: prefer `undefined` over `null` for unset values, matching the project's convention (`userStore.ts`). Match each field's optionality (`field?: T` ↔ `field: undefined`).
- **Action naming**: `setX` / `removeX` / `clearX` / `toggleX` / `addX` / etc. for symmetry. For collection mutations, accept the minimal needed parameter and compute the next state inside the action — don't expose the whole collection as mutable:
  ```ts
  type CartStoreType = {
    items: CartItemType[]
    addItem: (item: CartItemType) => void
    removeItem: (id: string) => void
    clearCart: () => void
  }
  ```
- **State updates from prior state**: use the functional `set((state) => ...)` form. For independent field updates, the object form `set({ field })` is fine and more concise.
- **No `memo()` / `useCallback` / `useMemo`** wrapping selectors or actions — React Compiler is enabled and Zustand's `useStore((state) => state.field)` already handles selective re-renders.
- **Persistence**: if the store needs to survive a page reload, wrap with `zustand/middleware`'s `persist`:
  ```ts
  import { persist } from 'zustand/middleware'

  const useStoreNameStore = create<StoreNameStoreType>()(
    persist(
      (set) => ({ /* ... */ }),
      { name: '{kebab-case-key}' }
    )
  )
  ```
  Skip this for in-memory-only state (UI toggles, search filters, transient modals).
- **Derived values**: NEVER store data that can be derived. Compute in the consumer with a selector:
  ```tsx
  const total = useCartStore((s) => s.items.reduce((sum, i) => sum + i.price, 0))
  ```
  Storing derived fields creates two sources of truth that drift out of sync.
- **No `process.env`**: env vars from `@/constants/env`.
- **Imports**: external → `@/` → relative → type imports LAST (ESLint enforces). Single quotes, no semicolons, 2-space indent.

### Reference examples

- `src/stores/userStore.ts` — minimal store with two grouped state slices (user + token).
- `src/stores/modalStore.ts` — advanced store with discriminated payloads, computed maps, and helper actions (`openModal`/`closeModal`/`closeAllModals`). Use as the pattern for any store with keyed entries.

---

## Step 2 — Conventions checklist + summary

Before closing, verify:
- [ ] File at `src/stores/{storeFile}.ts` (camelCase, ends in `Store`)
- [ ] `'use client'` at the top
- [ ] Export `use{StoreName}Store` matches the file naming
- [ ] Type `{StoreName}StoreType` declared as `type` (not `interface`) above the `create<>()` call
- [ ] `export default use{StoreName}Store` at the bottom — no named exports
- [ ] Initial state uses `undefined` (not `null`) for unset values
- [ ] No `memo()` / `useCallback` / `useMemo` (React Compiler handles memoization)
- [ ] No derived data stored — compute via selectors in consumers
- [ ] No `process.env` references — env vars come from `@/constants/env`
- [ ] If modal-related: STOPPED and confirmed `/new-modal` isn't the right tool
- [ ] If auth-related: STOPPED and confirmed `useUserStore` isn't the right tool

Then post a short summary:
1. File created (markdown link)
2. One-line import snippet (e.g. `import use{StoreName}Store from '@/stores/{storeFile}'`)
3. Usage example showing both whole-store and selective subscription patterns:

```tsx
// Whole store (re-renders on any change — use sparingly)
const { value, setValue } = use{StoreName}Store()

// Selective subscription (re-renders only when `value` changes — prefer this)
const value = use{StoreName}Store((state) => state.value)
const setValue = use{StoreName}Store((state) => state.setValue)
```

4. What the user should fill in next (state shape, actions, optional persistence)

---

## Step 3 — Validate

Run these commands and fix any errors before finishing:

```bash
pnpm run lint-check --fix
pnpm run type-check
```
