---
name: figma-design-import
description: Orchestrates the bottom-up import of a full Figma design file into this codebase — inventory → tokens → assets → components → layouts → screens → validation. Delegates each step to a dedicated sub-agent in `.claude/agents/` so each task runs in the right model (Haiku for mechanical, Sonnet for moderate, Opus for architectural). Invoke when starting to translate a complete Figma design to code, NOT for one-off component tweaks. For a single screen/component, prefer `/figma:figma-implement-design`.
---

Import a Figma design end-to-end following the project's bottom-up workflow. Arguments: **$ARGUMENTS**

**REQUIRED**: a Figma URL pointing to the FULL design file (or the page that contains every screen + every component). Every step that enumerates frames — Step 0 (inventory), Step 4 (layouts), Step 5.1 (scaffold all screens), Step 5.2 (per-screen implementation) — relies on seeing the entire design at once. Token analysis, component reuse detection, shared layout extraction, and the screen registry all depend on global visibility.

If the argument is missing OR clearly points to a single screen/component, STOP and ask the user:

> Necesito el link al **archivo completo de Figma** (la página con todas las pantallas + componentes). Pegame algo como `https://figma.com/design/{fileKey}/{name}?node-id=X-Y` donde X-Y apunta al canvas/page raíz, no a una pantalla individual. Si solo querés implementar una pantalla, usá `/figma:figma-implement-design` en vez de este skill.

Do not proceed past Step 0 with a partial design — the inventory will be wrong and you'll have to refactor.

## Pre-flight — Read CONVENTIONS.md (mandatory)

Before delegating to any sub-agent, `Read` [`.claude/CONVENTIONS.md`](../../CONVENTIONS.md). As the orchestrator, you need it for two distinct purposes:

