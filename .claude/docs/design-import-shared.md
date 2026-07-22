# design-import-shared — Shared rules for the design-import flows

> **Scope.** This file is `Read` at pre-flight by the step agents of **both** `figma-design-import`
> and `claude-design-import` (the `figma-*`, `claude-design-*`, and `design-validation` agents).
> It is **not a subagent** (nothing invokes it) and **not a general code convention**.
>
> - **Code conventions** — what valid *output* looks like (type scale, no-hex, a11y, `container-custom`,
>   SASS rules) — live in [`.claude/CONVENTIONS.md`](../CONVENTIONS.md). Read that too.
> - **This file** holds the two things that are shared **across the import agents** but are NOT code
>   conventions: **(B) import-translation rules** (how to translate an external design into valid code)
>   and **(C) the agent protocol** (footer / report shape / delegation contract).
> - **Format-specific mechanics** (Figma MCP vs `unpack.mjs`, the `nodeId` gate vs a source-file path,
>   asset download vs manifest-decode, etc.) stay in each agent's own `.md` and are **not** synced to
>   the sibling flow.
> - **Orchestrator-only protocol is deliberately NOT here.** Section C covers the protocol *you* (a step
>   agent) follow — the footer you emit, the STOP shape, the delegation contract. What the ORCHESTRATOR
>   does with your footer (the workload/cost ledger, verifying your reported counts against the
>   filesystem) lives duplicated in the two `SKILL.md` files instead, because you would otherwise load it
>   at every pre-flight and never act on it. See [`CLAUDE.md` § Keep the two flows in sync](../../CLAUDE.md#keep-figma-design-import-and-claude-design-import-in-sync).
>   If you find yourself about to add orchestrator instruction here, that is the rule you're crossing.
>
> Litmus test for "does a rule belong here (B) or in CONVENTIONS (A)?": *would a developer writing code
> from scratch use this rule?* If yes → CONVENTIONS. If it only applies when **translating a design** →
> here. (Example: the typography **scale** is a code convention; **how an off-scale source size is resolved** — added as a token, a fraction rounded to an
> integer first — is import-translation.)

---

# Section B — Import-translation rules

How to turn a design's raw values (Figma variables / node styles, or a Claude Design `THEMES` object /
`rawScan`) into this project's tokens and conventions. Applies to `*-tokens`, `*-components`, `*-layouts`,
and `*-screen` agents of both flows.

## B1. Typography — off-scale sizes become real tokens (both flows), never rounded

**Both flows treat an off-scale source `fontSize` identically:** it is a real design value → emit
`STOP-BLOCKING / TOKENS_MISSING` so the tokens agent (`figma-design-tokens` / `claude-design-tokens`) adds it as a
`text-{weight}-{size}` token. **Do NOT round / snap to a nearby scale step** — the exact size is preserved.
Typography is still ALWAYS `text-{weight}-{size}`, never `text-[Npx]` or a loose `text-lg`/`font-bold`.

**One physical exception — fractional sizes (a Claude Design `rawScan` only; Figma sizes are integers).**
The typography plugin builds each class as `.${prefix}-${size}` (`tailwind.config.js`), so the suffix MUST
be an integer — a `.text-bold-13.5` selector is invalid (the dot splits it), so a fractional token cannot
exist. Round a fractional source size to the **nearest integer first** (ties round up, deterministic so
isolated per-screen runs agree: `13.5 → 14`, `16.5 → 17`), THEN apply the rule above: if that integer is
already on the scale, use it as-is (no token); if it's off-scale, add it as a token. This is the **only**
place a size is rounded, and only because the class name physically cannot carry a fraction.

> Consequence to expect: a noisy `rawScan` produces several new typography tokens (e.g. Holograma's
> `13/15/17/19/21/27/30/34/50/58` → ~10 tokens). That's intended under this rule — fidelity over a lean
> token set.

## B2. Color — cluster the raw scan, map to tokens, never raw hex

