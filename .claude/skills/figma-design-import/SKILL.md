---
name: figma-design-import
description: Orchestrates the bottom-up import of a full Figma design file into this codebase — inventory → tokens → assets → components → layouts → screens → validation. Delegates each step to a dedicated sub-agent in `.claude/agents/figma-design/` so each task runs in the right model (Haiku for mechanical, Sonnet for moderate, Opus for architectural). Invoke when starting to translate a complete Figma design to code, NOT for one-off component tweaks. For a single screen/component, prefer `/figma:figma-implement-design`.
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

> ⚠️ **DELIBERATELY DUPLICATED — the twin at `claude-design-import/SKILL.md` carries a parallel copy of this whole section. Edit BOTH or they drift.** This is the one documented exception to [`CLAUDE.md`'s "edit once, both inherit" doctrine](../../../CLAUDE.md#keep-figma-design-import-and-claude-design-import-in-sync). The rule would put it in `design-import-shared.md`, but that file is `Read` at pre-flight by **every step agent of both flows** — and the ledger is orchestrator-only instruction. Moving it there would load it into ~7 sub-agent contexts per import to serve one reader. Duplication was chosen with eyes open; the cost is that this section is the likeliest place in the two skills to go out of sync.
>
> Only the *substance* is shared. Naturally-divergent details stay per-flow: the agent-name column (`figma-*` vs `claude-design-*`), the frontmatter path (`.claude/agents/figma-design/` vs `.claude/agents/claude-design/`) and each flow's own step numbering.

Maintain a running ledger of every sub-agent invocation. After each delegation returns, append a row:

```
| Step | Sub-agent | Model | Duration | Tool calls | Tokens | Notes |
|------|-----------|-------|----------|------------|--------|-------|
| 1 | figma-design-tokens | Haiku | 12s | 5 | 8k | 6 colors + 4 sizes added |
| 2 | figma-design-assets | Haiku | 45s | 21 | 14k | 14 images, 5 icons |
| 3 | figma-design-components | Opus | 3m | 23 | 85k | 6 new + 1 extended |
| ... | ... | ... | ... | ... | ... | ... |
```

**`Tokens`, `Tool calls` and `Duration` are REPORTED BY THE HARNESS — never estimate them.** The result of every `Agent(...)` call ends with a `<usage>` block carrying the exact figures:

```
<usage>subagent_tokens: 70655   tool_uses: 22   duration_ms: 392235</usage>
```

Read `subagent_tokens` → `Tokens`, `tool_uses` → `Tool calls`, `duration_ms` → `Duration`. These are measured, not modelled — do NOT derive them from `tool_calls × model_factor`, and do NOT take `tool_calls` from the agent's footer. (A per-tool-call heuristic was used here historically; it ran 2–3× low against measured runs and is gone. If a `<usage>` block is ever absent, say `Tokens: n/a` rather than inventing a number.)

Round to two significant figures in the ledger (`85k`, not `85,124`). The point is to see whether Step 5.2 per-screen invocations are creeping into the hundreds-of-thousands range so the user can pause before the next one.

**Where the other columns come from** (every sub-agent ends its `Output to parent` with a standardized 3-line footer):

```
---
Workload: model={haiku|sonnet|opus}, tool_calls≈{N}, files_touched={M}
Validation: lint=✅/❌, type-check=✅/❌
Notes: {one-line count summary}
```

- `Model` ← **read from the sub-agent's frontmatter** in `.claude/agents/figma-design/{name}.md` (Read the file, parse `model: {value}` from the YAML header). Do NOT trust `Workload: model=...` in the footer — that's a string the sub-agent typed, and it drifts if the frontmatter changes without the footer template being updated in lockstep. The frontmatter is the source of truth; the footer field exists only so the human reader sees the value inline. **Two exceptions:** Steps 0.55 and 5.2b run the builtin `general-purpose`, which has no file under `.claude/agents/` — record the model you actually passed.
- `Duration`, `Tool calls`, `Tokens` ← the `<usage>` block of the `Agent(...)` result (see above). Exact, harness-measured. The footer's `tool_calls≈` is the agent's own count — ignore it for the ledger; `<usage>` wins.
- `Notes` ← `Notes:` line from the footer — but **do not repeat its counts to the user unverified**; see the rule immediately below. It is a self-reported summary, not a measurement.
- `Validation` ← `Validation:` line from the footer.

Append the `Validation:` line of the footer to the checkpoint message after each step so the user sees lint/type-check status without scrolling through the agent's full report.

### Verify the deliverable counts against the filesystem — do NOT trust the report

The rule above (`Tokens`/`Tool calls`/`Duration` come from the harness, never from the agent) exists because a sub-agent's self-report is a reconstruction, not a measurement: it runs in isolated context, makes dozens of tool calls, then summarizes from memory at the end. **That applies to the DELIVERABLE counts too — and those are the ones that reach the user.**

Measured, not hypothetical. On a `claude-design-import` run, all three main step agents misstated their own output — including **`design-validation`, which is the SAME shared agent file this flow delegates to at Step 6**:

| Agent | Claimed | Actual |
| --- | --- | --- |
| `{flow}-tokens` | "39 colors created" | 31 |
| `{flow}-assets` | "17 PNGs reused **from prior run**" | there was no prior run |
| `design-validation` (shared) | "27 tokens · 23 webp · 23 `.hash.txt` deleted" | 31 · 24 · 24 |

`design-validation` also attributed a type change to the wrong component — so the error is not only arithmetic, it can be in *which file was touched*. In every case the underlying work was correct; only the reporting was wrong. The failure mode is a property of the sub-agent architecture, not of the design source, so it is not specific to either flow.

**After any step that produces files, spend one command confirming the count before writing it into the ledger or repeating it to the user:**

```bash
# POSIX
# Step 1 — token decisions actually recorded: the tokens agent appends ONE ROW per CREATE/REUSE to
# design-tokens-map.md, so count the rows this run added (the step is not committed yet at verification
# time). Grepping tailwind.config.js keys is unreliable — nested namespaces and digitless names like
# brand-primary match no single pattern. First import: subtract the 2 header rows the agent just created.
git diff -U0 -- design-tokens-map.md | grep -c '^+|'
# Step 2 — downloaded/converted assets + generated icon components
find src/assets/images -name '*.webp' | wc -l ; ls src/assets/icons/*.tsx | wc -l
# Steps 3 / 5.1 / 5.2 — the files the agent said it wrote really exist
ls src/components/{Name}/ src/screens/{Name}Page/
# Step 6 — the scratch cleanup really happened (this one is silently skipped most often)
find src/assets/images -name '*.hash.txt' | wc -l    # expect 0
```

```powershell
# Windows — this project's primary shell (`wc`, `find -name` and `grep -c` do not exist in PowerShell)
(git diff -U0 -- design-tokens-map.md | Select-String '^\+\|').Count    # first import: subtract the 2 header rows
(Get-ChildItem src/assets/images -Recurse -Filter *.webp).Count ; (Get-ChildItem src/assets/icons/*.tsx).Count
Get-ChildItem src/components/{Name}/, src/screens/{Name}Page/
(Get-ChildItem src/assets/images -Recurse -Filter *.hash.txt).Count    # expect 0
```

If a count disagrees with the report, **the filesystem wins**: use the real number and say so in the checkpoint. A mismatch is worth one line to the user, not a re-delegation — the work is usually fine.

### Two report failures that are NOT miscounts — handle them differently

A wrong number is the common case and the rule above covers it. These two are not wrong numbers, and treating them like one loses real information:

**1. An empty or truncated return is NOT a failed run — check the filesystem before re-delegating.** An agent can end its turn without emitting its report at all (e.g. it kicked off its own background command and stopped waiting for it). The `<usage>` block still arrives, so the step *looks* like it ran and returned nothing. **The work is usually complete on disk.** Re-delegating blind is the expensive mistake: it re-does an Opus step, and on a step that writes files it can double-write. Instead: `git status` the paths that step owns, read the files, and run its validation yourself. Only re-delegate if the deliverables are genuinely missing or half-written. Record the row as normal with a `⚠️ returned without report; verified on disk` note. (Measured on a `claude-design-import` run — the mechanism is the harness, not the flow, so it applies here identically: `claude-design-layouts` returned nothing while its layout, header, footer and nav constants were all complete and correct on disk.)

**2. Distrust "pre-existing" and "unrelated" — they are claims about history the agent cannot see.** A sub-agent starts fresh: it has no idea which files YOUR flow created ten minutes ago. So when a report waves something away as *"pre-existing … unrelated"* — especially while reporting `lint=✅` or `type-check=✅` — verify before accepting it. This is worse than a miscount, because a miscount is visibly a number while this **suppresses a real failure** and reads as diligence.

The check is two seconds: `git status --porcelain <path>` (untracked/modified means your flow touched it) or the file's mtime. Measured: a scaffold agent reported `lint=✅` and dismissed a `check-file/filename-naming-convention` error as a *"pre-existing … unrelated"* naming issue — the file had been created by an earlier step of the **same flow** fifteen minutes before, and lint was genuinely failing. It is the only class of report error in that run that would have shipped a red gate to the user.

> Both of these generalize past their own step: the rule is that an agent's claims about **things outside its own turn** — what existed before, what another step did, whether something is related — carry no evidence and must be checked. Its claims about **what it just did** are merely unreliable (see the counts rule above).

**Show the ledger at every checkpoint** (end of Step 0, end of Step 5.1, between each Step 5.2 screen, end of Step 6) so the user can see cost-per-step accumulating in real time and decide whether to keep going. At the end of the batch, also show the cumulative `Tokens` sum and the per-model breakdown:

```
Cumulative tokens 420k
  haiku: 30k
  sonnet: 15k
  opus: 375k    ← Step 5.2 per-screen is the dominant share
```

This makes the trajectory inspectable: if the per-screen Opus delta starts rising sharply across consecutive screens (Step 5.2), the user can pause and decide whether to simplify the remaining screens before continuing.

This makes the model-assignment promise verifiable — if Step 1 ends up running on Opus by mistake, the ledger surfaces it.

---

## Commit cadence — commit each validated step, not just the scaffold

**Commit each step once its validation is green**, with a `[ TYPE ] description` subject scoped to that step's concern (`[ ADD ] Design tokens`, `[ ADD ] Converted design assets`, `[ FEATURE ] Scaffold design routes`, `[ FEATURE ] {Name}Page`). An import touches tokens, assets, components, layouts, routes and N screens; batching all of it into one commit produces a diff nobody can review and nothing to bisect when a later step regresses an earlier one. It also makes "revert just the screens, keep the tokens" a real option — which is what a user actually asks for after a long import.

Screens commit **per screen**, at the checkpoint, so the history mirrors the checkpoints the user already walked through.

*Unless the user asked you not to commit* (a test/dry run, a dirty worktree they're inspecting, a branch they own) — **their instruction wins**; skip the commits and say so rather than committing anyway or silently dropping the step. Same for a step that returned red: fix it or surface it, do not commit a broken gate.

---

## How this skill manages models automatically

You (the parent agent, typically Opus) act as the **orchestrator**. You do Step 0 directly because it requires holistic judgment. Every other step is delegated via the `Agent` tool to a dedicated sub-agent in `.claude/agents/figma-design/`. Each sub-agent has its model pre-set in its frontmatter, runs in **isolated context**, and returns only a summary — keeping your context lean and using the cheapest viable model per task.

| Step | Sub-agent | Model | Why this model |
|------|-----------|-------|----------------|
| 0 | (you, the parent) | Opus | Holistic judgment + checkpoint with user |
| 0.55 | `general-purpose` | Sonnet | Re-derives the spec from Figma to catch the parent's own errors — the only step that gates YOUR decisions. Builtin agent, no file under `.claude/agents/`; record the model you actually passed it |
| 1 | `figma-design-tokens` | Haiku | Mechanical config edits |
| 2 | `figma-design-assets` | Haiku | Bash + boilerplate from templates |
| 3 | `figma-design-components` | Opus | Component API design, extend-vs-create judgment |
| 4 | `figma-design-layouts` | Sonnet | Moderate decisions, known patterns |
| 5.1 | `figma-design-scaffold` | Haiku | Mechanical `/new-screen` invocations |
| 5.2 | `figma-design-screen` | Opus | Pixel-perfect fidelity, heaviest token user |
| 5.2b | `general-purpose` (fidelity diff) | Sonnet | Diffs each implemented screen against its frame — the twin of 0.55, on the output side. Builtin agent, no file under `.claude/agents/` |
| 6 | `design-validation` | Haiku | Run commands + report findings (shared agent). Its runtime half is a deterministic script, so no model measures anything |

**Always pass enough context** in each delegation prompt — sub-agents start fresh, they don't see your conversation. Include relevant gap-analysis data, file paths, and decisions already made.

---

## Why this flow exists

Implementing Figma top-down (screen-first) leads to:
- Hardcoded colors/typography (because tokens aren't in `tailwind.config.js` yet)
- Duplicated components (because the inventory of existing ones in `src/components/` wasn't checked)
- Repeated navbars/footers (because layouts weren't decided before screens)
- Refactor passes after the fact

Bottom-up (this skill) prevents all of that. **Do not skip steps.** Each layer depends on the previous — so **run them in order, one delegation at a time, and wait for each to return before starting the next.** Steps that look independent are not safe to overlap: several of them write the same files (`src/app/layout.tsx` is touched by Steps 1, 4 and 5.1; `src/styles/general.sass` by Steps 1 and 4), and a step running with stale knowledge of what exists can undo work another step just did (see [§ C1b](../../docs/design-import-shared.md#c1b-stay-inside-your-brief--never-delete-what-it-does-not-name) for the measured case). The checkpoint after each step is the sequencing mechanism, not a formality.

---

## Step 0 — Inventory & gap analysis

> **Run directly** (no delegation). This is the architectural pass — needs Opus and full visibility.

Read the Figma source AND the relevant codebase before touching any file.

1. **Figma context** — call `get_design_context` on the user's nodeId. If the response is too large, fall back to `get_metadata` first, then `get_design_context` on specific sub-nodes. As a last resort, delegate the file parsing to a generic subagent that returns a structured summary.
2. **Codebase context** — read these to know what already exists:
   - `tailwind.config.js` — existing colors (`surface-*`), typography scale, breakpoints
   - `design-tokens-map.md` (project root, may not exist yet) — Figma-variable → Tailwind-token mapping from prior imports. ALWAYS read this first: if a Figma variable from the current node is already mapped, do NOT propose it as a new token; reuse the mapped one.
   - `src/styles/index.sass` — fonts loaded
   - `src/components/` — list every folder; cross-reference with the [Existing Reusable Components](../../CONVENTIONS.md#existing-reusable-components) table in `.claude/CONVENTIONS.md`
   - `src/layouts/` — `AuthLayout`, `DashboardLayout`, `GeneralLayout`
   - `src/proxy.ts` — current `AUTH_PATHS`, `PUBLIC_PATHS`
   - `src/assets/icons/index.ts` — existing icons
3. **Produce a gap analysis** as a written report (in chat — NOT a `.md` file unless the user asks):

   ```markdown
   ## Tokens
   - Already mapped (in design-tokens-map.md): [list — `figmaVar` → `tailwindToken`]
   - Add: [list new Figma variables that need a token decision; the figma-design-tokens agent will apply its REUSE/CREATE/BLOCK policy]
   - Already covered (Tailwind has an exact match by hex AND name is not yet mapped): [list]
   - **Warnings**: if any proposed token would override `surface-*` or any existing token, flag it here — the figma-design-tokens agent will block these unless the user explicitly confirms.

   ## Assets
   - SVGs to convert to React components: [list with Figma node IDs]
   - Images to convert to WebP: [list]

   ## Components (with representative Figma nodeIds — MANDATORY)
   Every component (whether to extend or create) MUST have a representative Figma `nodeId` resolved here. `figma-design-components` will refuse to work without one — it forbids prose-only specs because building components from text descriptions consistently produces wrong-but-plausible output (screenshots hide structure: a colored area may be the IMAGE fill rather than a card frame; auto-layout direction, exact spacing per side, and hover/focus variants are invisible until the node is inspected).

   How to resolve a nodeId:
   - If the Figma file has a dedicated "Components / Library / Design System" page → pull the nodeId from there (canonical source).
   - Otherwise → take the FIRST instance of that component you find in any screen frame. Any single instance works; `figma-design-components` will fetch its design context.

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

   ## Route collisions with what the template already serves
   - Cross the screen list against the routes THIS template already ships and list every collision. The template is not an empty app: it serves `/` (`HomePage`), `/dashboard`, and a **working, Cypress-tested auth flow** — `/login`, `/signup`, email validation, password recovery. A design carrying its own login or signup maps straight onto them, and nothing downstream notices: both screens compile, both routes render, and the app ships with two signups.
   - Per collision: `{ScreenName}Page → {route}` · what the template already serves there · proposal (**reuse the existing route** / **map the design's screen elsewhere** / **the design's version replaces it**). **Reuse is the default** — the auth flow is wired to real session handling and has E2E coverage; the design's version is a drawing of one.
   - **Removing a template route is never a step-agent decision, and rarely the right one.** `typedRoutes: true` makes every route literal type-checked, so deleting `/` or `/dashboard` breaks `redirect('/')`, the auth redirect constants and the error pages — in files this import never touched, plus the specs under `src/cypress/e2e/`.
   - Write `none` when there are none. Deciding this now costs a line; deciding it after Step 5.2 costs an Opus screen.

   ## Cost estimate for Step 5.2
   - `{N} screens · Step 5.2 is the bulk of the cost`. Do NOT quote a per-screen constant from another import — cost varies by screen density. Offer to run the first 2–3 screens, then **recalibrate from the ledger's measured `<usage>` figures** and re-quote the remainder.
   - Past ~10 screens, offer **batching by flow** (auth → marketing → dashboard → …) with a real stop between batches, not just the per-screen checkpoint. A long import is easier to abandon at a batch boundary than at screen 19. This is an offer, not a gate.

   ## PrimeReact accent (app-wide input fidelity)
   The template ships the `lara-light-blue` PrimeReact theme (`src/app/layout.tsx`), so **every** input's focus border and focus ring render blue regardless of the brand you just tokenized. The import produces correct brand tokens and still leaves every form off-brand, app-wide — a fidelity gap no per-screen work can close and no check reports.
   - If the design's accent is not blue, propose the override at the checkpoint: focus/hover border + the focus `box-shadow` ring → the brand accent, **preserving `.p-invalid`'s red**. Step 1 applies it in `general.sass` (it already owns that file).
   - **Offer it; do not apply it silently.** It is a global visual change to a template default, and a project may deliberately keep the PrimeReact look.

   ## Detected language
   - Sample of visible text strings from the Figma frames: {3-5 short quoted examples, e.g. "Comenzar ahora", "Nuestros productos", "Iniciar sesión"}
   - Decision: `en` | `es` — with brief reasoning ({% of strings that are Spanish, presence of accented chars / ñ / common Spanish words like "iniciar/nuevo/comprar/usuario"})
   - **Current `<html lang>`** in `src/app/layout.tsx`: read it and report. If it doesn't match the detected language, flag for switching (the figma-design-scaffold agent will perform the switch).
   ```

   **How to detect language**: from the design context of the screens, collect every `characters` value (visible text). Score: a string is "Spanish-leaning" if it contains any of: `ñ`, accented Latin characters (`á é í ó ú ü`), or whole-word matches against a small list (`iniciar`, `comenzar`, `nuevo`, `usuario`, `comprar`, `ingresar`, `nosotros`, `productos`, `acerca`, `contacto`). If ≥50% of sampled strings are Spanish-leaning → language = `es`. Otherwise → `en`. **Default to `en` on tie or insufficient data** — the template ships English-first, and forcing a switch should only happen with clear majority-Spanish evidence.

   **Building the screen registry**: when you scan the metadata, pair desktop and mobile frames by naming convention. Common patterns:
   - Mobile frames often start with `M-`, `M_`, or `Mobile - ` prefix.
   - Desktop frames carry the canonical name (e.g. `Inicio > Nosotros`).
   - The mobile counterpart usually has the same root name (e.g. `Mobile - Inicio > Nosotros`, `M-INICIO>NOSOTROS`).
   - Frame width is also a signal: ~390px wide → mobile, ~1440px wide → desktop.

   If a desktop has no obvious mobile pair (or vice versa), mark it as `(no mobile variant found)` — don't guess. The user will confirm or correct in Step 0's checkpoint.

4. **Gate your own spec against the Figma source (Step 0.55) — do NOT skip this.**

   > **Delegate to**: `Agent({ subagent_type: 'general-purpose' })` — **Sonnet or cheaper**. One call, before the checkpoint.

   Everything downstream has a source-of-truth gate except **you**. `figma-design-components` refuses a prose-only spec and re-fetches each component's `nodeId` itself — but that gate only proves the agent built *the node you named*. It cannot tell you that you named the **wrong** node, missed a primitive that repeats, or paired the wrong mobile frame. Those global decisions reach the render with nothing checking them, and they are invisible to lint, type-check, `pnpm build` and `design-validation` — they all compile. (On the first `claude-design-import` run of this same gate, **four spec errors were caught, all the orchestrator's own**, including a spec that named a non-representative instance of a repeated glyph — extracting it would have silently re-drawn every call site.)

   **⚠️ Bound the MCP cost — this is the one way this step differs sharply from its `claude-design-import` twin.** That flow's auditor reads local files for free; here every `get_design_context` runs **~80–120K tokens** (see Step 5.2). An auditor told to "re-derive the whole design" would cost as much as implementing a screen. So scope it explicitly:

   - Give the auditor `get_metadata` on the top-level file/page FIRST — cheap, and enough for frame pairing, frame widths and instance counts.
   - **Then `get_variable_defs` on the root node** — also cheap, and it is what makes the COLORS and TYPOGRAPHY questions answerable at all (see the budget table below).
   - Allow `get_design_context` **only** on the specific nodeIds your spec already names (the component list), and `get_screenshot` only where a visual check is the sole way to settle a question.
   - Tell it the budget: a handful of node pulls, not a tree walk. If it needs more to answer a question, it should say so and leave that question unanswered rather than blow the budget.
   - **If the Figma MCP is unavailable** (desktop app closed / Dev Mode off), it must report that and skip — never guess from the screenshot alone, and never block the flow.

   **Know what the cheap tools can and cannot answer, or this gate silently does nothing.** `get_metadata` returns *only* node IDs, layer types, names, positions and sizes — no fills, no text sizes, no stroke weights. So a budget of "metadata + the nodeIds the spec names" genuinely funds some questions and genuinely starves others; the prompt below is ordered accordingly, and the auditor is told to answer in order and stop when the budget runs out:

   | Question | Funded by | Coverage |
   | --- | --- | --- |
   | 1 FRAME PAIRING | `get_metadata` | **Full** — names + widths are exactly what it returns |
   | 2 REPEATED PRIMITIVES | `get_metadata` (counts) + spec nodeIds (representativeness) | **Full** |
   | 3 COLORS / 4 TYPOGRAPHY | `get_variable_defs` | **Defined tokens only** — a hard-coded value that bypasses variables is invisible; say so rather than implying full coverage |
   | 5 ICONS / 6 IMAGE FILLS | `get_design_context` on spec nodeIds only | **Partial by design** — covers what the spec already names, which is the half that catches a WRONG citation. It cannot find a primitive or fill the spec never mentioned, in a frame it never pulls |

   That last row is the honest limit of this gate: it is strong against *mis-citation* and weak against *omission* in un-pulled frames. Accept that rather than lifting the budget — an auditor that walks the tree costs as much as implementing a screen. If you specifically suspect a missing asset, pull that ONE frame yourself and say so in the checkpoint.

   ```
   Figma file: {fileKey}   Root node: {nodeId}
   My spec: {the gap-analysis report you just wrote}

   Re-derive these FROM FIGMA, without reference to my spec, then diff. Report ONLY mismatches, each
   with its nodeId. If my spec is right on a point, say "match" and move on.

   BUDGET — this is a cheap audit, not a re-derivation. Work the questions IN ORDER and stop when you
   run out; a short honest answer beats a complete expensive one:
     - get_metadata on the root FIRST (ids/types/names/positions/sizes only — no fills, no text sizes).
     - then get_variable_defs on the root (defined colour + type tokens).
     - get_design_context ONLY on the nodeIds my spec already names. Never walk the tree: each pull is
       ~80–120K tokens and a tree walk costs as much as implementing a screen.
     - get_screenshot only where a visual check is the ONLY way to settle a question.
   If a question needs data those calls don't give you, WRITE "unanswered — needs {tool} on {node}" and
   move on. Do not spend the budget to complete it, and do not infer the answer from a screenshot.

   1. FRAME PAIRING — list every top-level frame with its name and width. Which are desktop (~1440) vs
      mobile (~390)? Does my desktop↔mobile pairing match yours? Flag any frame I assigned to the wrong
      screen, any pair I invented, and any frame I left out of the registry entirely.
   2. REPEATED PRIMITIVES — for each component in my spec, count how many instances exist across the
      frames. Flag any primitive repeated 2+ times that my spec MISSES. Then check the nodeId I cited is
      REPRESENTATIVE: do all instances share the same structure/variant, or does the one I named differ
      from the majority? (Both halves are load-bearing: a missed 2+× primitive triggers a BLOCKING
      COMPONENT_GAP mid-Step-5.2, and a non-representative nodeId silently mis-builds every call site.)
   3. COLORS (from get_variable_defs) — spot-check my variable→token mapping. Flag (a) any mapped into a
      DIFFERENT HUE FAMILY and (b) any defined colour variable my map does not cover. Note only ONE
      collapse rule is bounded at Δ4: § B2 rule 3 collapses near-duplicates at per-channel Δ ≤ 4, while
      § B2 rule 4's long-tail fold maps a leftover to the NEAREST token in its family at whatever
      distance that is — so a fold wider than Δ4 is not by itself an error; report the distance and let
      me judge. A wrong-hue fold always is. State explicitly that this covers DEFINED VARIABLES only —
      a hard-coded fill that bypasses variables is outside what you checked.
   4. TYPOGRAPHY (from get_variable_defs) — every defined text size. Which land off the project scale
      (10/12/14/16/18/20/24/28/32/36/40/44/48/56/64)? Those must become tokens, never a snap to a nearby
      step. Same caveat: defined variables only.
   5. ICONS (spec nodeIds only) — for the icon nodes my spec names: stroke weight, fill-vs-stroke, style.
      Is there a coherent set? For any glyph used 2+ times, are all instances identical, or does one
      carry an extra sub-path?
   6. IMAGE FILLS / ASSETS (spec nodeIds only) — for the nodes my spec names, list every image fill and
      exported asset, and flag any my asset list omits. (A fill reads as a plain coloured area in a
      screenshot, so it is easy to miss — and a missing image compiles, type-checks and passes every
      convention grep.) Then state plainly which frames you did NOT pull, so I know where this audit is
      blind rather than assuming silence means clean.
   ```

   **Do NOT ask about breakpoints.** Unlike a CSS-based Claude Design export, a Figma file has no `@media` — it carries desktop and mobile *frames*, and Step 5.2 synthesizes responsive from the project scale. Asking an auditor for "the design's breakpoints" invites it to invent values, and [CONVENTIONS > Breakpoints](../../CONVENTIONS.md#breakpoints) forbids re-pointing `2xs`…`2xl` onto a design's numbers. Frame pairing (question 1) is this flow's real equivalent.

   Anything it flags, **verify against Figma yourself** before changing the spec — the auditor can be wrong too. Then fold the confirmed mismatches in and re-show the report.

   > **Known limitation.** If the auditor reports a section whose content is deliberately narrower than its frame, this flow has nowhere to carry it: the Step 5.2 prompt has no `Bespoke widths` field (its twin does), and the `Container rule` tells the screen agent to ignore Figma's frame widths outright. Record it in the checkpoint as a manual note for the developer rather than dropping it.

5. **Stop and confirm with the user** before continuing. The user must approve the plan AND the screen registry before any code is written. This is the most important checkpoint in the flow.

   **Why the registry matters**: Step 5.2 (per-screen implementation) uses these resolved nodeIds automatically — the user won't have to dig through Figma for each pantalla. If the user spots a wrong pairing here, they correct it before we burn tokens implementing the wrong frame.

---

## Step 1 — Tokens (colors, typography, fonts)

> **Delegate to**: `Agent({ subagent_type: 'figma-design-tokens' })` — runs in **Haiku**.

Pass to the agent the exact list from the gap analysis: colors with hex values, typography sizes to add, font families. The agent edits `tailwind.config.js` + `src/styles/index.sass` + (if needed) `src/styles/general.sass`, then runs `pnpm type-check`.

**If the user approved the PrimeReact accent override at the checkpoint, this is the step that applies it.** Pass the accent **token name** and point the agent at [§ B11](../../docs/design-import-shared.md#b11-the-primereact-accent-override--apply-it-only-when-asked-and-write-it-with-apply), which carries the edit spec (the `@apply border-… ring-…` form, the `:not(.p-invalid)` guards, no `!important`, no invented CSS vars). **Omit the item entirely if the user declined** — the agent applies this only when the brief passes a token, so silence is the off switch. Naming the token is not enough on its own: measured twice, a brief that said `→ {ns}-accent` and nothing else produced raw hex both times.

> **The accent block is deliberately duplicated in both `SKILL.md` files** — the Step 0 report item and this paragraph, same convention as [§ Workload tracking](#workload-tracking-cost-telemetry-across-the-flow). It is orchestrator instruction, and the orchestrator's only mandatory pre-flight read is `CONVENTIONS.md`, not `design-import-shared.md`. § B11 there owns the mechanism; these two spots own the decision. Edit both skills or they drift.

You receive: confirmation of changes + type-check result.

---

## Step 2 — Assets

> **Delegate to**: `Agent({ subagent_type: 'figma-design-assets' })` — runs in **Haiku**.

Pass to the agent a list of every asset: type (`svg-icon` | `raster-logo` | `raster-image`), source URL (Iconify or Figma), target file name, and `screenSlug` when the asset belongs to a single screen (omit for shared assets like logos). The agent downloads each, generates React components for SVG icons (following `GmailIcon.tsx` pattern), converts raster to WebP via `sharp` (no ffmpeg), registers exports in `src/assets/icons/index.ts`. Per-screen raster images land at `src/assets/images/{screenSlug}/{name}.webp`; shared raster assets land flat at `src/assets/images/{name}.webp`.

**You (the orchestrator) pre-filter icons before delegating** — the `figma-design-assets` agent does not re-check this. Filter per [`design-import-shared.md` § B8](../../docs/design-import-shared.md#b8-icons--primeicons-pre-filter-vs-the-sources-own-glyph), NOT by "a PrimeIcon with that name exists". First **measure** whether the design ships a coherent icon set (compare the icon nodes' stroke weight / style): if it does, **every member keeps its Figma asset and the import yields zero PrimeIcons** — that is correct, not an oversight. Only when there is no set (mixed/system icons — more common from Figma than from a Claude Design export) do generic affordances (hamburger, close, chevron, search) get dropped from the asset list with a `→ use <i className='pi pi-{name}'/>` note in the gap analysis so the screen agent (Step 5.2) knows. **Brand marks always keep the Figma asset**, set or no set. Decide it here; do NOT ask the user.

You receive: list of files created with their final sizes + lint/type-check status.

---

## Step 3 — Components

> **Delegate to**: `Agent({ subagent_type: 'figma-design-components' })` — runs in **Opus**.

Pass to the agent:
- The Figma `fileKey` (so the agent can call MCP tools itself).
- The list of existing components to extend with which new variants/sizes/states, AND a representative **`figmaNodeId`** for each one (from Step 0's component-node mapping).
- The list of new components to create, AND a representative **`figmaNodeId`** for each one.
- The design tokens already added in Step 1 (colors/typography names, not hex).

`figma-design-components` will INDEPENDENTLY fetch `get_design_context` + `get_screenshot` on each component's nodeId before writing code — that's the gate against prose-driven implementation errors. Do not try to pre-extract the design and pass it in as prose; let the agent fetch and interpret the structured data directly.

If any component in your input lacks a `figmaNodeId`, the agent will refuse to proceed. Resolve the nodeIds in Step 0 — they are cheap to obtain (any instance of the component in any screen frame works) and save much more in rework cycles down the line.

The agent reads existing `.tsx` and `.sass` files, finds usages with Grep (to avoid breaking callers), extends or creates following project conventions, and validates each one.

You receive: a table of which variants were added to which component, file paths touched, and lint/type-check status.

---

## Step 4 — Layouts

> **Delegate to**: `Agent({ subagent_type: 'figma-design-layouts' })` — runs in **Sonnet**.

Pass to the agent:
- Current state of `src/layouts/` (existing layouts).
- Figma layout findings: which screens share a header/footer pattern.
- Names of any new layouts to create.

The agent compares, adjusts, or creates layouts in `src/layouts/{Name}/`, wires them up in `src/app/{(group-name)}/layout.tsx` route groups, and ensures they compose existing components (Navbar, Footer) rather than duplicating JSX.

**A confirmed no-op is a valid outcome — still delegate.** See [§ C5b](../../docs/design-import-shared.md#c5b-a-confirmed-no-op-is-a-valid-outcome--still-delegate). If the design shares no chrome across screens, do NOT skip Step 4 and do NOT run it yourself — delegate, pass your reading, and ask the agent to verify or refute it. Equally, tell it not to invent layout work to justify the step. A cheap Sonnet pass returning "no-op, here's the evidence" is the point: the parent's reading is the one thing with no other gate.

You receive: layouts adjusted/created (or a reasoned no-op) + route groups wired + lint/type-check status.

---

## Step 5 — Screens + routing

Two phases: scaffold all screens at once (5.1), then implement each one in detail (5.2).

### 5.1 — Scaffold all screens with placeholders

> **Delegate to**: `Agent({ subagent_type: 'figma-design-scaffold' })` — runs in **Haiku**.

Pass to the agent the full screen list from the gap analysis. **Before delegating, read `src/app/layout.tsx` and extract the current `<html lang>` value** — pass it as `currentHtmlLang`. Required input to the agent:

- For each screen: `screenName`, `screenType` (`auth` | `public` | `protected`), `route`, `routeGroup` (optional), `isFromFigma` (boolean).
- Batch-level: `detectedLanguage` (`en` | `es`, from Step 0) and `currentHtmlLang` (the literal value you just read).

All screens — both those with Figma sources and those that are TBD — get the same placeholder for consistency (`"Coming soon"` when language is `en`, `"Próximamente"` when language is `es`). Step 5.2 will replace the Figma-sourced ones with real implementations. The agent invokes `/new-screen` for each (which generates `metadata.alternates.canonical` from the start), sets the placeholder content in the right language, switches `<html lang>` and `openGraph.locale` in `src/app/layout.tsx` if they don't match the detected language, and verifies routes are reachable.

After this step, **commit the scaffold as a checkpoint** — per [§ Commit cadence](#commit-cadence--commit-each-validated-step-not-just-the-scaffold) above.

You receive: list of created routes + lint/type-check status.

### 5.2 — Per-screen implementation (sequential auto with checkpoint between each)

> **Delegate to**: `Agent({ subagent_type: 'figma-design-screen' })` — runs in **Opus**, **one invocation per screen, sequential with a per-screen checkpoint**.

This is the heaviest token usage of the whole flow. By delegating each screen to its own `figma-design-screen` agent invocation, the screen's `get_design_context` (~80–120K tokens), screenshots, and image downloads stay in the sub-agent's context — they NEVER touch yours. After each screen, you only see a short report.

**Sequential auto-iterate with checkpoints.** As soon as Step 5.1 commits, walk the Step 0 registry one screen at a time:

1. Pick the next screen with a real Figma source (skip "Próximamente" / TBD).
2. Delegate to `figma-design-screen` with the standard prompt (below).
3. When the subagent returns, post a SHORT report and ask the user a checkpoint question.
4. Branch on the user's response:
   - **Empty / "siguiente" / "continuá" / "ok" / "next"** → move to step 1 with the next screen.
   - **Adjustment instructions** (free text, e.g. "achicá el hero un 20%", "el contact form va del lado izquierdo en mobile") → re-delegate to `figma-design-screen` for THE SAME screen with the adjustment notes appended to the prompt. After it returns, post the new report and re-ask the checkpoint.
   - **"parar" / "stop" / "pausá"** → halt the batch and tell the user how to resume (e.g. "decime `seguí desde {ScreenName}` cuando quieras retomar").
   - **Skip-specific** ("saltá esta", "después la veo") → mark the screen as skipped, move to next.
5. After the last screen (or when user halts), post the cumulative final report.

**Standard prompt for each `figma-design-screen` invocation:**

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
  # Pre-resolved from Step 3 output (screen registry → expected reusable components) — short-circuits the per-screen reuse audit so figma-design-screen doesn't have to re-grep src/components/.
Tokens available: {list from Step 1}
Container rule: every top-level <section> MUST be anchored with `container-custom` (or wrap its content in a child <div className='container-custom ...'> when the section has a full-bleed background). The class already brings a built-in 16px lateral gutter — do NOT add `px-*` on the same element. Ignore Figma's absolute frame width and per-section padding-x — they break cross-section alignment. BUT keep the per-section `py-*` / `pt-*` / `pb-*` from Figma intact — `container-custom` only handles horizontal spacing, so every section still needs its own vertical rhythm.
Adjustment notes (only on re-runs): {text from user}
```

The default image strategy is `descargá de Figma` since the user didn't provide URLs. The `figma-design-screen` agent will curl + `sharp` each asset into `src/assets/images/{screen-slug}/`.

**Gate the IMPLEMENTATION against the design (the twin of Step 0.55) — before each checkpoint.**

> **Delegate to**: `Agent({ subagent_type: 'general-purpose' })` — **Sonnet**. One call per screen, between the screen agent returning and you posting the checkpoint. Give it the screen's **desktop nodeId** and the emitted files; tell it to pull `get_design_context` on that node ONCE and read no other node — this is the same pull the screen agent already made, and letting it wander the file is how a cheap gate turns expensive.

Step 0.55 diffs your **spec** against the design *before* anything is built. Step 6 runs *after*, but only over **generic invariants** — lint, type-check, build, the convention greps, and a runtime sweep that measures widths and overflow. **Neither one ever compares the implemented screen to its own frame.** So a screen can be visually or interactively unfaithful while being token-clean, convention-clean and build-clean, and pass every gate the flow has: an extra field added to a form, a static label rendered as an input, a bottom sheet turned into a centered dialog, a near-match component substituted for the one the design draws, an optional prop switched on where the design's instance does not use it.

```
Design: fileKey {key}, desktop nodeId {X:Y}   # pull get_design_context on THIS node only
Output: src/screens/{Name}Page/{Name}Page.tsx + .sass

Read the frame, then the output, and report where the output is NOT faithful to the frame.
Check exactly these, per § B9/B10 of .claude/docs/design-import-shared.md:
1. CONTROL SET — every input/button/link/toggle in the output with no counterpart in the frame, and every
   one in the frame missing from the output. Include required-markers.
2. AFFORDANCES — anything the frame draws as static text rendered as editable/clickable, or vice versa.
3. LABELS — the frame's label typography vs what the output renders.
4. MODAL PRESENTATION — bottom-sheet / centered / full-screen, per overlay.
5. COMPONENT SUBSTITUTION — a frame primitive implemented with an existing component that differs in
   radius/border/fill/stroke/aspect. Say which parameters differ.
6. INSTANCE PROPS — optional props or variants enabled on a call site the frame's instance does not use.
7. DERIVED VISUALS — hash colours, initials, generated placeholders: does the mapping match?
8. FORM INITIAL STATE — if this screen creates something, does it start blank/minimal as the frame shows?
Report ONLY mismatches, each with the frame's element name + the output line. Where it matches, say "match".
Do NOT fix anything. Do NOT judge whether the design is right — only whether the output matches it.
```

**Its findings are ADVISORY and the user adjudicates them — never auto-fix, and never "correct" a screen on the strength of this report alone.** The design is not automatically right for the codebase either: an import with no backend legitimately turns a mocked edit into static text. That is exactly why the output is a list for a person rather than a patch. Surface the findings inside the checkpoint below; if the user wants any applied, re-delegate the screen with them as `Adjustment notes:`.

Skip the gate for a screen the user skipped. If the diff agent returns nothing, say `fidelity diff: sin hallazgos` — silence is a result, not an omission.

**Per-screen checkpoint message (post after each subagent returns).** Keep it tight so the user can decide quickly:

```
✅ {Name}Page implementada ({images_count} imágenes, {duration})
   Ruta: /{path}
   Archivos: src/screens/{Name}Page/, src/assets/images/{slug}/
   Fidelidad vs diseño: {"sin hallazgos" | the diff's findings, one line each, marked as adjudicables}

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

- **Screen with desktop only (no mobile pair found)** → pass the desktop URL and the literal `"no mobile variant"` in the `Mobile URL:` field (the agent STOPs `INVALID_INPUT` on an ABSENT field — the placeholder is what satisfies it), and tell `figma-design-screen` to apply best-effort responsive defaults (mobile-first Tailwind, stacked layout below `md:`). Mention this in the checkpoint message so the user knows.
- **Screen with mobile only** → same in reverse: pass the mobile URL and `"no desktop variant"` in the `Desktop URL:` field, and ask the agent to extrapolate desktop from the project's container/breakpoint conventions.
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

Pass any provided fields to `figma-design-screen`; fall back to the registry for the rest.

---

## Step 6 — Code validation

> **Delegate to**: `Agent({ subagent_type: 'design-validation' })` — **Haiku**. Pass `importFlow: 'figma-design-import'` so it names `figma-*` agents in the suggested-fixers mapping, plus the **scope** (below). This is the **shared** validation agent (also used by `claude-design-import`); it carries 44 static checks **plus a runtime invariant sweep** that renders every route in a browser.
>
> **Pass the ROUTE LIST with a value for every dynamic segment** (`/products/[id]` → an id that exists in the mock data). The runtime sweep skips a route it cannot resolve, and a skipped route is reported as unverified — which is correct, but it means you lose the check unless you supply the parameter.
>
> **Fallback — ONLY if `design-validation` is not an available `subagent_type`.** A project agent can silently fail to load ([#14018](https://github.com/anthropics/claude-code/issues/14018)) — see [`agent-loading-troubleshooting.md`](../../docs/agent-loading-troubleshooting.md). Then run the sweep inline (below) rather than hard-failing or skipping validation, and **say in the report that validation ran inline (fallback) and is a reduced check set** — the inline sweep is a strict subset of the agent's, so a clean inline run proves less.

**Scope — pass it to the agent, or apply it inline.** Hand over the list of files this import created/modified so findings can be ATTRIBUTED; without it you'll read pre-existing template violations as import defects (`Waves.tsx`, `Filters.sass`, `mixins.sass` legitimately carry hex; `sentry-example-page/` is a documented throwaway). **It does NOT narrow what gets checked** — the agent still runs every check over its own paths and splits the OUTPUT into `IN SCOPE` / `PRE-EXISTING`. That is deliberate: several checks assert repo-wide invariants an import can break in a file it never wrote (a global-only modal newly mounted in an existing component, a `'use client'` pushed onto an existing layout), and this list is assembled from the step agents' self-reported `files_touched` — the very thing the ledger rules above tell you to distrust. Partitioning makes an incomplete list *mislabel* a finding; filtering would make it *vanish*. **Build the file list as you go** — every step agent's report names the files it touched; accumulate them in the workload ledger and hand that list over. Do not reconstruct it from `git status` (the worktree may hold unrelated work) and do not default to `src/`.

**The inline sweep** (fallback only):

1. `pnpm run lint-check --fix` → expect **0 errors**. Warnings are OK if they're the mandated `// TODO: openapi-import` markers (`sonarjs/todo-tag`); flag anything else.
2. `pnpm run type-check` → expect clean.
3. `pnpm run build` → catches what lint/tsc can't (SASS compile, `theme()` resolution, static generation). If it fails on a missing `.env.local`, that's the pre-`/init-project` state, NOT your bug — say so and move on.
4. Convention greps over the scope list only (`$F` = the accumulated paths):

```bash
# raw hex — icon components are the documented exception (their fill/stroke IS the brand),
# as are rgba() alpha overlays and a `// FLAG raw-hex gradient` marked per B4.
grep -rn "#[0-9a-fA-F]\{3,8\}" $F | grep -v "rgba\|assets/icons/\|FLAG raw-hex"
# loose typography (banned — must be text-{weight}-{size})
grep -rnE "\b(text-(xs|sm|base|lg|[0-9]?xl)|font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black))\b" $F
# px-* on the same element as container-custom (banned — 16px gutter is built in)
grep -rn "container-custom" $F | grep -E "px-[0-9]"
# banned imports
grep -rn "from 'clsx'\|import { motion }\|from '@/api\|useSWR\|customFetch" $F
```

> Do NOT grep for `theme(` — [§ B4](../../docs/design-import-shared.md#b4-brand-gradients--the-one-hex-exception-besides-icons) tells agents to *prefer* `bg-[linear-gradient(…,theme(colors.x),…)]`, so its presence in a `.sass` is the recommended output, not a defect. Step 3's `pnpm build` already fails on a genuinely unresolvable `theme()`.

5. Structural checks that greps get wrong — **verify these by reading, not by regex**: exactly one `<h1>` and one `<main>` per rendered page (a multi-line JSX `<a>` will make a naive `target='_blank'`-without-`rel` grep produce false positives — check the 2 lines after each hit before reporting it); SEO metadata completeness on every public page (`title`/`description`/`alternates.canonical`/`openGraph`/`twitter`); heading hierarchy; a11y on clickable non-buttons; `aria-label` on icon-only buttons.
6. **The runtime sweep — run it even in the fallback.** It is a script, not an agent, so the load failure that sent you here cannot affect it, and it is the only part of Step 6 that would have caught the defects greps miss:

```bash
node .claude/scripts/render-audit.mjs --app . --routes "<the import's routes>" --param <k>=<v> --out "<scratch>/render-audit"
```

Exit `0` = clean · `1` = findings (a result, not a crash) · `2` = the sweep did not run, so report the runtime check as FAILED rather than clean. Paste its tables verbatim, numbers included, and hand its `SUSPECT` rows to yourself to adjudicate against the design source — they are measured anomalies that may be intentional.

Report findings in a categorized `path:line` shape. **Don't auto-fix** — surface and offer to delegate to the relevant agent.

**Then clean up the import's scratch state.** The `.hash.txt` siblings are import-scoped: Step 2 writes them so it can dedup across screen folders, and Step 5.2 reads them to skip a re-download from the Figma MCP. Once validation has run, nothing else consumes them — they are not source, and they are ~100 bytes of noise per image. Delete them as the last action of the flow:

```bash
find src/assets/images -name '*.hash.txt' -delete
```

Say how many you removed. The `.webp` files are the deliverable and stay. A future import re-downloads and re-converts from Figma — the cost is one MCP round-trip per asset, paid once.

**Step 6 now has two halves, and only one of them renders.** The static half (lint, type-check, build, the greps) is blind to anything that needs layout. The runtime sweep closes part of that gap — it measures widths, background bands, overflow, hover colours and the mobile menu in a real browser — but it is still **not** a fidelity check:

- it **cannot** see a breakpoint mapped to the wrong width, a glyph or typeface swapped for a near-identical one, or a spacing value that shipped at 40px instead of 72px. Each of those renders a perfectly coherent page.
- it reports what it could **not** reach in a `SKIPPED` list. Read it — an unreachable route is unverified, not passing.

So a clean Step 6 means *nothing violated a known invariant*, never *the design was reproduced*. Visual review against Figma is still the developer's job via the per-screen checkpoint in Step 5.2. (Measured on a real import: five defects shipped after Step 6 reported clean on every static check — which is why the runtime half exists.)

You receive: a categorized report (passing / warnings / failing) with `path:line` references. Don't auto-fix violations — surface them to the user and offer to delegate the fix to the relevant agent (`figma-design-tokens` for hex, `figma-design-components` for a11y, etc).

---

## Handling agent STOPs

Every sub-agent in this flow may emit a STOP at the end of its report following the [STOP Protocol](../../CONVENTIONS.md#stop-protocol) defined in CONVENTIONS.md. As the orchestrator, you MUST parse and handle each STOP. The two severities:

- **`STOP-BLOCKING`** — the sub-agent could NOT complete. You must resolve before re-invoking the same agent. Resolution path depends on the `next_agent` field.
- **`STOP-ADVISORY`** — the sub-agent completed with a documented default (`default_applied:` field describes what). You continue the flow but MUST surface the advisory in the next per-screen checkpoint so the user can decide to re-delegate post-batch.

### Decision tree per STOP

When you see `STOP-BLOCKING`:

| `next_agent` value | What to do |
| ------------------ | ---------- |
| `figma-design-tokens` | Delegate to `figma-design-tokens` with the `details:` payload, then re-invoke the original sub-agent. |
| `figma-design-components` | Delegate to `figma-design-components` with the missing variant nodeId, then re-invoke. |
| `figma-design-layouts` | Delegate to `figma-design-layouts` with the user's decision, then re-invoke. |
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

Every STOP contributes one row to the workload ledger with the `Notes` column quoting the category and severity (e.g. `Notes: 1 STOP-BLOCKING TOKENS_MISSING (delegated to figma-design-tokens)`). This makes per-batch STOP frequency visible — if `COMPONENT_GAP` advisories keep firing on the same component across multiple screens, the user can decide to upgrade the component once via `figma-design-components`.

---

## Anti-patterns (do NOT do this)

- ❌ Accept a partial design (single-screen URL) at the start — the skill needs the FULL file for the inventory pass
- ❌ Skip Step 0 and "just start with the screens"
- ❌ Skip Step 0.55 because the gap analysis "looks right" — it is the ONLY check on the orchestrator's own decisions, and every error it catches is one that compiles, type-checks and passes `design-validation`
- ❌ Let the Step 0.55 auditor walk the whole Figma tree — bound it to `get_metadata` + the nodeIds your spec names, or one gate costs as much as implementing a screen
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
- ❌ Pass components to `figma-design-components` as PROSE only (no `figmaNodeId`) — screenshots and text descriptions hide structure (e.g. which fill belongs to which node, auto-layout direction, exact paddings, hover/focus variants), and prose-driven components are the #1 source of rework. Resolve a representative nodeId for every component during Step 0.
- ❌ Pre-extract the design context for each component in Step 0 and pass it as prose to `figma-design-components` — that is exactly the failure mode the nodeId-per-component rule prevents. Let the agent fetch its own design context per nodeId; that's the whole point of isolated sub-agent contexts.
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
| 0.55 | Gate the spec against the source | `general-purpose` | Sonnet | fileKey + root nodeId + your gap-analysis report (**bound the MCP pulls** — `get_metadata` first, `get_design_context` only on the nodeIds the spec names) |
| 1 | Tokens | `figma-design-tokens` | Haiku | List of colors/sizes/fonts to add |
| 2 | Assets | `figma-design-assets` | Haiku | List of assets with type + URL + target name |
| 3 | Components | `figma-design-components` | Opus | fileKey + extend list (with `figmaNodeId` each) + create list (with `figmaNodeId` each) + token names |
| 4 | Layouts | `figma-design-layouts` | Sonnet | Current layouts state + Figma findings |
| 5.1 | Scaffold screens | `figma-design-scaffold` | Haiku | Screen list (name, **screenType**, route, routeGroup, Figma-or-TBD) + `detectedLanguage` + `currentHtmlLang` |
| 5.2 | Per-screen implementation (sequential auto + post-screen checkpoint) | `figma-design-screen` | Opus | Per-screen: name, **screenType**, **screenSlug**, desktop/mobile URLs, **detectedLanguage**, expected reusable components (from Step 3 registry) |
| 5.2b | Gate the implementation against the design | `general-purpose` | Sonnet | That screen's desktop nodeId (ONE `get_design_context` pull) + the emitted `.tsx`/`.sass` |
| 6 | Validation | `design-validation` | Haiku | Scope (or empty for full sweep) + `importFlow: 'figma-design-import'` + the **route list with a value for every dynamic segment** (for the runtime sweep) |