1. **Token / asset / component / layout / screen gap analysis (Step 0)** — the [Existing Reusable Components](../../CONVENTIONS.md#existing-reusable-components) table is the authoritative reuse list. The [Color System](../../CONVENTIONS.md#color-system), [Typography System](../../CONVENTIONS.md#typography-system), and [Breakpoints](../../CONVENTIONS.md#breakpoints) define what is already in the template vs what's new.
2. **STOP protocol handling** — every sub-agent may emit `STOP-BLOCKING` or `STOP-ADVISORY` blocks following the [STOP Protocol](../../CONVENTIONS.md#stop-protocol). You parse them and route as described in the "Handling agent STOPs" section below.

If `CONVENTIONS.md` is missing, STOP the entire import flow and report to the user — every sub-agent depends on it, so proceeding would compound errors.

---

## Workload tracking (cost telemetry across the flow)

Maintain a running ledger of every sub-agent invocation. After each delegation returns, append a row:

```
| Step | Sub-agent | Model | Duration | Tool calls | Tokens≈ | Notes |
|------|-----------|-------|----------|------------|---------|-------|
| 1 | figma-tokens | Haiku | 12s | ≈5 | ≈8k | 6 colors + 4 sizes added |
| 2 | figma-assets | Haiku | 45s | ≈21 | ≈14k | 14 images, 5 icons |
| 3 | figma-components | Opus | 3m | ≈23 | ≈85k | 6 new + 1 extended |
| ... | ... | ... | ... | ... | ... | ... |
```

**Estimating `Tokens≈`** — use the tool-call count as a proxy. Per-tool-call averages from past runs (calibrate as you go):
- Haiku agent: ≈1.5k tokens / tool call (mostly small Reads, Edits, Bash).
- Sonnet agent: ≈3k tokens / tool call (longer Reads, denser reasoning).
- Opus agent: ≈4k tokens / tool call (large MCP responses, multi-file edits, screenshots).
- Add a flat +30k for any sub-agent that calls `get_design_context` on a node (the MCP response itself is heavy).

The estimate is a SIGNAL, not an invoice — keep two significant figures (`≈85k`, not `85,124`). The point is to see if Step 5.2 per-screen invocations are creeping into the hundreds-of-thousands range so the user can pause before the next one.

**Where each column comes from** (every sub-agent ends its `Output to parent` with a standardized 3-line footer):

```
---
Workload: model={haiku|sonnet|opus}, tool_calls≈{N}, files_touched={M}
Validation: lint=✅/❌, type-check=✅/❌
Notes: {one-line count summary}
```

- `Model` ← **read from the sub-agent's frontmatter** in `.claude/agents/{name}.md` (Read the file, parse `model: {value}` from the YAML header). Do NOT trust `Workload: model=...` in the footer — that's a string the sub-agent typed, and it drifts if the frontmatter changes without the footer template being updated in lockstep. The frontmatter is the source of truth; the footer field exists only so the human reader sees the value inline.
- `Duration` ← **measured by the orchestrator** from wall-clock time between the `Agent(...)` call start and return. Don't ask the sub-agent to self-report — it can't measure it accurately and the harness already exposes it.
- `Tool calls` ← `Workload: tool_calls≈...` from the footer. The sub-agent counts its own calls; the orchestrator can't see them otherwise. If you need per-tool breakdown (`Read×8, Write×12, Bash×3`), derive it from the visible tool calls in the agent's run log — that detail is not part of the footer.
- `Tokens≈` ← **computed by the orchestrator** from `tool_calls × model_factor` + flat surcharges (see formula above). Sub-agents do NOT self-report tokens. The `model_factor` comes from the frontmatter-derived `Model` value above, so a drifted footer can't poison the estimate.
- `Notes` ← `Notes:` line from the footer, used verbatim.

Append the `Validation:` line of the footer to the checkpoint message after each step so the user sees lint/type-check status without scrolling through the agent's full report.

**Show the ledger at every checkpoint** (end of Step 0, end of Step 5.1, between each Step 5.2 screen, end of Step 6) so the user can see cost-per-step accumulating in real time and decide whether to keep going. At the end of the batch, also show the cumulative `Tokens≈` sum and the per-model breakdown:

```
Cumulative tokens≈ 420k
  haiku: ≈30k
  sonnet: ≈15k
  opus: ≈375k    ← Step 5.2 per-screen is the dominant share
```

This makes the trajectory inspectable: if the per-screen Opus delta starts rising sharply across consecutive screens (Step 5.2), the user can pause and decide whether to simplify the remaining screens before continuing.

This makes the model-assignment promise verifiable — if Step 1 ends up running on Opus by mistake, the ledger surfaces it.

---

## How this skill manages models automatically

You (the parent agent, typically Opus) act as the **orchestrator**. You do Step 0 directly because it requires holistic judgment. Every other step is delegated via the `Agent` tool to a dedicated sub-agent in `.claude/agents/`. Each sub-agent has its model pre-set in its frontmatter, runs in **isolated context**, and returns only a summary — keeping your context lean and using the cheapest viable model per task.

| Step | Sub-agent | Model | Why this model |
|------|-----------|-------|----------------|
| 0 | (you, the parent) | Opus | Holistic judgment + checkpoint with user |
| 1 | `figma-tokens` | Haiku | Mechanical config edits |
| 2 | `figma-assets` | Haiku | Bash + boilerplate from templates |
| 3 | `figma-components` | Opus | Component API design, extend-vs-create judgment |
| 4 | `figma-layouts` | Sonnet | Moderate decisions, known patterns |
| 5.1 | `figma-scaffold` | Haiku | Mechanical `/new-screen` invocations |
| 5.2 | `figma-screen` | Opus | Pixel-perfect fidelity, heaviest token user |
| 6 | `figma-validation` | Haiku | Run commands + report findings |

**Always pass enough context** in each delegation prompt — sub-agents start fresh, they don't see your conversation. Include relevant gap-analysis data, file paths, and decisions already made.

---

## Why this flow exists

Implementing Figma top-down (screen-first) leads to:
- Hardcoded colors/typography (because tokens aren't in `tailwind.config.js` yet)
- Duplicated components (because the inventory of existing ones in `src/components/` wasn't checked)
- Repeated navbars/footers (because layouts weren't decided before screens)
- Refactor passes after the fact

Bottom-up (this skill) prevents all of that. **Do not skip steps.** Each layer depends on the previous.

---

## Step 0 — Inventory & gap analysis

> **Run directly** (no delegation). This is the architectural pass — needs Opus and full visibility.

Read the Figma source AND the relevant codebase before touching any file.

1. **Figma context** — call `get_design_context` on the user's nodeId. If the response is too large, fall back to `get_metadata` first, then `get_design_context` on specific sub-nodes. As a last resort, delegate the file parsing to a generic subagent that returns a structured summary.
2. **Codebase context** — read these to know what already exists:
   - `tailwind.config.js` — existing colors (`surface-*`), typography scale, breakpoints
   - `figma-tokens-map.md` (project root, may not exist yet) — Figma-variable → Tailwind-token mapping from prior imports. ALWAYS read this first: if a Figma variable from the current node is already mapped, do NOT propose it as a new token; reuse the mapped one.
   - `src/styles/index.sass` — fonts loaded
   - `src/components/` — list every folder; cross-reference with the "Existing Reusable Components" table in `CLAUDE.md`
   - `src/layouts/` — `AuthLayout`, `DashboardLayout`, `GeneralLayout`
   - `src/proxy.ts` — current `AUTH_PATHS`, `PUBLIC_PATHS`
   - `src/assets/icons/index.ts` — existing icons
3. **Produce a gap analysis** as a written report (in chat — NOT a `.md` file unless the user asks):

   ```markdown
   ## Tokens
   - Already mapped (in figma-tokens-map.md): [list — `figmaVar` → `tailwindToken`]
   - Add: [list new Figma variables that need a token decision; the figma-tokens agent will apply its REUSE/CREATE/BLOCK policy]
   - Already covered (Tailwind has an exact match by hex AND name is not yet mapped): [list]
   - **Warnings**: if any proposed token would override `surface-*` or any existing token, flag it here — the figma-tokens agent will block these unless the user explicitly confirms.

   ## Assets
   - SVGs to convert to React components: [list with Figma node IDs]
   - Images to convert to WebP: [list]

   ## Components (with representative Figma nodeIds — MANDATORY)
   Every component (whether to extend or create) MUST have a representative Figma `nodeId` resolved here. `figma-components` will refuse to work without one — it forbids prose-only specs because building components from text descriptions consistently produces wrong-but-plausible output (screenshots hide structure: a colored area may be the IMAGE fill rather than a card frame; auto-layout direction, exact spacing per side, and hover/focus variants are invisible until the node is inspected).

   How to resolve a nodeId:
   - If the Figma file has a dedicated "Components / Library / Design System" page → pull the nodeId from there (canonical source).
   - Otherwise → take the FIRST instance of that component you find in any screen frame. Any single instance works; `figma-components` will fetch its design context.

   - Extend existing:
     - `CustomButton` ← nodeId `X:Y` (Figma: "Button - Primary - Default")
   - Create new:
     - `ProductCard` ← nodeId `X:Y` (Figma: first instance in `Home > Products grid`)
     - `Navbar` ← nodeId `X:Y` (Figma: any screen's header)
   - Reuse as-is: [list — these don't need a nodeId, no change is made]

   ## Layouts
   - Existing match: [DashboardLayout matches dashboard nav? Yes/No]
   - To create: [{NewLayoutName} if a Figma shell doesn't match any existing layout]

   ## Screens (with desktop + mobile node IDs resolved)
   - **{ScreenName}Page** → route `{/path}`, type `{auth|public|protected}`
     - Desktop: `X:Y` ({Figma frame name})
     - Mobile: `X:Z` ({Figma frame name}) — or `(no mobile variant found)` if missing
     - Expected reusable components (from Step 3 inventory): `[{Component1}, {Component2}, ...]` — populated after Step 3 returns, used by Step 5.2 to short-circuit the per-screen reuse audit.

   ## Detected language
   - Sample of visible text strings from the Figma frames: {3-5 short quoted examples, e.g. "Comenzar ahora", "Nuestros productos", "Iniciar sesión"}
   - Decision: `en` | `es` — with brief reasoning ({% of strings that are Spanish, presence of accented chars / ñ / common Spanish words like "iniciar/nuevo/comprar/usuario"})
   - **Current `<html lang>`** in `src/app/layout.tsx`: read it and report. If it doesn't match the detected language, flag for switching (the figma-scaffold agent will perform the switch).
   ```

   **How to detect language**: from the design context of the screens, collect every `characters` value (visible text). Score: a string is "Spanish-leaning" if it contains any of: `ñ`, accented Latin characters (`á é í ó ú ü`), or whole-word matches against a small list (`iniciar`, `comenzar`, `nuevo`, `usuario`, `comprar`, `ingresar`, `nosotros`, `productos`, `acerca`, `contacto`). If ≥50% of sampled strings are Spanish-leaning → language = `es`. Otherwise → `en`. **Default to `en` on tie or insufficient data** — the template ships English-first, and forcing a switch should only happen with clear majority-Spanish evidence.

   **Building the screen registry**: when you scan the metadata, pair desktop and mobile frames by naming convention. Common patterns:
   - Mobile frames often start with `M-`, `M_`, or `Mobile - ` prefix.
   - Desktop frames carry the canonical name (e.g. `Inicio > Nosotros`).
   - The mobile counterpart usually has the same root name (e.g. `Mobile - Inicio > Nosotros`, `M-INICIO>NOSOTROS`).
   - Frame width is also a signal: ~390px wide → mobile, ~1440px wide → desktop.

   If a desktop has no obvious mobile pair (or vice versa), mark it as `(no mobile variant found)` — don't guess. The user will confirm or correct in Step 0's checkpoint.

4. **Stop and confirm with the user** before continuing. The user must approve the plan AND the screen registry before any code is written. This is the most important checkpoint in the flow.

   **Why the registry matters**: Step 5.2 (per-screen implementation) uses these resolved nodeIds automatically — the user won't have to dig through Figma for each pantalla. If the user spots a wrong pairing here, they correct it before we burn tokens implementing the wrong frame.

---

## Step 1 — Tokens (colors, typography, fonts)

> **Delegate to**: `Agent({ subagent_type: 'figma-tokens' })` — runs in **Haiku**.

Pass to the agent the exact list from the gap analysis: colors with hex values, typography sizes to add, font families. The agent edits `tailwind.config.js` + `src/styles/index.sass` + (if needed) `src/styles/general.sass`, then runs `pnpm type-check`.

You receive: confirmation of changes + type-check result.

---

## Step 2 — Assets

> **Delegate to**: `Agent({ subagent_type: 'figma-assets' })` — runs in **Haiku**.

Pass to the agent a list of every asset: type (`svg-icon` | `raster-logo` | `raster-image`), source URL (Iconify or Figma), target file name, and `screenSlug` when the asset belongs to a single screen (omit for shared assets like logos). The agent downloads each, generates React components for SVG icons (following `GmailIcon.tsx` pattern), converts raster to WebP via `ffmpeg`, registers exports in `src/assets/icons/index.ts`. Per-screen raster images land at `src/assets/images/{screenSlug}/{name}.webp`; shared raster assets land flat at `src/assets/images/{name}.webp`.

**You (the orchestrator) pre-filter assets covered by PrimeIcons (`pi pi-{name}`) before delegating** — the `figma-assets` agent does not re-check this. When the Figma node maps to an icon that exists in PrimeIcons, do NOT include it in the asset list passed to the agent; instead, note `→ use <i className='pi pi-{name}'/>` in the gap analysis so the screen agent (Step 5.2) knows.

You receive: list of files created with their final sizes + lint/type-check status.

---

## Step 3 — Components

> **Delegate to**: `Agent({ subagent_type: 'figma-components' })` — runs in **Opus**.

Pass to the agent:
- The Figma `fileKey` (so the agent can call MCP tools itself).
- The list of existing components to extend with which new variants/sizes/states, AND a representative **`figmaNodeId`** for each one (from Step 0's component-node mapping).
- The list of new components to create, AND a representative **`figmaNodeId`** for each one.
- The design tokens already added in Step 1 (colors/typography names, not hex).

`figma-components` will INDEPENDENTLY fetch `get_design_context` + `get_screenshot` on each component's nodeId before writing code — that's the gate against prose-driven implementation errors. Do not try to pre-extract the design and pass it in as prose; let the agent fetch and interpret the structured data directly.

If any component in your input lacks a `figmaNodeId`, the agent will refuse to proceed. Resolve the nodeIds in Step 0 — they are cheap to obtain (any instance of the component in any screen frame works) and save much more in rework cycles down the line.

The agent reads existing `.tsx` and `.sass` files, finds usages with Grep (to avoid breaking callers), extends or creates following project conventions, and validates each one.

You receive: a table of which variants were added to which component, file paths touched, and lint/type-check status.

---

## Step 4 — Layouts

> **Delegate to**: `Agent({ subagent_type: 'figma-layouts' })` — runs in **Sonnet**.

Pass to the agent:
- Current state of `src/layouts/` (existing layouts).
- Figma layout findings: which screens share a header/footer pattern.
- Names of any new layouts to create.

The agent compares, adjusts, or creates layouts in `src/layouts/{Name}/`, wires them up in `src/app/{(group-name)}/layout.tsx` route groups, and ensures they compose existing components (Navbar, Footer) rather than duplicating JSX.

You receive: layouts adjusted/created + route groups wired + lint/type-check status.

---

## Step 5 — Screens + routing

Two phases: scaffold all screens at once (5.1), then implement each one in detail (5.2).

### 5.1 — Scaffold all screens with placeholders

> **Delegate to**: `Agent({ subagent_type: 'figma-scaffold' })` — runs in **Haiku**.

Pass to the agent the full screen list from the gap analysis. **Before delegating, read `src/app/layout.tsx` and extract the current `<html lang>` value** — pass it as `currentHtmlLang`. Required input to the agent:

- For each screen: `screenName`, `screenType` (`auth` | `public` | `protected`), `route`, `routeGroup` (optional), `isFromFigma` (boolean).
- Batch-level: `detectedLanguage` (`en` | `es`, from Step 0) and `currentHtmlLang` (the literal value you just read).

All screens — both those with Figma sources and those that are TBD — get the same placeholder for consistency (`"Coming soon"` when language is `en`, `"Próximamente"` when language is `es`). Step 5.2 will replace the Figma-sourced ones with real implementations. The agent invokes `/new-screen` for each (which generates `metadata.alternates.canonical` from the start), sets the placeholder content in the right language, switches `<html lang>` and `openGraph.locale` in `src/app/layout.tsx` if they don't match the detected language, and verifies routes are reachable.

After this step, **commit the scaffold as a checkpoint** before moving on.

You receive: list of created routes + lint/type-check status.

### 5.2 — Per-screen implementation (sequential auto with checkpoint between each)

> **Delegate to**: `Agent({ subagent_type: 'figma-screen' })` — runs in **Opus**, **one invocation per screen, sequential with a per-screen checkpoint**.

This is the heaviest token usage of the whole flow. By delegating each screen to its own `figma-screen` agent invocation, the screen's `get_design_context` (~80–120K tokens), screenshots, and image downloads stay in the sub-agent's context — they NEVER touch yours. After each screen, you only see a short report.

**Sequential auto-iterate with checkpoints.** As soon as Step 5.1 commits, walk the Step 0 registry one screen at a time:

1. Pick the next screen with a real Figma source (skip "Próximamente" / TBD).
2. Delegate to `figma-screen` with the standard prompt (below).
3. When the subagent returns, post a SHORT report and ask the user a checkpoint question.
4. Branch on the user's response:
   - **Empty / "siguiente" / "continuá" / "ok" / "next"** → move to step 1 with the next screen.
   - **Adjustment instructions** (free text, e.g. "achicá el hero un 20%", "el contact form va del lado izquierdo en mobile") → re-delegate to `figma-screen` for THE SAME screen with the adjustment notes appended to the prompt. After it returns, post the new report and re-ask the checkpoint.
   - **"parar" / "stop" / "pausá"** → halt the batch and tell the user how to resume (e.g. "decime `seguí desde {ScreenName}` cuando quieras retomar").
   - **Skip-specific** ("saltá esta", "después la veo") → mark the screen as skipped, move to next.
5. After the last screen (or when user halts), post the cumulative final report.

**Standard prompt for each `figma-screen` invocation:**

```
Screen name: {Name}Page
Screen type: {auth|public|protected}                # required — drives screen file path + <main> className
Screen slug: {kebab-case}                           # required — used for src/assets/images/{slug}/ image folder
Desktop URL: figma.com/design/{fileKey}/{name}?node-id={desktop_id}
Mobile URL: figma.com/design/{fileKey}/{name}?node-id={mobile_id}   (or "no mobile variant" if missing)
Detected language: {en|es}                          # required — drives Formik error copy, default alt text, etc.
Images: descargá de Figma
Existing components to reuse:
  - {ComponentA} (variants: [primary, secondary]) → src/components/{ComponentA}/{ComponentA}.tsx
  - {ComponentB} (created in Step 3, no variants) → src/components/{ComponentB}/{ComponentB}.tsx
  # Pre-resolved from Step 3 output (screen registry → expected reusable components) — short-circuits the per-screen reuse audit so figma-screen doesn't have to re-grep src/components/.
Tokens available: {list from Step 1}
Container rule: every top-level <section> MUST be anchored with `container-custom` (or wrap its content in a child <div className='container-custom ...'> when the section has a full-bleed background). The class already brings a built-in 16px lateral gutter — do NOT add `px-*` on the same element. Ignore Figma's absolute frame width and per-section padding-x — they break cross-section alignment. BUT keep the per-section `py-*` / `pt-*` / `pb-*` from Figma intact — `container-custom` only handles horizontal spacing, so every section still needs its own vertical rhythm.
Adjustment notes (only on re-runs): {text from user}
```

The default image strategy is `descargá de Figma` since the user didn't provide URLs. The `figma-screen` agent will curl + ffmpeg each asset into `src/assets/images/{screen-slug}/`.

**Per-screen checkpoint message (post after each subagent returns).** Keep it tight so the user can decide quickly:

```
✅ {Name}Page implementada ({images_count} imágenes, {duration})
   Ruta: /{path}
   Archivos: src/screens/{Name}Page/, src/assets/images/{slug}/

¿Ajustes para {Name}Page o seguimos con {NextName}Page?
  • Pegá instrucciones específicas para refinarla
  • Decí "siguiente" o presioná Enter para continuar
  • "saltá esta" para skipearla, "parar" para pausar el batch
```

If the previous subagent failed, surface the error in the same checkpoint:

```
❌ {Name}Page falló: {error}

¿Reintentamos con instrucciones, saltamos, o parar?
```

**Edge cases — handle automatically, do not ask:**

- **Screen with desktop only (no mobile pair found)** → pass only the desktop URL and tell `figma-screen` to apply best-effort responsive defaults (mobile-first Tailwind, stacked layout below `md:`). Mention this in the checkpoint message so the user knows.
- **Screen with mobile only** → same in reverse: pass mobile URL and ask the agent to extrapolate desktop from the project's container/breakpoint conventions.
- **Subagent failure** → checkpoint with the error and ask whether to retry, skip, or stop. Do NOT silently move on after a failure.

**Cumulative final report.** When the batch ends (all screens done or user halted), post:

```
Resumen del batch:
✅ {ScreenA}  — implementada (1 ajuste)
✅ {ScreenB}  — implementada
⏭️  {ScreenC} — skipped por el usuario
✅ {ScreenD} — implementada

Probá: pnpm start → /, /{route-b}, /{route-d}
Reportá cualquier gap visual y pedimos un re-run puntual.
```

**Manual escape hatch (post-batch).** If the user wants to redo a specific screen later with different inputs (e.g. real image URLs they uploaded to a CDN), they can ask outside of the auto-batch:

```
Re-implementá {ScreenName} con:
Desktop: figma.com/design/.../?node-id=...   (optional override)
Mobile: figma.com/design/.../?node-id=...     (optional override)
Imágenes: ['/products/p1.webp', '/products/p2.webp']
```

Pass any provided fields to `figma-screen`; fall back to the registry for the rest.

---

## Step 6 — Code validation

> **Delegate to**: `Agent({ subagent_type: 'figma-validation' })` — runs in **Haiku**.

Visual validation is the developer's job — they review the dev server side-by-side with Figma and request adjustments via the per-screen checkpoint in Step 5.2. This step is a final automated code sweep only.

Pass to the agent: scope (which screens/components to verify), or empty for full sweep. The agent runs `pnpm run lint-check --fix`, `pnpm run type-check`, plus structural checks: SEO metadata on every page, heading hierarchy, a11y on clickable non-buttons, raw hex compliance, typography compliance.

You receive: a categorized report (passing / warnings / failing) with `path:line` references. Don't auto-fix violations — surface them to the user and offer to delegate the fix to the relevant agent (`figma-tokens` for hex, `figma-components` for a11y, etc).

---

## Handling agent STOPs

Every sub-agent in this flow may emit a STOP at the end of its report following the [STOP Protocol](../../CONVENTIONS.md#stop-protocol) defined in CONVENTIONS.md. As the orchestrator, you MUST parse and handle each STOP. The two severities:

- **`STOP-BLOCKING`** — the sub-agent could NOT complete. You must resolve before re-invoking the same agent. Resolution path depends on the `next_agent` field.
- **`STOP-ADVISORY`** — the sub-agent completed with a documented default (`default_applied:` field describes what). You continue the flow but MUST surface the advisory in the next per-screen checkpoint so the user can decide to re-delegate post-batch.

### Decision tree per STOP

When you see `STOP-BLOCKING`:

| `next_agent` value | What to do |
| ------------------ | ---------- |
| `figma-tokens` | Delegate to `figma-tokens` with the `details:` payload, then re-invoke the original sub-agent. |
| `figma-components` | Delegate to `figma-components` with the missing variant nodeId, then re-invoke. |
| `figma-layouts` | Delegate to `figma-layouts` with the user's decision, then re-invoke. |
| `user_decision` | Stop the batch, surface the STOP to the user with the exact `reason:` and `resolution:` quoted. Wait for the user's response, then proceed. |
| `manual` | Stop the batch and ask the user how to resolve. Common case: re-invoke with corrected input. |

When you see `STOP-ADVISORY`:

1. Note the advisory in your internal ledger for the current screen/component.
2. Continue the flow without stopping. The sub-agent already applied the default described in `default_applied:`.
3. At the next per-screen checkpoint (or end-of-batch summary), include the advisory verbatim so the user can decide whether to ask for a post-batch refactor.

Concrete example for a per-screen checkpoint with one advisory:

```
✅ HomePage implementada (6 imágenes, 1m 20s)
   Ruta: /
   Archivos: src/screens/HomePage/, src/assets/images/home-page/

⚠️ Advisories surfaced during implementation:
   - STOP-ADVISORY / COMPONENT_GAP: ProductCard does not cover the "compact" variant used in the Featured section.
     Default applied: implemented inline with `// TODO: refactor into ProductCard variant 'compact'` comment.
     If you want me to refactor into the component now, say so; otherwise we keep moving.

¿Ajustes para HomePage o seguimos con AboutPage?
```

### Format parsing

Each STOP is a fenced block. Parse the lines key by key (split on the first colon). The block ENDS at the first blank line or the next fenced block. `details:` is followed by indented key:value pairs forming an arbitrary tree — preserve the structure when re-delegating.

If a sub-agent's STOP is malformed (missing `category:`, unknown category name, etc.), treat it as `STOP-BLOCKING / category: INVALID_INPUT / reason: malformed STOP from {sub-agent}` and surface to the user — do NOT silently retry or guess.

### Ledger row for STOPs

Every STOP contributes one row to the workload ledger with the `Notes` column quoting the category and severity (e.g. `Notes: 1 STOP-BLOCKING TOKENS_MISSING (delegated to figma-tokens)`). This makes per-batch STOP frequency visible — if `COMPONENT_GAP` advisories keep firing on the same component across multiple screens, the user can decide to upgrade the component once via `figma-components`.

---

## Anti-patterns (do NOT do this)

- ❌ Accept a partial design (single-screen URL) at the start — the skill needs the FULL file for the inventory pass
- ❌ Skip Step 0 and "just start with the screens"
- ❌ Run any step yourself when there's a sub-agent for it — you waste Opus tokens on Haiku-grade work
- ❌ Forget to pass relevant context (gap analysis, decisions made) when delegating — sub-agents start fresh and won't know what you've decided
- ❌ Wait for user input BEFORE implementing each screen in Step 5.2 — the Step 0 registry already has every nodeId; auto-delegate, then ask AFTER each one completes (per-screen checkpoint, not pre-screen prompt)
- ❌ Skip the per-screen checkpoint and chain through every screen in one shot — the user wants to review each result before the next starts
- ❌ Halt the whole Step 5.2 batch silently if one screen fails — surface the error in the next checkpoint and let the user choose retry / skip / stop
- ❌ Hardcode hex colors anywhere — always tokens
- ❌ Use raw `<a href='/internal-route'>` for internal navigation — always `next/link` or `CustomButton` with `href` prop. Raw anchors trigger full-page reloads and lose Next.js client routing.
- ❌ Import `motion` from `framer-motion` — always `m` + `LazyMotion` (already set up in `ProvidersContainer`). ESLint enforces this; using `motion` fails lint and inflates the bundle.
- ❌ Import `clsx` for conditional classes — always `classNames` from `primereact/utils`. The project pins on `classNames` for consistency with PrimeReact's passthrough system.
- ❌ Translate Figma's absolute frame width / per-section `padding-x` literally instead of anchoring every top-level `<section>` with `container-custom` — this is the #1 cause of misaligned sections in Figma-driven screens. Every section (and the inner content of full-bleed layout chrome — Navbar, Footer) MUST use `container-custom`. NEVER substitute with `max-w-[Xpx]`, `max-w-7xl`, or arbitrary horizontal per-section paddings.
- ❌ Strip vertical padding from sections "because container-custom handles spacing" — IT DOES NOT. `container-custom` is horizontal-only (max-width + 16px lateral gutter). Every section must keep its own `py-*` / `pt-*` / `pb-*` translated from Figma; sections without vertical padding collapse against each other and look broken.
- ❌ Skip the "confirm with user" checkpoint at the end of Step 0
- ❌ Manual scaffolding instead of invoking `/new-component`, `/new-screen`, `/new-modal` (sub-agents already follow this rule, but you might be tempted)
- ❌ Pass components to `figma-components` as PROSE only (no `figmaNodeId`) — screenshots and text descriptions hide structure (e.g. which fill belongs to which node, auto-layout direction, exact paddings, hover/focus variants), and prose-driven components are the #1 source of rework. Resolve a representative nodeId for every component during Step 0.
- ❌ Pre-extract the design context for each component in Step 0 and pass it as prose to `figma-components` — that is exactly the failure mode the nodeId-per-component rule prevents. Let the agent fetch its own design context per nodeId; that's the whole point of isolated sub-agent contexts.
- ❌ Mis-route assets across the flat-vs-nested split. The convention is:
  - **SVG icons** → ALWAYS flat at `src/assets/icons/{Name}Icon.tsx`. Icons are reused across screens.
  - **Per-screen raster images** (hero photos, screen-specific illustrations) → nested at `src/assets/images/{screenSlug}/{name}.webp`. The orchestrator passes `screenSlug` to the asset agent when the image belongs to one screen.
  - **Shared raster assets** (logos, repeated brand graphics) → flat at `src/assets/images/{name}.webp` (no `screenSlug` passed).
  Don't invent further subfolders like `src/assets/images/shared/patterns/` — the two-level structure (`{screenSlug}/` OR flat) is it. Sub-agents that pick the wrong bucket are getting it wrong; the orchestrator decides the bucket via the `screenSlug` parameter, not the agent.

---

## Quick reference

| Step | What | Sub-agent | Model | Input from parent |
|------|------|-----------|-------|--------------------|
| 0 | Inventory & gap analysis | (parent) | Opus | **FULL design file URL** |
| 1 | Tokens | `figma-tokens` | Haiku | List of colors/sizes/fonts to add |
| 2 | Assets | `figma-assets` | Haiku | List of assets with type + URL + target name |
| 3 | Components | `figma-components` | Opus | fileKey + extend list (with `figmaNodeId` each) + create list (with `figmaNodeId` each) + token names |
| 4 | Layouts | `figma-layouts` | Sonnet | Current layouts state + Figma findings |
| 5.1 | Scaffold screens | `figma-scaffold` | Haiku | Screen list (name, **screenType**, route, routeGroup, Figma-or-TBD) + `detectedLanguage` + `currentHtmlLang` |
| 5.2 | Per-screen implementation (sequential auto + post-screen checkpoint) | `figma-screen` | Opus | Per-screen: name, **screenType**, **screenSlug**, desktop/mobile URLs, **detectedLanguage**, expected reusable components (from Step 3 registry) |
| 6 | Validation | `figma-validation` | Haiku | Scope (or empty for full sweep) |
