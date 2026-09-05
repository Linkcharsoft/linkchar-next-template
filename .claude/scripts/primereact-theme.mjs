#!/usr/bin/env node
/**
 * primereact-theme.mjs — vendor PrimeReact's compiled `lara-light-blue` theme as src/styles/primereact-theme.css
 * with its accent hardcodes replaced by CSS custom properties, so a project re-skins EVERY component by setting
 * ONE variable — `--theme-accent`, in src/styles/general.sass — with no script run and no hand-mapped selectors.
 *
 * WHY THIS EXISTS
 * ---------------
 * The compiled theme hardcodes its palette in ~350 declarations. The `--primary-color` / `--primary-*` custom
 * properties in its `:root` are informational — not one rule reads them (grep `var(--primary` in the file: zero
 * hits) — so there is nothing to override in the stock file. This script puts the variable back, ONCE, and the
 * output is committed. The derived shades (hover / active / focus ring / highlight / 50…900) are `color-mix()` of
 * the hook, declared under `:where(:root)` so a project's own `:root` declarations win regardless of stylesheet
 * order. It also drops the bundled Inter `@font-face` and every `font-family` declaration, so PrimeReact
 * components inherit the page font.
 *
 * HOW AN "ACCENT SLOT" IS DECIDED — exactly, not by guessing the hue
 * ------------------------------------------------------------------
 * Every `lara-light-*` theme is the SAME file with only the accent colours swapped, so a colour is an accent slot
 * iff it DIFFERS between two variants at the same position. The script tokenises `lara-light-blue` (base) and
 * `lara-light-green` (witness) side by side and replaces only the differing tokens. Everything the two themes
 * share stays literal by construction: the greys, the severities, and — the case a hue heuristic would get
 * wrong — the blues PrimeReact keeps in EVERY theme, i.e. the `info` severity of `.p-message` / inline message /
 * toast and `.p-button-info`'s focus ring. Those stay blue in a green-branded project exactly as errors stay red.
 * A differing colour the map does not know (an upgrade added a new accent shade) is a hard failure, exit 2 — the
 * script never emits a half-converted theme.
 *
 * WHEN TO RUN IT: once (done — the output is committed), and again only after a `primereact` upgrade — the file is
 * a snapshot of the version named in its header, not a live import. Changing the accent never needs it.
 *
 * USAGE
 *   node .claude/scripts/primereact-theme.mjs [--base lara-light-blue] [--witness lara-light-green]
 *                                              [--out src/styles/primereact-theme.css] [--app <dir>] [--check] [--no-wire]
 *   --check     regenerate in memory and compare with the file on disk; write nothing; exit 1 if it is stale.
 *   --no-wire   do not rewrite the theme import in src/app/layout.tsx.
 *
 * EXIT  0 = written / up to date · 1 = stale (--check) or bad input · 2 = the installed themes no longer fit the
 *       method (base and witness are not structurally identical, or an accent colour is missing from SLOTS) —
 *       inspect node_modules/primereact/resources/themes and update this script before trusting any output.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const argv = process.argv.slice(2)

const die = (msg, code = 1) => {
  console.error(`primereact-theme: ${msg}`)
  process.exit(code)
}

const flag = (name) => argv.includes(`--${name}`)
const opt = (name) => {
  const i = argv.indexOf(`--${name}`)
  if (i === -1) return undefined
  const v = argv[i + 1]
  if (v === undefined || v.startsWith('--')) die(`--${name} needs a value`)
  return v
}

const app = resolve(opt('app') ?? process.cwd())
const base = opt('base') ?? 'lara-light-blue'
const witness = opt('witness') ?? 'lara-light-green'
const out = resolve(app, opt('out') ?? 'src/styles/primereact-theme.css')
const check = flag('check')
const wire = !flag('no-wire')

if (base !== 'lara-light-blue') die('--base must be lara-light-blue: the SLOTS map below is written for its palette')
if (!/^lara-light-/.test(witness) || witness === base) die(`--witness must be a different lara-light-* theme (got ${witness})`)

const themeFile = (name) => join(app, 'node_modules', 'primereact', 'resources', 'themes', name, 'theme.css')
for (const name of [base, witness]) if (!existsSync(themeFile(name))) die(`theme not found: ${themeFile(name)} (is primereact installed?)`)
const pkg = JSON.parse(readFileSync(join(app, 'node_modules', 'primereact', 'package.json'), 'utf8'))

// ── accent slots of lara-light-blue → the variable that replaces them ─────────────────────────────────
// `#3b82f6` keeps a literal fallback because it is the only slot a project sets directly; the rest resolve
// through the :where(:root) block below. Which OCCURRENCES are replaced is decided by the witness diff, not
// by this list — the list only says what a differing colour becomes.

const HOOK = 'var(--theme-accent, #3b82f6)'

const SLOTS = {
  '#3b82f6': [HOOK, 'primary'],
  '#2563eb': ['var(--theme-accent-hover)', 'hover'],
  '#1d4ed8': ['var(--theme-accent-active)', 'active / highlight text'],
  '#bfdbfe': ['var(--theme-accent-ring)', 'focus ring'],
  '#eff6ff': ['var(--theme-accent-highlight)', 'highlight background'],
  '#9dc1fb': ['var(--theme-accent-200)', 'tint (focus shadow)'],
  '#8cbeff': ['var(--theme-accent-300)', 'tint'],
  '#70aeff': ['var(--theme-accent-400)', 'tint'],
  '#f5f9ff': ['var(--theme-accent-50)', 'scale 50'],
  '#d0e1fd': ['var(--theme-accent-100)', 'scale 100'],
  '#abc9fb': ['var(--theme-accent-200)', 'scale 200'],
  '#85b2f9': ['var(--theme-accent-300)', 'scale 300'],
  '#609af8': ['var(--theme-accent-400)', 'scale 400'],
  '#326fd1': ['var(--theme-accent-600)', 'scale 600'],
  '#295bac': ['var(--theme-accent-700)', 'scale 700'],
  '#204887': ['var(--theme-accent-800)', 'scale 800'],
  '#183462': ['var(--theme-accent-900)', 'scale 900']
}

const ALPHA_RE = /^rgba\(59, 130, 246, (0?\.\d+)\)$/

// `color-mix(in srgb, accent p%, white|black)` — the same tint/shade arithmetic Lara uses for its own scale.
const DERIVED = {
  '--theme-accent-hover': [89, 'black'],
  '--theme-accent-active': [80, 'black'],
  '--theme-accent-ring': [32, 'white'],
  '--theme-accent-highlight': [8, 'white'],
  '--theme-accent-50': [5, 'white'],
  '--theme-accent-100': [24, 'white'],
  '--theme-accent-200': [43, 'white'],
  '--theme-accent-300': [62, 'white'],
  '--theme-accent-400': [81, 'white'],
  '--theme-accent-600': [85, 'black'],
  '--theme-accent-700': [70, 'black'],
  '--theme-accent-800': [55, 'black'],
  '--theme-accent-900': [40, 'black']
}

// ── tokenise both themes side by side ──────────────────────────────────────────────────────────────────

const COLOUR = /(#[0-9a-f]{3,8}\b|rgba?\([^)]*\))/gi
const baseParts = readFileSync(themeFile(base), 'utf8').split(COLOUR)
const witnessParts = readFileSync(themeFile(witness), 'utf8').split(COLOUR)

const diverged = (why) => die(`${base} and ${witness} are not structurally identical in primereact@${pkg.version} (${why}); the witness diff cannot tell accent from semantic colour — inspect both themes and update this script`, 2)
if (baseParts.length !== witnessParts.length) diverged(`${baseParts.length} vs ${witnessParts.length} segments`)
for (let i = 0; i < baseParts.length; i += 2) {
  if (baseParts[i] !== witnessParts[i]) diverged(`text differs around segment ${i}`)
}

// ── replace only what differs from the witness ─────────────────────────────────────────────────────────

const counts = new Map()
let alphas = 0
let semantic = 0
const outParts = baseParts.slice()

for (let i = 1; i < baseParts.length; i += 2) {
  const token = baseParts[i].toLowerCase()
  if (token === witnessParts[i].toLowerCase()) {
    if (token in SLOTS) semantic++
    continue
  }
  const alpha = ALPHA_RE.exec(token)
  if (alpha) {
    outParts[i] = `color-mix(in srgb, ${HOOK} ${Math.round(Number(alpha[1]) * 100)}%, transparent)`
    alphas++
    continue
  }
  const slot = SLOTS[token]
  if (!slot) die(`accent slot ${token} (witness has ${witnessParts[i]}) is not in SLOTS — primereact@${pkg.version} added an accent shade; map it before regenerating`, 2)
  outParts[i] = slot[0]
  counts.set(token, (counts.get(token) ?? 0) + 1)
}

if (counts.size === 0) die('no accent slot differs between the two themes — wrong witness?', 2)

let css = outParts.join('')

const fontFaces = (css.match(/@font-face\s*\{[^}]*Inter var[^}]*\}\s*/g) ?? []).length
css = css.replace(/@font-face\s*\{[^}]*Inter var[^}]*\}\s*/g, '')
const fontDecls = (css.match(/^[ \t]*(?:--)?font-family:[^\n]*\n/gm) ?? []).length
css = css.replace(/^[ \t]*(?:--)?font-family:[^\n]*\n/gm, '')

