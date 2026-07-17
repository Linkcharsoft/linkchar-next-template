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

Before delegating to any sub-agent, `Read` [`.claude/CONVENTIONS.md`](../../../CONVENTIONS.md). As the orchestrator you need it for two purposes:

1. **Gap analysis (Step 0.5)** — the [Existing Reusable Components](../../../CONVENTIONS.md#existing-reusable-components) table is the authoritative reuse list. [Color System](../../../CONVENTIONS.md#color-system), [Typography System](../../../CONVENTIONS.md#typography-system) and [Breakpoints](../../../CONVENTIONS.md#breakpoints) define what already ships vs what's new.
2. **STOP protocol handling** — every sub-agent may emit `STOP-BLOCKING` / `STOP-ADVISORY` per the [STOP Protocol](../../../CONVENTIONS.md#stop-protocol). You parse and route them (see "Handling agent STOPs").

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
| Step | Sub-agent | Model | Duration | Tool calls | Tokens | Notes |
|------|-----------|-------|----------|------------|--------|-------|
| 1 | claude-design-tokens | Haiku | 10s | 5 | 8k | 7 colors + 3 sizes added |
```

**`Tokens`, `Tool calls` and `Duration` are REPORTED BY THE HARNESS — never estimate them.** The result of every `Agent(...)` call ends with a `<usage>` block carrying the exact figures:

```
<usage>subagent_tokens: 70655   tool_uses: 22   duration_ms: 392235</usage>
```

Read `subagent_tokens` → `Tokens`, `tool_uses` → `Tool calls`, `duration_ms` → `Duration`. Measured, not modelled — do NOT derive them from `tool_calls × model_factor`. (A per-tool-call heuristic lived here historically; measured runs put it 2–3× low, so it's gone. If a `<usage>` block is ever missing, report `Tokens: n/a` rather than inventing a number.) Round to two significant figures (`85k`, not `85,124`).

Each sub-agent ends its `Output to parent` with the standardized footer:

```
---
Workload: model={haiku|sonnet|opus}, tool_calls≈{N}, files_touched={M}
Validation: lint=✅/❌, type-check=✅/❌
Notes: {one-line count summary}
```

- `Model` ← **read from the sub-agent's frontmatter** in `.claude/agents/claude-design/{name}.md` (source of truth; the footer string can drift). The one exception is Step 0.55's `general-purpose`, a builtin with no file under `.claude/agents/` — record the model you actually passed it.
- `Duration` / `Tool calls` / `Tokens` ← the `<usage>` block of the `Agent(...)` result (above). The footer's `tool_calls≈` is the agent's own count — ignore it for the ledger; `<usage>` wins.
- `Notes` / `Validation` ← from the footer.

**Show the ledger at every checkpoint from 5.1 onward** (end of 5.1, between each 5.2 screen, end of 6) with a cumulative sum + per-model breakdown, so the trajectory is inspectable and the user can pause before the Opus-heavy Step 5.2 creeps up. (Not at the end of 0.5 — nothing has been delegated yet, so the ledger is empty.)

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

It writes: `source/*` (component source — babel: `source/jsx/*.jsx`; dclogic: `source/{screen}.markup.html` + `source/{screen}.logic.js` + `source/{screen}.helmet.css`; vanilla: `source/index.markup.html`), `assets/img/*` (decoded images), `fonts.json`, `tokens.json` (incl. `rawScan.clusters` — the B2 colour pre-grouping), `nav-graph.json`, `components.json`, and `inventory.json`.

> **The dclogic CSS lives in `source/{screen}.helmet.css`, and ONLY there.** The `<helmet>` carries the design's real stylesheet — its `@media` breakpoints, `@font-face`, CSS vars — and `{screen}.markup.html` has it stripped out (0 `@media`), so never look for a breakpoint in the markup. `template.html` is a convenience copy of the whole export, written for **babel and single-page dclogic only** — it does NOT exist for multi-page dclogic or vanilla, so read `source/*.helmet.css` rather than relying on it. (`inventory.screens[].file` points at the right source file for each screen — always use that, never a hardcoded path.)

**Read `inventory.json` first** — your map for Step 0.5: `format` (babel|dclogic|vanilla), `navModel` (screen-registry|single-page-sections|multi-page|single-page), `tokenSource` (themes-object|inline+helmet|inline+css), `targetSignals` (with a mobile-app|web `guess`), counts, `screens` (the authoritative list — each `key`/`component`/`role`/`file`; babel = one per registry KEY, dclogic multi-page = one per page, dclogic single-page = one per section), `components`, `brandFonts` (`{body, display, families}` — load `families`, preload `body`), `fontFamilies` (superset), `images` with `uuid`, `brand`, `tokenNamespaces`, `registries`/`tabs` (babel only), and `notes` (**READ THESE** — they carry per-format orchestration guidance the parser inferred).

**Format handling (read `inventory.format`).** `unpack.mjs` normalizes 3 flavors into the SAME IR:
- `babel` — React SPA (GIVXO). **Fully supported end-to-end.**
- `dclogic` — Claude Design's native `.dc.html` (`<x-dc>` markup + `class Component extends DCLogic` + `<helmet>`); `navModel` = `single-page-sections` or `multi-page`; `tokenSource` = `inline+helmet`; no `THEMES` (tokens from inline styles + `<helmet>`).
- `vanilla` — plain HTML/CSS/JS (best-effort; no reference sample — treat with care).

> **Implementation status.** `babel` (React) and `dclogic` **single-page-sections** (declarative — `state`/`renderVals()`/`{{holes}}`/`sc-if`, e.g. Hologramas) are wired **end-to-end**. `dclogic` **multi-page**: the shared-chrome **layout**, static structure, tokens and `style-hover` ARE wired — **but imperative interactivity is NOT yet translated.** A `.logic.js` built on `componentDidMount` + `querySelector`/`addEventListener`/`IntersectionObserver`/`setInterval` over refs + `data-*` (dropdowns, scroll-reveals, carousels/marquee — e.g. StreetBuild) will render **static**. **Before running a multi-page export, read its `.logic.js`: if it's imperative (no `state`/`renderVals`), WARN the user** that dropdowns/reveals/carousels will come out as TODOs until the imperative-DCLogic path lands. `vanilla` is **best-effort**. If extraction is thin (empty `screens`, missing `brandFonts` — see `inventory.notes` WARNINGs), surface it first.

If `unpack.mjs` exits non-zero, STOP and report — unrecognized/unsupported export or a format change.

---

## Step 0.5 — Inventory & gap analysis

> **Run directly** (no delegation). The architectural pass — needs Opus and full visibility.

Read the extracted artifacts AND the codebase, then produce a written gap-analysis report **in chat** (not a `.md` file unless asked).

1. **Design context** — read `inventory.json`, `tokens.json`, `nav-graph.json`, `components.json`, and skim the relevant source files under `source/` (babel: the App/entry `.jsx` for state+routing, the primitives file; dclogic: the `.logic.js` for state/routing + the `.markup.html` for structure/copy).
2. **Codebase context** — `tailwind.config.js`, `design-tokens-map.md`, `src/styles/index.sass`, `src/components/` (Glob folders, cross-ref the CONVENTIONS reuse table), `src/layouts/`, `src/stores/`, `src/proxy.ts`, `src/assets/icons/index.ts`.
3. **Produce the report:**

```markdown
## Target  (D5 — detect per prototype)
- Signals: {iosChrome, phoneFrameMaxWidth, bottom tabs, maxWidths seen} from inventory.targetSignals
- Decision: `mobile-app` | `web` — with reasoning. Drives Step 5.2 responsive strategy.

## Tokens
- Source (read `inventory.tokenSource`): `themes-object` (babel) → the brand preset `{brand}` in `tokens.json` (THEMES[brand]) is the canonical palette/typography. `inline+helmet`/`inline+css` (dclogic/vanilla) → **no THEMES**; palette/sizes come from `tokens.json.rawScan` (inline `hexColors` + `fontSizes`) + `<helmet>` CSS vars, fonts from `brandFonts` (helmet `@font-face`). Also check `rawScan.clampFontSizes` — responsive display sizes not captured; read them from source if a big heading size is missing.
- **Colors — start from `rawScan.clusters`, do NOT cluster 40+ hexes by hand.** `unpack.mjs` pre-groups them per [`design-import-shared.md` § B2](../../../docs/design-import-shared.md#b2-color--cluster-the-raw-scan-map-to-tokens-never-raw-hex): each entry is `{ representative, hexes[], uses, roles, dominantRole, suggestedFamily }` — grouped by **single-link** clustering at per-channel Δ ≤ 4, tagged with the CSS role each hex appears in (`text`/`background`/`border`/`icon`/`gradient`/`shadow`) and its usage count, sorted by `uses`. Your job is to **review and NAME** them (`suggestedFamily` is a hint, not a decision — verify it, especially on saturated tints), fold the long tail into the nearest family per B2.4, and hand the tokens agent the named result.

  **Single-link means Δ ≤ 4 holds between ADJACENT members, NOT across a cluster's extremes** — chained clusters really do come out wider than 4, so verify rather than trust the bound: on the Hologramas export, 2 of 33 clusters exceeded it (`["#eaf3fa","#e9f6fb","#eaf6fb","#eef7fb","#eef8fc"]` → Δ5; `["#e1ecf4","#e2f0f8","#e4f3fb"]` → Δ7). Split any cluster whose ends read as different colours. Note the clusters are a **hint about the raw scan**, not a token count: 33 clusters is not 33 tokens — B2.4's long-tail fold is what turns them into a palette.
- Already mapped (design-tokens-map.md): [`figmaVar/themeKey` → `tailwindToken`]
- Add: [new colors (hex), typography sizes, breakpoints the tokens agent should REUSE/CREATE/BLOCK]
- Typography sizing: **every off-scale source size becomes a real token** (both flows add tokens, they do NOT snap — see [§ B1](../../../docs/design-import-shared.md#b1-typography--off-scale-sizes-become-real-tokens-both-flows-never-rounded)).
  **YOU pre-round the fractional sizes HERE, before delegating Step 1** — do not leave it to Steps 3/5.2. A fractional size (13.5, 16.5 — common in a dclogic `rawScan`) can't be a token (the plugin builds `.${prefix}-${size}`, so the suffix must be an integer), so round each to the nearest integer first (**ties up**, deterministic), then hand the tokens agent the resulting off-scale INTEGERS. The tokens agent runs at **Step 1** and assumes it only ever receives integers; if you defer the rounding to the screen agent at **Step 5.2**, every fractional size resurfaces there as `TOKENS_MISSING` → re-delegate tokens → **re-run the Opus screen agent**. One list here costs nothing; the omission costs an Opus re-run per screen.
  Worked example (Holograma's `rawScan`): `10.5→11, 12.5→13, 13.5→14, 14.5→15, 15.5→16, 16.5→17, 17.5→18, 18.5→19`; of those, `14/16/18` land on-scale (no token) and the rest join the off-scale integers → **11 new tokens** (`11/13/15/17/19/21/27/30/34/50/58`). A noisy `rawScan` producing ~10 typography tokens is expected under this rule — fidelity over a lean token set.
- Radius — **branches on `tokenSource`; [§ B3](../../../docs/design-import-shared.md#b3-radius--token-driven-figma-vs-plain-css-literals-claude-design) is the source of truth, this is only the summary.** Radii are never per-value tokens and never a `TOKENS_MISSING` STOP.
  - **`themes-object` (babel)** — one `var(--radius)` drives everything, so decide ONE canonical translation here (a specific `rounded-*` step, or a single `borderRadius` token like `rounded-card` if no step is close) and pass it to Steps 3 + 5.2 so every component renders the SAME radius.
  - **`inline+helmet` / `inline+css` (dclogic / vanilla)** — there is NO `--radius`; radii are per-element literals (cards 20–24px, buttons 12–13px, pills 999px) → exact `rounded-[Npx]` per element. The `Radius translation` field below is **N/A** — say so explicitly in the delegation, and do NOT pass a single value (a fabricated "canonical radius" flattens a design that never had one).
- Breakpoints — **the design's own `@media` become real TOKENS, exactly like colors (§ B2) and off-scale sizes (§ B1). Never snap them onto the project scale, never leave them as raw `max-[Npx]:`.**
  A breakpoint is a design constant reused across the whole design — Hologramas' `max-width:860px` drives ~25 rules (nav, hero, four grids, footer, CTA, `h1`, `h2`) and every screen of a real import repeats it. That is exactly what a token is for; leaving it inline would make breakpoints the ONE design constant this flow treats as a magic number, while the `h1 { font-size: 34px }` INSIDE that same query becomes `text-*-34`. Snapping `860 → md (768)` is the identical error § B1 forbids for type: it shifts every rule and breaks a viewport band (an 800px tablet renders the `>860` layout).
  - **Read them from the source, not from `rawScan`** — `unpack.mjs` does not scan `@media`. dclogic: `source/{screen}.helmet.css` (the `.markup.html` has the CSS stripped). babel: `template.html`.
  - **Mind the direction.** A Claude Design export is usually **desktop-first** (`max-width`), the project scale is **mobile-first** (`min-width`). They are not interchangeable — declare each design breakpoint in Tailwind's explicit max form: `'hg-md': { max: '860px' }`.
  - **YOU name them**, same as colors: one namespace prefixed per design (`hg-*` for Hologramas), so they never collide with `sm/md/lg` or with a later import's. Deduplicate first — an `@media` repeated verbatim (Hologramas has `max-width:980px` twice) is ONE token.
  - Worked example (Hologramas): `max-width:980px → 'hg-lg'`, `860 → 'hg-md'`, `560 → 'hg-sm'` → **3 new breakpoint tokens**. Pass them to Step 1 and the `→ token` map to Step 5.2.
  - **A design with NO `@media` yields zero breakpoint tokens** — that is a valid outcome. Only then does Step 5.2 synthesize responsive with the project scale (`md:`/`lg:`), per its `Target` rule.
- Fonts: [from `inventory.brandFonts` — `{ body, display, families }` from the brand preset; load `families`, preload `body`] → next/font/google. Do NOT pass `inventory.fontFamilies` (that lists every embedded `@font-face` — a superset covering all THEMES presets, most of which are dead at runtime; loading them all is a bundle/LCP regression).
- **Warnings**: any proposed token that would override `surface-*` or an existing token — flag it.

## Assets
- Images (from inventory.images): [file, alias, uuid] → convert to WebP; per-screen vs shared.
- Icons: babel → the `Icon` component's named glyphs; flat dclogic (empty `components.json`) → the inline `<svg>` glyphs, counted by repetition.
- **Pre-filter per [`design-import-shared.md` § B8](../../../docs/design-import-shared.md#b8-icons--primeicons-pre-filter-vs-the-sources-own-glyph)** — NOT by "a PrimeIcon with that name exists". First **measure** whether the design ships a coherent icon set (tabulate every inline `<svg>`'s `stroke-width`/style): if it does, **every member keeps its source glyph and the import yields zero PrimeIcons** — that is the correct outcome, not an oversight. Only when there is no set do generic glyphs become `pi pi-{name}`. Brand marks always keep their source path — and use the **majority** path across instances, not the longest (a nav instance may carry an extra sub-path the other N don't; extracting that outlier silently re-draws every call site). Of the kept glyphs, pass the ones reused **2+ times** to the assets agent for extraction; single-use ones stay inline. Decide this here; do NOT ask the user.

## Components (each with its SOURCE FILE — mandatory)
Every primitive to extend/create MUST cite its source file in the unpacked tree (babel: `source/jsx/03_display.jsx`; dclogic: the `source/{screen}.markup.html` where the primitive's markup lives, or a `<dc-import>` child listed in `components.json`).
This is the equivalent of Figma's nodeId gate — claude-design-components reads the real source, never prose.
- Extend existing:
  - `CustomButton` ← `Btn` in `source/jsx/03_display.jsx` (variants: primary/accent/outline/ghost/soft)
- Create new:
  - `{Name}` ← `{Fn}` in `source/...`
- Reuse as-is: [list]

## State / Stores  (D6 — Zustand + seeding vs per-screen mock)
**Derive the full store spec HERE, up front** (analogous to deriving component primitives) — do NOT leave it for Step 5.2's isolated per-screen contexts (that produces divergent store APIs). Read the App/entry file's centralized state + reducers and, for each Zustand store, specify:
- **State fields** (`gifts`, `contribs`, `cart`, `draft`, …).
- **Initial seed** — the prototype seeds shared state from demo data (`useState(INITIAL_CONTRIBS)`, `setGifts(GIFTS.map(...))`). So the store's INITIAL STATE **is that mock seed**, defined in the store file and marked `// TODO: openapi-import — replace seeded mock with fetched data`. Screens then read POPULATED data from the store (never a blank list). Do NOT scatter shared-state mock as `MOCK_*` in screens — that leaves the store empty and the screen rendering `[]`.
- **Action bodies — including cross-entity reducers no single screen owns** (`addContribution` mutates `gifts` AND `contribs` atomically; `confirmContribution` recomputes both). **Author the full bodies here** — you (the Opus parent) have the App source, so translate the atomic logic now; the spec carries the IMPLEMENTATIONS, not just signatures, because scaffold runs on Haiku and must not invent atomic logic from a signature.
- Which screens consume which store.
Pass this spec to Step 5.1 (scaffold transcribes each store — seed + fields + reducer bodies — verbatim) and Step 5.2 (screens consume it, never redefine it).

**Store vs `MOCK_` rule of thumb**: the prototype's App holds it (shared across screens) → **store, seeded** with the demo data. Only one screen holds it (a static list that screen shows) → `MOCK_*` inline in that screen. Either way the data layer is deferred to `openapi-import` via the TODO — the difference is only WHERE the seed lives.

## Layouts (branches on `navModel`)
- `screen-registry` (babel): chrome detected (TopBar / BottomTabBar / iOS status bar); roles host/guest → route groups; existing match vs to-create.
- **`multi-page` (dclogic web): shared chrome → ONE layout.** The header/nav/footer repeats in EVERY `.dc` page's markup — it must be extracted to a single layout wrapping all N routes in a route-group, with the nav populated from the page list (entry → `/`). Do NOT let each page re-inline the chrome (8× duplication). Flag this for Step 4.
- `single-page-sections` / `single-page` (dclogic landing / vanilla): the sticky header/nav is part of the ONE screen (section switching), NOT a separate layout — no layout work unless a genuine shared shell exists.

## Screens — nav mapping (branches on `inventory.navModel`)

**`screen-registry` (babel — e.g. GIVXO): hybrid route/step/modal/skip.** Classify every registry key:
- **route** — first-level destination → `src/app/**/page.tsx` + screen. Give: name, type (auth|public|protected), route, role, source file, AND **`component`** (from `inventory.screens[].component` — REQUIRED; several screens share one file). If two keys map to the same component (`playlist` + `postboda` → `ContentHub`), keep BOTH routes rendering the shared component — do not drop either.
- **step** — sub-step of a wizard/flow (onboarding, pay steps) → internal stepper state inside the flow's anchor route.
- **modal** — overlay (cart, confirmations) → `/new-modal`.
- **skip** — demo chrome not portable (FlowMenu, role switcher, IOSDevice).
Authoritative list = **every registry key** in `inventory.screens`. `nav-graph.transitions` is only a PARTIAL hint (literal `go('x')` only; misses data-driven/tab nav — ≈30 of GIVXO's 42) — the registries are the source of truth, not transitions.

**`multi-page` (dclogic web — e.g. StreetBuild): one route per page.** Each `.dc` in `inventory.screens` = one **route**, type `public`, `component` = the page slug, `file` = its `.markup.html`. The `entry` page → `/`; the rest → `/{slug}`. No step/modal/skip decomposition — these are real web pages. (No registries; `transitions` is n/a.) ⚠ **Imperative interactivity is WIP** (see Implementation status) — if the pages' `.logic.js` is imperative (`querySelector`/`IntersectionObserver`/`setInterval`, no `state`), warn the user that dropdowns/reveals/carousels will be TODOs.

**`single-page-sections` (dclogic landing — e.g. Hologramas) / `single-page` (vanilla): ONE screen, one route.** The whole export is a single screen (usually `/`, `public`); the `inventory.screens` entries are **SECTIONS of that one screen** (navigated by internal state — `go(section)` / `state.page`), NOT separate routes/steps/modals. Scaffold ONE route; Step 5.2 implements the section switching internally (like a stepper). Do not create a route per section.

## Detected language
- Sample visible strings from screen JSX (`characters`/JSX text). Decision `en`|`es` + reasoning.
- Current `<html lang>` in `src/app/layout.tsx`: {value}. Flag if it must switch.
```

**Language heuristic**: same as the project standard — Spanish-leaning if strings contain `ñ`, accents, or words like `iniciar/comenzar/nuevo/usuario/comprar/requerido`. ≥50% Spanish → `es`, else `en`; default `en` on tie.

4. **Stop and confirm with the user.** They must approve the plan AND the screen classification (route/step/modal/skip) before any code is written. This is the most important checkpoint — Step 5.2 uses these decisions automatically, so a wrong classification here is caught cheaply now.

---

## Step 1 — Tokens

> **Delegate to**: `Agent({ subagent_type: 'claude-design-tokens' })` — **Haiku**.

**What you pass branches on `inventory.tokenSource`** — the agent's "brand preset" input only exists for babel:

- **`themes-object` (babel)** — the brand preset object from `tokens.json` (`themes[brand]`: colors + typography), plus the loose hex/size list from `rawScan`.
- **`inline+helmet` / `inline+css` (dclogic / vanilla)** — `tokens.json.themes` and `.brand` are **`null`**; there IS no preset, and the agent knows an absent one is expected here. Pass instead the **named clusters** you reviewed in Step 0.5 (from `rawScan.clusters`), each with its `hexes[]` member list so every member maps to the one token.

Either way, **pass your NAMES, not raw hexes.** You (Opus, with the whole design in view) decide the namespaces and the family names. The agent's input shape **requires** a `name` and a `decision` (REUSE | CREATE | BLOCK) per entry and will `INVALID_INPUT` on an entry without one — deliberately, because an unnamed list means **Haiku re-decides your naming** and two runs of the same design end up with different token names. Hand it explicit `hex → token-name` rows.

Also pass: the pre-rounded off-scale **integer** typography sizes (see Step 0.5 — fractions are rounded by YOU, before this step), and the **brand fonts** (`inventory.brandFonts`, not the full `fontFamilies` superset).

The agent applies REUSE/CREATE/BLOCK against `tailwind.config.js` + `design-tokens-map.md`, loads fonts via `next/font/google` in `layout.tsx`, updates `general.sass`, runs `type-check`.

---

## Step 2 — Assets

> **Delegate to**: `Agent({ subagent_type: 'claude-design-assets' })` — **Haiku**.

Pass: the path to `assets/img/*` + `inventory.images` (file, uuid, alias, mime, and `screenSlug` when per-screen), and — for babel, or a repeated dclogic glyph — the icon glyph list to split into React icon components (for a flat dclogic whose glyphs are all single-use, omit it: inline `<svg>` stays in the screen). The agent converts raster → WebP via `sharp` (no ffmpeg), builds any icon components (`GmailIcon.tsx` pattern), registers `src/assets/icons/index.ts`, writes `.hash.txt` siblings. You pre-filter icons per [`design-import-shared.md` § B8](../../../docs/design-import-shared.md#b8-icons--primeicons-pre-filter-vs-the-sources-own-glyph) before delegating (role-based, not name-based — brand marks and coherent sets keep their source glyph).

---

## Step 3 — Components

> **Delegate to**: `Agent({ subagent_type: 'claude-design-components' })` — **Opus**.

Pass: the extend list + create list, **each with its source JSX file** in the unpacked tree, the token names added in Step 1, and the **radius translation** decided in Step 0.5 (the single `rounded-*`/token every `var(--radius)` maps to). The agent reads the real JSX source per primitive (the gate against prose-driven errors — inline `style={{}}` variants are explicit in the code), reads existing `.tsx`/`.sass`, greps usages, extends/creates per conventions, validates each. If any component lacks a source file reference, the agent refuses — resolve it in Step 0.5.

---

## Step 4 — Layouts

> **Delegate to**: `Agent({ subagent_type: 'claude-design-layouts' })` — **Sonnet**.

Pass: current `src/layouts/` state, the chrome findings, the host/guest roles, the `target`, AND the `navModel`. The agent creates/adjusts layouts, wires route groups, and translates or drops mobile chrome per target. **For `navModel = multi-page`** (dclogic web) pass the list of `.dc` pages + the path to any one page's `.markup.html` — the shared header/nav/footer must become ONE layout wrapping all pages (nav from the page list), NOT re-inlined per page. It composes existing components, never duplicates JSX.

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
Source: {unpacked}/{inventory.screens[].file}  (babel: source/jsx/NN_*.jsx — may hold several screens; dclogic: source/{screen}.markup.html + sibling .logic.js)
Screen component: {FunctionName}     # from inventory.screens[].component — WHICH function in that file IS this screen (REQUIRED; the agent STOPs without it)
Absorbed steps: [{stepScreenKey → component}, ...]   # wizard sub-steps to implement as internal stepper
Store spec: {store → {seeded initial state, fields, action bodies}}   # from Step 0.5 — consume it, never redefine it; shared data comes from the (seeded) store, NOT MOCK_*
Radius translation: {the single canonical `rounded-*` / token from Step 0.5, OR the literal `N/A — tokenSource=inline+helmet, use exact rounded-[Npx] per element (§ B3)`}
Local modals: [{modalScreenKey → component}, ...]     # implement as screen-local modals / /new-modal
Target: {mobile-app|web}                              # drives responsive synthesis
Breakpoints: [{design @media → token}, ...]   # the design's OWN media queries, ALREADY ADDED AS TOKENS by Step 1 — e.g. `max-width:860px → hg-md:`. Use the TOKEN, never a raw `max-[860px]:` and never the project scale: re-labelling 860 onto md (768) shifts every rule and breaks a whole viewport band (a 800px tablet renders the >860 layout). Empty list = the design has no media queries; only THEN synthesize with the project scale (see Target).
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

Every sub-agent may emit a STOP per the [STOP Protocol](../../../CONVENTIONS.md#stop-protocol). Parse and route them:

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
| 0.55 | Gate the spec against the source | `general-purpose` | Sonnet | The source tree + your gap-analysis report |
| 1 | Tokens | `claude-design-tokens` | Haiku | Named tokens (`hex → name` + REUSE/CREATE/BLOCK) + off-scale integer sizes + fonts |
| 2 | Assets | `claude-design-assets` | Haiku | `assets/img/*` + `inventory.images` + `Icon` glyph list |
| 3 | Components | `claude-design-components` | Opus | Extend/create list, each with **source JSX file** + token names |
| 4 | Layouts | `claude-design-layouts` | Sonnet | Layouts state + chrome findings + roles + target |
| 5.1 | Scaffold routes + stores | `claude-design-scaffold` | Haiku | `route` screens (name, type, route, group, role, **component**) + store specs (full shape) + language |
| 5.2 | Per-screen (sequential + checkpoint) | `claude-design-screen` | Opus | Per-screen: name, type, slug, **source JSX + component**, absorbed steps, modals, target, language, reuse list, store spec |
| 6 | Validation | `design-validation` | Haiku | Scope (or empty) + `importFlow: 'claude-design-import'` |