CONVENTIONS bans raw hex in screens/components/layouts/`.sass` (only exception: multi-color brand glyphs
in `src/assets/icons/*.tsx`, and brand gradients — see B4). Every color must map to a token, so a noisy palette must be reduced to a
sensible token set up front. How much reduction is needed depends on the
source:

- **Clean palette source** (Figma variables, or a Claude Design `THEMES[brand]` object) → already ~8–15
  named colors; map each to a token more or less 1:1.
- **Raw-scan source** (`tokenSource = inline+helmet` / `inline+css` — dclogic/vanilla) → `rawScan.hexColors`
  can list **40+** hexes: brand colors, muted text, hairlines, background tints, **plus** one-off gradient
  stops and alpha-overlay values. This MUST be clustered before tokenizing.

**Clustering heuristic (do this in the gap analysis, pass the result to the tokens agent).** If
`tokens.json.rawScan.clusters` exists (emitted by `unpack.mjs` — **Claude Design only; the Figma flow has no
such block and applies steps 1–5 by hand**), start from it. Each entry is:

```jsonc
{
  "representative": "#e7eef4",          // the most-used hex in the cluster — name THIS one
  "hexes": ["#e7eef4", "#e1ecf4"],      // every source hex collapsed into it (per-channel Δ ≤ 4)
  "uses": 22,                            // total occurrences across the cluster
  "roles": { "border": 22 },             // the CSS properties it appears in, counted
  "dominantRole": "border",              // the most common one
  "suggestedFamily": "line"              // a HINT — verify it, especially on saturated tints
}
```

Sorted by `uses` descending. Review and **NAME** the clusters; don't recompute them by hand. `suggestedFamily`
has no hue awareness — it mislabels light brand tints as muted, and greens as generic tints — so treat it as a
starting guess, not a decision. Steps 1–5 below are the rules the pre-grouping encodes, and the procedure when
there is no `clusters` block:

1. **Pure white / black → Tailwind defaults, not new tokens and not raw hex.** `#fff`/`#ffffff` →
   `bg-white`/`text-white`; `#000`/`#000000` → `bg-black`/`text-black`. (This is the leak to watch: a
   plain white background must be `bg-white`, never `background: #ffffff` in a `.sass`.)
2. **Group the rest by family + role:** `brand-*` (identity), `ink-*` (dark text / dark section bg),
   muted text (a blue/warm-gray family — a **non-surface** namespace, since `surface-*` is pure gray and
   immutable), `line-*` (hairlines/borders), `bg-*` (light tints), plus semantic (`cta-*`, `danger`).
   **Role is inferred from the CSS property the hex appears in** — `color:` → text, `background:` → surface,
   `border:`/`border-color:` → line, a `linear-gradient(...)` stop → gradient.
3. **Within a family, collapse near-duplicates: max per-channel Δ ≤ 4 → ONE token, even if the roles differ.**
   At that distance they are the same colour to the eye; shipping both is palette noise. Role decides the
   **name** of the cluster (pick the dominant use), not whether to collapse. Example: `#0e2f4d` (a heading
   `color:`) and `#11314f` (a section `background:`) are Δ≤4 → one `ink-800`, named for whichever dominates.
   Feed the tokens agent the cluster, not 20 near-identical hexes.
4. **Map, don't multiply:** a source hex with no exact token → the **nearest token in its family**, not a
   fresh token per pixel-value. Aim for a palette in the low tens, not 40+. Drop pure alpha-overlay values
   that only ever appear as `rgba(...)` gradient/scrim layers — those are `.sass` values, not palette
   tokens (see B4).
5. The **screen/components agents**: if a source color has no exact token, use the nearest family token —
   **never** fall back to raw hex.

## B3. Radius — token-driven (Figma) vs plain-CSS literals (Claude Design)

Radius handling also **diverges by flow**:

- **Figma (`figma-*`)** — radii carry design-token meaning: use the standard Tailwind `rounded-*` scale, or
  `TOKENS_MISSING` → add a `borderRadius` token. Do NOT emit arbitrary `rounded-[Npx]`.