if (/url\(/.test(css)) die('the transformed theme still references a url() — it would not be self-contained; inspect the base theme', 2)
if (/Inter var/.test(css)) die('an "Inter var" reference survived the font strip; inspect the base theme', 2)

const header =
  `/* Generated by .claude/scripts/primereact-theme.mjs from primereact@${pkg.version} ${base} (accent slots = what differs from ${witness}) — regenerate after a primereact upgrade, do not edit. */\n` +
  `/* Accent hook: set \`--theme-accent\` on :root (src/styles/general.sass). Every --theme-accent-* below derives from it; pin any of them on :root to override. */\n` +
  `:where(:root) {\n` +
  Object.entries(DERIVED).map(([name, [pct, target]]) => `  ${name}: color-mix(in srgb, ${HOOK} ${pct}%, ${target});`).join('\n') +
  `\n}\n`

const output = header + css

// ── check / write / wire ───────────────────────────────────────────────────────────────────────────────

console.log(`primereact-theme  base=${base}  witness=${witness}  primereact@${pkg.version}`)
for (const [hex, [replacement, label]] of Object.entries(SLOTS)) {
  console.log(`  ${String(counts.get(hex) ?? 0).padStart(3)}× ${hex}   → ${replacement.padEnd(30)} ${label}`)
}
console.log(`  ${String(alphas).padStart(3)}× rgba(59, 130, 246, α) → color-mix(… α%, transparent)`)
console.log(`  ${String(semantic).padStart(3)}× blue kept literal — identical in ${witness}, so semantic (info severity), not accent`)
console.log(`  ${String(fontFaces).padStart(3)}× @font-face "Inter var" removed · ${fontDecls}× font-family declarations removed`)

if (check) {
  if (!existsSync(out)) die(`${out} does not exist — run without --check to create it`)
  if (readFileSync(out, 'utf8') === output) {
    console.log(`\n${out} is up to date`)
    process.exit(0)
  }
  die(`${out} is STALE against primereact@${pkg.version} — re-run without --check to regenerate`)
}

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, output)
console.log(`\nWrote ${out} (${(Buffer.byteLength(output) / 1024).toFixed(0)} KB)`)

if (wire) {
  const layout = join(app, 'src', 'app', 'layout.tsx')
  if (!existsSync(layout)) {
    console.log(`⚠ ${layout} not found — import the generated file from the root layout yourself`)
  } else {
    const src = readFileSync(layout, 'utf8')
    const importRe = /import\s+['"]primereact\/resources\/themes\/[^'"]+\/theme\.css['"]\s*\n/
    if (src.includes('@/styles/primereact-theme.css')) {
      console.log('layout.tsx already imports @/styles/primereact-theme.css')
    } else if (importRe.test(src)) {
      writeFileSync(layout, src.replace(importRe, "import '@/styles/primereact-theme.css'\n"))
      console.log("Rewired src/app/layout.tsx: theme import → '@/styles/primereact-theme.css'")
    } else {
      console.log("⚠ no primereact theme import found in src/app/layout.tsx — add `import '@/styles/primereact-theme.css'` where the theme was imported")
    }
  }
}
