---
name: figma-design-import
description: Orchestrates the bottom-up import of a full Figma design file into this codebase — inventory → tokens → assets → components → layouts → screens → validation. Delegates each step to a dedicated sub-agent in `.claude/agents/` so each task runs in the right model (Haiku for mechanical, Sonnet for moderate, Opus for architectural). Invoke when starting to translate a complete Figma design to code, NOT for one-off component tweaks. For a single screen/component, prefer `/figma:figma-implement-design`.
---

Import a Figma design end-to-end following the project's bottom-up workflow. Arguments: **$ARGUMENTS**

**REQUIRED**: a Figma URL pointing to the FULL design file (or the page that contains every screen + every component). Steps 0 through 4 rely on seeing the entire design at once — token analysis, component reuse detection, and shared layout extraction all depend on global visibility.

If the argument is missing OR clearly points to a single screen/component, STOP and ask the user:

> Necesito el link al **archivo completo de Figma** (la página con todas las pantallas + componentes). Pegame algo como `https://figma.com/design/{fileKey}/{name}?node-id=X-Y` donde X-Y apunta al canvas/page raíz, no a una pantalla individual. Si solo querés implementar una pantalla, usá `/figma:figma-implement-design` en vez de este skill.

Do not proceed past Step 0 with a partial design — the inventory will be wrong and you'll have to refactor.

---

## Workload tracking (cost telemetry across the flow)

Maintain a running ledger of every sub-agent invocation. After each delegation returns, append a row:

```
| Step | Sub-agent | Model | Duration | Tool calls | Notes |
|------|-----------|-------|----------|------------|-------|
| 1 | figma-tokens | Haiku | 12s | ≈5 | 6 colors + 4 sizes added |
| 2 | figma-assets | Haiku | 45s | ≈21 | 14 images, 5 icons |
| 3 | figma-components | Opus | 3m | ≈23 | 6 new + 1 extended |
| ... | ... | ... | ... | ... | ... |
```

**Where each column comes from** (every sub-agent ends its `Output to parent` with a standardized 3-line footer):

```
---
Workload: model={haiku|sonnet|opus}, tool_calls≈{N}, files_touched={M}
Validation: lint=✅/❌, type-check=✅/❌
Notes: {one-line count summary}
```

- `Model` ← `Workload: model=...` from the footer.
- `Duration` ← **measured by the orchestrator** from wall-clock time between the `Agent(...)` call start and return. Don't ask the sub-agent to self-report — it can't measure it accurately and the harness already exposes it.
- `Tool calls` ← `Workload: tool_calls≈...` from the footer. If you need per-tool breakdown (`Read×8, Write×12, Bash×3`), derive it from the visible tool calls in the agent's run log — that detail is not part of the footer.
- `Notes` ← `Notes:` line from the footer, used verbatim.

Append the `Validation:` line of the footer to the checkpoint message after each step so the user sees lint/type-check status without scrolling through the agent's full report.

**Show the ledger at every checkpoint** (end of Step 0, end of Step 5.1, between each Step 5.2 screen, end of Step 6) so the user can see cost-per-step accumulating in real time and decide whether to keep going. At the end of the batch, also show approximate cost class:
- Green: mostly Haiku/Sonnet (cheap)
- Yellow: mixed
- Red: heavy Opus usage (expected for Step 5.2 per-screen)

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
   ```

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

Skip any asset where a PrimeIcon already covers the need (`pi pi-{name}`).

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

Pass to the agent the full screen list from the gap analysis: each screen's name, page type, route, and route group (if any). All screens — both those with Figma sources and those that are TBD — get the same `"Próximamente"` placeholder for consistency. Step 5.2 will replace the Figma-sourced ones with real implementations. The agent invokes `/new-screen` for each, sets the placeholder content, ensures `metadata.alternates.canonical` is exported, and verifies routes are reachable.

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
Desktop URL: figma.com/design/{fileKey}/{name}?node-id={desktop_id}
Mobile URL: figma.com/design/{fileKey}/{name}?node-id={mobile_id}   (or "no mobile variant" if missing)
Images: descargá de Figma
Existing components to reuse: {list from Step 3}
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

## Anti-patterns (do NOT do this)

- ❌ Accept a partial design (single-screen URL) at the start — the skill needs the FULL file for the inventory pass
- ❌ Skip Step 0 and "just start with the screens"
- ❌ Run any step yourself when there's a sub-agent for it — you waste Opus tokens on Haiku-grade work
- ❌ Forget to pass relevant context (gap analysis, decisions made) when delegating — sub-agents start fresh and won't know what you've decided
- ❌ Wait for user input BEFORE implementing each screen in Step 5.2 — the Step 0 registry already has every nodeId; auto-delegate, then ask AFTER each one completes (per-screen checkpoint, not pre-screen prompt)
- ❌ Skip the per-screen checkpoint and chain through every screen in one shot — the user wants to review each result before the next starts
- ❌ Halt the whole Step 5.2 batch silently if one screen fails — surface the error in the next checkpoint and let the user choose retry / skip / stop
- ❌ Hardcode hex colors anywhere — always tokens
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
| 5.1 | Scaffold screens | `figma-scaffold` | Haiku | Screen list (name, type, route, Figma-or-TBD) |
| 5.2 | Per-screen implementation (sequential auto + post-screen checkpoint) | `figma-screen` | Opus | (none upfront — checkpoint after each screen for optional adjustments) |
| 6 | Validation | `figma-validation` | Haiku | Scope (or empty for full sweep) |