- **Claude Design (`claude-design-*`)** — CONVENTIONS treats border-radius as plain CSS, so radii are NOT
  per-value tokens; **never** `TOKENS_MISSING` on a radius. Two sub-cases by `tokenSource`:
  - **`THEMES`/babel, single `var(--radius)`** → decide ONE canonical translation in the gap analysis (a
    specific `rounded-*`, or one `borderRadius` token like `rounded-card`) and pass it to every
    component/screen agent so all radii match — the `Radius translation` prompt field.
  - **`inline+helmet` / `inline+css`** → no single `--radius`; radii are per-element literals (cards
    20–24px, buttons 12–13px, pills 999px). Use arbitrary `rounded-[Npx]` per element. The
    single-`--radius` `Radius translation` field is **N/A**; note it as such.

## B4. Brand gradients — the one hex exception besides icons

A multi-stop brand gradient (`linear-gradient(...)`) usually can't be expressed with token utilities.
Treat it like the inline-`<svg>` hex exception:

- Put it in the colocated `.sass` as `background: linear-gradient(...)`.
- **Prefer referencing tokens for each stop.** Most reliable: a Tailwind **arbitrary utility** —
  `bg-[linear-gradient(106deg,theme(colors.<tokenA>),theme(colors.<tokenB>))]` — Tailwind resolves
  `theme()` inside arbitrary values. (A `theme('colors.<token>')` value inside a `.sass` `background:` also
  works in this project's Tailwind + PostCSS pipeline, but confirm it compiles before relying on it.)
  Ideally the stops were already promoted to tokens in B2 (a hero-tint, an accent), so reference those.
- If token-referencing proves brittle for a given gradient, hardcoding the stops is the **one allowed hex
  exception** — but mark it `// FLAG raw-hex gradient` so `design-validation` can see it's deliberate, not
  a stray leak.

Solid fills are **never** an exception — those always resolve to a token (B2).

## B5. `container-custom` at import time

Every top-level `<section>` of a screen (and the inner content of layout chrome — navbar/footer/sidebar)
anchors its content with `container-custom` (16px built-in gutter — **no** `px-*` on the same element).
**Ignore** the source's fixed frame width and per-section horizontal padding (a Claude Design prototype's
430px phone frame, or a `max-width:1180px; margin:0 auto; padding:0 24px` block) — `container-custom`
replaces the horizontal part. For a full-bleed background, keep the bg on `<section>` and nest a
`container-custom` inner `<div>`. **Vertical** padding is separate: translate the source's vertical rhythm
(`padding:96px 24px` → `py-24`) into `py-*`/`pt-*`/`pb-*` — a section with only `container-custom` and no
`py-*` is incomplete. Full rule + non-applicable cases: [CONVENTIONS > Global Container](../CONVENTIONS.md#global-container).

## B6. Data is out of scope — `MOCK_*` or seeded store, always deferred to openapi-import

No screen/component adds `customFetch`, SWR, or `src/api/*`. The data layer is the separate
`openapi-import` flow's job. Split demo data by ownership:

- **Shared state** the prototype's App seeds and several screens read (`INITIAL_CONTRIBS`, a `GIFTS` list
  used across screens) → **seeded in the Zustand store** (initial state = the mock seed), marked
  `// TODO: openapi-import — replace seeded mock with fetched data`. Screens read populated data from the
  store, never re-declare the seed.
- **Per-screen demo data** (a static list only one screen shows) → an inline `const MOCK_{KIND}` at the
  top of that screen, marked `// TODO: replace with API call once openapi-import has run for {endpoint}`.

Never scatter shared-state mock as `MOCK_*` in screens (leaves the store empty); never split per-screen
mock into a sibling `.ts`.

## B7. Forms — Formik + Yup, wrapped in `InputContainer`

