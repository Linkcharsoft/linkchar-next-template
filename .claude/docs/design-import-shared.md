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

> Consequence to expect: a noisy `rawScan` produces several new typography tokens (e.g. one dclogic
> rawScan's `13/15/17/19/21/27/30/34/50/58` → ~10 tokens). That's intended under this rule — fidelity
> over a lean token set.

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

## B5. `container-custom` at import time — **branches on `Target`**

`container-custom` caps content at the project's desktop width. That is the right anchor for a design meant
to be viewed at desktop widths, and the wrong one for a design that was drawn inside a phone frame. So the
rule branches on the `Target` the orchestrator detected (`web` | `mobile-app`).

**Which branch applies is a property of the FLOW, not a judgement call.** `figma-design-import` has no
`mobile-app` target — a Figma frame is a desktop artboard — so its agents are always on the `web` branch and
never see the field. `claude-design-import` detects the target per prototype (most Claude Design exports are
phone-framed) and **passes it explicitly**; a `claude-design-*` agent that did not receive `Target:` emits
`STOP-BLOCKING / INVALID_INPUT` rather than picking a branch.

**`Target: web` — `container-custom` on every top-level `<section>`.** Each top-level `<section>` of a screen
(and the inner content of layout chrome — navbar/footer/sidebar) anchors its content with `container-custom`
(16px built-in gutter — **no** `px-*` on the same element). **Ignore** the source's own frame width and
per-section horizontal padding (a `max-width:1180px; margin:0 auto; padding:0 24px` block) —
`container-custom` replaces the horizontal part. For a full-bleed background, keep the bg on `<section>` and
nest a `container-custom` inner `<div>`.

**`Target: mobile-app` — the app shell owns the width; `container-custom` is NOT applied.** The design was
drawn inside a phone frame (≈390–430px) and the layout renders it as a centered app-shell column, so the
horizontal cap already exists one level up. Anchoring each section at the desktop width instead **stretches
every section past the shell** and undoes the layout's own capping. Here:

- The **layout** sets the shell's max-width once (that is the one place a `max-w-*` is correct for this
  target, and it is why the "never `max-w-*`" hard rule is scoped to screens, not layouts).
- The **screen** keeps the source's own horizontal rhythm as `px-*` — it is real design intent at this
  target, not a frame artifact to discard.
- Full-bleed sections still work the same way: bg on `<section>`, padded inner `<div>`.

**Vertical padding is separate and identical at both targets**: translate the source's vertical rhythm
(`padding:96px 24px` → `py-24`) into `py-*`/`pt-*`/`pb-*` — a section with no vertical padding at all is
incomplete regardless of target. Full rule + non-applicable cases:
[CONVENTIONS > Global Container](../CONVENTIONS.md#global-container).

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

**The demo seed is NOT the initial state of a creation form.** The seed exists so a dashboard/listing screen
renders populated instead of empty. A **creation or onboarding flow** in the same design initializes its own
draft **blank or minimal** in the source — read the source's own initialization, not the seed. A creation
step that reads the populated seed ships a form pre-filled with another entity's demo data (a signup wizard
that starts with three accounts already in it), which reads as a data-ownership bug to anyone testing the
prototype and is invisible to every gate. So the store spec carries **two** values where they differ: the
seeded demo state, and the initial state a creation flow resets to. A screen implementing a creation form
uses the latter.

**Carry the prototype's persistence, don't silently drop it.** If the source persists state
(`localStorage` / `sessionStorage`), the store spec must say so — the requirement AND the **scope**
(per-tab vs shared across tabs), which the source's choice of storage tells you. Translating persisted state
into an in-memory store satisfies the behaviour during client navigation and loses it on a hard refresh —
a half-met requirement that nothing downstream flags. `/new-store` ships the `persist` middleware for this;
use it rather than leaving the decision to whoever notices the reset.

## B7. Forms — Formik + Yup, wrapped in `InputContainer`

