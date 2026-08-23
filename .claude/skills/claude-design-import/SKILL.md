---
name: claude-design-import
description: Orchestrates the bottom-up import of a full Claude Design prototype into this codebase — unpack → inventory → tokens → assets → components → layouts → screens → validation. Ingests either a Project archive (.zip, unzipped — RECOMMENDED) or a Standalone HTML export; a local deterministic extractor (unpack.mjs) auto-detects which and replaces Figma's MCP calls, so the design context is read from disk for free. Delegates each step to a dedicated sub-agent in `.claude/agents/claude-design/` at the right model tier. Invoke when translating a whole Claude Design prototype to code, NOT for one-off tweaks.
---

Import a Claude Design prototype end-to-end following the project's bottom-up workflow. Arguments: **$ARGUMENTS**

**REQUIRED — one of two source shapes** (`unpack.mjs` accepts either; it auto-detects which):

1. **A Project archive** — Export → **Download as .zip → "Project archive"** (a.k.a. the "Send to coding agent" bundle). **This is the RECOMMENDED source.** It is the whole project folder: every raw `.dc.html`/`.jsx`, `support.js`, real asset files, the `uploads/` briefs, and a **README that names the primary design**. For a **multi-page** design it is the only source guaranteed to hold every page, because they are all on disk. **You unzip it to a scratch dir and pass the FOLDER** (unpack.mjs takes a directory, not the `.zip`).
2. **A URL (or path) to a "Standalone HTML" export** — the single self-contained `.html`. Always fine for a single-page design; **for multi-page its coverage is per-export and not predictable in advance** — use it when there's no archive.

> **How much of a multi-page design a Standalone actually carries — measured.** It varies by export and you cannot predict it: one multi-page dclogic Standalone carried **8 pages complete** (full link closure, no missing siblings), while a 5-page dclogic landing's carried **1 of 5**. You are never left guessing, though — when pages ARE missing `unpack.mjs` **aborts** and names them exactly (see [§ Step 0 partial-export](#step-0--unpack-the-export-deterministic-no-llm)). The failure is loud, not silent.
>
> The archive is still the recommendation — it removes the variance, and it is the only path that can hold a page the Standalone never bundled. But prefer it for that reason, not for a truncation that may not happen. **And "archive" does not mean "no judgment needed": it selects its entry from the README, which can put the wrong page at `/` — see the ORPHAN ENTRY warning under `multi-page` routing.**

If the argument is missing OR is neither a Project-archive folder nor an `.html` export/URL, STOP and ask the user:

> Necesito **una** de estas dos: (a) el **Project archive** — Export → Download as .zip → "Project archive" (o "Send to coding agent") — que trae TODO el proyecto y es lo recomendado (los diseños multi-página se importan completos); descomprimilo y pasame la carpeta. O (b) la **URL al "Standalone HTML"** (sirve para una sola página; en multi-página se queda corta). No sirven el PDF/PPTX.

**If given a `.zip`, unzip it to a scratch dir first** (outside `src/`), then run `unpack.mjs` on the resulting folder. Do not proceed past Step 0 without a successful unpack — a partial/failed extraction makes every downstream step wrong.

## Pre-flight — Read CONVENTIONS.md (mandatory)

Before delegating to any sub-agent, `Read` [`.claude/CONVENTIONS.md`](../../CONVENTIONS.md). As the orchestrator you need it for two purposes:

