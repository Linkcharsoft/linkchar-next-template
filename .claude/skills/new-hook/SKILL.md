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

See `src/hooks/usePersistentTimer.ts` for the reference example.

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
