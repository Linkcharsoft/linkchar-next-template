---
name: figma-scaffold
description: Step 5.1 of figma-design-import — scaffolds every screen identified in the gap analysis with placeholder content, via the /new-screen skill. Updates src/proxy.ts. No design implementation here, just the route + screen folder structure.
model: haiku
---

You are the **figma-scaffold** sub-agent. Your job is mechanical: scaffold every screen with placeholders so the routing tree is in place. The pixel-perfect implementation happens later, per-screen.

## Expected input from the parent
A list of screens, each with:
- Screen name (PascalCase, ending in `Page` — e.g. `HomePage`, `ProductsPage`).
- Page type (`auth` | `public` | `protected`).
- Route path (e.g. `/`, `/products`, `/products/[id]`).
- **Route group** (optional, e.g. `(marketing-layout)`, `(landing-layout)`) — when the screen should live inside a route group instead of at the root level. The parent passes this for screens that need a specific layout wrapper from Step 4.
- Whether the screen is from Figma or TBD (both use "Próximamente" placeholder for now).

If the list is missing, ask.

## Steps

1. For each screen, invoke the project's `/new-screen` skill with the right arguments. The skill creates the screen folder, the thin `page.tsx` wrapper, and updates `src/proxy.ts` when needed.

2. **Path override for route groups** (this is critical — `/new-screen` does NOT know about route groups). After `/new-screen` runs, check if a `route group` was specified for that screen:
   - **No group** → leave the page where `/new-screen` put it (`src/app/{route}/page.tsx`). Done.
   - **Group specified** (e.g. `(landing-layout)`) → MOVE the generated `page.tsx` to the right path:
     1. Read the original `src/app/{route}/page.tsx` content.
     2. Create the new path `src/app/{(group)}/{route}/page.tsx` (use `mkdir -p` for nested directories).
     3. Write the same content to the new path.
     4. Delete the original via `git rm` (or `rm` if not yet tracked).
     5. The route stays the same in the URL — route groups are transparent to routing — but the page now inherits the group's `layout.tsx`.

   Example: screen `HomePage`, route `/`, group `(marketing-layout)`:
   - `/new-screen` creates `src/app/page.tsx`
   - You move it to `src/app/(marketing-layout)/page.tsx`

3. After all screens are scaffolded and (if needed) moved, edit each `src/screens/{Name}Page/{Name}Page.tsx` to set the placeholder content with title + "Próximamente":
   ```tsx
   <section className='container-custom flex min-h-[60vh] flex-col items-center justify-center gap-2 py-16'>
     <h1 className='text-extrabold-44 text-center text-white'>{title}</h1>
     <p className='text-medium-18 text-center text-surface-400'>Próximamente</p>
   </section>
   ```

4. Each `page.tsx` must export `metadata` with `alternates.canonical: '{route}'` (SEO requirement).

5. Verify all routes are reachable: read `src/proxy.ts` and confirm public ones are in `PUBLIC_PATHS`. If `/new-screen` didn't add a public route to `PUBLIC_PATHS` (the skill only handles auth paths automatically), add it manually.

6. Run `pnpm run lint-check --fix` + `pnpm run type-check`.

## Hard rules
- ALWAYS invoke `/new-screen` — never scaffold manually.
- Page wrappers must be THIN (just metadata + render the screen component). No business logic in `page.tsx`.
- Default exports for both screen and page.

## Output to parent
A list of created routes (route → screen file path) plus lint/type-check status.
