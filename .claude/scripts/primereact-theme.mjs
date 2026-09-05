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
 * hits) — so there is nothing to override in the stock file. Every `lara-light-*` theme is the SAME file with
 * 16 hex + 3 rgba slots swapped (verified: masking colours makes `lara-light-blue` and `lara-light-green`
 * byte-identical). This script swaps those slots for `var(--theme-accent…)` ONCE; the derived shades (hover /
 * active / focus ring / highlight / 50…900) are `color-mix()` of the hook, declared under `:where(:root)` so a
 * project's own `:root` declarations win regardless of stylesheet order. It also drops the bundled Inter
 * `@font-face` and every `font-family` declaration, so PrimeReact components inherit the page font.
 *
 * WHEN TO RUN IT: once (done — the output is committed), and again after every `primereact` upgrade — the file is
 * a snapshot of the version named in its header, not a live import. Changing the accent never needs it.
 *
 * USAGE
 *   node .claude/scripts/primereact-theme.mjs [--base lara-light-blue] [--out src/styles/primereact-theme.css]
 *                                              [--app <dir>] [--check] [--no-wire]
 *   --check     regenerate in memory and compare with the file on disk; write nothing; exit 1 if it is stale.
 *   --no-wire   do not rewrite the theme import in src/app/layout.tsx.
 *
 * EXIT  0 = written / up to date · 1 = stale (--check) or bad input · 2 = the base theme no longer matches the
 *       slot map (an upgrade reshuffled the palette) — update SLOTS below before trusting the output.
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
const out = resolve(app, opt('out') ?? 'src/styles/primereact-theme.css')
const check = flag('check')
const wire = !flag('no-wire')

if (!/^lara-light-/.test(base)) die(`--base must be a lara-light-* theme (got ${base}); the slot map is Lara-specific`)

const baseFile = join(app, 'node_modules', 'primereact', 'resources', 'themes', base, 'theme.css')
if (!existsSync(baseFile)) die(`base theme not found: ${baseFile} (is primereact installed?)`)
const pkg = JSON.parse(readFileSync(join(app, 'node_modules', 'primereact', 'package.json'), 'utf8'))

// ── slot map for lara-light-blue ───────────────────────────────────────────────────────────────────────
// [needle, replacement, label]. Every needle is asserted present, so an upgrade that reshuffles the palette
// fails loudly (exit 2) instead of silently half-converting. `#3b82f6` keeps a literal fallback because it is
// the only slot a project sets directly; the rest resolve through the :where(:root) block below.

const HOOK = 'var(--theme-accent, #3b82f6)'

const SLOTS = [
  ['#3b82f6', HOOK, 'primary'],
  ['#2563eb', 'var(--theme-accent-hover)', 'hover'],
  ['#1d4ed8', 'var(--theme-accent-active)', 'active / highlight text'],
  ['#bfdbfe', 'var(--theme-accent-ring)', 'focus ring'],
  ['#eff6ff', 'var(--theme-accent-highlight)', 'highlight background'],
  ['#9dc1fb', 'var(--theme-accent-200)', 'tint (focus shadow)'],
  ['#8cbeff', 'var(--theme-accent-300)', 'tint'],
  ['#70aeff', 'var(--theme-accent-400)', 'tint'],
  ['#f5f9ff', 'var(--theme-accent-50)', 'scale 50'],
  ['#d0e1fd', 'var(--theme-accent-100)', 'scale 100'],
  ['#abc9fb', 'var(--theme-accent-200)', 'scale 200'],
  ['#85b2f9', 'var(--theme-accent-300)', 'scale 300'],
  ['#609af8', 'var(--theme-accent-400)', 'scale 400'],
  ['#326fd1', 'var(--theme-accent-600)', 'scale 600'],
  ['#295bac', 'var(--theme-accent-700)', 'scale 700'],
  ['#204887', 'var(--theme-accent-800)', 'scale 800'],
  ['#183462', 'var(--theme-accent-900)', 'scale 900']
]

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

// ── transform ──────────────────────────────────────────────────────────────────────────────────────────

const escape = (s) => s.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
let css = readFileSync(baseFile, 'utf8')
const counts = []

for (const [needle, replacement, label] of SLOTS) {
  const re = new RegExp(escape(needle), 'gi')
  let n = 0
  // The theme's informational `--blue-*` scale stays blue; everything else follows the accent.
  css = css.split('\n').map(line => {
    if (/^\s*--blue-\d+:/.test(line)) return line
    return line.replace(re, () => { n++; return replacement })
  }).join('\n')
  if (n === 0) die(`slot "${label}" (${needle}) not found in ${base}/theme.css — primereact@${pkg.version} changed the palette; update the slot map`, 2)
  counts.push([label, needle, replacement, n])
}

let alphas = 0
css = css.replace(/rgba\(59, 130, 246, (0?\.\d+)\)/g, (_, a) => {
  alphas++
  return `color-mix(in srgb, ${HOOK} ${Math.round(Number(a) * 100)}%, transparent)`
})
if (alphas === 0) die('no `rgba(59, 130, 246, α)` slots found — the palette changed; update the slot map', 2)

const fontFaces = (css.match(/@font-face\s*\{[^}]*Inter var[^}]*\}\s*/g) ?? []).length
css = css.replace(/@font-face\s*\{[^}]*Inter var[^}]*\}\s*/g, '')
const fontDecls = (css.match(/^[ \t]*(?:--)?font-family:[^\n]*\n/gm) ?? []).length
css = css.replace(/^[ \t]*(?:--)?font-family:[^\n]*\n/gm, '')

if (/url\(/.test(css)) die('the transformed theme still references a url() — it would not be self-contained; inspect the base theme', 2)
if (/Inter var/.test(css)) die('an "Inter var" reference survived the font strip; inspect the base theme', 2)

const header =
  `/* Generated by .claude/scripts/primereact-theme.mjs from primereact@${pkg.version} ${base} — regenerate after a primereact upgrade, do not edit. */\n` +
  `/* Accent hook: set \`--theme-accent\` on :root (src/styles/general.sass). Every --theme-accent-* below derives from it; pin any of them on :root to override. */\n` +
  `:where(:root) {\n` +
  Object.entries(DERIVED).map(([name, [pct, target]]) => `  ${name}: color-mix(in srgb, ${HOOK} ${pct}%, ${target});`).join('\n') +
  `\n}\n`

const output = header + css

// ── check / write / wire ───────────────────────────────────────────────────────────────────────────────

console.log(`primereact-theme  base=${base}  primereact@${pkg.version}`)
for (const [label, needle, replacement, n] of counts) console.log(`  ${String(n).padStart(3)}× ${needle.padEnd(9)} → ${replacement.padEnd(30)} ${label}`)
console.log(`  ${String(alphas).padStart(3)}× rgba(59, 130, 246, α) → color-mix(… α%, transparent)`)
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
