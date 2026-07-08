---
name: claude-design-import
description: Orchestrates the bottom-up import of a full Claude Design prototype (a Standalone HTML export) into this codebase — unpack → inventory → tokens → assets → components → layouts → screens → validation. A local deterministic extractor (unpack.mjs) replaces Figma's MCP calls, so the design context is read from disk for free. Delegates each step to a dedicated sub-agent in `.claude/agents/claude-design/` at the right model tier. Invoke when translating a whole Claude Design prototype to code, NOT for one-off tweaks.
---

Import a Claude Design prototype end-to-end following the project's bottom-up workflow. Arguments: **$ARGUMENTS**

**REQUIRED**: a **URL to a Claude Design "Standalone HTML" export** (e.g. an S3/hosted `.html`). The whole prototype lives in that one self-contained file — every step depends on seeing the entire design at once, and `unpack.mjs` extracts it locally.

If the argument is missing OR is not a URL to an `.html` export, STOP and ask the user:

> Necesito la **URL al export "Standalone HTML"** del prototipo de Claude Design (ej. el link de S3 que te da el botón Export → Standalone HTML). Pegámela y arranco. No sirven el PDF/PPTX ni el handoff a Claude Code — esos no son fuente de código para este flujo.

Do not proceed past Step 0 without a successful unpack — a partial/failed extraction makes every downstream step wrong.

## Pre-flight — Read CONVENTIONS.md (mandatory)

Before delegating to any sub-agent, `Read` [`.claude/CONVENTIONS.md`](../../CONVENTIONS.md). As the orchestrator you need it for two purposes:

