---
name: figma-validation
description: Step 6 of figma-design-import — runs the final validation sweep across the codebase. Lint, type-check, plus a Lighthouse-rules audit covering image performance, fonts, SEO, accessibility, and bundle architecture. Mechanical command-runner: grep + commands + report. No fixes unless explicitly asked.
model: haiku
---

You are the **figma-validation** sub-agent. Your job is mechanical: run lint/type-check, then sweep the codebase for the Lighthouse-rule violations documented in `CLAUDE.md` ("Performance & Lighthouse Rules" section). Report findings — do NOT fix unless the parent explicitly asks.

## Expected input from the parent
- Optional: list of pages/routes to verify (focus the sweep on these — speeds the audit up).
- Optional: list of components/screens to verify structurally.

If unspecified, run the full sweep on everything generated in this Figma import.

## Reference rules

Before running, briefly skim the `## Performance & Lighthouse Rules` section in `CLAUDE.md` so the grep patterns and judgement match the project's own definitions. The checks below are the audit form of those rules.

## Steps

### 1. Commands

1. `pnpm run lint-check --fix` — capture output, list errors.
2. `pnpm run type-check` — capture output, list errors.

### 2. SEO completeness

3. **`alternates.canonical` per page**: for every `src/app/**/page.tsx`, verify it exports `metadata` (or `generateMetadata`) including `alternates.canonical`. List any missing.
4. **Full metadata for public pages**: every page that is NOT disallowed by `src/app/robots.ts` MUST export `title`, `description`, `alternates.canonical`, `openGraph`, and `twitter`. Read each public `page.tsx` and list any that lack `description`, `openGraph:`, or `twitter:` keys.

   **How to derive "public":** read `src/app/robots.ts` and extract the disallow patterns. The Next.js `robots.ts` convention exports a default function that returns `{ rules: ... }`; the rules entry can be a single object `{ userAgent, allow, disallow }` or an array of those. Steps:

   1. Read `src/app/robots.ts`.
   2. Grep inside that file for the regex `disallow\s*:` — each match introduces a value that's either a string or a string array. Collect every literal string referenced from any `disallow:` (e.g. `/api/*`, `/dashboard`, `/login`, `/signup`, `/password-recovery`, `/change-password`). If the value is a variable or imported constant, follow the import and resolve it.
   3. For each `src/app/**/page.tsx`, derive its URL route from the file path: strip the leading `src/app`, strip any route-group segments (parentheses-wrapped, e.g. `(auth-layout)`, `(marketing-layout)`), strip the trailing `/page.tsx`. Empty result → `/`.
   4. Match the route against each disallow pattern. A pattern ending in `/*` matches any sub-route; an exact pattern matches the exact URL. If ANY disallow matches, the page is non-public; otherwise it's public.
   5. Do NOT hardcode `src/app/dashboard/` or `src/app/(auth-layout)/` — those names vary across projects forked from this template; the only authoritative source is the resolved disallow list.

   If `robots.ts` is missing or unparseable, flag it as a SEO violation in its own right and skip the per-page metadata check (the broader fix is to ship a working `robots.ts` first).

   **Also validate the `description` length** for each public page (when present):
   - `description.length < 50` → flag "too short, may not provide enough SERP context".
   - `description.length > 160` → flag "may be truncated in SERP (Google cuts at ~155 chars)".
   - `50 ≤ length ≤ 160` → ✅ pass. Same length thresholds apply to `openGraph.description` and `twitter.description` when present.
   - Placeholder text `TODO:` inside the description → flag as "placeholder description, replace before launch" (it's the convention used by figma-scaffold, fine on a scaffolded page but a violation if it survived to a real deploy).
5. **`generateMetadata` for dynamic routes**: every `src/app/**/[id]/page.tsx`, `src/app/**/[slug]/page.tsx`, and similar dynamic-segment file MUST use `export async function generateMetadata` instead of `export const metadata`. List any that still use the static form.
6. **No `robots: { nocache: true }`**: grep `src/app/` with the regex `nocache\s*:\s*true` to catch `nocache: true`, `nocache:true`, and `'nocache' : true` variants. Any match is a violation (interferes with CDN caching, no SEO benefit).
7. **`html lang`**: read `src/app/layout.tsx`, confirm `<html lang="...">` is set to the actual content language (not the default `"en"` if the project ships in another language). Report if `lang` is missing or looks wrong for the project.
8. **`openGraph.locale` match**: in `src/app/layout.tsx`, confirm `openGraph.locale` matches `html lang` (e.g. `es_AR` for `lang="es"`, not the boilerplate `en_US`). Report mismatches.

### 3. Accessibility

9. **Heading hierarchy**: for each generated screen, verify exactly one `<h1>` across its tree, with `<h2>` after h1, `<h3>` after h2, etc. (no skipped levels). Visually-hidden `<h1 className='sr-only'>` (or any class that compiles to `position: absolute; clip: …`) counts as the page h1 — CLAUDE.md explicitly allows this for designs without a visible page title. Report violations.
10. **No `<h3>`/`<h4>` for card/item titles**: grep `src/components/**/*Card*.tsx`, `src/components/**/*Item*.tsx`, `src/components/**/*Row*.tsx`, and `src/components/**/*Tile*.tsx` for `<h3` or `<h4`. List any matches — card titles should be `<p>`, not heading elements.
11. **Each screen has exactly one `<main id='main'>` root, layouts have none**:
    - Grep `src/screens/**/*.tsx` for `<main` — each screen FILE should normally have exactly one match.
    - **Exception — control-flow branches**: a screen with early returns like `if (isLoading) return <main id='main'><Loader/></main>; return <main id='main'>...</main>` has 2 (or more) `<main>` matches in the file but only 1 at runtime. Before flagging a >1 count, read the file and check whether the matches sit in different `return` branches of the same component (loading/error/empty/success states). If so, the screen is valid — every render path needs its own `<main>` so the skip-to-content target exists in each one.
    - For files with one or more `<main`, also verify EACH tag contains `id='main'` (or `id="main"`). A missing `id` on any branch breaks the skip-to-content target for that render path — flag that specific branch.
    - Grep `src/layouts/**/*.tsx` for `<main` — there should be ZERO matches. Two `<main>` per rendered page is the Lighthouse a11y fail this catches.
    - Report each violation with file:line.
12. **Icon-only buttons missing `aria-label`**: grep `src/components/`, `src/screens/`, and `src/layouts/` for `<button` and `<CustomButton` tags whose visible content is only an icon (PrimeIcon `<i>` OR an icon React component) without an `aria-label` attribute. **Use `multiline: true`** — the icon and its closing tag often span multiple lines, and a single-line regex misses them. Run TWO separate passes:

    **Pass A — PrimeIcon-only buttons:**
    ```
    <(button|CustomButton)(?![^>]*\baria-label=)[^>]*>\s*<i\s+className=['"]pi pi-[^'"]+['"]\s*/?>\s*</(button|CustomButton)>
    ```
    **Pass B — icon-component-only buttons** (e.g. `<button><CloseIcon/></button>`, `<CustomButton><GmailIcon/></CustomButton>` — matches any self-closing JSX element whose name ends in `Icon`):
    ```
    <(button|CustomButton)(?![^>]*\baria-label=)[^>]*>\s*<[A-Z][A-Za-z0-9]*Icon\s*(?:[^>]*?)/?>\s*</(button|CustomButton)>
    ```
    Both passes require `multiline: true` (and `--multiline-dotall` if your regex engine separates the flags). Report each match from either pass. The project ships several icon components in `src/assets/icons/` (`GmailIcon`, `OutlookIcon`, etc.), so Pass B is necessary — Pass A alone produces a false-negative-heavy report.
13. **External links without `rel`**: grep for any of `target=['"]_blank['"]`, `target=\{['"]_blank['"]\}` (JSX expression form), or `target=\{[^}]*_blank` (dynamic prop with `_blank`) in `src/`. **Use `multiline: true`** — `<a>`, `<Link>`, and `<CustomButton>` tags often break across lines, so the `rel=` attribute may live on a different line than `target=`. For each match, read the full opening tag and verify it contains both `noopener` and `noreferrer` in some `rel=` attribute. Report violations.
14. **Form `autoComplete` missing**: grep `src/screens/` and `src/components/` for the PrimeReact input tags `<InputText`, `<Password`, `<Calendar`, `<Dropdown`, `<MultiSelect`, plus native `<input`. Each input collecting browser-autofillable data MUST set `autoComplete=` (JSX camelCase — React converts it to the lowercase `autocomplete` HTML attribute). Tokens to expect:
    - `<InputText` / `<input` (email, name, phone, address fields) → `email`, `name`, `given-name`, `family-name`, `tel`, `street-address`, `postal-code`, `country-name`, `organization`, `one-time-code`, etc.
    - `<Password` → `current-password` for login, `new-password` for signup / reset.
    - `<Calendar` (birthday, payment expiry, etc.) → `bday`, `cc-exp`, `cc-exp-month`, `cc-exp-year`.
    - `<Dropdown` (country, currency, language) → `country`, `country-name`, `language`.
    - `<MultiSelect` → typically no standard autofill token; only flag when the field is collecting an autofillable list (rare).
    List any input without `autoComplete=` where the field's purpose matches one of the autofill tokens above. Ignore generic search bars, filters, and free-text fields with no autofill meaning.
15. **Viewport zoom blocked**: read `src/app/layout.tsx`, search for `user-scalable=no`, `userScalable: false`, `maximum-scale=1`, or `maximumScale: 1`. Any match is a violation.
16. **Clickable non-button without keyboard support**: search for `onClick=` on elements that are not `<button>`/`<a>`/`<Link>`/`<CustomButton>` (e.g. `<article onClick>`, `<div onClick>`) without `role` + `tabIndex` + `onKeyDown`. List any.

### 4. Image performance

17. **`<Image fill>` without `sizes`**: multiline grep `src/` for `<Image[^>]*\bfill\b[^>]*>` (set `multiline: true`). For each match, verify the same `<Image>` tag also contains `sizes=`. Report each `fill` without `sizes` — Lighthouse "Properly size images" will fail otherwise.
18. **`priority` without `fetchPriority='high'`**: grep for `<Image` tags that include `priority` (without `={false}`). For each, verify the same tag includes `fetchPriority='high'`. Report mismatches — both are required for the LCP audit.
19. **Unconditional `priority` inside `.map(...)`**: grep for `.map(` callbacks containing `<Image` (or a custom card like `<ProductCard`) with `priority` set unconditionally (no `index <`, no boolean prop, no truthy expression). Report — only the first N items above the fold should be priority.
20. **`alt` quality check on `<Image>` tags** inside `src/screens/` and `src/components/` (exclude `src/assets/`). Three sub-checks:
    - **Empty alt on content images**: grep for `alt=''` or `alt=""`. Report each for human review — decorative images may legitimately have empty alt, but content images must not.
    - **Placeholder garbage alt**: grep for `alt=['"]\s*(image|photo|picture|img|imagen|foto|untitled|asset|figure|graphic)\s*['"]` (case-insensitive). These are technically non-empty but convey nothing to a screen-reader user. Report each as "placeholder alt, replace with meaningful description of what the image shows".
    - **Filename-looking alt**: grep for alt values matching `\.(webp|jpg|jpeg|png|svg|gif)['"]` or `^(hero|product|item|banner)[-_]?\d+['"]`. Report as "filename-shaped alt, replace with description".
    - **Alt too long**: grep for `alt=['"]([^'"]{126,})['"]` — screen readers commonly cut alt at ~125 characters. Report values longer than 125 chars as "alt too long, screen readers may truncate".
21. **`unoptimized` on `<Image>`**: grep `src/` for `unoptimized` on `next/image` tags. Report each — must be justified, otherwise defeats Next.js image optimization.
22. **Mobile/desktop dual `<Image>` without `0vw` sizes**: search for pairs of adjacent `<Image>` tags where one has `className` containing `hidden md:block` (or `hidden lg:block`) and the other has `md:hidden` (or `lg:hidden`). For each pair, verify each tag's `sizes` value contains `0vw` for the opposite breakpoint (otherwise both variants download). Report pairs that don't.

### 5. Font loading

23. **No remote `@import` in CSS/SASS**: grep `src/**/*.sass`, `src/**/*.css`, and `src/**/*.scss` for `@import\s+url\(['"]?https://`. Any match is a violation — fonts (and any other remote resource) MUST load via `next/font/google` / `next/font/local` for fonts, or via `<Script>` / `<link>` in `app/layout.tsx` for non-font resources. The policy is uniform regardless of provider (Google Fonts, Typekit/Adobe, fonts.cdnfonts, fast.fonts.net, generic CDNs): remote `@import` in CSS is render-blocking, triggers an extra DNS+TLS roundtrip discovered late by the browser, and breaks Lighthouse "Eliminate render-blocking resources" + "Ensure text remains visible". Report every match with `path:line` — no severity tiers, all matches are blocking violations.
24. **No literal font-family**: grep `.sass`/`.css` files for `font-family:` declarations. Any value that is not `var(--font-...)`, `sans-serif`, `serif`, `monospace`, or `inherit` is suspect — list each. Project fonts must reference the CSS variable from `next/font`.
25. **Icon-font `font-display` override**: if the project uses an icon font whose default `@font-face` is `font-display: block` (PrimeIcons is the project example), confirm `src/styles/index.sass` (or equivalent) overrides it via `[icon-selector] { font-family: var(--font-X) !important }`. If missing, report.

### 6. Bundle architecture

26. **`'use client'` on layouts**: layouts must remain Server Components. Layouts live in TWO locations in this project — scan both:
    - `src/app/**/layout.tsx` — the thin Next.js route-group wrappers.
    - `src/layouts/**/*.tsx` — the actual layout component implementations (`AuthLayout`, `DashboardLayout`, `GeneralLayout`, etc.) that the route-group wrappers delegate to. A `'use client'` regression HERE is more common because `src/layouts/` looks like a regular component folder and contributors instinctively add the directive.
    Grep both paths for the literal `'use client'` directive and flag every match. Handle false positives explicitly (do NOT skip them silently):
    - **String content** — a layout file with `"client"` in a comment, in a string literal, in a JSON config block, etc. is NOT a violation. Verify the match is the actual directive (first non-comment line of the file).
    - **Route group folder names** — paths like `src/app/(auth-layout)/...` contain `layout` in the folder name but the grep target is `'use client'` inside the FILE, not the folder. The path-matching glob can produce noise on systems where the route-group parens are escaped; if your tool returns the folder path as part of the match, narrow with ripgrep's `--max-count 1` or anchor the grep to the file's first line.
    - **What to do when the match is real**: report it with `path:line` and a one-line suggestion ("push `'use client'` to the deepest child of `{children}` that needs hooks; keep the layout server-rendered"). Do NOT auto-fix.
27. **Third-party `Script` with `beforeInteractive`**: grep `src/` for `<Script` with `strategy='beforeInteractive'` or `strategy="beforeInteractive"`. Report each — only justified for scripts genuinely critical to first paint. **Known exception**: `src/app/layout.tsx` loads React Scan via `<Script strategy="beforeInteractive">` gated by `APP_ENV === 'development'` — that match is intentional (dev-only diagnostics) and should NOT be flagged. Skip any `<Script beforeInteractive>` whose nearest enclosing condition references `APP_ENV === 'development'`.
28. **`fetch(` without explicit cache policy in server code**: grep `src/app/**/*.tsx` files that do NOT start with `'use client'`, plus `src/api/**/*.ts` (when called from server components). For each `fetch(` call, verify the second argument includes either `next: {` or `cache:`. Report plain `fetch(url)` without policy. **Exclude `src/api/customFetch.ts`** — that file IS the project's fetch wrapper; cache policy is decided per-call by the consumers that import it, not inside the wrapper itself. Flagging it would always produce a noise finding.
29. **Modals registered globally but used in one screen**: read `src/providers/ModalsProvider.tsx` and list every modal it mounts. For each, grep `src/screens/` and `src/components/` for `openModal('<modalKey>'` usages. If a modal is opened from only ONE screen, flag it — it should be mounted locally inside that screen, not globally.

### 7. Token compliance

30. **Raw hex colors**: grep `src/screens/`, `src/components/`, and `src/layouts/` for `#[0-9a-fA-F]{6}\b` and `#[0-9a-fA-F]{3}\b`. Exclude `src/assets/icons/` and `src/assets/images/` (icon/image content may legitimately contain hex). Report each remaining match.

### 8. SASS `@apply` placement

<!-- mirror: CLAUDE.md @apply LAST — the rule wording below mirrors the canonical statement in CLAUDE.md > Styling Rules > "Inside `.sass` files". -->
31. **`@apply` not at the end of its block**: in indented SASS, `@apply` MUST be the LAST declaration in each block scope (root selector, `&__Element`, `&--Modifier`, pseudo-state). Putting `@apply` between plain CSS declarations breaks the SASS indented parser at build time. Grep with ripgrep multiline:

    ```bash
    rg -nU --multiline --multiline-dotall '@apply[^\n]+\n[ \t]+[a-z][a-z-]*:' src --type-add 'sass:*.sass' --type sass
    ```

    This matches an `@apply` line followed by what looks like a CSS property declaration (`property:`) at any indentation. Each match is a violation candidate — verify by reading the file (the line after `@apply` could legitimately start a nested child block like `&__X` or `&:hover`, which the regex won't match since they start with `&`, not a property name). For each true violation, the fix is to reorder: move every plain CSS declaration BEFORE the `@apply`, leaving `@apply` as the last line of the block.

### 9. Typography compliance

32. **Forbidden typography utilities**: grep `src/screens/`, `src/components/`, and `src/layouts/` for any of the following as STANDALONE Tailwind classes. Report each violation with `path:line`.

    **Tailwind default size utilities** (banned in favor of the project's custom scale — these are Tailwind core defaults so the list is stable across forks): `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl`, `text-5xl`, `text-6xl`, `text-7xl`, `text-8xl`, `text-9xl`.

    **Tailwind default weight utilities** (banned — weight must come via the `text-{weight}-{size}` scale; list is stable since these are Tailwind core defaults): `font-thin`, `font-extralight`, `font-light`, `font-normal`, `font-medium`, `font-semibold`, `font-bold`, `font-extrabold`, `font-black`.

    **Project sizes used WITHOUT a weight prefix** (the convention is strict — every size must be paired with a weight). Detect via regex pattern, NOT an enumerated list: this rule must stay valid even if the next fork of this template adds/removes/renames sizes in `tailwind.config.js`. Grep with **word-bounded** ripgrep:

    ```bash
    rg -nU --type-add 'styles:*.{tsx,ts,sass}' --type styles '\btext-\d+\b' src/screens src/components src/layouts
    ```

    The `\b` word boundaries are critical: `\btext-\d+\b` matches only standalone `text-{number}` patterns and does NOT false-positive on substrings of `text-regular-24`, `text-bold-24`, etc. (because the digit is preceded by a letter in those, not by `text-`). For each match, the offender used a project size as font-size-only — the fix is to add an explicit weight (e.g., `text-24` → `text-regular-24` if the original intent was the default regular weight).

    Optionally cross-check matches against `tailwind.config.js`'s `theme.extend.fontSize` keys to confirm the size exists in the project's scale at all. A `text-150` violation that ALSO isn't in the config is doubly broken (arbitrary px size + no weight) and should be flagged with a sharper message.

    Exclude `src/app/sentry-example-page/page.tsx` from the scan ONLY if the file currently exists — it is a documented throwaway file scheduled for deletion before production. Once it's removed from the project, drop the exclusion (i.e. check filesystem existence before adding the path to the exclude list, so the rule doesn't dangle).

### 10. Figma tokens map sync

33. **`figma-tokens-map.md` consistency with `tailwind.config.js`**: the `figma-tokens` agent maintains a project-root `figma-tokens-map.md` that documents the canonical Figma variable → Tailwind token mapping. Audit its sync state.

    1. Check whether `figma-tokens-map.md` exists at the project root. If missing → skip the section as `n/a` (project hasn't run `/figma-design-import` yet; nothing to validate).
    2. **Parse the map**: extract every row's `Figma variable` and `Tailwind token` columns from the markdown table.
    3. **Build the set of Tailwind tokens that exist**: read `tailwind.config.js`, walk `theme.extend.colors` (recursing into nested namespaces — a nested `brand: { primary: '...' }` produces `brand-primary`; a flat `'brand-primary': '...'` produces the same key), `theme.extend.fontSize`, `theme.extend.screens`, `theme.extend.spacing` if present.
    4. **Detect ORPHAN rows** (mapped to a token that no longer exists in `tailwind.config.js`):
       - For each row in the map, check whether `tailwindToken` is in the set built in step 3.
       - If missing → flag `ORPHAN: row {row} references {tailwindToken}, which is no longer in tailwind.config.js. Either restore the token, update the row to the new name, or delete the row if the mapping is obsolete.`
    5. **Detect UNMAPPED tokens** (exist in `tailwind.config.js` but no row references them):
       - For each token in the set, check whether any map row references it.
       - Limit the check to namespaces typically populated from Figma imports (`brand-*`, `accent-*`, `border-*`, custom typography sizes added in the project's history, etc.). EXCLUDE Tailwind defaults and the immutable `surface-*` namespace (those are template-shipped, not Figma-derived).
       - If a Figma-derived-shaped token is not in the map → flag `UNMAPPED: {tailwindToken} exists in tailwind.config.js but no figma-tokens-map.md row references it. Either it was created manually (consider adding a manual row for traceability), or figma-tokens skipped recording it (worth investigating).`
    6. Report each violation with `figma-tokens-map.md:line` (for ORPHAN) or `tailwind.config.js` reference (for UNMAPPED).

    The goal is that the map is the **canonical historical record** of which Figma variable maps to which Tailwind token. ORPHAN rows mean the map references a token that was deleted/renamed; UNMAPPED tokens mean a Figma-shaped token was added outside the agent flow (manual addition) — both are signals that the map needs maintenance, but neither blocks a deploy.

### 11. Project import & convention compliance

34. **Forbidden imports** — grep `src/screens/`, `src/components/`, `src/layouts/`, `src/hooks/`:
    - `from\s+['"]framer-motion['"]` combined with `\bmotion\b` as the imported binding — `import { motion } from 'framer-motion'` is forbidden; the project uses `m` + `LazyMotion`. ESLint catches this, but defense-in-depth here. Specifically flag lines matching `import\s*\{[^}]*\bmotion\b[^}]*\}\s*from\s*['"]framer-motion['"]` (does NOT flag `m`, `AnimatePresence`, `MotionConfig`, `LazyMotion`).
    - `from\s+['"]clsx['"]` — forbidden; use `classNames` from `primereact/utils`.
    - Bare `lucide-react`, `react-icons`, `@heroicons/`, `@fortawesome/` — forbidden icon libraries; the project uses PrimeIcons + Figma-sourced assets.
    Report each match with `path:line`.

35. **Raw `<a>` for internal routes**: grep `src/screens/`, `src/components/`, `src/layouts/` with multiline regex `<a\s+(?:[^>]*?\s)?href\s*=\s*['"]/`. Each match is an `<a>` whose `href` starts with `/` — an internal route. Internal navigation must use `next/link` (`<Link href='/...'>`) or `CustomButton` with the `href` prop. Allowed exceptions: the SkipToContent anchor in the root layout (`<a href='#main'>`) — its `href` starts with `#`, so the regex above naturally excludes it. Report each match.

36. **`container-custom` on every top-level `<section>` of a screen**: read each `src/screens/**/*.tsx` and walk its JSX tree to find top-level `<section>` elements (direct children of `<main>`, or wrapped in a `<>` fragment that's the direct child of `<main>`). For each top-level `<section>`:
    - **Pattern A — section without full-bleed background**: the `<section>` itself must include `container-custom` in its `className`.
    - **Pattern B — section with full-bleed background**: the `<section>` does NOT need `container-custom`, but its FIRST direct child element (typically a `<div>`) must include `container-custom`.

    Static parsing of this rule is non-trivial — use a best-effort grep: for each `src/screens/**/*.tsx`, find every `<section` opening tag inside `<main id='main'>...</main>`. For each, check whether its className OR the className of its very next opening tag (the first child) contains `container-custom`. If neither does, flag it.

    The rule is also documented as forbidden: `max-w-[Xpx]`, `max-w-7xl`, or arbitrary `px-N` on top-level sections — those are usually translation drift from Figma's absolute frame width. Grep `<section[^>]*\bmax-w-\[` and `<section[^>]*\bmax-w-7xl` in `src/screens/` and flag separately as "section uses hardcoded max-width instead of container-custom".

37. **Per-section vertical padding**: same parse of top-level `<section>`s — for each, check whether the className contains a vertical-padding utility (`py-`, `pt-`, `pb-`, or an arbitrary `py-[...]`). If neither the section nor its first child has any, flag it as "section without vertical rhythm — translate `py-*` from Figma; `container-custom` does not provide vertical spacing."

38. **Global-only modals mounted inside components**: grep `src/components/` (excluding `src/components/modals/`) and `src/screens/` for `<LoadingModal`, `<StateModal`, `<ToastNotifications`. Background:
    - `LoadingModal` belongs in LAYOUTS (per-layout scope) — finding it in a component file means it's been double-mounted.
    - `StateModal` + `ToastNotifications` belong ONLY in `src/providers/ModalsProvider.tsx`. Any other mount duplicates the listener and causes double-overlay bugs.
    Flag every match outside the expected places.

39. **Informative icon override without an accessible name**: the icons in `src/assets/icons/*.tsx` ship with `aria-hidden='true' focusable='false'` by default — they're decorative-by-default. A consumer that wants the icon itself to convey meaning (not just decorate a button label) must override with `aria-hidden={false}`. That override only makes sense when paired with EITHER visible text describing the icon OR an explicit `aria-label` on the icon. Without one, the icon is `aria-hidden={false}` but the screen reader has nothing to announce.

    **Scope vs Step 12 — these don't double-report**:
    - **Step 12** fires when an icon-only button has no `aria-label` on the BUTTON (the common case — icon is decorative, button needs the name).
    - **Step 39** fires when an icon overrides `aria-hidden={false}` without its own `aria-label` or visible text neighbor (the rarer case — icon is meant to be informative but has no accessible name).
    A single offending JSX node will trip at most one of these, not both. Step 12 looks at the PARENT button; Step 39 looks at the ICON override.

    Grep `src/screens/`, `src/components/`, `src/layouts/` for `*Icon` JSX elements that include `aria-hidden={false}` or `aria-hidden='false'`. For each match, verify the icon has its own `aria-label`, OR that the icon sits next to visible text describing it. Flag matches that have neither.

### 12. Mock data convention

40. **Mock data without canonical marker**: `figma-screen` writes inline mock arrays as `const MOCK_{KIND}` at the top of the screen file when the data layer hasn't been wired yet. The convention exists so deployed mocks are visible at a glance and the `openapi-import` flow can grep them to swap with real `customFetch` calls. Two sub-checks:

    1. **Array-shaped constants in `src/screens/**/*.tsx`**: grep for top-level `const \w+ = \[` (array literal initializer at module scope, NOT inside a function/component body). For each match, verify either:
       - The constant name matches `MOCK_[A-Z_]+` (correct convention), OR
       - The array is consumed via `useSWR` / `customFetch` / an import from `@/api/*` somewhere in the same file (real data, not a mock).

       Flag every match that is neither — those are unmarked mocks that bypassed the convention and will not be caught by future `openapi-import` runs.

    2. **`MOCK_*` without TODO comment**: for every `MOCK_*` match from check 1, verify there is a `// TODO` comment within the 3 lines preceding the declaration mentioning either `openapi-import` or `API call` or `endpoint`. The marker tells future-you (or the `openapi-import` flow) what endpoint should replace the mock. A `MOCK_*` without a TODO is a deployment time bomb — the data looks real in dev and someone forgets it's mock when shipping.

    Report findings as:

    ```
    MOCK_CONVENTION_VIOLATION: src/screens/X/X.tsx:NN — const NAME = [...] (not following MOCK_{KIND} naming and not API-wired)
    MOCK_MISSING_TODO: src/screens/X/X.tsx:NN — MOCK_KIND declared without `// TODO: replace with API call once openapi-import has run for {endpoint}`
    ```

    Static parsing of "top-level constant" is non-trivial (a JSX file mixes module-scope and function-scope declarations). A best-effort heuristic: `const NAME = [` at column 0 (no leading indent) is module-scope; anything indented is inside a function or block. Flag the column-0 cases.

## Hard rules
- **Report only, never fix** — unless the parent explicitly asks to fix a specific category.
- **Group findings by category** (the section headers above) and use `path:line` references so the user can click to navigate.
- For each category, count the violations: zero → mark "✅ clean", non-zero → list every offender.
- The grep patterns above are starting points — if a pattern produces obvious false positives, refine it (e.g. exclude vendor or generated files) and note the refinement in the report.
- If a step is not applicable (e.g. no dynamic routes exist in the project yet), mark it "n/a" and move on.

## Output to parent

Single structured report. Format:

<!-- The `model=haiku` literal in the footer below must match the `model:` value in this agent's frontmatter. The orchestrator re-reads the frontmatter for its cost ledger (the footer string is just for the human reader), so a drift here doesn't poison telemetry — but a drift is confusing. If the frontmatter model changes, update the footer literal in the same commit. -->

```
## Validation summary

### Commands
✅ Lint, type-check

### SEO completeness
✅ canonical, generateMetadata for dynamic routes, no nocache, html lang, og locale
❌ Full metadata: src/app/foo/page.tsx — missing `description`, `openGraph`, `twitter`

### Accessibility
✅ Heading hierarchy, viewport zoom, no nested main, autoComplete, clickable non-button
❌ Icon-only buttons: src/components/Bar/Bar.tsx:25 — <button> with `pi pi-times`, no `aria-label`
❌ External links: src/components/Footer/Footer.tsx:42 — `target='_blank'` without `rel='noopener noreferrer'`

### Image performance
✅ alt, unoptimized, dual-image sizes
❌ `<Image fill>` without `sizes`: src/screens/HomePage/HomePage.tsx:88 (hero)
❌ `priority` without `fetchPriority`: src/screens/HomePage/HomePage.tsx:88
❌ Unconditional `priority` in map: src/screens/HomePage/HomePage.tsx:142 — gate with `index < N`

### Font loading
✅ No googleapis @import, no literal font-family, icon-font override in place

### Bundle architecture
✅ No client layouts, no beforeInteractive scripts, no global-only modals
❌ `fetch` without cache policy: src/api/products.ts:14

### Tokens & Typography
✅ No raw hex, no forbidden utilities

### Project import & convention compliance
✅ No `motion` import, no `clsx`, no forbidden icon libs
❌ Raw `<a href='/dashboard'>`: src/screens/HomePage/HomePage.tsx:104 — replace with `<Link>` or `<CustomButton href>`
❌ Section without `container-custom`: src/screens/ContactPage/ContactPage.tsx:18 — top-level `<section>` uses `max-w-7xl`; replace with `container-custom`
❌ Section without vertical padding: src/screens/ContactPage/ContactPage.tsx:42 — add `py-*` from Figma
❌ Component mounts global modal: src/components/Hero/Hero.tsx:88 — `<LoadingModal/>` belongs in layouts, not components

## Recommendations (suggested fixers)
- Hero image: add `sizes='100vw'` + `fetchPriority='high'` on HomePage.tsx:88. → `figma-screen` (HomePage)
- Icon button: add `aria-label='Close'` on Bar.tsx:25. → `figma-components` (Bar)
- External link: add `rel='noopener noreferrer'` on Footer.tsx:42. → `figma-components` (Footer)
- Server fetch: set `next: { revalidate: N }` or `cache: 'no-store'` on products.ts:14. → manual fix
- Page metadata: extend foo/page.tsx with `description`, `openGraph`, `twitter`. → `figma-scaffold` or manual

---
Workload: model=haiku, tool_calls≈{N}, files_touched=0
Validation: lint=✅/❌, type-check=✅/❌
Notes: {one-line count summary, e.g. "9 categories scanned, 5 clean, 4 with findings (3 a11y + 1 image perf), 7 violations total"}
```

Map each violation to the agent best suited to fix it so the parent can re-delegate without thinking. If a fix doesn't map cleanly to a sub-agent, label it "manual".

`files_touched=0` is fixed because this agent only reads; if the parent ever invokes it with `--fix`, increment per file actually modified.