A design's inputs become a real Formik form. **Every** input is wrapped in `InputContainer`
(label + `InputError`) — including PrimeReact `Dropdown` / `InputTextarea`, not just `InputText`. Never a
bare `InputText` + manual `<label>` + `InputError`. `validateOnChange: false`. Error copy matches
`detectedLanguage` (`Required`/`Requerido`, `Invalid email`/`Email inválido`). Leave `onSubmit` as a
marked `// TODO (openapi-import): replace with the real API call` — no `src/api/*`. On form-level errors,
move focus to the first invalid field or render `<div role='alert' aria-live='assertive'>`. Icon-free
file inputs (no PrimeReact primitive) use a styled `<label>` + hidden `<input type=file>`.

## B8. Icons — PrimeIcons pre-filter vs the source's own glyph

CONVENTIONS says *"PrimeIcons for icons. NO inline SVGs when a PrimeIcon exists"* — that is the rule for a
developer writing **from scratch**. When **translating a design**, applying it literally shreds a coherent icon
set: dropping a PrimeIcons font glyph into a set of stroke-matched SVGs is visibly inconsistent (different
weight, different corner treatment, different optical size). So the pre-filter is by **role**, not by "does a
PrimeIcon with this name exist":

**First, answer ONE question about the design as a whole** (not glyph by glyph): *does it ship a coherent icon
set?* Measure it — tabulate every inline `<svg>`'s `stroke-width` / `stroke-linecap` / fill-vs-stroke. If most
glyphs share one visual language (a lucide/feather-style set is the common case), **the design HAS a set**.

