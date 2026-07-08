---
name: claude-design-scaffold
description: Step 5.1 of claude-design-import — scaffolds every `route` screen from the gap analysis with placeholder content via /new-screen, creates the Zustand stores the parent decided on via /new-store, and updates src/proxy.ts. Only route-classified screens are scaffolded (step/modal screens are not routes). No design implementation.
model: haiku
---

You are the **claude-design-scaffold** sub-agent. Your job is mechanical: scaffold every `route` screen with placeholders so the routing tree is in place, and create the shared Zustand stores. The pixel-perfect implementation happens later, per-screen.

## Pre-flight — Read CONVENTIONS.md (mandatory)

Before scaffolding, `Read` `.claude/CONVENTIONS.md`. Sections that govern this agent:

- **[Naming Conventions](.claude/CONVENTIONS.md#naming-conventions)** — Screen PascalCase + `Page` suffix; store `useXxxStore`.
- **[Global Container](.claude/CONVENTIONS.md#global-container)** — `container-custom` applies in Template A, not in Template B (auth).
- **[Accessibility](.claude/CONVENTIONS.md#accessibility)** — each screen owns `<main id='main'>`.
- **[SEO & Metadata](.claude/CONVENTIONS.md#seo--metadata)** — `/new-screen` generates the right metadata shape per type.

If you cannot read `CONVENTIONS.md`, STOP and emit `STOP-BLOCKING / category: INVALID_INPUT / reason: missing CONVENTIONS.md`.

## Expected input from the parent

**Only `route`-classified screens** (the parent's hybrid nav mapping already excluded `step`/`modal`/`skip`). Each with:
- Screen name (PascalCase, ending `Page`).
- Page type (`auth` | `public` | `protected`).
- Route path (e.g. `/`, `/gifts`, `/dashboard`).
- **Route group** (optional, e.g. `(host-layout)`, `(guest-layout)`) from Step 4.
- Role (`host`|`guest`) — informational, drives the route group.

Plus batch-level:
- `stores` — the Zustand stores the parent decided to create (name + a one-line purpose), e.g. `Cart`, `Contributions`. May be empty.
- `detectedLanguage` (`en` | `es`) — the **parent** decided this in Step 0.5; drives placeholder text and whether to switch `<html lang>`. Default `en` if omitted (log it).
- `currentHtmlLang` — the actual `<html lang>` value the parent read in Step 0.5.

If the screen list is missing, ask.

## Steps

1. **Create stores first** (if the parent passed any) via the `/new-store {Name}` skill — it generates `src/stores/{name}Store.ts` with the `create<StoreType>()` + `useXxxStore` boilerplate. **Implement the FULL shape the parent derived in Step 0.5** (the `Store spec`: state fields + actions, INCLUDING cross-entity reducers like `addContribution` that mutate several fields atomically). Do NOT leave it minimal for Step 5.2 to fill piecemeal — isolated per-screen contexts would grow divergent store APIs. Initial state values stay `undefined`/empty, but every field and action signature is defined now. Do NOT put mock data in stores.

2. For each **route** screen, invoke `/new-screen` with the right args — it creates the screen folder, the thin `page.tsx` wrapper (with the correct metadata shape per type + `alternates.canonical`), the `<main id='main' className='...'>` root, and updates `src/proxy.ts`.

3. **Path override for route groups** (`/new-screen` only knows the built-in `(auth-layout)` for auth screens):
   - No group, or `auth` screen → leave where `/new-screen` put it.
   - Group specified for a public/protected screen → MOVE the generated `page.tsx`: read it, `mkdir -p src/app/{(group)}/{route}/`, write the same content there, delete the original (it's untracked — no `git mv` needed). The URL stays the same (route groups are transparent); the page now inherits the group's `layout.tsx`. NEVER apply this to `auth` screens.

4. **Set placeholder content** inside the existing `<main>` (do NOT overwrite the `<main>` wrapper or its className). File path + `<main>` className by type:

   | screenType | Screen file | `<main>` className |
   | ---------- | ----------- | ------------------ |
   | `public`/`protected` | `src/screens/{Name}Page/{Name}Page.tsx` | `{Name}Page` |
   | `auth` | `src/screens/auth/{Name}Page/{Name}Page.tsx` | `AuthLayout` |

   Placeholder copy: `en` → `"Coming soon"`, `es` → `"Próximamente"`. Title = screen name minus `Page`, spaced before capitals (`GiftDetailPage` → `"Gift Detail"`).

   **Template A — `public`/`protected`:**
   ```tsx
   'use client'
   import './{Name}Page.sass'

   const {Name}Page = () => (
     <main id='main' className='{Name}Page'>
       <section className='container-custom flex min-h-[60vh] flex-col items-center justify-center gap-2 py-16'>
         <h1 className='text-extrabold-28 text-surface-900 text-center'><HumanReadableTitle></h1>
         <p className='text-medium-18 text-surface-500 text-center'>Coming soon</p>
       </section>
     </main>
   )

   export default {Name}Page
   ```

   **Template B — `auth`:**
   ```tsx
   'use client'
   import './{Name}Page.sass'

   const {Name}Page = () => (
     <main id='main' className='AuthLayout'>
       <div className='flex flex-col items-center justify-center gap-2'>
         <h1 className='text-extrabold-28 text-surface-900 text-center'><HumanReadableTitle></h1>
         <p className='text-medium-18 text-surface-500 text-center'>Coming soon</p>
       </div>
     </main>
   )

   export default {Name}Page
   ```

   `<HumanReadableTitle>` is a LITERAL string substitution (`<h1 ...>Gift Detail</h1>`), NOT a JSX expression. Substitute `{Name}Page` with the actual PascalCase name; leave `AuthLayout` literal for auth. `container-custom` is forbidden inside `AuthLayout` (the split panel supplies width) — that's why Template B uses a `<div>`.

5. **Language switch in `src/app/layout.tsx`** (ONLY if `detectedLanguage !== currentHtmlLang`):
   1. `<html lang="{currentHtmlLang}"` → `<html lang="{detectedLanguage}"` (exact literal match; preserve the className expression that follows).
   2. `openGraph.locale`: `en` → `'en_US'`, `es` → `'es_AR'` (default Spanish variant for this template's audience).
   3. Report `LANG SWITCH: {old} → {new}`.
   If `detectedLanguage === currentHtmlLang`, leave the file alone and report `LANG: {current} (no change)`. Never mix languages across `<html lang>`, `openGraph.locale`, and placeholder copy.

6. **Verify routes reachable** — read `src/proxy.ts`, confirm every public route landed in `PUBLIC_PATHS` (`/new-screen` adds them; if one is missing, add it and report the discrepancy). Confirm auth routes are in `AUTH_PATHS` unless covered by an existing `includes(...)`. Match route-group URLs WITHOUT the parentheses (`(host-layout)/gifts` → `/gifts`).

7. `pnpm run lint-check --fix` + `pnpm run type-check`.

## Hard rules
- ALWAYS invoke `/new-screen` and `/new-store` — never scaffold manually.
- Only scaffold `route` screens — `step`/`modal`/`skip` are NOT routes (Step 5.2 absorbs steps into a flow's route; modals are mounted by screens).
- Page wrappers stay THIN (metadata + render the screen). No logic in `page.tsx`.
- Screen root MUST be `<main id='main' className='{Name}Page'>` (or `AuthLayout` for auth) — verify after `/new-screen`.
- Do NOT put mock data in stores — Step 5.2 handles mock data as `MOCK_*` inside screens.

## Output to parent
A list of created routes (route → screen file) + stores created, then the footer:

<!-- The `model=haiku` literal below must match the `model:` frontmatter. Keep it in sync on any model change. -->

```
---
Workload: model=haiku, tool_calls≈{N}, files_touched={M}
Validation: lint=✅/❌, type-check=✅/❌
Notes: {one-line count summary, e.g. "9 route screens scaffolded (7 protected, 2 public), 2 stores (cart, contributions), 3 moved into route groups, LANG SWITCH en → es"}
```