1. **Gap analysis (Step 0.5)** — the [Existing Reusable Components](../../CONVENTIONS.md#existing-reusable-components) table is the authoritative reuse list. [Color System](../../CONVENTIONS.md#color-system), [Typography System](../../CONVENTIONS.md#typography-system) and [Breakpoints](../../CONVENTIONS.md#breakpoints) define what already ships vs what's new.
2. **STOP protocol handling** — every sub-agent may emit `STOP-BLOCKING` / `STOP-ADVISORY` per the [STOP Protocol](../../CONVENTIONS.md#stop-protocol). You parse and route them (see "Handling agent STOPs").

If `CONVENTIONS.md` is missing, STOP the whole flow — every sub-agent depends on it.

Also read `design-tokens-map.md` (project root, shared with `figma-design-import`; may not exist yet) BEFORE proposing tokens, so a variable already mapped by a prior import is reused, not duplicated.

---

## What a Claude Design export actually is (read once)

The "Standalone HTML" export is **not** flat HTML — it's a self-contained page in a private `__bundler` format: a `manifest` (base64 assets + fonts + gzip'd source keyed by UUID), an `ext_resources` alias map, and a `template` (the real inner HTML as a JSON string). A **babel** export is a React SPA whose components use **inline `style={{}}` objects + CSS custom properties**, a screen registry for routing, and **prop-drilled state** with inline mock data — but the specifics vary by export: a `THEMES` token object, `window.HOST`/`GUEST` registries and `HOST_TABS` drive some babel exports, yet others have none of those (CSS vars in a stylesheet, one nested `SCREENS` registry, a 393px frame). Treat that first shape as ONE instance, not the contract. Most prototypes are **mobile-app shaped** (≈390–430px phone frame, iOS chrome). (A **dclogic** export is the native `.dc.html` format instead — see Format handling.)

`unpack.mjs` turns all of that into a clean working tree you read from disk — no per-node token cost, unlike Figma's MCP.

---

## Workload tracking (cost telemetry across the flow)

> ⚠️ **DELIBERATELY DUPLICATED — the twin at `figma-design-import/SKILL.md` carries a parallel copy of this whole section. Edit BOTH or they drift.** This is the one documented exception to [`CLAUDE.md`'s "edit once, both inherit" doctrine](../../../CLAUDE.md#keep-figma-design-import-and-claude-design-import-in-sync). The rule would put it in `design-import-shared.md`, but that file is `Read` at pre-flight by **every step agent of both flows** — and the ledger is orchestrator-only instruction. Moving it there would load it into ~7 sub-agent contexts per import to serve one reader. Duplication was chosen with eyes open; the cost is that this section is the likeliest place in the two skills to go out of sync.
>
> Only the *substance* is shared. Naturally-divergent details stay per-flow: the agent-name column (`claude-design-*` vs `figma-*`), the frontmatter path (`.claude/agents/claude-design/` vs `.claude/agents/figma-design/`), the token-namespace grep, and each flow's own step numbering.

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

Read `subagent_tokens` → `Tokens`, `tool_uses` → `Tool calls`, `duration_ms` → `Duration`. Measured, not modelled — do NOT derive them from `tool_calls × model_factor` (a per-tool-call heuristic runs 2–3× low against measured runs). If a `<usage>` block is ever missing, report `Tokens: n/a` rather than inventing a number. Round to two significant figures (`85k`, not `85,124`).

Each sub-agent ends its `Output to parent` with the standardized footer:

```
---
Workload: model={haiku|sonnet|opus}, tool_calls≈{N}, files_touched={M}
Validation: lint=✅/❌, type-check=✅/❌
Notes: {one-line count summary}
```

- `Model` ← **read from the sub-agent's frontmatter** in `.claude/agents/claude-design/{name}.md` (source of truth; the footer string can drift). The one exception is Step 0.55's `general-purpose`, a builtin with no file under `.claude/agents/` — record the model you actually passed it.
- `Duration` / `Tool calls` / `Tokens` ← the `<usage>` block of the `Agent(...)` result (above). The footer's `tool_calls≈` is the agent's own count — ignore it for the ledger; `<usage>` wins.
- `Notes` / `Validation` ← from the footer, but see the verification rule immediately below — the `Notes` line is a self-reported summary, not a measurement.

**Append the footer's `Validation:` line to the checkpoint message after each step**, so the user sees lint/type-check status without scrolling through the agent's full report.

### Verify the deliverable counts against the filesystem — do NOT trust the report

The rule above ("`Tokens`/`Tool calls`/`Duration` come from the harness, never from the agent") exists because an agent's self-report is a reconstruction, not a measurement. **That applies to the DELIVERABLE counts too, and those are the ones that reach the user.** A sub-agent runs in isolated context, makes dozens of tool calls, and then summarizes from memory at the end; the summary is the least reliable part of an otherwise-correct run.

This is measured, not hypothetical — on one dclogic single-page-sections run **all three** of the main step agents misstated their own output:

| Agent | Claimed | Actual |
| --- | --- | --- |
| `claude-design-tokens` | "39 colors created" | 31 |
| `claude-design-assets` | "17 PNGs reused **from prior run**" | there was no prior run |
| `design-validation` | "27 tokens · 23 webp · 23 `.hash.txt` deleted" | 31 · 24 · 24 |

`design-validation` also attributed a type change to `CustomButton` that was actually made to `InputContainer` — so the error is not only in the arithmetic, it can be in *which file was touched*. In every case the underlying work was correct; only the reporting was wrong.

**So: after any step that produces files, spend one command confirming the count before you write it into the ledger or repeat it to the user.** The check is seconds long and the asymmetry is the whole point — an invented number that reaches the final report is one the user has no way left to catch.

Substitute `{ns}` with the namespace you actually used (`ac-`, …) — pasted verbatim it matches nothing and reports 0.

```bash
# POSIX
# Step 1 — tokens actually in the config (the trailing screens/ entries are NOT colors; count the hex rows)
grep -cE "'\{ns\}-[a-z]+-[0-9]+': '#" tailwind.config.js
# Step 2 — converted assets + extracted icons
find src/assets/images -name '*.webp' | wc -l ; ls src/assets/icons/*.tsx | wc -l
# Step 3 / 5.1 / 5.2 — the files the agent said it wrote really exist
ls src/components/{Name}/ src/screens/{Name}Page/
# Step 6 — the scratch cleanup really happened (this one is silently skipped most often)
find src/assets/images -name '*.hash.txt' | wc -l    # expect 0
```

```powershell
# Windows — this project's primary shell (`wc`, `find -name` and `grep -c` do not exist in PowerShell)
(Select-String -Path tailwind.config.js -Pattern "'\{ns\}-[a-z]+-[0-9]+': '#").Count
(Get-ChildItem src/assets/images -Recurse -Filter *.webp).Count ; (Get-ChildItem src/assets/icons/*.tsx).Count
Get-ChildItem src/components/{Name}/, src/screens/{Name}Page/
(Get-ChildItem src/assets/images -Recurse -Filter *.hash.txt).Count    # expect 0
```

If a count disagrees with the report, **the filesystem wins**: use the real number and say so in the checkpoint. A mismatch is worth one line to the user, not a re-delegation — the work is usually fine.

### Two report failures that are NOT miscounts — handle them differently

A wrong number is the common case and the rule above covers it. These two are not wrong numbers, and treating them like one loses real information:

**1. An empty or truncated return is NOT a failed run — check the filesystem before re-delegating.** An agent can end its turn without emitting its report at all (e.g. it kicked off its own background command and stopped waiting for it). The `<usage>` block still arrives, so the step *looks* like it ran and returned nothing. **The work is usually complete on disk.** Re-delegating blind is the expensive mistake: it re-does an Opus step, and on a step that writes files it can double-write. Instead: `git status` the paths that step owns, read the files, and run its validation yourself. Only re-delegate if the deliverables are genuinely missing or half-written. Record the row as normal with a `⚠️ returned without report; verified on disk` note. (Measured: on one multi-page dclogic run `claude-design-layouts` did exactly this — `LandingLayout` + its header/footer components + the nav constants were all complete and correct.)

**2. Distrust "pre-existing" and "unrelated" — they are claims about history the agent cannot see.** A sub-agent starts fresh: it has no idea which files YOUR flow created ten minutes ago. So when a report waves something away as *"pre-existing … unrelated"* — especially while reporting `lint=✅` or `type-check=✅` — verify before accepting it. This is worse than a miscount, because a miscount is visibly a number while this **suppresses a real failure** and reads as diligence.

The check is two seconds: `git status --porcelain <path>` (untracked/modified means your flow touched it) or the file's mtime. Measured on the same run: `claude-design-scaffold` reported `lint=✅` and dismissed a `check-file/filename-naming-convention` error on a nav constants file as *"pre-existing … naming convention issue, unrelated"* — that file had been created by **Step 4 of the same flow** fifteen minutes earlier, and lint was genuinely failing. It is the only class of report error in this run that would have shipped a red gate to the user.

> Both of these generalize past their own step: the rule is that an agent's claims about **things outside its own turn** — what existed before, what another step did, whether something is related — carry no evidence and must be checked. Its claims about **what it just did** are merely unreliable (see the counts rule above).

**Show the ledger at every checkpoint from 5.1 onward** (end of 5.1, between each 5.2 screen, end of 6) with a cumulative sum + per-model breakdown, so the trajectory is inspectable and the user can pause before the Opus-heavy Step 5.2 creeps up. (Not at the end of 0.5 — nothing has been delegated yet, so the ledger is empty.)

---

## Commit cadence — commit each validated step, not just the scaffold

**Commit each step once its validation is green**, with a `[ TYPE ] description` subject scoped to that step's concern (`[ ADD ] Design tokens`, `[ ADD ] Converted design assets`, `[ FEATURE ] Scaffold design routes`, `[ FEATURE ] {Name}Page`). An import touches tokens, assets, components, layouts, routes and N screens; batching all of it into one commit produces a diff nobody can review and nothing to bisect when a later step regresses an earlier one. Per-step commits also make "revert just the screens, keep the tokens" a real option — which is what a user actually asks for after a long import.

Screens commit **per screen**, at the checkpoint, so the history mirrors the checkpoints the user already walked through.

*Unless the user asked you not to commit* (a test/dry run, a dirty worktree they're inspecting, a branch they own) — **their instruction wins**; skip the commits and say so rather than committing anyway or silently dropping the step. Same for a step that returned red: fix it or surface it, do not commit a broken gate.

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
| 5.2b | `general-purpose` (fidelity diff) | Sonnet | Diffs each implemented screen against its source — the twin of 0.55, on the output side |
| 6 | `design-validation` | Haiku | Run commands + report (shared agent). Its runtime half is a deterministic script, so no model measures anything |

**Always pass enough context** in each delegation — sub-agents start fresh. Above all, pass the **path to the unpacked working tree** and the **specific extracted file(s)** each agent needs (its source of truth), plus decisions already made.

---

## Why this flow exists

Implementing a prototype top-down (screen-first) leads to hardcoded hex/px (tokens not in `tailwind.config.js` yet), duplicated components (existing `src/components/` not checked), repeated chrome (layouts not decided first), and refactor passes. Bottom-up prevents all of that. **Do not skip steps.** Each layer depends on the previous — so **run them in order, one delegation at a time, and wait for each to return before starting the next.** Steps that look independent are not safe to overlap: several of them write the same files (`src/app/layout.tsx` is touched by Steps 1, 4 and 5.1; `src/styles/general.sass` by Steps 1 and 4), and a step running with stale knowledge of what exists can undo work another step just did (see [§ C1b](../../docs/design-import-shared.md#c1b-stay-inside-your-brief--never-delete-what-it-does-not-name) for the measured case). The checkpoint after each step is the sequencing mechanism, not a formality.

---

## Step 0 — Unpack the export (deterministic, no LLM)

Run the extractor. Pick a scratch output directory **outside** the repo `src/` tree (the session scratchpad, or a temp dir) — never write the raw dump into the project.

```bash
# Project archive (RECOMMENDED): unzip first, then pass the FOLDER.
unzip "<archive>.zip" -d "<SCRATCH_DIR>/archive"          # or Expand-Archive on Windows
node .claude/scripts/unpack.mjs "<SCRATCH_DIR>/archive" "<SCRATCH_DIR>/unpacked"

# OR a Standalone HTML export (URL or local .html):
node .claude/scripts/unpack.mjs "<EXPORT_URL_OR_HTML>" "<SCRATCH_DIR>/unpacked"
```

> **`unpack.mjs` auto-detects the source** (a **directory** → Project archive; a `.html`/URL → Standalone) and writes the SAME IR either way, so every downstream step is source-agnostic. `inventory.sourceMode` records which (`archive` | `standalone`) and `inventory.archiveEntry` names the design the archive's README selected.
>
> **How the archive path works (read once):** a Project archive is the user's WHOLE project — several designs, version-copies (`- export`, `deploy/`, `v2`), bundled variants (`(offline)`/`(standalone-src)`/`-print`), older iterations, and `uploads/`. The extractor reads the **handoff README's `**Read \`…\` in full**` line to pick the ONE primary design**, then resolves its dependency **closure** from disk (linked `.dc.html` pages, `<link>` stylesheets, images) — so version-copies and other designs are ignored automatically. Per-format:
> - **dclogic** → follows the sibling-`.dc.html` href closure. **Multi-page imports COMPLETE** (e.g. a 5-page site → 5 routes), which is the whole reason to prefer the archive.
> - **vanilla** (plain `.html`+`.css`) → inlines the linked `styles.css` and writes it to `source/`, and writes the `<head>` to `source/index.head.html` (the Google-Fonts `<link>` lives there and NOWHERE else). **Multi-route IS detected when the page is a client-side router** whose routes are inline `<script type="text/template" data-route="X">` blocks: each becomes `source/route.{key}.markup.html` + one `screens[]` entry, `navModel=multi-page`, entry route → `/`. Any OTHER router idiom is NOT detected — a `notes` line says so explicitly when no blocks are found, so `screens=1` on a vanilla export is a claim to verify against the source, not a fact. (A vanilla site split across sibling `.html` FILES is still captured as its README-named entry only — see Known limitations.)
> - **babel** (`.jsx` / `text/babel`) → **STOPs by design** with guidance to import that design via its Standalone HTML export instead (a babel SPA is fully captured by the standalone; the archive adds nothing). NOT an error to debug.
> - **bundled entry** — if the README names an `(offline)`/`(standalone-src)` variant that already carries a `__bundler` envelope, the extractor decodes it via the standalone path automatically (a note flags it; a bundled variant may hold only one page of a multi-page design, so prefer the raw `.dc.html` entry if the import looks short).

It writes: `source/*` (component source — babel: `source/jsx/*.jsx`; dclogic: `source/{screen}.markup.html` + `source/{screen}.logic.js` + `source/{screen}.helmet.css`; vanilla: `source/index.markup.html`), `assets/img/*` (decoded images), `fonts.json`, `tokens.json` (incl. `rawScan.clusters` — the B2 colour pre-grouping), `nav-graph.json`, `components.json`, and `inventory.json`.

> **The dclogic CSS lives in `source/{screen}.helmet.css`, and ONLY there.** The `<helmet>` carries the design's real stylesheet — its `@media` breakpoints, `@font-face`, CSS vars — and `{screen}.markup.html` has it stripped out (0 `@media`), so never look for a breakpoint in the markup. `template.html` is a convenience copy of the whole export, written for **babel and single-page dclogic only** — it does NOT exist for multi-page dclogic or vanilla, so read `source/*.helmet.css` rather than relying on it. (`inventory.screens[].file` points at the right source file for each screen — always use that, never a hardcoded path.)

**Read `inventory.json` first** — your map for Step 0.5: `format` (babel|dclogic|vanilla), `navModel` (screen-registry|single-page-sections|multi-page|single-page), `tokenSource` (themes-object|inline+helmet|inline+css), `targetSignals` (with a mobile-app|web `guess`), counts, `screens` (the authoritative list — each `key`/`component`/`role`/`file`; babel = one per registry KEY, dclogic multi-page = one per page, dclogic single-page = one per section), `components`, `brandFonts` (`{body, display, families}` — load `families`, preload `body`), `fontFamilies` (superset), `images` with `uuid`, **`remoteImages`** (photos referenced by URL and NOT shipped in the export — absent from `images[]`; raises a WARNING note; needs a user decision at the checkpoint, see Step 0.5 > Assets), `brand`, `tokenNamespaces`, `registries`/`tabs` (babel only — and possibly empty even then; see Format handling), and `notes` (**READ THESE** — they carry per-format orchestration guidance the parser inferred, including the nested-registry and partial-export flags).

**Format handling (read `inventory.format`).** `unpack.mjs` normalizes 3 flavors into the SAME IR:
- `babel` — React SPA. **Fully supported end-to-end.** **The registry shape is NOT mandated** — a screen registry maps `key → component`, but it comes flat (`{home: HomeScreen}`) in some babel exports and nested (`{home: {c: HomeScreen, role:'cliente'}}`) in others; `unpack.mjs` reads both. **`THEMES` and `window.HOST`/`GUEST`/`HOST_TABS` are present in SOME babel exports and entirely absent in others.** So `tokenSource` may be `themes-object` OR `inline+helmet` for babel, and `registries`/`tabs` may be empty — treat their presence as per-export, never assumed. When a registry is nested, `inventory.notes` flags it and `screens[].role` holds the registry NAME (read the per-entry role, e.g. `cliente`/`prestador`, from source at Step 0.5).
- `dclogic` — Claude Design's native `.dc.html` (`<x-dc>` markup + `class Component extends DCLogic` + `<helmet>`); `navModel` = `single-page-sections` or `multi-page`; `tokenSource` = `inline+helmet`; no `THEMES` (tokens from inline styles + `<helmet>`).
- `vanilla` — plain HTML/CSS/JS (best-effort; no reference sample — treat with care).

> **`babel` is not a legacy/dead format.** Claude Design's current system prompt mandates the DC (`.dc.html`) format for *new* UI, but existing `.jsx` projects are still edited and exported as babel today — a fresh export can be either flavor. Do not assume a babel export is old or malformed.

> **Implementation status.** `babel` (React) and `dclogic` **single-page-sections** (declarative — `state`/`renderVals()`/`{{holes}}`/`sc-if`) are wired **end-to-end**. `dclogic` **multi-page**: the shared-chrome **layout**, static structure, tokens and `style-hover` ARE wired — **but imperative interactivity is NOT yet translated.** A `.logic.js` built on `componentDidMount` + `querySelector`/`addEventListener`/`IntersectionObserver`/`setInterval` over refs + `data-*` (dropdowns, scroll-reveals, carousels/marquee) will render **static**. **Before running a multi-page export, read its `.logic.js`: if it's imperative (no `state`/`renderVals`), WARN the user** that dropdowns/reveals/carousels will come out as TODOs until the imperative-DCLogic path lands.

> `vanilla` is **best-effort**, but no longer untested: a full 10-route vanilla import ran end-to-end on 2026-07-20 (tokens → assets → 19 components → layout → 10 screens → validation, all gates green). What that run proved is narrow — the **template-block router** idiom works; a vanilla design using any other routing shape, or split across sibling `.html` files, is still unexercised. A vanilla export's imperative `<script>` (scroll listeners, `IntersectionObserver` reveals, count-ups, gallery swaps, click-to-load iframes) translates fine, but **it is the parent's job to read that script and spec the behaviors** — nothing extracts them for you. If extraction is thin (empty `screens`, missing `brandFonts` — see `inventory.notes` WARNINGs), surface it first.

> **Partial-export abort (a specific non-zero exit — do NOT treat as a bug).** A Standalone HTML export carries ONE design; when that design links to sibling `.dc` pages (`<a href="Equipo.dc.html">`), those pages are **not in the bundle**, and a naïve import would silently produce a site with them missing (measured: a 5-page dclogic landing extracted as `screens=1`, no warning). The script now detects the dangling links and **aborts with the exact missing-page list**. This is not an unsupported-format failure — the remedy is one of:
> - **BEST — use the Project archive** (Export → .zip → "Project archive"), unzip it, pass the folder: it contains every `.dc.html`, so the multi-page design imports complete. This is the real fix and the reason the archive path exists.
> - Or re-export each linked page as its own Standalone HTML and import them one at a time, OR
> - re-run `unpack.mjs` with **`--allow-partial`** to import only the bundled design (its cross-page links stay dead ends — a `notes` WARNING records this and you MUST relay it to the user).
>
> Surface this to the user and let them choose — do NOT auto-pass `--allow-partial`. (An **archive** never hits this abort for truncation — every page is on disk; there, a dangling link means a genuinely broken link in the design, and the abort message says so.)

> **Known limitations (archive path).** A **vanilla** site split across multiple sibling `.html` pages is captured as its README-named entry ONLY — the extractor does not follow a plain-`.html` page closure the way it does for `.dc.html`. So a vanilla project whose README names `index.html` imports just the home page.
>
> **It now DETECTS and reports the gap rather than truncating silently.** On the archive path the entry's own relative same-dir `.html` links are checked against disk, and any that exist but aren't covered by a detected route produce a `notes` WARNING naming them. Deliberately a detector, not a closure: `.html` is far more common than `.dc.html`, so a BFS would happily pull in unrelated pages — a loud "I did not import these" beats a heuristic that over-collects. **The count is a FLOOR** (one level deep, entry links only): on one multi-page vanilla site's `index.html` it finds 7 while the site really has 9 others, because `producto` and `novedad` are linked only from sub-pages. Import each missing page separately, or accept the gap knowingly.
>
> **The general trap to keep in mind: "format X was validated on design Y" is worth nothing unless someone checked that Y actually exercises X's hard part.**

If `unpack.mjs` exits non-zero for any OTHER reason, STOP and report — unrecognized/unsupported export or a format change.

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
- **Colors — start from `rawScan.clusters`, do NOT cluster 40+ hexes by hand.** `unpack.mjs` pre-groups them per [`design-import-shared.md` § B2](../../docs/design-import-shared.md#b2-color--cluster-the-raw-scan-map-to-tokens-never-raw-hex): each entry is `{ representative, hexes[], uses, roles, dominantRole, suggestedFamily }` — grouped by **single-link** clustering at per-channel Δ ≤ 4, tagged with the CSS role each hex appears in (`text`/`background`/`border`/`icon`/`gradient`/`shadow`) and its usage count, sorted by `uses`. Your job is to **review and NAME** them (`suggestedFamily` is a hint, not a decision — verify it, especially on saturated tints), fold the long tail into the nearest family per § B2 rule 4, and hand the tokens agent the named result.

  **Single-link means Δ ≤ 4 holds between ADJACENT members, NOT across a cluster's extremes** — chained clusters really do come out wider than 4, so verify rather than trust the bound: on one dclogic export, 2 of 33 clusters exceeded it (`["#eaf3fa","#e9f6fb","#eaf6fb","#eef7fb","#eef8fc"]` → Δ5; `["#e1ecf4","#e2f0f8","#e4f3fb"]` → Δ7). Split any cluster whose ends read as different colours. Note the clusters are a **hint about the raw scan**, not a token count: 33 clusters is not 33 tokens — § B2 rule 4's long-tail fold is what turns them into a palette.
- Already mapped (design-tokens-map.md): [`figmaVar/themeKey` → `tailwindToken`]
- Add: [new colors (hex), typography sizes, breakpoints the tokens agent should REUSE/CREATE/BLOCK]
- Typography sizing: **every off-scale source size becomes a real token** (both flows add tokens, they do NOT snap — see [§ B1](../../docs/design-import-shared.md#b1-typography--off-scale-sizes-become-real-tokens-both-flows-never-rounded)).
  **YOU pre-round the fractional sizes HERE, before delegating Step 1** — do not leave it to Steps 3/5.2. A fractional size (13.5, 16.5 — common in a dclogic `rawScan`) can't be a token (the plugin builds `.${prefix}-${size}`, so the suffix must be an integer), so round each to the nearest integer first (**ties up**, deterministic), then hand the tokens agent the resulting off-scale INTEGERS. The tokens agent runs at **Step 1** and assumes it only ever receives integers; if you defer the rounding to the screen agent at **Step 5.2**, every fractional size resurfaces there as `TOKENS_MISSING` → re-delegate tokens → **re-run the Opus screen agent**. One list here costs nothing; the omission costs an Opus re-run per screen.
  Worked example (a real dclogic `rawScan`): `10.5→11, 12.5→13, 13.5→14, 14.5→15, 15.5→16, 16.5→17, 17.5→18, 18.5→19`; of those, `14/16/18` land on-scale (no token) and the rest join the off-scale integers → **11 new tokens** (`11/13/15/17/19/21/27/30/34/50/58`). A noisy `rawScan` producing ~10 typography tokens is expected under this rule — fidelity over a lean token set.
- Radius — **branches on `tokenSource`; [§ B3](../../docs/design-import-shared.md#b3-radius--token-driven-figma-vs-plain-css-literals-claude-design) is the source of truth, this is only the summary.** Radii are never per-value tokens and never a `TOKENS_MISSING` STOP.
  - **`themes-object` (babel)** — one `var(--radius)` drives everything, so decide ONE canonical translation here (a specific `rounded-*` step, or a single `borderRadius` token like `rounded-card` if no step is close) and pass it to Steps 3 + 5.2 so every component renders the SAME radius.
  - **`inline+helmet` / `inline+css` (dclogic / vanilla)** — there is NO `--radius`; radii are per-element literals (cards 20–24px, buttons 12–13px, pills 999px) → exact `rounded-[Npx]` per element. The `Radius translation` field below is **N/A** — say so explicitly in the delegation, and do NOT pass a single value (a fabricated "canonical radius" flattens a design that never had one).
- Breakpoints — **the design's own `@media` become real TOKENS, exactly like colors (§ B2) and off-scale sizes (§ B1). Never snap them onto the project scale, never leave them as raw `max-[Npx]:`.**
  A breakpoint is a design constant reused across the whole design — one dclogic landing's `max-width:860px` drives ~25 rules (nav, hero, four grids, footer, CTA, `h1`, `h2`) and every screen of a real import repeats it. That is exactly what a token is for; leaving it inline would make breakpoints the ONE design constant this flow treats as a magic number, while the `h1 { font-size: 34px }` INSIDE that same query becomes `text-*-34`. Snapping `860 → md (768)` is the identical error § B1 forbids for type: it shifts every rule and breaks a viewport band (an 800px tablet renders the `>860` layout).
  - **Read them from the source, not from `rawScan`** — `unpack.mjs` does not scan `@media`. dclogic: `source/{screen}.helmet.css` (the `.markup.html` has the CSS stripped). babel: `template.html`.
  - **Mind the direction.** A Claude Design export is usually **desktop-first** (`max-width`), the project scale is **mobile-first** (`min-width`). They are not interchangeable — declare each design breakpoint in Tailwind's explicit max form: `'ac-md': { max: '860px' }`.
  - **YOU name them**, same as colors: one namespace prefixed per design (`ac-*` in the worked example below), so they never collide with `sm/md/lg` or with a later import's. Deduplicate first — an `@media` repeated verbatim (that same landing has `max-width:980px` twice) is ONE token.
  - Worked example (the same landing): `max-width:980px → 'ac-lg'`, `860 → 'ac-md'`, `560 → 'ac-sm'` → **3 new breakpoint tokens**. Pass them to Step 1 and the `→ token` map to Step 5.2.
  - **A design with NO `@media` yields zero breakpoint tokens** — that is a valid outcome. Only then does Step 5.2 synthesize responsive with the project scale (`md:`/`lg:`), per its `Target` rule.
- Fonts: [from `inventory.brandFonts` — `{ body, display, families }`; load `families`, preload `body`] → next/font/google. Do NOT pass `inventory.fontFamilies` (that lists every embedded `@font-face` — a superset covering all THEMES presets, most of which are dead at runtime; loading them all is a bundle/LCP regression).
  - **`brandFonts` now excludes declared-but-unused faces**, and a `notes` WARNING names them. A design can `<link>` a font it never references — measured: one vanilla export loads `Poppins` and no rule names it; a multi-page dclogic export declares 12 families and uses 2. Those are dead weight in the ORIGINAL; do not carry them over.
  - **Check where the brand face sits in the stack before deciding.** A face can be real but not first: one vanilla export's `body` stack is `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", …`, so Inter renders for every non-Apple visitor while Apple gets SF Pro. Reproducing that stack verbatim (with `var(--font-inter)` in its actual position) is higher fidelity than collapsing it to the webfont — and dropping the webfont entirely because "it's only a fallback" ships Arial to most visitors. Read the real `body { font-family }` rule; on a vanilla export it is in `source/index.styles.css`, and the `<link>` that loads it is in `source/index.head.html`.
- **Warnings**: any proposed token that would override `surface-*` or an existing token — flag it.

## Assets
- Images (from inventory.images): [file, alias, uuid] → convert to WebP; per-screen vs shared.
- Remote images: {count} found → **DECISION NEEDED: (a) download+convert · (b) keep remote · (c) placeholders** — list each `url` with its `alt`, `uses` and proposed name. Write `none` if `inventory.remoteImages` is empty. This line must carry an ANSWER before Step 1 starts; it is the one Assets item the user has to choose, not merely approve.
- **Remote images (`inventory.remoteImages`) — check this list EVERY time; an empty one is a finding, not a formality.** A design may reference photos by URL (stock/CDN) instead of shipping them, and those are in NEITHER ingestion path's output: not in the standalone's manifest, not on disk for the archive closure. So they are absent from `images[]`, and an import that reads only `images[]` ships the design **with those photos missing** — including, typically, the LCP one. Nothing downstream catches it: a missing image compiles, type-checks and passes every convention grep. (Measured on one dclogic landing: `images[]` had the 17 local logos while the hero, the about photo and all 5 service-card photos were remote.) Each entry is `{ url, alt, uses, from, renditions? }` — `alt` is your naming context (`alias` is null on dclogic); `from` is `img`/`picture`/`css` and records only where the URL was **first seen**, so it never proves an image is used in one kind of markup (`uses` is the real count); and `renditions` means the same photo is referenced at several CDN sizes (`?w=600` / `?w=700`): that is ONE asset, and `url` is the largest variant `unpack.mjs` could **read**. It reads `w`/`width`/`h`/`height` params and `/800x600/` path segments; a CDN that encodes size some other way leaves every rendition scoring 0 and the first-seen URL wins. So when an entry has `renditions`, glance at the list — if `url` is visibly not the biggest, say which one Step 2 should fetch.

**This needs a USER DECISION at the checkpoint** — do not pick for them: (a) download + convert to WebP in Step 2, (b) keep them remote, or (c) sized placeholders + a TODO. **Each option has an owner and none of them is "it happens automatically":**

| Choice | Who does what |
| --- | --- |
| (a) download + convert | Step 2 — pass `remoteImages` as an explicit second list (see Step 2). |
| (b) keep remote | **YOU**, before Step 5.2: add each host to `images.remotePatterns` in `next.config.ts` (there is a commented template at the `images:` key). Then pass the URLs to Step 5.2 via `Remote images:`. Without the config edit **every one of these images fails at runtime** — `next/image` rejects an unconfigured host, and neither lint, type-check, `pnpm build` nor `design-validation` checks for it. |
| (c) placeholders | Pass the list to Step 5.2 via `Remote images:` with the intended box sizes, so the screen agent renders sized placeholders + `// TODO:` instead of silently omitting the element. |
- Icons: babel → the `Icon` component's named glyphs; flat dclogic (empty `components.json`) → the inline `<svg>` glyphs, counted by repetition.
- **Pre-filter per [`design-import-shared.md` § B8](../../docs/design-import-shared.md#b8-icons--primeicons-pre-filter-vs-the-sources-own-glyph)** — NOT by "a PrimeIcon with that name exists". First **measure** whether the design ships a coherent icon set (tabulate every inline `<svg>`'s `stroke-width`/style): if it does, **every member keeps its source glyph and the import yields zero PrimeIcons** — that is the correct outcome, not an oversight. Only when there is no set do generic glyphs become `pi pi-{name}`. Brand marks always keep their source path — and use the **majority** path across instances, not the longest (a nav instance may carry an extra sub-path the other N don't; extracting that outlier silently re-draws every call site). Of the kept glyphs, pass the ones reused **2+ times** to the assets agent for extraction; single-use ones stay inline. Decide this here; do NOT ask the user.
- **Glyphs referenced BY NAME from data need a resolver, and it belongs to Step 2.** A source that stores an icon name in its data (`{ icon: 'gift' }` rendered through `<Icon name={item.icon}/>`) cannot import a component per call site — it needs a `name → component` map. Detect it here (grep the source's data arrays for an icon-ish string field) and tell Step 2 to emit that map alongside the icon components, in `src/assets/icons/index.ts`. Otherwise every screen agent improvises its own local `Record<string, ComponentType>` — N divergent copies of one map, each with its own idea of which names exist.

## Components (each with its SOURCE FILE — mandatory)
Every primitive to extend/create MUST cite its source in the unpacked tree (babel: `source/jsx/03_display.jsx`; dclogic: a `<dc-import>` child listed in `components.json`, OR — when `components.json` is **empty** (a flat landing / single-page dclogic with no `<dc-import>`) — a **`file:lines` markup region** in `source/{screen}.markup.html`, e.g. `source/app.markup.html:140-149`).
This is the equivalent of Figma's nodeId gate — claude-design-components reads the real source, never prose.
**Flat-dclogic reuse pass (when `components.json` is empty):** the repeated inline regions ARE the components. Scan the markup and componentize any primitive **reused 2+ times** (service/detail cards, feature tiles, contact rows, logo items). **The usage count is the ONLY criterion** — do NOT add a side condition like "…or a clearly-named primitive" ([`CONVENTIONS.md` § STOP Protocol](../../CONVENTIONS.md#stop-protocol) forbids it: it makes the same 1× case ADVISORY there and BLOCKING here, and leaves "no match, used once, not clearly named" — the most common case on a flat landing — with no branch at all). A repeated CTA qualifies because it is repeated, not because it is called a button. This is the **same criterion the screen agent's reuse audit uses** — a no-match primitive reused 2+× triggers a `COMPONENT_GAP` STOP mid-Step-5.2 — so pre-building them here is exactly what avoids that deadlock. Cite each with its `file:lines` region below; do NOT leave them to be re-inlined N× by the screen agent (mirroring the `multi-page` shared-chrome rule for layouts).
- Extend existing:
  - `CustomButton` ← `Btn` in `source/jsx/03_display.jsx` (variants: primary/accent/outline/ghost/soft)
- Create new:
  - `{Name}` ← `{Fn}` in `source/...`
- Reuse as-is: [list]

## State / Stores  (D6 — Zustand + seeding vs per-screen mock)
**Derive the full store spec HERE, up front** (analogous to deriving component primitives) — do NOT leave it for Step 5.2's isolated per-screen contexts (that produces divergent store APIs). Read the App/entry file's centralized state + reducers and, for each Zustand store, specify:
- **State fields** (`gifts`, `contribs`, `cart`, `draft`, …).
- **Initial seed** — the prototype seeds shared state from demo data (`useState(INITIAL_CONTRIBS)`, `setGifts(GIFTS.map(...))`). So the store's INITIAL STATE **is that mock seed**, defined in the store file and marked `// TODO: openapi-import — replace seeded mock with fetched data`. Screens then read POPULATED data from the store (never a blank list). Do NOT scatter shared-state mock as `MOCK_*` in screens — that leaves the store empty and the screen rendering `[]`.
- **Initial state for CREATION flows, when it differs from the seed.** The seed exists so a dashboard renders populated. A creation/onboarding flow in the same design initializes its own draft **blank or minimal** — read that initialization from the source and put it in the spec as a separate value the creation screen resets to. Omit this and the onboarding step opens pre-filled with the dashboard's demo entities, which reads as a data-ownership bug and passes every gate ([§ B6](../../docs/design-import-shared.md#b6-data-is-out-of-scope--mock_-or-seeded-store-always-deferred-to-openapi-import)).
- **Persistence, when the prototype persists.** Grep the source for `localStorage` / `sessionStorage`. If it persists state, the spec carries the requirement AND the **scope** (per-tab vs shared) — `/new-store` ships the `persist` middleware for it. An in-memory translation satisfies client navigation and loses everything on a hard refresh; nothing downstream flags that.
- **Action bodies — including cross-entity reducers no single screen owns** (`addContribution` mutates `gifts` AND `contribs` atomically; `confirmContribution` recomputes both). **Author the full bodies here** — you (the Opus parent) have the App source, so translate the atomic logic now; the spec carries the IMPLEMENTATIONS, not just signatures, because scaffold runs on Haiku and must not invent atomic logic from a signature.
- Which screens consume which store.
Pass this spec to Step 5.1 (scaffold transcribes each store — seed + fields + reducer bodies — verbatim) and Step 5.2 (screens consume it, never redefine it).

**Store vs `MOCK_` rule of thumb**: the prototype's App holds it (shared across screens) → **store, seeded** with the demo data. Only one screen holds it (a static list that screen shows) → `MOCK_*` inline in that screen. Either way the data layer is deferred to `openapi-import` via the TODO — the difference is only WHERE the seed lives.

## Layouts (branches on `navModel`)
- `screen-registry` (babel): chrome detected (TopBar / BottomTabBar / iOS status bar); roles → route groups; existing match vs to-create. **Roles are not always `host`/`guest`** — that pair is the shape of a babel export with two `window.*` registries. A single nested registry instead tags each entry with its own role (measured: `cuenta`/`cliente`/`prestador`), and there `inventory.screens[].role` is the registry NAME, so read the real per-screen role from source (see the nested-registry note in Implementation status). Map whatever roles exist to route groups; do not force a host/guest split that isn't there.
- **`multi-page` (dclogic web): shared chrome → ONE layout.** The header/nav/footer repeats in EVERY `.dc` page's markup — it must be extracted to a single layout wrapping all N routes in a route-group, with the nav populated from the page list (entry → `/`). Do NOT let each page re-inline the chrome (8× duplication). Flag this for Step 4.
- `single-page-sections` / `single-page` (dclogic landing / vanilla): the sticky header/nav is part of the ONE screen (section switching), NOT a separate layout — no layout work unless a genuine shared shell exists.

## Screens — nav mapping (branches on `inventory.navModel`)

**`screen-registry` (babel): hybrid route/step/modal/skip.** Classify every registry key:
- **route** — first-level destination → `src/app/**/page.tsx` + screen. Give: name, type (auth|public|protected), route, role, source file, AND **`component`** (from `inventory.screens[].component` — REQUIRED; several screens share one file). If two keys map to the same component (`playlist` + `postboda` → `ContentHub`), keep BOTH routes rendering the shared component — do not drop either.
- **step** — sub-step of a wizard/flow (onboarding, pay steps) → internal stepper state inside the flow's anchor route.
- **modal** — overlay (cart, confirmations) → `/new-modal`.
- **skip** — demo chrome not portable (FlowMenu, role switcher, IOSDevice).
Authoritative list = **every registry key** in `inventory.screens`. `nav-graph.transitions` is only a PARTIAL hint (literal `go('x')` only; misses data-driven/tab nav — ≈30 of the 42 keys on one measured babel export) — the registries are the source of truth, not transitions.

**`multi-page` (dclogic web): one route per page.** Each `.dc` in `inventory.screens` = one **route**, type `public`, `component` = the page slug, `file` = its `.markup.html`. The `entry` page → `/`; the rest → `/{slug}`. No step/modal/skip decomposition — these are real web pages. (No registries; `transitions` is n/a.) ⚠ **Imperative interactivity is WIP** (see Implementation status) — if the pages' `.logic.js` is imperative (`querySelector`/`IntersectionObserver`/`setInterval`, no `state`), warn the user that dropdowns/reveals/carousels will be TODOs.

> ⚠️ **`entry` is not a verified home — if `inventory.notes` carries an `ORPHAN ENTRY` WARNING, do NOT map `entry` → `/` until the user confirms it.** The archive's entry comes from the handoff README, which names *the file the user had OPEN when they hit export* — on a project full of variants and WIP pages that is often not the site's home. `unpack.mjs` measures the page link graph and raises this WARNING only when the entry is a true orphan (in-degree 0) sitting next to a shared-nav hub; it deliberately does NOT guess which page is the home, because several usually tie. **Put the in-degree table from the note in front of the user at the Step 0.5 checkpoint and ask.**
>
> Getting this wrong inverts the site — measured on one multi-page dclogic archive: the README named a 16KB "home short" variant (in-degree 0) while the real home (40KB) is linked by all 8 siblings, so `/` became an unlinked variant and every sibling's nav "home" link pointed at that variant's route. **Nothing downstream catches it**: each page renders correctly on its own, so lint, type-check, `pnpm build` and `design-validation` — runtime sweep included — all pass on a site with the wrong topology. This checkpoint is the only place it can be caught.
>
> **An absent WARNING is not proof the entry is right, only that it is not an orphan.** A hub-and-spoke landing legitimately has in-degree 0 on its home (measured: a 5-page dclogic landing — its home links to the 4 sub-pages and none link back), which is exactly why the check requires a competing hub before firing. The floor is calibrated on the two multi-page samples available; widen it if a third disagrees.

**`single-page-sections` (dclogic landing) / `single-page` (vanilla): ONE screen, one route.** The whole export is a single screen (usually `/`, `public`); the `inventory.screens` entries are **SECTIONS of that one screen** (navigated by internal state — `go(section)` / `state.page`), NOT separate routes/steps/modals. Scaffold ONE route; Step 5.2 implements the section switching internally (like a stepper). Do not create a route per section.

**`multi-page` on a `vanilla` export (client-side router): one route per template block.** Each `inventory.screens` entry is a real **route**, type `public`, `file` = its own `source/route.{key}.markup.html`. The entry route (first entry, usually `index`) → `/`; the rest → `/{key}`. No step/modal/skip decomposition. Two things this format needs that the others don't:
- **The shared chrome lives OUTSIDE the route blocks** — header/nav/footer/floating buttons sit in the shell, so read `source/index.markup.html` (the full body) for them and hand them to Step 4 as ONE layout wrapping all N routes. Do not let each screen re-inline the chrome.
- **The router's own behavior is design intent, not scaffolding** — read the inline `<script>` at the bottom of `index.markup.html`. The measured vanilla sample's carried: a scroll-driven solid-header state, an `aria-current` **alias map** (`producto`→Complementos, `novedad`→Novedades), a `forceSolid` flag for the one route with no hero, and a dynamic footer year. All of that belongs in the layout (Step 4), and the per-route bits (e.g. force-solid) need an explicit mechanism the screen can opt into.
- **Detail routes usually want to be dynamic.** A `producto` / `novedad` block is the detail template for a listing — prefer `/productos/[slug]` + `/novedades/[slug]` over a static route, and confirm with the user at the checkpoint. Then remember `src/proxy.ts`'s `PUBLIC_PATHS` is an **exact-match `Set`** — a dynamic public route needs a prefix mechanism (mirror `AUTH_PATH_PREFIXES`) or real visitors get bounced to `/login`.

## Route collisions with what the template already serves
Cross the design's route list against the routes THIS template already ships, and list every collision here. The template is not an empty app: it serves `/` (`HomePage`), `/dashboard`, and a **working, Cypress-tested auth flow** — `/login`, `/signup`, email validation, password recovery. A prototype that draws its own login or signup maps straight onto them, and nothing downstream notices: both screens compile, both routes render, and the app ships with two signups.
- For each collision: `{design key} → {route}` · what the template already serves there · proposal (**reuse the existing route** / **map the design's screen to a different route** / **the design's version replaces it**).
- **Reuse is the default.** The auth flow is wired to real session handling and has E2E coverage; the prototype's version is a drawing of one.
- **Removing a template route is never a step-agent decision, and rarely the right one.** `typedRoutes: true` makes every route literal type-checked, so deleting `/` or `/dashboard` breaks `redirect('/')`, the auth redirect constants and the error pages — in files this import never touched.
- Put the list in front of the user at the checkpoint. Deciding it now costs a line; deciding it after Step 5.2 costs an Opus screen.

## Post-design feedback in `uploads/` (archive path only)
`inventory.sourceMode = archive` → the unzipped project may carry an `uploads/` folder: briefs, references, and **design feedback written AFTER the design was drawn**. Those corrections are not in the JSX — the design does not reflect them yet — so nothing in the extraction can surface them.
- `ls` the archive's `uploads/` and READ anything that reads as a brief or feedback (dated notes, `feedback`/`revisión`/`v1.7`-style names). Skip binaries you cannot read and say so.
- Fold each actionable item into the gap analysis, and **carry it into the delegation of the screen it affects** (Step 5.2's `Adjustment notes:`) — an item noted only here is an item that never reaches the code.
- Write `none` if there is no `uploads/`, or `standalone — n/a` on the standalone path. An unread `uploads/` is the one input the user KNOWS about and will expect to see honoured.

## Cost estimate for Step 5.2
Screens are the Opus-heavy step and the only one that scales with the design. Before the checkpoint, state: `{N} route screens · Step 5.2 is the bulk of the cost`. Do **not** quote a per-screen constant from another import — cost varies by screen density and format. Instead: offer to run the first 2–3 screens, then **recalibrate from the ledger's measured `<usage>` figures** and re-quote the remainder.
- For a design past ~10 routes, offer **batching by flow** (auth → onboarding → dashboard → …) with a real stop between batches, not just the per-screen checkpoint. A long import is easier to abandon at a batch boundary than at screen 19.
- This is an offer, not a gate — if the user wants the whole list in one run, run it.

## PrimeReact accent (app-wide input fidelity)
The template ships the `lara-light-blue` PrimeReact theme (`src/app/layout.tsx`), so **every** input's focus border and focus ring render blue regardless of the brand you just tokenized. The import produces correct brand tokens and still leaves every form off-brand, app-wide — a fidelity gap no per-screen work can close and no check reports.
- If the design's accent is not blue, propose the override at the checkpoint: focus/hover border + the focus `box-shadow` ring → the brand accent, **preserving `.p-invalid`'s red**. Step 1 applies it in `general.sass` (it already owns that file).
- **Offer it; do not apply it silently.** It is a global visual change to a template default, and a project may deliberately keep the PrimeReact look.

## Detected language
- Sample the VISIBLE strings of the source (babel: JSX text nodes; dclogic: the text between tags in `{screen}.markup.html`, plus `<option>` labels and `placeholder=` — NOT `{{holes}}`, class names, or `data-*`). Decision `en`|`es` + reasoning.
- Current `<html lang>` in `src/app/layout.tsx`: {value}. Flag if it must switch.
```

**Language heuristic**: same as the project standard — a string is Spanish-leaning if it contains `ñ`, an accented vowel, or a word like `iniciar/comenzar/nuevo/usuario/comprar/requerido`. **Count STRINGS, not words or characters**: ≥50% of the sampled visible strings Spanish-leaning → `es`, else `en`; `en` on a tie. Sample at least ~20 strings spread across the design (a nav alone is not a sample).

4. **Gate your own spec against the source (Step 0.55) — do NOT skip this.**

> **Delegate to**: `Agent({ subagent_type: 'general-purpose' })` — **Sonnet or cheaper**. One call, before the checkpoint.

Everything downstream has a source-of-truth gate except **you**. The `file:lines` / `nodeId` rule stops an agent from building a component out of your prose — but your *global* decisions (breakpoints, which glyph is canonical, which width is "the frame", which colour absorbs which) reach the render with nothing checking them. That is not hypothetical: on the first real dclogic run, **four spec errors shipped**, all of them mine, none caught by lint/type-check/build or by `design-validation` — they all compile.

So before the checkpoint, hand a cheap agent the **source** and your **spec**, and ask it to *re-derive independently and report every mismatch* — not to agree with you:

```
Source: {unpacked}/source/*   # dclogic: the CSS you need is source/{screen}.helmet.css (@media/@font-face/vars); the .markup.html has it stripped. babel: source/jsx/*.jsx + template.html. vanilla: index.markup.html (full body incl. the router <script>) + index.styles.css + index.head.html (the <link> that loads the fonts) + route.{key}.markup.html per route.
My spec: {the gap-analysis report you just wrote}

Re-derive these FROM THE SOURCE, without reference to my spec, then diff:
1. BREAKPOINTS — every @media in the design. Exact px. (I must use its values, not the project scale.)
2. WIDTHS — the max-width of every section. Flag any that differs from the design's default frame width.
3. ICONS — tabulate every inline <svg>: stroke-width, style, use count. Is there a coherent set? For any
   glyph used 2+ times, are ALL its instances byte-identical, or does one carry an extra sub-path?
4. TYPOGRAPHY — every font-size. Which are fractional? Which land off the project scale after rounding?
5. COLORS — spot-check my hex→token mapping. Flag (a) any hex mapped into a DIFFERENT HUE FAMILY, and (b) any
   hex in the raw scan my map does not cover at all. Note the two collapse rules are different and only ONE is
   bounded at Δ4: § B2 rule 3 collapses near-duplicates at per-channel Δ ≤ 4, while § B2 rule 4's long-tail fold
   deliberately maps a leftover hex to the NEAREST token in its family at whatever distance that is. So a fold
   wider than Δ4 is not by itself an error — report the distance and let me judge; a wrong-hue fold always is.
6. REPEATED PRIMITIVES — independently count how many times each candidate component appears, and give the
   `file:startLine-endLine` of the first instance. Flag any primitive repeated 2+ times that my spec MISSES.
   (This one is load-bearing: a no-match primitive used 2+× triggers a BLOCKING `COMPONENT_GAP` in the middle
   of Step 5.2, and re-running an Opus screen agent is the most expensive mistake in the flow.)
7. FONTS — every font-family in the source: which are declared (@font-face / <link>) vs used only in an inline
   `style="font-family:…"`, and how each is loaded. Does my font list cover ALL of them? Which is the body face
   and which the display face, per the `body {}` rule and per what the headings actually use?
8. IMAGES — count the DISTINCT image paths referenced anywhere in the source, including the ones inside
   `.logic.js` data arrays (`{ img: './x.jpg' }` rendered through `src="{{ item.img }}"`), not just literal
   `src=` in markup. Compare that count to `inventory.counts.images`. List any referenced path that is not in
   `inventory.images[]`, and any that does not exist on disk in the archive.
BUDGET — this is a cheap audit, not a re-derivation. Work the questions IN ORDER and stop when you run out
of room; a short honest answer beats a complete expensive one. If a question needs more of the source than
you can hold, WRITE "unanswered — needs {file}" and move on to the next. Never stall on one question.
Report ONLY mismatches, with source line numbers. If my spec is right on a point, say "match" and move on.
```

**Send the 8 questions above and nothing else.** They are the audit; adding your own (routing, stores, anything
you feel unsure about) makes the pass bigger than the one this step was scoped for — measured: a run that
appended two extra questions produced an agent that stalled at 600s with zero output, and the same content
split across three passes completed fine. If you genuinely need a ninth question, that is a **second** call
after this one returns, not a longer prompt.

> **On a very large design, split by question group rather than growing the prompt** (`1-4` / `5-8` is the
> natural cut — the first four are per-value checks, the last four are inventory checks). Three passes of the
> claude flow's questions cost nothing extra: the auditor reads local files. **This does NOT transfer to the
> Figma twin**, where each pass re-pays `get_design_context` at ~80–120K tokens — there, keep it to one call.

**7 and 8 audit the EXTRACTOR, not just your spec — that is the point, and they stay even though `unpack.mjs` handles both cases.** Every other question checks a judgment call of yours; these two check whether `inventory.json` itself is complete, because nothing else in the flow does. Both have been silent failures in practice: `images: 7` when the design referenced 34 (the other 27 were data-driven), and `brandFonts` listing only the body face when a display serif set all 31 headings from inline styles. Neither raised a note; an import trusting the inventory ships with the photos missing and the headings in the wrong face, **and it compiles, type-checks, builds and passes `design-validation`**.

`unpack.mjs` covers both cases (it scans bare image-path literals, treats the font-usage tier as additive, and flags `dataDriven: true` per image plus a NOTE) — but those are **heuristics over source text**: a path assembled at runtime (`'./img/' + item.slug + '.jpg'`) is still invisible, and a face injected by a script is still unattributable. So the gate stays — it costs two questions on an agent that is already reading the source.

Anything it flags, **verify against the source yourself** before changing the spec — it can be wrong too (an auditor once mis-measured an icon set and would have had correct code "fixed"). Then fold the confirmed mismatches in and re-show the report.

> **The gate can only be as complete as the tree you point it at — a missing file reads as a missing FEATURE.** Measured on a vanilla run: `parseVanilla` wrote only the `<body>` and the `<style>` blocks, so the Google-Fonts `<link>` never reached `source/`. Asked to re-derive the fonts, the auditor correctly reported that nothing in the source declared any — which read as proof that `brandFonts` was fabricated, and nearly shipped the design with its real webfont dropped. Two passes agreeing, both reading the same amputated evidence. (`index.head.html` is written now, but the failure mode is general.) So when the gate reports an ABSENCE — "no fonts declared", "no @media", "no images" — check that the file which would carry it is actually in the tree before believing it. An absence is only evidence if the thing had somewhere to be.

5. **Stop and confirm with the user.** They must approve the plan AND the screen classification (route/step/modal/skip) before any code is written. This is the most important checkpoint — Step 5.2 uses these decisions automatically, so a wrong classification here is caught cheaply now.

   **If `inventory.remoteImages` is non-empty, this checkpoint has a second, explicit ASK** — the (a)/(b)/(c) choice from the Assets section. Approval of "the plan" is not a choice among three options: put the question to the user directly and get an answer. Do not default to one and do not proceed to Step 1 without it — Steps 2 and 5.2 both branch on it, and picking silently means the user never learns their design's photos weren't in the export.

---

## Step 1 — Tokens

> **Delegate to**: `Agent({ subagent_type: 'claude-design-tokens' })` — **Haiku**.

**What you pass branches on `inventory.tokenSource`** — the agent's "brand preset" input only exists for babel:

- **`themes-object` (babel)** — the brand preset object from `tokens.json` (`themes[brand]`: colors + typography), plus the loose hex/size list from `rawScan`.
- **`inline+helmet` / `inline+css` (dclogic / vanilla)** — `tokens.json.themes` and `.brand` are **`null`**; there IS no preset, and the agent knows an absent one is expected here. Pass instead the **named clusters** you reviewed in Step 0.5 (from `rawScan.clusters`), each with its `hexes[]` member list so every member maps to the one token.

Either way, **pass your NAMES, not raw hexes.** You (Opus, with the whole design in view) decide the namespaces and the family names. The agent's input shape **requires** a `name` and a `decision` (REUSE | CREATE | BLOCK) per entry and will `INVALID_INPUT` on an entry without one — deliberately, because an unnamed list means **Haiku re-decides your naming** and two runs of the same design end up with different token names. Hand it explicit `hex → token-name` rows.

Also pass: the pre-rounded off-scale **integer** typography sizes (see Step 0.5 — fractions are rounded by YOU, before this step), and the **brand fonts** (`inventory.brandFonts`, not the full `fontFamilies` superset).

The agent applies REUSE/CREATE/BLOCK against `tailwind.config.js` + `design-tokens-map.md`, loads fonts via `next/font/google` in `layout.tsx`, updates `general.sass`, runs `type-check`.

**If the user approved the PrimeReact accent override at the checkpoint, this is the step that applies it.** Pass the accent **token name** and point the agent at [§ B11](../../docs/design-import-shared.md#b11-the-primereact-accent-override--apply-it-only-when-asked-and-write-it-with-apply), which carries the edit spec (the `@apply border-… ring-…` form, the `:not(.p-invalid)` guards, no `!important`, no invented CSS vars). **Omit the item entirely if the user declined** — the agent applies this only when the brief passes a token, so silence is the off switch. Naming the token is not enough on its own: measured twice, a brief that said `→ {ns}-accent` and nothing else produced raw hex both times.

---

## Step 2 — Assets

> **Delegate to**: `Agent({ subagent_type: 'claude-design-assets' })` — **Haiku**.

Pass: the path to `assets/img/*` + `inventory.images` (each entry carries `file`, `uuid`, `alias`, `mime`), and — for babel, or a repeated dclogic glyph — the icon glyph list to split into React icon components (for a flat dclogic whose glyphs are all single-use, omit it: inline `<svg>` stays in the screen). The agent converts raster → WebP via `sharp` (no ffmpeg), builds any icon components (`GmailIcon.tsx` pattern), registers `src/assets/icons/index.ts`, writes `.hash.txt` siblings. You pre-filter icons per [`design-import-shared.md` § B8](../../docs/design-import-shared.md#b8-icons--primeicons-pre-filter-vs-the-sources-own-glyph) before delegating (role-based, not name-based — brand marks and coherent sets keep their source glyph).

**Remote images (`inventory.remoteImages`)** — if the user chose "download + convert" at the checkpoint, pass them as an explicit SECOND list with the same `url → name` shape, and say they must be fetched BEFORE conversion (PowerShell `Invoke-WebRequest -Uri "…" -OutFile "…"` on Windows, `curl -s -o` on POSIX). Tell the agent to report a failed download rather than substituting another image — a silent stock swap is worse than a gap. Where an entry carries `renditions`, say so explicitly: fetch `url` ONCE and reuse the single converted file for every call site (and if you spotted at Step 0.5 that `url` is not the biggest rendition, name the one to fetch instead). If the user chose (b) keep-remote or (c) placeholders, this step converts nothing — carry the list to Step 5.2's `Remote images:` field, and for (b) make the `next.config.ts` `remotePatterns` edit yourself first.

**Three inputs the agent needs that `inventory.images` does NOT contain — YOU supply them, or the step deadlocks (or silently degrades):**

- **`screenSlug`** is **not** a field `unpack.mjs` emits. It is *your* decision (per-screen → `src/assets/images/{screenSlug}/`; shared brand asset → flat). Pass it per image.
- **`isLogo`** per image — set it on logos and flat-color marks. The agent's default rule encodes lossless only when the source has alpha AND is ≤512×512; a brand logo above that size falls through to lossy `quality: 85`, which is exactly what smears hard edges and flat color. Measured on one vanilla import: two 1247×244 logos went lossy for want of this flag. You know which images are logos (from their `alt`/name), the agent does not. (Sources that are ALREADY `.webp` are copied verbatim and never re-encoded, so this only matters for PNG/JPEG sources.)
- **The `iconByName` map, when Step 0.5 found data-driven glyphs.** Say which names must resolve and to which components; the agent exports the map from `src/assets/icons/index.ts` next to the components themselves. Without it, each screen agent re-invents a local one.
- **A semantic `name` per image.** `alias` is `null` for every image on a dclogic export (it comes from babel's `ext_resources` map, which dclogic has no equivalent of), so the agent's naming-sanitization rules cannot fire and **every image falls through to `STOP-BLOCKING / NAMING_NEEDED`** — 28 of them on one dclogic landing. The semantic context exists, but only YOU are positioned to read it: the markup's `alt=` attributes (`alt="Acme Salud"` → `obra-acme-salud`, `alt="Atención y acompañamiento…"` → `hero-atencion`). Derive the `uuid → name` map at Step 0.5 and hand it over — the same "the parent names, the agent applies" split already used for colors, breakpoints and icons.

---

## Step 3 — Components

> **Delegate to**: `Agent({ subagent_type: 'claude-design-components' })` — **Opus**.

Pass: the extend list + create list, **each with its source JSX file** in the unpacked tree, the token names added in Step 1, the **radius translation** decided in Step 0.5 (the single `rounded-*`/token every `var(--radius)` maps to), and **`detectedLanguage`** (`en`|`es`, from Step 0.5). The language is easy to forget here because this step writes components rather than page copy — but the agent drives `aria-label`s and placeholder text off it and **defaults to `en` when it is absent**, so omitting it on a Spanish import ships English a11y strings silently, with no STOP and nothing downstream to catch them. The agent reads the real JSX source per primitive (the gate against prose-driven errors — inline `style={{}}` variants are explicit in the code), reads existing `.tsx`/`.sass`, greps usages, extends/creates per conventions, validates each. If any component lacks a source file reference, the agent refuses — resolve it in Step 0.5.

---

## Step 4 — Layouts

> **Delegate to**: `Agent({ subagent_type: 'claude-design-layouts' })` — **Sonnet**.

Pass: current `src/layouts/` state, the chrome findings, the host/guest roles, the `target`, the `navModel`, AND **the names of any new layout to create** — that last one is a field the agent declares as REQUIRED and `STOP-BLOCKING / INVALID_INPUT`s on when absent, so it must be passed explicitly. **An empty list is a valid value and is NOT the same as omitting the field**: say `[]` when the existing layouts already cover the design, and the agent proceeds to its confirmed-no-op path instead of stalling on a missing input. The agent creates/adjusts layouts, wires route groups, and translates or drops mobile chrome per target. **For `navModel = multi-page`** (dclogic web) pass the list of `.dc` pages + the path to any one page's `.markup.html` — the shared header/nav/footer must become ONE layout wrapping all pages (nav from the page list), NOT re-inlined per page. It composes existing components, never duplicates JSX.

**A confirmed no-op is a valid outcome — still delegate.** See [§ C5b](../../docs/design-import-shared.md#c5b-a-confirmed-no-op-is-a-valid-outcome--still-delegate) for the rule and both failure modes. Here it fires for `navModel = single-page-sections` / `single-page`: the chrome belongs to the one screen (wired to its `page`/`menuOpen` state, so hoisting it would force UI state into a store — out of scope). Note in the delegation that **roles/registries do not exist for dclogic** (`unpack.mjs` emits no registries) so the agent doesn't stall on a required input it can never receive.

---

## Step 5 — Screens + routing

### 5.1 — Scaffold all `route` screens + stores

> **Delegate to**: `Agent({ subagent_type: 'claude-design-scaffold' })` — **Haiku**.

Before delegating, read `src/app/layout.tsx` and extract the current `<html lang>` (pass as `currentHtmlLang`). Pass: for each **route** screen — `screenName`, `screenType` (auth|public|protected), `route`, `routeGroup`, `role`; the Zustand `stores` to create; batch-level `detectedLanguage` + `currentHtmlLang`. The agent runs `/new-screen` per route (placeholder in the right language), `/new-store` per store, updates `src/proxy.ts`, switches `<html lang>`/`openGraph.locale` if needed. **Only `route` screens are scaffolded — `step`/`modal` are not routes.** Also pass the **route-collision decisions** from the Step 0.5 checkpoint (which design screens map onto routes the template already serves, and whether each reuses or relocates) — the agent re-checks the app tree itself, but it cannot know what the user decided.

**Expect a near-total no-op on a `single-page` / `single-page-sections` import, and do NOT mistake that for "skip the step".** The design maps to `/`, which the template already serves via `HomePage` — so `/new-screen` is skipped (it would collide), `/` is already in `PUBLIC_PATHS`, and there may be zero stores. Two duties survive, and they are the whole point of the step here:

1. **The language switch** (`<html lang>` + `openGraph.locale`) — often the only file this step writes.
2. **The reused route's metadata upgrade.** The agent is REQUIRED to bring the existing `page.tsx` up to the full per-type metadata shape `/new-screen` would have generated (a template placeholder typically ships only `title`), and to report `REUSED ROUTE: /{path} ({Name}Page) — metadata upgraded`. **Do not instruct it to leave that file alone** — that contradicts its contract and re-opens the lost-metadata gap the rule exists to close. If you want Step 5.2 to own the final SEO copy, say so as a follow-up, not as a prohibition here.

After this step, **commit the scaffold as a checkpoint** — per [§ Commit cadence](#commit-cadence--commit-each-validated-step-not-just-the-scaffold) above.

### 5.2 — Per-screen implementation (sequential auto with per-screen checkpoint)

> **Delegate to**: `Agent({ subagent_type: 'claude-design-screen' })` — **Opus**, one invocation per route screen, sequential.

Because the design context is local files, cost is far lower than Figma's per-screen MCP pulls — but this is still the heaviest Opus step. Walk the approved route list one screen at a time.

**Standard prompt for each invocation:**

```
Screen name: {Name}Page          # for a REUSED route, this MUST be the existing screen's name (5.1 reports `REUSED ROUTE: /… ({Name}Page)`) — inventing a new name here writes a screen folder no route renders
Screen type: {auth|public|protected}
Screen slug: {kebab-case}
Source: {unpacked}/{inventory.screens[].file}  (babel: source/jsx/NN_*.jsx — may hold several screens; dclogic: source/{screen}.markup.html + sibling .logic.js; routed vanilla: source/route.{key}.markup.html — that file is THIS route's markup only, with the shared chrome deliberately absent because Step 4 owns it)
Format: {babel|dclogic|vanilla}      # from inventory.format — picks the JSX path vs the markup+logic path (REQUIRED; do NOT let the agent infer it from the file extension)
navModel: {screen-registry|single-page-sections|multi-page|single-page}   # from inventory.navModel — drives section-vs-route handling (REQUIRED)
Screen component: {FunctionName}     # from inventory.screens[].component — WHICH function in that file IS this screen (REQUIRED; the agent STOPs without it)
Sections: [{key → source region or sc-if guard}, ...]   # single-page-sections ONLY, and REQUIRED there: the inventory.screens[] entries are SECTIONS of this one screen, switched by internal state (e.g. inicio/servicios/trabaja via `state.page`). This is the defining feature of the format — no other field carries it. Omit for other navModels.
Absorbed steps: [{stepScreenKey → component}, ...]   # screen-registry ONLY — wizard sub-steps to implement as internal stepper. NOT the same thing as Sections.
Store spec: {store → {seeded initial state, fields, action bodies}}   # from Step 0.5 — consume it, never redefine it; shared data comes from the (seeded) store, NOT MOCK_*
Radius translation: {the single canonical `rounded-*` / token from Step 0.5, OR the literal `N/A — tokenSource=inline+helmet, use exact rounded-[Npx] per element (§ B3)`}
Local modals: [{modalScreenKey → component}, ...]     # implement as screen-local modals / /new-modal
Target: {mobile-app|web}                              # drives responsive synthesis
Breakpoints: [{design @media → token}, ...]   # the design's OWN media queries, ALREADY ADDED AS TOKENS by Step 1 — e.g. `max-width:860px → ac-md:`. Use the TOKEN, never a raw `max-[860px]:` and never the project scale: re-labelling 860 onto md (768) shifts every rule and breaks a whole viewport band (a 800px tablet renders the >860 layout). Empty list = the design has no media queries; only THEN synthesize with the project scale (see Target).
Detected language: {en|es}
Images: [{sourceUuid-or-srcRef → `@/assets/images/…webp`}, ...]   # ALREADY converted by Step 2 — import these, do NOT re-convert. Only convert (sharp, dedup by `.hash.txt`) if a source image reaches you that Step 2 never received. Key by whichever identity the export gave: `uuid` on a standalone, `srcRef` on an archive (`uuid` is null there) — and for a downloaded remote image, its ORIGINAL URL, since it has neither.
Remote images: {mode: downloaded|keep-remote|placeholder} + [{sourceUrl → target}, ...]   # from the Step 0.5 checkpoint decision. `downloaded` → the entries are already in `Images:` above, keyed by URL, nothing else to do. `keep-remote` → render `next/image` against the ORIGINAL URL (I have already added the host to `next.config.ts` remotePatterns). `placeholder` → render a correctly-SIZED placeholder box + `// TODO: remote image {url}` — never omit the element, and never substitute another image. Omit this field only when `inventory.remoteImages` was empty.
Existing components to reuse: [{Component} → path, ...]   # from Step 3
Tokens available: [list from Step 1]
Container rule: BRANCHES ON `Target` — § B5. `web` → every top-level <section> anchored with `container-custom` (16px built-in gutter, no px-* on the same element), and the prototype's own frame width is ignored. `mobile-app` → NO `container-custom`: the layout's app-shell caps the width, so the screen keeps the source's horizontal padding as px-*. Either way, per-section py-* from the design. State the branch explicitly here — the agent STOPs rather than guessing.
Bespoke widths: [{section → max-width}, ...]   # `web` only. Sections whose source width is NOT the design's default frame width: `container-custom` replaces the DEFAULT width only, so a section the design deliberately narrowed keeps its cap (nest it inside the container-custom section). List them or they silently render full-width. N/A on `mobile-app` (no container-custom to override) — say so.
Adjustment notes (only on re-runs): {text}
```

The screen agent re-styles the inline `style={{}}` source into Tailwind + tokens + `container-custom` + BEM, reuses components, wires forms to Formik+Yup, animates with `m`, keeps mock data as `MOCK_*`, absorbs `step`s as an internal stepper, mounts local modals, and **synthesizes responsive per `target`** (`web` → full desktop+mobile; `mobile-app` → mobile-first fidelity + conservative desktop centering).

**Gate the IMPLEMENTATION against the source (the twin of Step 0.55) — before each checkpoint.**

> **Delegate to**: `Agent({ subagent_type: 'general-purpose' })` — **Sonnet**. One call per screen, between the screen agent returning and you posting the checkpoint.

Step 0.55 diffs your **spec** against the source *before* anything is built. Step 6 runs *after*, but only over **generic invariants** — lint, type-check, build, the convention greps, and a runtime sweep that measures widths and overflow. **Neither one ever compares the implemented screen to its own source.** So a screen can be visually or interactively unfaithful while being token-clean, convention-clean and build-clean, and pass every gate the flow has. That is not a hypothetical class — it is where the addendum's eight measured drifts live (extra controls, a static label turned editable, a bottom sheet turned into a centered dialog, a near-match primitive, an optional prop switched on, a form seeded from the dashboard's demo data).

Running it here, per screen, is deliberate: the user is already stopping at this checkpoint, the findings are about a screen still fresh, and a Sonnet pass is marginal next to the Opus run that just finished. Batching it to the end of the import instead produces one long adjudication session about screens nobody remembers.

```
Source: {unpacked}/{inventory.screens[].file}  (the region implementing {component})
Output: src/screens/{Name}Page/{Name}Page.tsx + .sass
Target: {mobile-app|web}

Read the source, then the output, and report where the output is NOT faithful to the source.
Check exactly these, per § B9/B10 of .claude/docs/design-import-shared.md:
1. CONTROL SET — every input/button/link/toggle/menu item in the output that has no counterpart in the
   source, and every one in the source that is missing from the output. Include required-markers.
2. AFFORDANCES — anything static in the source rendered as editable/clickable in the output, or vice
   versa. Name the handler.
3. LABELS — the source's label typography vs what the output renders.
4. MODAL PRESENTATION — bottom-sheet / centered / full-screen, per overlay.
5. COMPONENT SUBSTITUTION — a source primitive implemented with an existing component that differs in
   radius/border/fill/stroke/aspect. Say which parameters differ.
6. INSTANCE PROPS — optional props or variants enabled on a call site the source did not use them on.
7. DERIVED VISUALS — hash colours, initials, generated placeholders: does the output's mapping match the
   source's function exactly?
8. FORM INITIAL STATE — if this screen creates something, does it start from the source's blank/minimal
   draft, or from populated demo data?
Report ONLY mismatches, each with source line + output line. Where the output matches, say "match".
Do NOT fix anything. Do NOT judge whether the source is right — only whether the output matches it.
```

**Its findings are ADVISORY and the user adjudicates them — never auto-fix, and never "correct" a screen on the strength of this report alone.** The source is not automatically right for this target: an import with no backend legitimately turns a mocked edit into static text, and a mobile-app frame legitimately drops chrome. That is exactly why the output is a list for a person rather than a patch. Surface the findings inside the checkpoint below; if the user wants any of them applied, re-delegate the screen with them as `Adjustment notes:`.

Skip the gate for a screen the user skipped. If the diff agent returns nothing, say `fidelity diff: sin hallazgos` — silence is a result, not an omission.

**Per-screen checkpoint (post after each return):**

```
✅ {Name}Page implementada ({images_count} imágenes, {duration})
   Ruta: /{path}   ·   Archivos: src/screens/{Name}Page/, src/assets/images/{slug}/
   {if steps absorbed: "Incluye stepper interno: {step list}"}
   Fidelidad vs fuente: {"sin hallazgos" | the diff's findings, one line each, marked as adjudicables}

¿Ajustes para {Name}Page o seguimos con {NextName}Page?
  • Pegá instrucciones específicas para refinarla
  • "siguiente" / Enter para continuar   • "saltá esta" para skipear   • "parar" para pausar
```

Branch on the reply exactly like the figma flow (empty/"siguiente"→next; free text→re-delegate same screen with notes; "parar"→halt with resume hint; "saltá esta"→skip). On subagent failure, surface the error in the checkpoint and ask retry/skip/stop — never silently move on.

**Cumulative final report** when the batch ends (✅/⏭️ per screen + `pnpm start` routes to try).

---

## Step 6 — Code validation

> **Delegate to**: `Agent({ subagent_type: 'design-validation' })` — **Haiku**. Pass `importFlow: 'claude-design-import'` so it names `claude-design-*` agents in the suggested-fixers mapping, plus the **scope** (below). This is the **shared** validation agent (also used by `figma-design-import`); it carries 44 static checks including source-import leak checks (untranslated inline styles, leaked prototype CSS vars, stack-router remnants), **plus a runtime invariant sweep** that renders every route in a browser.
>
> **Pass the ROUTE LIST with a value for every dynamic segment** (`/novedades/[slug]` → a slug that exists in the mock data). The runtime sweep skips a route it cannot resolve, and a skipped route is reported as unverified — which is correct, but it means you lose the check unless you supply the parameter.
>
> **Fallback — ONLY if `design-validation` is not an available `subagent_type`.** A project agent can silently fail to load ([#14018](https://github.com/anthropics/claude-code/issues/14018)) — see [`agent-loading-troubleshooting.md`](../../docs/agent-loading-troubleshooting.md). Then run the sweep inline (below) rather than hard-failing or skipping validation, and **say in the report that validation ran inline (fallback) and is a reduced check set** — the inline sweep is a strict subset of the agent's, so a clean inline run proves less.

**Scope — pass it to the agent, or apply it inline.** Hand over the list of files this import created/modified so findings can be ATTRIBUTED; without it you'll read pre-existing template violations as import defects (`Waves.tsx`, `Filters.sass`, `mixins.sass` legitimately carry hex; `sentry-example-page/` is a documented throwaway). **It does NOT narrow what gets checked** — the agent still runs every check over its own paths and splits the OUTPUT into `IN SCOPE` / `PRE-EXISTING`. That is deliberate: several checks assert repo-wide invariants an import can break in a file it never wrote (a global-only modal newly mounted in an existing component, a `'use client'` pushed onto an existing layout), and this list is assembled from the step agents' self-reported `files_touched` — the very thing the ledger rules above tell you to distrust. Partitioning makes an incomplete list *mislabel* a finding; filtering would make it *vanish*. **Build the file list as you go** — every step agent's report names the files it touched (the `files_touched` footer count plus the paths in its report); accumulate them in the workload ledger and hand that list over. Do not reconstruct it from `git status` (the worktree may hold unrelated work) and do not default to `src/`.

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
# prototype leaks (dclogic/babel remnants)
grep -rn "hp-blob\|data-r=\|sc-if\|__bundler\|window.HOST\|window.GUEST" $F
```

> Do NOT grep for `theme(` — [§ B4](../../docs/design-import-shared.md#b4-brand-gradients--the-one-hex-exception-besides-icons) tells agents to *prefer* `bg-[linear-gradient(…,theme(colors.x),…)]`, so its presence in a `.sass` is the recommended output, not a defect. Step 3's `pnpm build` already fails on a genuinely unresolvable `theme()`.

5. Structural checks that greps get wrong — **verify these by reading, not by regex**: exactly one `<h1>` and one `<main>` per rendered page (a multi-line JSX `<a>` will make a naive `target='_blank'`-without-`rel` grep produce false positives — check the 2 lines after each hit before reporting it); SEO metadata completeness on each public `page.tsx` (`title`/`description`/`alternates.canonical`/`openGraph`/`twitter`); heading hierarchy; `aria-label` on icon-only buttons.
6. **The runtime sweep — run it even in the fallback.** It is a script, not an agent, so the load failure that sent you here cannot affect it, and it is the only part of Step 6 that would have caught the defects greps miss:

```bash
node .claude/scripts/render-audit.mjs --app . --routes "<the import's routes>" --param <k>=<v> --out "<scratch>/render-audit"
```

Exit `0` = clean · `1` = findings (a result, not a crash) · `2` = the sweep did not run, so report the runtime check as FAILED rather than clean. Paste its tables verbatim, numbers included. Its `SUSPECT` rows are yours to adjudicate: you have the unpacked source tree, so open the CSS rule the selector points at and decide whether the measured anomaly is the design or a translation miss.

Report findings in a categorized `path:line` shape. **Don't auto-fix** — surface and offer to delegate to the relevant agent.

**Then clean up the import's scratch state.** The `.hash.txt` siblings are import-scoped: Step 2 writes them so a **re-invocation of Step 2** (after a STOP, or a follow-up batch) can dedup against what it already converted, rather than re-encoding every image. **Step 5.2 never reads them** — `claude-design-screen` is explicitly told not to convert images or touch `.hash.txt`, since Step 2 owns conversion. Once validation has run, nothing consumes them — they are not source, and they are ~100 bytes of noise per image. Delete them as the last action of the flow:

```bash
find src/assets/images -name '*.hash.txt' -delete
```

Say how many you removed. The `.webp` files are the deliverable and stay. A future import re-converts from source — on a Claude Design export that's local files through `sharp`, i.e. seconds.

**Step 6 now has two halves, and only one of them renders.** The static half (lint, type-check, build, the greps) is blind to anything that needs layout. The runtime sweep closes part of that gap — it measures widths, background bands, overflow, hover colours and the mobile menu in a real browser — but it is still **not** a fidelity check:

- it **cannot** see a breakpoint mapped to the wrong width, a glyph or typeface swapped for a near-identical one, or a spacing value that shipped at 40px instead of 72px. Each of those renders a perfectly coherent page.
- it reports what it could **not** reach in a `SKIPPED` list. Read it — an unreachable route is unverified, not passing.

So a clean Step 6 means *nothing violated a known invariant*, never *the design was reproduced*. Visual review against the source is still the developer's job via the 5.2 checkpoints. (Measured on one vanilla run: five real defects shipped after Step 6 reported clean on every static check — which is why the runtime half exists.)

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

- ❌ Accept a source that is neither a **Project-archive folder** nor a **Standalone-HTML** export/URL — a PDF, a PPTX or a rendered spec doc is not a code source here. (Note the archive **is** a handoff bundle — its README opens with "This is a handoff bundle from Claude Design" — so "handoff" is not a reason to reject it; it is the RECOMMENDED input.)
- ❌ Skip Step 0/0.5 and "just start with the screens".
- ❌ Run a step yourself when there's a sub-agent for it — waste of Opus on Haiku-grade work.
- ❌ Dump the unpacked tree into the repo `src/` — extract to a scratch dir; only generated code lands in `src/`.
- ❌ Translate the prototype's inline `style={{}}` hex/px literally — always tokens + Tailwind; hardcoded hex is banned.
- ❌ Apply the same horizontal anchor at both targets — it branches ([§ B5](../../docs/design-import-shared.md#b5-container-custom-at-import-time--branches-on-target)). `web` → discard the prototype's frame width and anchor every `<section>` with `container-custom`. `mobile-app` → the layout's app-shell caps the width; `container-custom` there stretches every section past the shell. Either way, keep per-section `py-*`.
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
| 0 | Unpack | `unpack.mjs` | — | **Project-archive folder** (unzip first; recommended) OR **Standalone HTML URL/path** + scratch outDir |
| 0.5 | Inventory & gap analysis | (parent) | Opus | The unpacked artifacts |
| 0.55 | Gate the spec against the source | `general-purpose` | Sonnet | The source tree + your gap-analysis report |
| 1 | Tokens | `claude-design-tokens` | Haiku | Named tokens (`hex → name` + REUSE/CREATE/BLOCK) + off-scale integer sizes + fonts |
| 2 | Assets | `claude-design-assets` | Haiku | `assets/img/*` + `inventory.images` (+ `remoteImages` if the user chose to download them) + per-image `name`/`screenSlug`/`isLogo` + `Icon` glyph list |
| 3 | Components | `claude-design-components` | Opus | Extend/create list, each with **source JSX file** + token names |
| 4 | Layouts | `claude-design-layouts` | Sonnet | Layouts state + chrome findings + roles + target |
| 5.1 | Scaffold routes + stores | `claude-design-scaffold` | Haiku | `route` screens (name, type, route, group, role, **component**) + store specs (full shape) + language |
| 5.2 | Per-screen (sequential + checkpoint) | `claude-design-screen` | Opus | Per-screen: name, type, slug, **source JSX + component**, absorbed steps, modals, target, language, reuse list, store spec |
| 5.2b | Gate the implementation against the source | `general-purpose` | Sonnet | That screen's source region + the emitted `.tsx`/`.sass` + the target |
| 6 | Validation | `design-validation` | Haiku | The accumulated touched-file list + `importFlow: 'claude-design-import'` + the **route list with a value for every dynamic segment** (for the runtime sweep) |
