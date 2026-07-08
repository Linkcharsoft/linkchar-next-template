---
name: new-hook
description: Create a new custom React hook — generates `src/hooks/useXxx.ts` following project conventions (`use` prefix camelCase, default export, `'use client'` when needed). Check `usehooks-ts` and existing hooks (`usePressKey`, `usePersistentTimer`, `useTableParams`) first — many common patterns are already shipped.
---

Create a new custom React hook. Arguments: **$ARGUMENTS**

Parse the arguments:
- First word = `useHookName` (camelCase, must start with `use` — prepend it if missing)

Examples:
- `useDebounce`
- `useClickOutside`
- `useScrollPosition`
- `debounce` → renamed to `useDebounce`

---

## Pre-flight — Read CONVENTIONS.md (mandatory)

Before generating anything, `Read` [`.claude/CONVENTIONS.md`](../../CONVENTIONS.md). The sections that govern this skill:

- **[Naming Conventions](../../CONVENTIONS.md#naming-conventions)** — hooks are camelCase with `use` prefix.
- **[Component Patterns](../../CONVENTIONS.md#component-patterns)** — `'use client'` when needed, default exports, no `memo()`/`useCallback`/`useMemo` for memoization's sake (React Compiler).
- **[Code Style](../../CONVENTIONS.md#code-style)** — imports, quotes, semicolons.

If you cannot read `CONVENTIONS.md`, STOP and report `STOP-BLOCKING / category: INVALID_INPUT / reason: missing CONVENTIONS.md`.

---

## Step 0 — Recon & dedup

Before creating anything:
- Scan `src/hooks/` to list existing project hooks: `usePressKey`, `usePersistentTimer`, `useTableParams`.
- Cross-reference against `usehooks-ts` (already a project dependency — see `package.json`). Many common patterns are already shipped there, including `useDebounceCallback`, `useDebounceValue`, `useMediaQuery`, `useSessionStorage`, `useLocalStorage`, `useIsClient`, `useClickAnyWhere`, `useEventListener`, `useCopyToClipboard`, `useOnClickOutside`, `useIntersectionObserver`, `useIsMounted`, `useInterval`, `useTimeout`, `useCountdown`, `useToggle`, `useBoolean`, `useStep`, `useCounter`. If the requested hook is essentially one of these, **STOP** and tell the user to import from `usehooks-ts` instead.

If a similar hook already exists in the project, **stop and tell the user** which one to reuse or extend instead.

---

## Step 1 — Create `src/hooks/{useHookName}.ts`

Follow this exact template. Adapt the implementation, parameters, and return shape:

```ts
'use client'
import { useEffect } from 'react'

const useHookName = (param: ParamType): ReturnType => {
  // hook implementation
  useEffect(() => {
    // side-effects, listeners, subscriptions
    return () => {
      // cleanup
    }
  }, [/* deps */])

  return /* value */
}

export default useHookName
```

### Rules:
- **`'use client'`** at the top when the hook:
  - Uses any React hook (`useState`, `useEffect`, `useRef`, `useMemo`, `useReducer`, `useContext`, `useLayoutEffect`, etc.)
  - Touches browser APIs (`window`, `document`, `localStorage`, `sessionStorage`, `navigator`, etc.)
  - Wraps a `usehooks-ts` hook or any other client-only library
  - **Skip `'use client'`** ONLY for purely synchronous, dependency-free utility hooks that don't touch React state or the browser. These are rare — when in doubt, include the directive.
- **File naming**: `{useHookName}.ts` (camelCase, `use` prefix). One hook per file.
- **Default export**: `export default useHookName` at the bottom — NEVER named export. Aligns with project convention enforced across `src/hooks/`.
- **No `memo` / `useCallback` / `useMemo` for memoization's sake**: React Compiler is enabled (`reactCompiler: true` in `next.config.ts` + `babel-plugin-react-compiler`). The compiler handles memoization automatically. Only use `useCallback`/`useMemo` when semantically required (e.g., to stabilize a value used as a dependency where you've verified the compiler doesn't already handle it).
- **TypeScript**: explicit parameter AND return types — both are mandatory. If the hook takes multiple parameters, prefer a single object parameter for readability and forward-compatibility:
  ```ts
  const useHookName = ({ a, b }: { a: string, b: number }): ReturnShape => { ... }
  ```
  For complex shapes, declare a named `type` or `interface` above the hook (PascalCase, `Type` suffix when it's a model).
- **Cleanup**: every `useEffect` that registers a listener, interval, timeout, or subscription MUST return a cleanup function. Memory leaks degrade Lighthouse scores and cause real bugs across route transitions.
- **Effect dependencies**: list every value from the outer scope that the effect reads. Don't suppress the `react-hooks/exhaustive-deps` lint warning without understanding why.
- **No `process.env`**: env vars from `@/constants/env`.
- **Imports**: external → `@/` → relative → type imports LAST (ESLint enforces). Single quotes, no semicolons, 2-space indent.

### Optional but recommended: JSDoc

For hooks with non-trivial APIs, add a JSDoc block above the declaration so consumers get IntelliSense:

```ts
/**
 * @hook
 * @name useHookName
 * @description One-sentence description of what the hook does.
 *
 * @example
 * ```tsx
 * const value = useHookName({ a: 'x', b: 1 })
 * ```
 */
```

### Reference example: `src/hooks/usePersistentTimer.ts`

`usePersistentTimer` is the project's canonical "non-trivial hook" example — open it before writing your own to see the conventions in practice:

- **Single source of truth** — persists state across remounts via `localStorage` so timers survive route transitions. Reads it back on mount with a `useRef` guard to avoid StrictMode double-init.
- **Cleanup discipline** — every interval is cleared on unmount, even when the component remounts mid-tick. Cleanup runs return the timer to a stable state.
- **JSDoc with `@hook` / `@name` / `@description` / `@example`** — so the IDE shows usage at the call site, not just the type signature.
- **Object parameter, not positional** — `useXxx({ a, b })` instead of `useXxx(a, b)` so the call site is self-documenting and adding optional keys later is non-breaking.
- **No `useCallback` / `useMemo` wrapping** — React Compiler handles memoization automatically; the hook returns plain values and the consumers stay clean.
- **Explicit return type** — the IntelliSense hint at the call site shows the exact shape, not `any`.

When extending or building a hook with similar complexity (persistence, intervals, cross-mount state), mirror this structure instead of inventing a new convention. For shorter idioms — a single piece of state, a single effect — look at `useTableParams` (URL-state derived) and `usePressKey` (event listener with cleanup) for the simpler patterns.

---

## Step 2 — Conventions checklist + summary

Before closing, verify:
- [ ] File at `src/hooks/{useHookName}.ts`, exactly one hook per file
- [ ] Hook name starts with `use` (camelCase) and matches the file name exactly
- [ ] `export default {useHookName}` at the bottom — no named exports
- [ ] `'use client'` present when the hook touches React state/effects or browser APIs
- [ ] No `memo()` / `useCallback` / `useMemo` wrapping unless semantically required (React Compiler handles memoization)
- [ ] Explicit TypeScript types on parameters AND return value
- [ ] Every `useEffect` with a listener / timer / subscription has a cleanup function
- [ ] No `process.env` references — env vars come from `@/constants/env`
- [ ] Imports alphabetized within groups (external → `@/` → relative), type imports LAST
- [ ] Confirmed `usehooks-ts` doesn't already ship the same functionality

Then post a short summary:
1. File created (markdown link)
2. One-line import snippet (e.g. `import {useHookName} from '@/hooks/{useHookName}'`)
3. What the user should fill in next (parameters, implementation, return shape)

---

## Step 3 — Validate

Run these commands and fix any errors before finishing:

```bash
pnpm run lint-check --fix
pnpm run type-check
```