1. **Gap analysis (Step 0.5)** — the [Existing Reusable Components](../../CONVENTIONS.md#existing-reusable-components) table is the authoritative reuse list. [Color System](../../CONVENTIONS.md#color-system), [Typography System](../../CONVENTIONS.md#typography-system) and [Breakpoints](../../CONVENTIONS.md#breakpoints) define what already ships vs what's new.
2. **STOP protocol handling** — every sub-agent may emit `STOP-BLOCKING` / `STOP-ADVISORY` per the [STOP Protocol](../../CONVENTIONS.md#stop-protocol). You parse and route them (see "Handling agent STOPs").

If `CONVENTIONS.md` is missing, STOP the whole flow — every sub-agent depends on it.

Also read `design-tokens-map.md` (project root, shared with `figma-design-import`; may not exist yet) BEFORE proposing tokens, so a variable already mapped by a prior import is reused, not duplicated.

---

## What a Claude Design export actually is (read once)

The "Standalone HTML" export is **not** flat HTML — it's a self-contained React SPA in a private `__bundler` format: a `manifest` (base64 assets + fonts + gzip'd JS/JSX source keyed by UUID), an `ext_resources` alias map, and a `template` (the real inner HTML as a JSON string). Components are written as React with **inline `style={{}}` objects + CSS custom properties** (a `THEMES` token object drives them), a **custom stack router** (`window.HOST`/`window.GUEST` registries keyed by screen name, `HOST_TABS` for the bottom tab bar), and **prop-drilled state** with inline mock data. Most prototypes are **mobile-app shaped** (≈430px phone frame, iOS chrome).

`unpack.mjs` turns all of that into a clean working tree you read from disk — no per-node token cost, unlike Figma's MCP.

---

## Workload tracking (cost telemetry across the flow)

Maintain a running ledger of every sub-agent invocation. After each delegation returns, append a row:

```
| Step | Sub-agent | Model | Duration | Tool calls | Tokens≈ | Notes |
|------|-----------|-------|----------|------------|---------|-------|
| 1 | claude-design-tokens | Haiku | 10s | ≈5 | ≈8k | 7 colors + 3 sizes added |
```

**Estimating `Tokens≈`** — use tool-call count as a proxy (calibrate as you go): Haiku ≈1.5k/call, Sonnet ≈3k/call, Opus ≈4k/call. There is **no MCP surcharge** here (unlike Figma) — the design context is local files, so per-screen cost is dominated by Reads of the extracted JSX, not heavy MCP responses.

Each sub-agent ends its `Output to parent` with the standardized footer:

```
---
Workload: model={haiku|sonnet|opus}, tool_calls≈{N}, files_touched={M}
Validation: lint=✅/❌, type-check=✅/❌
Notes: {one-line count summary}
```

- `Model` ← **read from the sub-agent's frontmatter** in `.claude/agents/claude-design/{name}.md` (source of truth; the footer string can drift).
- `Duration` ← measured by you from wall-clock between the `Agent(...)` call and its return.
- `Tool calls` / `Notes` ← from the footer.
- `Tokens≈` ← computed by you from `tool_calls × model_factor`.

**Show the ledger at every checkpoint** (end of 0.5, end of 5.1, between each 5.2 screen, end of 6) with a cumulative sum + per-model breakdown, so the trajectory is inspectable and the user can pause before the Opus-heavy Step 5.2 creeps up.

---

## How this skill manages models automatically

You (the parent, typically Opus) are the **orchestrator**. You run Steps 0 and 0.5 directly (extraction + holistic judgment); every other step is delegated via the `Agent` tool to a sub-agent in `.claude/agents/claude-design/`, each with its model pre-set, running in isolated context and returning only a summary.

| Step | Sub-agent | Model | Why this model |
|------|-----------|-------|----------------|
| 0 | `unpack.mjs` (you run it) | — | Deterministic script, no LLM |
| 0.5 | (you, the parent) | Opus | Holistic judgment + checkpoint with user |
| 1 | `claude-design-tokens` | Haiku | Mechanical config edits |
| 2 | `claude-design-assets` | Haiku | Decode base64 + boilerplate |
| 3 | `claude-design-components` | Opus | Component API design, extend-vs-create |
| 4 | `claude-design-layouts` | Sonnet | Moderate decisions, known patterns |
| 5.1 | `claude-design-scaffold` | Haiku | Mechanical `/new-screen` + `/new-store` |
| 5.2 | `claude-design-screen` | Opus | Highest-fidelity re-styling + responsive |
| 6 | `design-validation` | Haiku | Run commands + report (shared agent) |

**Always pass enough context** in each delegation — sub-agents start fresh. Above all, pass the **path to the unpacked working tree** and the **specific extracted file(s)** each agent needs (its source of truth), plus decisions already made.

---

## Why this flow exists

Implementing a prototype top-down (screen-first) leads to hardcoded hex/px (tokens not in `tailwind.config.js` yet), duplicated components (existing `src/components/` not checked), repeated chrome (layouts not decided first), and refactor passes. Bottom-up prevents all of that. **Do not skip steps.**

---

## Step 0 — Unpack the export (deterministic, no LLM)

Run the extractor. Pick a scratch output directory **outside** the repo `src/` tree (the session scratchpad, or a temp dir) — never write the raw dump into the project.

```bash
node .claude/skills/orchestrators/claude-design-import/unpack.mjs "<EXPORT_URL>" "<SCRATCH_DIR>/unpacked"
```

It writes: `template.html`, `jsx/*` (component source), `assets/img/*` (decoded images), `fonts.json`, `tokens.json`, `nav-graph.json`, `components.json`, and `inventory.json`.

**Read `inventory.json` first** — it is your map for Step 0.5 (`flavor`, `targetSignals`, counts, `registries`, `screens` — **one entry per registry KEY**, with `key`/`component`/`role`/`file`, `jsxFiles`/`images` with `uuid`, `fontFamilies` (superset) + `brandFonts` (the fonts actually used at runtime — load THESE), `brand`, `tokenNamespaces`).

**Flavor gate:** if `inventory.flavor !== 'babel-inline'`, surface it — the fully-supported case is `babel-inline` (React + Babel runtime, inline styles). For `react` / `next` / `vanilla` exports, tell the user the extraction may be partial and proceed with extra care (the structured artifacts may be thinner). If `unpack.mjs` exits non-zero (missing `__bundler` blocks), STOP and report — likely a non-standard export or a format change.

---

## Step 0.5 — Inventory & gap analysis

> **Run directly** (no delegation). The architectural pass — needs Opus and full visibility.

Read the extracted artifacts AND the codebase, then produce a written gap-analysis report **in chat** (not a `.md` file unless asked).

1. **Design context** — read `inventory.json`, `tokens.json`, `nav-graph.json`, `components.json`, and skim the relevant `jsx/*` files (the App/entry file for state + routing, the primitives file for components, a few screen files for copy/patterns).
2. **Codebase context** — `tailwind.config.js`, `design-tokens-map.md`, `src/styles/index.sass`, `src/components/` (Glob folders, cross-ref the CONVENTIONS reuse table), `src/layouts/`, `src/stores/`, `src/proxy.ts`, `src/assets/icons/index.ts`.
3. **Produce the report:**

```markdown
## Target  (D5 — detect per prototype)
- Signals: {iosChrome, phoneFrameMaxWidth, bottom tabs, maxWidths seen} from inventory.targetSignals
- Decision: `mobile-app` | `web` — with reasoning. Drives Step 5.2 responsive strategy.

## Tokens
- Brand preset: `{brand}` from tokens.json (THEMES[brand]) — the canonical palette/typography.
- Already mapped (design-tokens-map.md): [`figmaVar/themeKey` → `tailwindToken`]
- Add: [new colors (hex), typography sizes, breakpoints the tokens agent should REUSE/CREATE/BLOCK]
- Fonts: [from `inventory.brandFonts` — the brand preset's actual runtime fonts] → next/font/google. Do NOT pass `inventory.fontFamilies` (that lists every embedded `@font-face` — a superset covering all THEMES presets, most of which are dead at runtime; loading them all is a bundle/LCP regression).
- **Warnings**: any proposed token that would override `surface-*` or an existing token — flag it.

## Assets
- Images (from inventory.images): [file, alias, uuid] → convert to WebP; per-screen vs shared.
- Icons: the `Icon` component's named glyphs → split into individual React icon components.
- Pre-filter: icons covered by PrimeIcons → note `→ pi pi-{name}`, do NOT pass to the assets agent.

## Components (each with its SOURCE JSX FILE — mandatory)
Every primitive to extend/create MUST cite its source file in the unpacked tree (e.g. `jsx/03_display.jsx`).
This is the equivalent of Figma's nodeId gate — claude-design-components reads the real JSX, never prose.
- Extend existing:
  - `CustomButton` ← `Btn` in `jsx/03_display.jsx` (variants: primary/accent/outline/ghost/soft)
- Create new:
  - `{Name}` ← `{Fn}` in `jsx/NN_*.jsx`
- Reuse as-is: [list]

## State / Stores  (D6 — Zustand vs mock)
**Derive the full store shape HERE, up front** (analogous to deriving component primitives) — do NOT leave it for Step 5.2 to discover piecemeal across isolated per-screen contexts (that produces divergent store APIs). Read the App/entry file's centralized state and reducers, then for each Zustand store to create, specify its COMPLETE shape:
- **State fields** (e.g. `gifts`, `contribs`, `cart`, `draft`).
- **Actions — including cross-entity reducers no single screen owns** (e.g. `addContribution` mutates `gifts` AND `contribs` atomically; `confirmContribution` recomputes both). These are exactly what gets lost if left to per-screen discovery.
- Which screens consume which store.
Pass this store spec to Step 5.1 (scaffold creates each store WITH this full shape) and Step 5.2 (screens consume it, never redefine it). Demo/filler data (EVENT, GUESTS, GIFTS…) → inline `MOCK_*` in screens (data layer deferred to openapi-import), NEVER in stores.

## Layouts
- Chrome detected: TopBar / BottomTabBar (HOST_TABS) / iOS status bar.
- Roles: host / guest → route groups + protected/public.
- Existing match vs to-create.

## Screens — hybrid nav mapping  (D6)
Classify every registry screen (from nav-graph) as route | step | modal | skip:
- **route** — first-level destination → `src/app/**/page.tsx` + screen. Give: name, type (auth|public|protected), route, role, source file, AND **`component`** (the function name from `inventory.screens[].component` — REQUIRED; several screens share one file, and Step 5.2 must know which function to implement). If two keys map to the same component (e.g. `playlist` + `postboda` → `ContentHub`), keep BOTH routes and render the shared component in each (route-group/param disambiguates) — do not drop either.
- **step** — sub-step of a wizard/flow (onboarding HOb*, gift pay steps) → internal stepper state inside the flow's anchor route. Group them under their route.
- **modal** — overlay (cart, confirmations) → `/new-modal`.
- **skip** — demo chrome not portable (FlowMenu, role switcher, IOSDevice).
Authoritative list = **every registry key** in `inventory.screens` / `inventory.registries` — classify each into exactly one bucket. `nav-graph.transitions` is only a PARTIAL hint: it captures literal `go('x')` calls but NOT data-driven nav (`go(item.screen)`) or tab nav, so it under-reports (≈30 of GIVXO's 42 keys). Do NOT use `transitions` as the complete screen list — the registries are the source of truth.

## Detected language
- Sample visible strings from screen JSX (`characters`/JSX text). Decision `en`|`es` + reasoning.
- Current `<html lang>` in `src/app/layout.tsx`: {value}. Flag if it must switch.
```

**Language heuristic**: same as the project standard — Spanish-leaning if strings contain `ñ`, accents, or words like `iniciar/comenzar/nuevo/usuario/comprar/requerido`. ≥50% Spanish → `es`, else `en`; default `en` on tie.

4. **Stop and confirm with the user.** They must approve the plan AND the screen classification (route/step/modal/skip) before any code is written. This is the most important checkpoint — Step 5.2 uses these decisions automatically, so a wrong classification here is caught cheaply now.

---

## Step 1 — Tokens

> **Delegate to**: `Agent({ subagent_type: 'claude-design-tokens' })` — **Haiku**.

Pass: the brand preset object from `tokens.json` (colors + typography), the loose hex/size list from `rawScan`, and the **brand fonts** (`inventory.brandFonts`, not the full `fontFamilies` superset). The agent applies REUSE/CREATE/BLOCK against `tailwind.config.js` + `design-tokens-map.md`, loads fonts via `next/font/google` in `layout.tsx`, updates `general.sass`, runs `type-check`.

---

## Step 2 — Assets

> **Delegate to**: `Agent({ subagent_type: 'claude-design-assets' })` — **Haiku**.

Pass: the path to `assets/img/*` + `inventory.images` (file, uuid, alias, mime, and `screenSlug` when per-screen), and the `Icon` glyph list to split into React icon components. The agent converts raster → WebP (ffmpeg), builds icon components (`GmailIcon.tsx` pattern), registers `src/assets/icons/index.ts`, writes `.hash.txt` siblings. You pre-filter PrimeIcons before delegating.

---

## Step 3 — Components

> **Delegate to**: `Agent({ subagent_type: 'claude-design-components' })` — **Opus**.

Pass: the extend list + create list, **each with its source JSX file** in the unpacked tree, plus the token names added in Step 1. The agent reads the real JSX source per primitive (the gate against prose-driven errors — inline `style={{}}` variants are explicit in the code), reads existing `.tsx`/`.sass`, greps usages, extends/creates per conventions, validates each. If any component lacks a source file reference, the agent refuses — resolve it in Step 0.5.

---

## Step 4 — Layouts

> **Delegate to**: `Agent({ subagent_type: 'claude-design-layouts' })` — **Sonnet**.

Pass: current `src/layouts/` state, the chrome findings (TopBar/BottomTabBar/iOS status bar), the host/guest roles, and the `target`. The agent creates/adjusts layouts, wires route groups, and translates or drops mobile chrome per target (a bottom tab bar becomes a top navbar on `web`, stays a bottom nav on `mobile-app`). It composes existing components, never duplicates JSX.

---

## Step 5 — Screens + routing

### 5.1 — Scaffold all `route` screens + stores

> **Delegate to**: `Agent({ subagent_type: 'claude-design-scaffold' })` — **Haiku**.

Before delegating, read `src/app/layout.tsx` and extract the current `<html lang>` (pass as `currentHtmlLang`). Pass: for each **route** screen — `screenName`, `screenType` (auth|public|protected), `route`, `routeGroup`, `role`; the Zustand `stores` to create; batch-level `detectedLanguage` + `currentHtmlLang`. The agent runs `/new-screen` per route (placeholder in the right language), `/new-store` per store, updates `src/proxy.ts`, switches `<html lang>`/`openGraph.locale` if needed. **Only `route` screens are scaffolded — `step`/`modal` are not routes.**

After this step, **commit the scaffold as a checkpoint**.

### 5.2 — Per-screen implementation (sequential auto with per-screen checkpoint)

> **Delegate to**: `Agent({ subagent_type: 'claude-design-screen' })` — **Opus**, one invocation per route screen, sequential.

Because the design context is local files, cost is far lower than Figma's per-screen MCP pulls — but this is still the heaviest Opus step. Walk the approved route list one screen at a time.

**Standard prompt for each invocation:**

```
Screen name: {Name}Page
Screen type: {auth|public|protected}
Screen slug: {kebab-case}
Source JSX: {unpacked}/jsx/NN_*.jsx  (the file — it may contain several screens + helpers)
Screen component: {FunctionName}     # from inventory.screens[].component — WHICH function in that file IS this screen (REQUIRED; the agent STOPs without it)
Absorbed steps: [{stepScreenKey → component}, ...]   # wizard sub-steps to implement as internal stepper
Store spec: {store name → {state fields, actions}}   # from Step 0.5 — the screen consumes these, never redefines them
Local modals: [{modalScreenKey → component}, ...]     # implement as screen-local modals / /new-modal
Target: {mobile-app|web}                              # drives responsive synthesis
Detected language: {en|es}
Images: {unpacked}/assets/img/  (dedup by hash, convert to WebP under src/assets/images/{slug}/)
Existing components to reuse: [{Component} → path, ...]   # from Step 3
Tokens available: [list from Step 1]
Container rule: every top-level <section> anchored with `container-custom` (16px built-in gutter — no px-* on the same element); keep per-section py-* from the design. Ignore the prototype's fixed 430px frame width.
Adjustment notes (only on re-runs): {text}
```

The screen agent re-styles the inline `style={{}}` source into Tailwind + tokens + `container-custom` + BEM, reuses components, wires forms to Formik+Yup, animates with `m`, keeps mock data as `MOCK_*`, absorbs `step`s as an internal stepper, mounts local modals, and **synthesizes responsive per `target`** (`web` → full desktop+mobile; `mobile-app` → mobile-first fidelity + conservative desktop centering).

**Per-screen checkpoint (post after each return):**

```
✅ {Name}Page implementada ({images_count} imágenes, {duration})
   Ruta: /{path}   ·   Archivos: src/screens/{Name}Page/, src/assets/images/{slug}/
   {if steps absorbed: "Incluye stepper interno: {step list}"}

¿Ajustes para {Name}Page o seguimos con {NextName}Page?
  • Pegá instrucciones específicas para refinarla
  • "siguiente" / Enter para continuar   • "saltá esta" para skipear   • "parar" para pausar
```

Branch on the reply exactly like the figma flow (empty/"siguiente"→next; free text→re-delegate same screen with notes; "parar"→halt with resume hint; "saltá esta"→skip). On subagent failure, surface the error in the checkpoint and ask retry/skip/stop — never silently move on.

**Cumulative final report** when the batch ends (✅/⏭️ per screen + `pnpm start` routes to try).

---

## Step 6 — Code validation

> **Delegate to**: `Agent({ subagent_type: 'design-validation' })` — **Haiku**. Pass `importFlow: 'claude-design-import'` so it names `claude-design-*` agents in the suggested-fixers mapping. This is the **shared** validation agent (also used by `figma-design-import`); it includes source-import leak checks (untranslated inline styles, leaked prototype CSS vars, stack-router remnants).

Final automated code sweep only (visual review is the developer's job via the 5.2 checkpoints). Pass scope (or empty for full sweep). The agent runs `pnpm run lint-check --fix`, `pnpm run type-check`, plus structural checks (SEO metadata, heading hierarchy, a11y on clickable non-buttons, raw-hex compliance, typography compliance). Returns a categorized report with `path:line`. Don't auto-fix — surface and offer to delegate to the relevant agent.

---

## Handling agent STOPs

Every sub-agent may emit a STOP per the [STOP Protocol](../../CONVENTIONS.md#stop-protocol). Parse and route them:

- **`STOP-BLOCKING`** — the agent could not complete; resolve before re-invoking. Route by `next_agent`:

| `next_agent` | What to do |
| --- | --- |
| `claude-design-tokens` | Delegate to tokens with the `details:` payload, then re-invoke the original agent. |
| `claude-design-components` | Delegate to components with the missing variant's source JSX file, then re-invoke. |
| `claude-design-layouts` | Delegate to layouts with the decision, then re-invoke. |
| `user_decision` | Stop the batch, surface the exact `reason:`/`resolution:`, wait for the user. |
| `manual` | Stop and ask the user (common: re-invoke with corrected input). |

- **`STOP-ADVISORY`** — the agent completed with a documented default (`default_applied:`). Continue, but surface it in the next checkpoint so the user can request a post-batch refactor.

Malformed STOP → treat as `STOP-BLOCKING / INVALID_INPUT` and surface; never silently retry. Each STOP contributes a ledger row quoting category + severity.

---

## Anti-patterns (do NOT do this)

- ❌ Accept anything other than a Standalone-HTML URL (PDF/PPTX/handoff are not code sources here).
- ❌ Skip Step 0/0.5 and "just start with the screens".
- ❌ Run a step yourself when there's a sub-agent for it — waste of Opus on Haiku-grade work.
- ❌ Dump the unpacked tree into the repo `src/` — extract to a scratch dir; only generated code lands in `src/`.
- ❌ Translate the prototype's inline `style={{}}` hex/px literally — always tokens + Tailwind; hardcoded hex is banned.
- ❌ Translate the fixed 430px frame width / per-section padding-x literally — anchor every `<section>` with `container-custom` (horizontal only; keep per-section `py-*`).
- ❌ Create one route per `step` screen — wizard sub-steps are internal stepper state inside the flow's route (D6 hybrid).
- ❌ Re-embed the woff2 fonts from the manifest — fonts are Google Fonts, loaded via `next/font/google` by name.
- ❌ Port iOS chrome (status bar, home indicator, `IOSDevice`) literally — it's demo framing, not product UI.
- ❌ Pass a component to `claude-design-components` without its source JSX file — prose-only specs produce wrong-but-plausible output; the real inline-style source is the gate.
- ❌ Add `customFetch`/SWR/`src/api/*` in screens — data is out of scope; use `MOCK_*` + a `// TODO: openapi-import` comment. The separate `openapi-import` flow owns the data layer.
- ❌ Import `motion` (use `m` + `LazyMotion`), `clsx` (use `classNames` from `primereact/utils`), or raw `<a>` for internal routes (use `next/link`/`CustomButton`).
- ❌ Wait for user input BEFORE each Step 5.2 screen — auto-delegate from the approved list, checkpoint AFTER each.
- ❌ Silently continue after a sub-agent fails — surface in the checkpoint, offer retry/skip/stop.

---

## Quick reference

| Step | What | Sub-agent | Model | Input from parent |
|------|------|-----------|-------|--------------------|
| 0 | Unpack | `unpack.mjs` | — | **Export URL** + scratch outDir |
| 0.5 | Inventory & gap analysis | (parent) | Opus | The unpacked artifacts |
| 1 | Tokens | `claude-design-tokens` | Haiku | Brand preset + rawScan hex/sizes + fonts |
| 2 | Assets | `claude-design-assets` | Haiku | `assets/img/*` + `inventory.images` + `Icon` glyph list |
| 3 | Components | `claude-design-components` | Opus | Extend/create list, each with **source JSX file** + token names |
| 4 | Layouts | `claude-design-layouts` | Sonnet | Layouts state + chrome findings + roles + target |
| 5.1 | Scaffold routes + stores | `claude-design-scaffold` | Haiku | `route` screens (name, type, route, group, role, **component**) + store specs (full shape) + language |
| 5.2 | Per-screen (sequential + checkpoint) | `claude-design-screen` | Opus | Per-screen: name, type, slug, **source JSX + component**, absorbed steps, modals, target, language, reuse list, store spec |
| 6 | Validation | `design-validation` | Haiku | Scope (or empty) + `importFlow: 'claude-design-import'` |