- **Design HAS a coherent set → every member keeps its source glyph.** Do not swap any member for a PrimeIcon,
  no matter how generic the glyph is on its own (a hamburger drawn in the set's stroke IS part of the set).
  Mixing one font glyph into a stroke-matched set is the exact inconsistency this rule exists to prevent.
  Expect **zero PrimeIcons** from such an import — that is the correct outcome, not an oversight.
- **Design has NO coherent set** (mixed/system icons, no shared language — more common from Figma) → then per
  glyph: **brand mark → keep the source**; **anything else → `<i className='pi pi-{name}' aria-hidden='true' />`**.

**Brand marks always keep the source glyph**, set or no set (WhatsApp, Instagram, LinkedIn, Google). The exact
path IS the brand; a lookalike is wrong even when PrimeIcons ships that name. Multi-color brand glyphs keep
their hex — the CONVENTIONS icon exception. **Use the path the design uses MOST, not the longest one**: a nav
instance may carry an extra sub-path the other N don't (an outlined ring vs a solid bubble). Diff the instances
before extracting; the majority path is canonical. Extracting the outlier silently re-draws every call site.

Then, among the glyphs kept from the source:

- **Reused 2+ times → extract** to `src/assets/icons/{Name}Icon.tsx` (monochrome → `stroke`/`fill='currentColor'`
  so callers theme with `text-*`; register in `src/assets/icons/index.ts`). **Check `src/assets/icons/index.ts`
  first** — a prior import may already ship it; reuse rather than duplicate.
- **Used exactly once → stays inline** in the screen. Repetition decides only WHERE a kept glyph lives; it never
  changes whether it's kept.

**The parent applies this in the Step 0.5 pre-filter and does NOT ask the user** — it's a mechanical rule, not a
preference. **Worked example** (the Holograma dclogic landing): measured, 16 of 18 glyphs are stroke-based at
`stroke-width:2` and 5 of those at `1.9` — one lucide-style set with a sub-variant → **the design HAS a set** →
every glyph keeps its source path, **zero PrimeIcons**, even though `pi-whatsapp`/`pi-instagram`/`pi-clock`/
`pi-bars` all exist. Extracted (2+): WhatsApp ×11 (majority path — NOT the nav's ringed variant), Instagram ×2,
Clock ×2, and the 5 specialty glyphs ×2. Left inline (1×): hamburger, users, lock, map-pin, phone, heart,
upload, check-circle, big-check, linkedin.

---

# Section C — Agent protocol

Cross-agent machinery, identical for every step agent of both flows.

## C1. Delegation contract

Sub-agents start with **fresh context** — they see only what the parent passes. The orchestrator MUST pass
enough context every time: the path to the extracted/working design tree, the **specific source file(s)**
the agent needs (its source-of-truth gate — a Figma `nodeId` or an unpacked source-file path/region), the
tokens/decisions already made, and the target/language. An agent that is missing a required input emits
`STOP-BLOCKING / INVALID_INPUT` rather than guessing.

**When the parent's brief disagrees with the source or the filesystem, the source/filesystem WINS — implement
that, and report the discrepancy in your `Output to parent`.** The orchestrator writes the brief from memory
after reading dozens of files; its per-value details (a `clamp()` endpoint, a section's padding, the exact
responsive step a sibling screen used, which alpha values need bracket form) are the least reliable part of an
otherwise-correct plan. You are looking at the actual file — it is the gate, exactly as the `file:lines` /
`nodeId` rule makes it the gate for component structure.

This is measured, not hypothetical. On the Tercer Milenium run the parent's brief was wrong three times and the
screen agents caught all three by preferring what they could see: a hero's vertical padding quoted from the
wrong section, a `tm-lg:` step that did not match the sibling screen already on disk, and a blanket
"bracket-form required" alpha warning that was over-broad (Tailwind's default opacity scale *does* include
5/10/20/25/30/…, so only genuinely off-scale values like 6/12/15/55/78/85/92 need it) — that last one sent an
agent hunting a non-existent bug in a shared component.

Do NOT silently "fix" the brief either: a one-line note in the report is what lets the orchestrator correct the
plan for the remaining screens instead of repeating the error N times. And do NOT escalate it as a STOP — a
disagreement you can resolve by reading the source is not a blocker.

## C2. STOP protocol

When an agent can't proceed (or completes with a documented default), it emits a STOP per
[CONVENTIONS > STOP Protocol](../CONVENTIONS.md#stop-protocol) — that section is the source of truth for
severities (`STOP-BLOCKING` / `STOP-ADVISORY`), the fenced format, and the category table. Do not restate
the categories in agent files; reference them. Emit one fenced STOP block per occurrence at the end of the
report.

## C3. Workload footer

Every step agent ends its `Output to parent` with this exact footer (the orchestrator parses it for the
workload ledger):

```
---
Workload: model={haiku|sonnet|opus}, tool_calls≈{N}, files_touched={M}
Validation: lint=✅/❌, type-check=✅/❌
Notes: {one-line count summary}
```

The `model=` literal MUST match the agent's `model:` frontmatter (the orchestrator reads the frontmatter
for the ledger; keep the footer literal in sync on any model change). `Validation:` reports `lint=skipped,
type-check=skipped` for runs that wrote only `.webp`/`.svg`/`.hash.txt` (no code). Agents that must also run
`build` (see C3b) append `, build=✅/❌` to the same line.

## C3b. An agent that creates or changes a COMPONENT must run `pnpm run build`

`lint` + `type-check` do not catch a broken **server/client boundary**. A component that imports a package
carrying a module-level `'use client'` banner silently becomes a client component and drags every subtree that
renders it out of SSR — and both cheap gates pass. Only `pnpm run build` fails, and only when some *page*
actually renders it. So the defect ships from the components step and detonates in a later, far more expensive
step.

**This is not a hypothetical, and the package involved is one CONVENTIONS actively mandates.** `classNames`
from `primereact/utils` ships that banner. On the Tercer Milenium run, four of six new presentational
components left the components step with `lint=✅ type-check=✅` and were unusable from any server component;
the other two were latent and would have broken three more routes. It surfaced in the first screen agent, ~44
minutes of Opus later. See [CONVENTIONS > PrimeReact Usage](../CONVENTIONS.md#primereact-usage) for the
documented carve-out (a purely presentational component composes classes natively and stays server-rendered).

So: **`{flow}-components` and `{flow}-screen` run `lint` → `type-check` → `build`, in that order, and report
all three.** A build failure is not "the orchestrator's problem later" — fix it before returning. The other
step agents (tokens, assets, scaffold, layouts) keep the two-gate footer; they do not author components.

`build` is also the ONLY gate that proves a route still prerenders. When the design is a static marketing site,
say so explicitly in your report — `○ (Static)` vs `ƒ (Dynamic)` per route is the evidence, not the absence of
errors.

## C4. Output-to-parent report shape

Before the footer, report **what changed** in a scannable form: the files created/modified (paths), the
key decisions taken (tokens created/reused, components extended/created, routes scaffolded, images
converted/reused), any screen-local modals / absorbed steps, and — for the screen agent — a note to run
`pnpm start`, open the route, and eyeball it. The report is data for the orchestrator's checkpoint, not a
human-facing essay; keep it terse.

## C5. Model tier

Each agent's model is fixed in its frontmatter (`haiku` mechanical / `sonnet` moderate judgment / `opus`
architectural + highest-fidelity). The orchestrator reads the frontmatter (not the footer) for its ledger.
Do not override the tier from inside the agent.

## C5b. A confirmed no-op is a valid outcome — still delegate

A step whose gap analysis says "there's nothing to do here" is **not** a step to skip, and **not** a step for the
orchestrator to run itself (that's Opus doing Haiku-grade work — see each SKILL's anti-patterns). Delegate it
anyway, pass your reading, and ask the agent to **verify or refute it**. A cheap agent returning "no-op, and
here's the evidence" is the point: it's the only thing that distinguishes *"correctly nothing to do"* from
*"the parent missed it"* — and the parent's reading is exactly what has no other gate.

Two symmetric failure modes to name in the delegation:

- **Don't invent work to justify the step.** "A landing usually has a layout header" is not a reason. If the
  chrome is state-coupled to a single screen, hoisting it to a layout would force UI state into a store — out
  of scope for an import.
- **Don't rubber-stamp.** If the agent finds real work the parent missed, it says so; if it finds work that
  would need a decision outside its scope, it emits a STOP rather than guessing.

Applies to any step, most often **Step 4 (layouts)** — e.g. `navModel = single-page-sections`, where the header
and footer belong to the one screen. An agent whose required inputs don't exist for the format (roles/registries
are a `screen-registry` construct; dclogic has none) should be told so explicitly in the delegation and asked to
report the no-op — **not** left to hit its own "if the input is missing, ask" branch (see C1: it emits
`STOP-BLOCKING / INVALID_INPUT`; it has no user to ask).

## C6. Registering a new component in the reuse table

The **[Existing Reusable Components](../CONVENTIONS.md#existing-reusable-components)** table lives in
**`.claude/CONVENTIONS.md`** — **not** in `CLAUDE.md`. (It used to live in `CLAUDE.md`; it moved, and stale
pointers sent agents to a file where the heading no longer exists.) It is the authoritative reuse list every
`*-components` / `*-screen` / `*-layouts` agent of both flows reads before creating anything, so a component
missing from it will be silently rebuilt by the next import.

After **creating** a component, append its row. After **extending** one, update its existing row's description.

```markdown
| `{ComponentName}` | `components/{path}/{ComponentName}.tsx` | One sentence: what it is + key props/variants. |
```

- **Path column** reflects the real subfolder (`components/inputs/PhoneInput/PhoneInput.tsx`,
  `components/modals/ConfirmModal/ConfirmModal.tsx`).
- **Placement** — the table interleaves root and `inputs/` rows, then groups `modals/` rows at the end:
  `modals/` component → after the LAST `modals/` row; `inputs/` component → after the LAST `inputs/` row;
  root component → after the last root-level row that PRECEDES the `modals/` block (keeps `modals/` last).
- When **extending**, `Edit` with `old_string` = the complete current row (both `|` delimiters). NEVER
  `replace_all` — rows share substrings.
- Do NOT proactively re-sort the table; place your row by the rules above and move on.