A design's inputs become a real Formik form. **Every** input is wrapped in `InputContainer`
(label + `InputError`) — including PrimeReact `Dropdown` / `InputTextarea`, not just `InputText`. Never a
bare `InputText` + manual `<label>` + `InputError`. `validateOnChange: false`. Error copy matches
`detectedLanguage` (`Required`/`Requerido`, `Invalid email`/`Email inválido`). Leave `onSubmit` as a
marked `// TODO (openapi-import): replace with the real API call` — no `src/api/*`. On form-level errors,
move focus to the first invalid field or render `<div role='alert' aria-live='assertive'>`. File inputs
go through PrimeReact `FileUpload`, wrapped in `InputContainer` like every other input: `mode='basic'` (a
re-stylable choose button) by default; `mode='advanced'` + `emptyTemplate`/`headerTemplate`/`itemTemplate`
when the design draws a dropzone; `customUpload` so `onSubmit` keeps the openapi-import TODO; skin via
per-instance `pt` + the colocated `.sass`. Only when `FileUpload`'s own DOM makes the design's control
irreproducible (neither button nor dropzone — a fully clickable card, an avatar-circle picker) fall back to a
styled `<label>` + visually-hidden `<input type=file>`, and emit `STOP-ADVISORY` with `default_applied` naming
the fallback — never take it silently ([CONVENTIONS > PrimeReact Usage](../CONVENTIONS.md#primereact-usage)
records the same rule).

**The wrapper is mandatory; the label's TYPOGRAPHY still comes from the source.** `InputContainer` renders
its `label` through the template's `Label`, whose default treatment (sentence case, neutral grey, 16px) will
otherwise silently replace whatever the design specified — an uppercase tinted eyebrow at 11px, say. Because
the wrapper is *required*, an agent doing the right thing re-styles every label in every form of the import,
which makes this the quietest drift in the flow: nothing is skipped, nothing STOPs, and the forms just stop
looking like the design.

`InputContainer`'s `label` prop is typed `ReactNode`, not `string` — so carry the source treatment in the
node itself and no component change is needed:

```tsx
<InputContainer label={<span className='text-bold-11 uppercase tracking-wide text-brand-400'>Nombre</span>} htmlFor='name' error={errors.name}>
```

Only when the source treatment genuinely cannot be expressed this way (it needs different layout, not
different type) do you emit `STOP-ADVISORY` and note the default you applied.

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

> **The repetition filter is the SCATTERED-glyph rule. It does NOT bound a design whose glyphs are collected in
> ONE place.** Both flows have that shape: a code source with a single `Icon` component holding a `name → svg`
> map, or a Figma file with an icon **component set** whose variants are the glyphs. Either way **the collection
> is the universe** — every member gets split out, regardless of how many times the screens in scope happen to
> place it.
>
> **Derive the list from the collection, never from the screens you are looking at.** The screens in scope are a
> subset in three ordinary situations: a batch that implements 2 of 25 screens, a partial import, and — for a
> code source — glyphs reached by NAME FROM DATA (`<Icon name={item.icon}/>`), which have no call site to count
> and no call site to "stay inline" at. Each undercounts, and the failure surfaces later as a screen rendering
> an undefined glyph. Measured: a 9-glyph list taken from 2 screens' markup, against a source collection
> declaring 50, missing three that a seeded data array referenced.

**The parent applies this in the Step 0.5 pre-filter and does NOT ask the user** — it's a mechanical rule, not a
preference. **Worked example** (one dclogic landing): measured, 16 of 18 glyphs are stroke-based at
`stroke-width:2` and 5 of those at `1.9` — one lucide-style set with a sub-variant → **the design HAS a set** →
every glyph keeps its source path, **zero PrimeIcons**, even though `pi-whatsapp`/`pi-instagram`/`pi-clock`/
`pi-bars` all exist. Extracted (2+): WhatsApp ×11 (majority path — NOT the nav's ringed variant), Instagram ×2,
Clock ×2, and the 5 specialty glyphs ×2. Left inline (1×): hamburger, users, lock, map-pin, phone, heart,
upload, check-circle, big-check, linkedin.

## B9. Fidelity is not only about copy — the control set and its affordances are the design too

The "verbatim, do not improve" discipline that every screen agent applies to **text** has no counterpart for
**UI**, and that asymmetry is where a whole class of drift lives. Each of these is plausible, useful, compiles,
type-checks, builds and passes every convention grep — and is a product decision nobody took, buried inside a
run of N screens:

- a `Descripción (opcional)` textarea added to a create form the source does not have
- a per-field `Copiar` button, an `Editar` affordance per row, a third CTA next to the source's two
- required-marker asterisks on fields the source does not mark
- a static label ("Vos", a name the source only displays) implemented as an editable input

**So: implement the source's control set as it is.** Concretely —

- **No extra controls.** Every input, button, link, toggle and menu item in your output must trace to one in
  the source. Adding one is not a styling call; route it through `STOP-ADVISORY` with `default_applied` so the
  orchestrator can approve or drop it, instead of it appearing silently.
- **No missing controls either** — the rule is symmetric. A control you could not implement is a STOP, not an
  omission.
- **Preserve the affordance.** Editable stays editable; static stays static; clickable stays clickable. Ask of
  each element what the source lets the user *do* with it, not just what it looks like. This one is worth
  flagging rather than "fixing on sight" in either direction: the source is not automatically right for this
  target either (an import with no backend may have no way to honour an edit the prototype mocked), so it is
  the orchestrator's call — report it, don't decide it.
- **Preserve a modal's PRESENTATION.** Bottom-sheet, centered dialog and full-screen takeover are three
  different components to a user, not three skins of one. Read how the source presents each overlay
  (`align-items: flex-end` + top-rounded corners is a sheet, not a dialog) and keep it. Where a modal is
  mounted (screen-local vs the global `ModalsProvider`) is a separate question and does not change this.

## B10. Reusing a component — match the INSTANCE, not just the component

The reuse audit answers *"does a component for this already exist?"*. Two things it does not answer, both of
which produce output that looks like correct reuse:

**"Near match" is not a match.** When the existing component differs from the source primitive in a **visual
parameter** — corner radius, border style, fill vs outline, stroke weight, aspect — reusing it with overrides
is not reuse, it is a silent substitution, and the real gap gets recorded as a win. Treat it as a missing
**variant**: `COMPONENT_GAP` → extend the component (add the variant to its `variant` union, never a parallel
prop) rather than approximating. Severity follows the existing usage-count rule — 1× ADVISORY, 2+× BLOCKING —
so this widens *what counts as a gap*, not how loudly a gap is reported.

Related: the placeholder/fallback of one **family** (an object's list card, its detail hero, its preview) must
be the SAME component across all three unless the source deliberately differs. Two different fallbacks for one
entity is the tell that a near-match slipped in somewhere.

**Optional props mirror the source INSTANCE, not the component's capabilities.** A shared component's optional
props exist because *some* call site needs them. Enabling one on a call site the source did not — a progress
bar's end caps, a card's badge slot, a dense variant — changes what that screen asserts. It can even put two
contradictory numbers on the same card while remaining type-safe. So read the props off the instance you are
translating, one call site at a time.

The same applies to a **derived visual**: if the primitive computes something from data (a colour from a name
hash, initials from a full name, a generated placeholder), reproduce the source's mapping **exactly** — the
same hash function and the same number of initials. A different hash over the same names produces different
colours, which is a different design, not an implementation detail. If the shared component's derivation
differs from the source's, that is a missing variant, per the rule above.

## B11. The PrimeReact accent override — one variable in `general.sass`, only when asked

The template ships PrimeReact's `lara-light-blue` theme **vendored** as `src/styles/primereact-theme.css`
(imported by `src/app/layout.tsx`) with every accent hardcode replaced by `var(--theme-accent…)`. So re-skinning
EVERY component — input focus ring, dropdown/listbox highlight, checkbox, radio, slider, tabs, paginator,
datatable selection, calendar — is one declaration in `src/styles/general.sass`:

```sass
:root
  --theme-accent: theme('colors.acme.accent')      // template default: theme('colors.inferencia-magenta')
```

Whether to repaint is the orchestrator's call at its checkpoint (both `SKILL.md` files carry that decision);
this section is the **mechanism** for the agent that carries it out (the tokens agent at Step 1, or
`design-post-import` at Step 7).

**Apply it ONLY if the parent's brief passes the accent token.** No token in the brief means the user declined
or the design's accent is already blue — leave the line alone. Never infer it from the palette you just added.

- **Write the token through `theme()`**, never a hex: `theme('colors.brand-primary')` for a flat token,
  `theme('colors.brand.500')` for a nested scale — read `tailwind.config.js` for the shape. A hex there is the
  same violation as anywhere else, and lint does not catch it.
- Hover / active / focus ring / highlight and the `50…900` scale **derive from the hook** via `color-mix()`,
  declared under `:where(:root)` in the vendored file so your `:root` always wins. A brand with its own exact
  shades may pin any of them in the same block — `--theme-accent-hover`, `--theme-accent-active`,
  `--theme-accent-ring`, `--theme-accent-highlight`, `--theme-accent-{50…900}` — again through `theme()`.
- `.p-invalid`'s red is not a slot, and neither is the blue of the `info` severity (`.p-message-info`, inline
  message, toast, `.p-button-info`'s ring): severities stay state signals, untouched by construction — a
  green-branded project still shows blue info messages, exactly as PrimeReact's own green theme does.
- The vendored file carries **no `font-family`** — PrimeReact components inherit the page font. Do not add one.
- **Never edit `src/styles/primereact-theme.css`, never write `.p-*` colour overrides in `general.sass`, never
  override PrimeReact's own `--primary-color`.** The file is generated by `.claude/scripts/primereact-theme.mjs`
  from the installed `primereact` (its header names the version) and is re-run only after a `primereact`
  upgrade; `--check` says whether the snapshot is stale, exit `2` means the upgrade changed the themes in a way
  the script cannot map (a new accent shade, or the two reference themes no longer line up) — report, do not
  hand-patch. The import flows run only its `--check`, at Step 7: `design-post-import` regenerates a stale
  snapshot, so nobody has to remember the upgrade by hand.

Why a variable had to be manufactured, and how the script knows which colours are "the accent": the compiled
theme hardcodes its palette in ~350 declarations, and the `--primary-color` / `--primary-*` custom properties in
its `:root` are read by no rule (`grep 'var(--primary'` → 0 hits). Every `lara-light-*` theme is the SAME file
with only the accent colours swapped, so the script tokenises `lara-light-blue` next to `lara-light-green` and
replaces exactly the colours that differ between the two — an exact definition, not a hue heuristic. That is
also why the semantic blues survive: they are identical in both themes.

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

## C1b. Stay inside your brief — never delete what it does not name

Writing outside your brief is usually harmless; **deleting outside it destroys another step's work, and the
report reads like diligence.** Measured: the tokens agent removed an icon export that the assets agent had just
created, filed it under "CLEANUP" as an errant entry that "should not be in `src`", and reported
`lint=✅ type-check=✅`. The icon was required by two screens. Nothing downstream catches this — the deletion
compiles.

The trap is that some agents carry a standing tidy-up mandate (removing legacy `@import` lines, stripping dead
rules) with no file boundary attached, and "this looks like it doesn't belong" is exactly how a fresh-context
agent misreads a file another step wrote ten minutes earlier — see C3's rule that your claims about things
outside your own turn carry no evidence.

So:

- **Delete only inside the files your brief names.** Anything else — even something that looks obviously
  wrong — is `STOP-ADVISORY` with what you found and why, not a removal.
- **A removal is never "cleanup" in your report.** Report it as `DELETED: {path} — {reason}`, on its own line,
  so the orchestrator can weigh it against what the other steps produced. Burying it in a tidy-up section is
  how it goes unnoticed.
- **Replacing a file's contents wholesale is a deletion** of whatever you did not carry over. Same rule.

This is measured, not hypothetical. On one multi-page dclogic run the parent's brief was wrong three times and the
screen agents caught all three by preferring what they could see: a hero's vertical padding quoted from the
wrong section, a namespaced design-breakpoint step that did not match the sibling screen already on disk, and a blanket
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
from `primereact/utils` ships that banner. On one multi-page dclogic run, four of six new presentational
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

## C3c. An agent that creates, moves or removes a ROUTE must run `pnpm run build`

Same shape as C3b, different blind spot. This project sets **`typedRoutes: true`** (`next.config.ts`), so
`Route` is a union generated from the app tree into `.next/types` — and **`pnpm run type-check` validates
against whatever was generated last, not against the tree you just changed.** Two consequences, both measured:

- **Stale-green and stale-red are both possible.** After scaffolding routes, `type-check` can report errors for
  routes that now exist, or pass on links to routes that no longer do. Only `next build` regenerates the types.
  Diagnosing those phantom errors as real is a wasted cycle; trusting a stale pass ships a broken link.
- **A route literal is type-checked everywhere it appears.** Removing or renaming a route the template already
  serves breaks every `redirect('/')`, route constant and error-page link that names it — in files the import
  never touched.

So: **scaffold ALL routes first, then validate, and validate with `build`** — `lint` → `type-check` →
`build`, reporting all three (append `, build=✅/❌` to the footer's `Validation:` line, per C3). While the
target route does not exist yet, link to it with the object form `href={{ pathname: '/x' }}`, which is not
narrowed to the generated union.

This extends C3b's list: **`{flow}-components`, `{flow}-screen` and `{flow}-scaffold` run all three gates.**
`tokens`, `assets` and `layouts` keep the two-gate footer — unless a layouts run wires a route group, which
moves `page.tsx` files and therefore changes the route tree; then it runs `build` too.

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

The orchestrator delegates a step even when its own gap analysis says "there's nothing to do here" — that
instruction lives in each SKILL's Step 4, not here. The reason concerns YOU: a cheap agent returning "no-op,
and here's the evidence" is the only thing that distinguishes *"correctly nothing to do"* from *"the parent
missed it"* — the parent's reading is exactly what has no other gate. So when your brief says "we believe this
step is a no-op — verify or refute it", that IS the task, not a formality to acknowledge.

Two symmetric failure modes:

- **Don't invent work to justify the step.** "A landing usually has a layout header" is not a reason. If the
  chrome is state-coupled to a single screen, hoisting it to a layout would force UI state into a store — out
  of scope for an import.
- **Don't rubber-stamp.** If you find real work the parent missed, say so; if you find work that would need a
  decision outside your scope, emit a STOP rather than guessing.

Report the confirmed no-op with its evidence in the normal report shape (C4) — a reasoned no-op is a
deliverable, not a failure. Applies to any step, most often **Step 4 (layouts)** — e.g.
`navModel = single-page-sections`, where the header and footer belong to the one screen. Expect the brief to
SAY when a required input does not exist for the format (roles/registries are a `screen-registry` construct;
dclogic has none): a named absence is valid input, not a missing field — do not emit
`STOP-BLOCKING / INVALID_INPUT` over it. C1's missing-input rule covers fields the parent forgot, not fields
the format cannot have.

## C6. Registering a new component in the reuse table

The **[Existing Reusable Components](../CONVENTIONS.md#existing-reusable-components)** table lives in
**`.claude/CONVENTIONS.md`** — **not** in `CLAUDE.md`, which carries no such heading. It is the authoritative reuse list every
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

## C7. Invoking a project skill from inside a sub-agent — one at a time, and YOU do the writing

Some steps are specified as "invoke `/new-screen` / `/new-store` / `/new-modal`" rather than "write these
files". That is deliberate — the skill is the canonical generator and hand-rolling drifts from it.

**First, what invoking a skill actually does, because getting this wrong makes a correct run look like a
failure.** The `Skill` tool does not execute anything. It loads that skill's `SKILL.md` into YOUR context, and
you then carry out its steps — including writing the files — yourself. **Writing the files by hand after
invoking the skill IS the skill path**, not a fallback from it. Measured twice: `Skill(new-store)` from inside
a step agent returns `Launching skill: new-store` plus the full instruction body, and creates zero files on its
own. So:

- **Never report "the skill did not run, so I wrote the files manually."** If you invoked the tool and then
  wrote the files it described, the skill ran. Reporting that as a fallback tells the orchestrator a step
  failed when it succeeded.
- **The one real failure is the tool not being there or the skill not loading** — the tell is an error or an
  `Unknown command`, never a normal-looking return. Only then do you `Read` the `SKILL.md` from disk and follow
  it without invoking ([CLAUDE.md § Automation Skills](../../CLAUDE.md#automation-skills) — its warning is
  about the tool ceasing to be *invoked*, not about you doing the typing).
- **Report which of the two happened**, per deliverable: `via Skill` or `SKILL.md read from disk (tool
  unavailable)`. That distinction is real and worth a line; "skill-generated vs hand-written" is not — every
  file a skill produces is one you typed.

**Invoke one at a time, sequentially — never fan out.** Firing N invocations in a single turn injects N full
instruction bodies at once, and the observed result is an agent that treats the acknowledgements as the
deliverable and writes nothing: 28 parallel `/new-screen` calls produced 28 acknowledgements and zero screens,
while the same agent invoking the same skill sequentially across a 10-route import worked. One invocation,
carry out its steps, then the next.

**The acknowledgement is not evidence.** After completing each one, confirm the deliverable exists
(`ls`/`Test-Path` the folder) before starting the next. Same rule the orchestrator applies to your reported
counts: a claim about what happened is not a measurement of it.
