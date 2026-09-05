#!/usr/bin/env node
/**
 * primereact-theme.mjs — re-colour PrimeReact's compiled `lara-light-blue` theme with the project's accent.
 *
 * WHY A SCRIPT, AND WHY NOT A CSS VARIABLE
 * ----------------------------------------
 * The compiled theme hardcodes its palette in ~350 declarations. The `--primary-color` / `--primary-*`
 * custom properties in its `:root` are informational — not one rule reads them (grep `var(--primary` in
 * the file: zero hits) — so there is no variable to override. Every `lara-light-*` theme is the SAME file
 * with 16 hex + 3 rgba slots swapped (verified: masking colours makes `lara-light-blue` and
 * `lara-light-green` byte-identical). This script does that swap deterministically, so ONE accent re-skins
 * every component — inputs, dropdown/listbox highlight, checkbox/radio, slider, tabs, paginator, datatable
 * selection, calendar, chips — not just the input focus ring.
 *
 * It also drops the theme's bundled "Inter var" `@font-face` and points `--font-family` at the project's
 * body font (from `tailwind.config.js` → `fontFamily.sans`), because the stock theme renders every
 * PrimeReact component in Inter regardless of the brand font.
 *
 * USAGE
 *   node .claude/scripts/primereact-theme.mjs --primary <hex|token> [options]
 *
 *   --primary <v>        REQUIRED. A hex (`#7c5ce6`) or a colour token from tailwind.config.js
 *                        (`brand-500`, `brand-primary`, `acme-accent`). When the token belongs to a
 *                        50…900 scale, the sibling shades fill the other slots (600 → dark, 700 → darker,
 *                        200 → light, 50 → highlight-bg); otherwise they are derived from --primary by
 *                        HSL lightness scaling, the same way the Lara theme derives its own `--primary-*`.
 *   --dark <v>           hover state (default: derived / <ns>-600)
 *   --darker <v>         active state + highlight text (default: derived / <ns>-700)
 *   --light <v>          focus ring + selected-row tint (default: derived / <ns>-200)
 *   --highlight-bg <v>   dropdown/listbox selected background (default: derived / <ns>-50)
 *   --font <css>         value for the theme's `--font-family` (default: tailwind `fontFamily.sans` joined)
 *   --base <name>        source theme under node_modules/primereact/resources/themes (default lara-light-blue;
 *                        only `lara-light-*` share the slot map below)
 *   --out <path>         default src/styles/primereact-theme.css
 *   --app <dir>          project root (default: cwd)
 *   --no-wire            do NOT rewrite the theme import in src/app/layout.tsx
 *   --dry-run            print the resolved palette and the replacement counts, write nothing
 *
 * EXIT CODES  0 = written (or dry-run) · 1 = bad input · 2 = the base theme no longer matches the slot map
 *             (a PrimeReact upgrade changed the file — re-derive the map before trusting the output).
 *
 * Re-run after every `primereact` upgrade: the generated file is a snapshot of the package version named in
 * its header, not a live import.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
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
const dryRun = flag('dry-run')
const wire = !flag('no-wire')
const primaryInput = opt('primary')

if (!primaryInput) die('--primary <hex|token> is required (see the header for usage)')
if (!/^lara-light-/.test(base)) die(`--base must be a lara-light-* theme (got ${base}); the slot map is Lara-specific`)

// ── colour maths ───────────────────────────────────────────────────────────────────────────────────────

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

const normalizeHex = (hex) => {
  const h = hex.trim().toLowerCase()
  if (!HEX_RE.test(h)) return null
  if (h.length === 4) return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`
  return h
}

const hexToRgb = (hex) => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16))

const rgbToHex = ([r, g, b]) => `#${[r, g, b].map(c => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`

const rgbToHsl = ([r, g, b]) => {
  const R = r / 255; const G = g / 255; const B = b / 255
  const max = Math.max(R, G, B); const min = Math.min(R, G, B)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === R) h = (G - B) / d + (G < B ? 6 : 0)
  else if (max === G) h = (B - R) / d + 2
  else h = (R - G) / d + 4
  return [h * 60, s, l]
}

const hslToRgb = ([h, s, l]) => {
  if (s === 0) return [l * 255, l * 255, l * 255]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hue = (t) => {
    let x = t
    if (x < 0) x += 1
    if (x > 1) x -= 1
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  const H = h / 360
  return [hue(H + 1 / 3) * 255, hue(H) * 255, hue(H - 1 / 3) * 255]
}

// SASS `scale-color($c, $lightness: pct%)` — positive moves toward white, negative toward black.
const scaleLightness = (hex, pct) => {
  const [h, s, l] = rgbToHsl(hexToRgb(hex))
  const l2 = pct >= 0 ? l + (1 - l) * (pct / 100) : l * (1 + pct / 100)
  return rgbToHex(hslToRgb([h, s, l2]))
}

// SASS `mix()` with white (tint) or black (shade) — how Lara builds its own `--primary-50…900` scale.
const mix = (hex, target, pct) => rgbToHex(hexToRgb(hex).map((c, i) => c + (target[i] - c) * (pct / 100)))
const tint = (hex, pct) => mix(hex, [255, 255, 255], pct)
const shade = (hex, pct) => mix(hex, [0, 0, 0], pct)

// ── tailwind token resolution ──────────────────────────────────────────────────────────────────────────

const flattenColors = (obj, prefix = '', acc = {}) => {
  for (const [key, value] of Object.entries(obj)) {
    const name = key === 'DEFAULT' ? prefix : (prefix ? `${prefix}-${key}` : key)
    if (typeof value === 'string') acc[name] = value
    else if (value && typeof value === 'object') flattenColors(value, name, acc)
  }
  return acc
}

// Tailwind's own loader (jiti) — a plain `import()` chokes on the config's extensionless `tailwindcss/plugin`.
const loadTailwind = () => {
  const file = join(app, 'tailwind.config.js')
  if (!existsSync(file)) return { colors: {}, sans: null }
  const require = createRequire(join(app, 'package.json'))
  const { loadConfig } = require('tailwindcss/lib/lib/load-config.js')
  const theme = loadConfig(file)?.theme ?? {}
  const extend = theme.extend ?? {}
  const colors = flattenColors({ ...(theme.colors ?? {}), ...(extend.colors ?? {}) })
  const sansRaw = extend.fontFamily?.sans ?? theme.fontFamily?.sans ?? null
  const sans = Array.isArray(sansRaw) ? sansRaw.join(', ') : sansRaw
  return { colors, sans }
}

const { colors: tokens, sans } = loadTailwind()

const resolveColor = (input, label) => {
  const direct = normalizeHex(input)
  if (direct) return { hex: direct, source: 'hex' }
  const value = tokens[input]
  if (!value) die(`--${label} "${input}" is neither a hex nor a colour token in tailwind.config.js (known: ${Object.keys(tokens).slice(0, 12).join(', ')}…)`)
  const hex = normalizeHex(value)
  if (!hex) die(`token "${input}" resolves to "${value}", which is not a hex — pass the hex explicitly`)
  return { hex, source: `token ${input}` }
}

// ── resolve the palette ────────────────────────────────────────────────────────────────────────────────

const primary = resolveColor(primaryInput, 'primary')

// `brand-500` → look for `brand-600` etc.; `brand-primary` has no scale → derive.
const scaleNs = /^(.+)-500$/.exec(primaryInput)?.[1]
const sibling = (shade) => (scaleNs && tokens[`${scaleNs}-${shade}`]) ? `${scaleNs}-${shade}` : null

const DERIVE = { dark: -11, darker: -20, light: 68, 'highlight-bg': 92 }
const SIBLING = { dark: 600, darker: 700, light: 200, 'highlight-bg': 50 }

const slot = (name) => {
  const explicit = opt(name)
  if (explicit) return resolveColor(explicit, name)
  const sib = sibling(SIBLING[name])
  if (sib) return resolveColor(sib, name)
  return { hex: scaleLightness(primary.hex, DERIVE[name]), source: `derived (${DERIVE[name] > 0 ? '+' : ''}${DERIVE[name]}% L)` }
}

const palette = {
  primary,
  dark: slot('dark'),
  darker: slot('darker'),
  light: slot('light'),
  'highlight-bg': slot('highlight-bg')
}

// The theme's own `--primary-50…900` scale: tints of white below 500, shades of black above (exact for blue).
const SCALE = { 50: 95, 100: 76, 200: 57, 300: 38, 400: 19, 600: -15, 700: -30, 800: -45, 900: -60 }
const scale = Object.fromEntries(Object.entries(SCALE).map(([k, pct]) => [k, pct > 0 ? tint(primary.hex, pct) : shade(primary.hex, -pct)]))

const [l] = [rgbToHsl(hexToRgb(primary.hex))[2]]
const warnings = []
if (l > 0.8) warnings.push(`primary is very light (L ${Math.round(l * 100)}%): the theme paints white text on it — check contrast on buttons/highlights`)
if (l < 0.25) warnings.push(`primary is very dark (L ${Math.round(l * 100)}%): the derived dark/darker shades collapse toward black — consider --dark/--darker`)

const fontFamily = opt('font') ?? sans ?? null
if (!fontFamily) warnings.push('no --font and no fontFamily.sans in tailwind.config.js — leaving the theme on "Inter var" (its @font-face is still dropped)')

// ── slot map for lara-light-blue ───────────────────────────────────────────────────────────────────────
// Each entry: [needle in the base file, replacement]. Counts are asserted against the base file so a
// PrimeReact upgrade that reshuffles the palette fails loudly (exit 2) instead of silently half-recolouring.

const rgb = hexToRgb(primary.hex).join(', ')

const SLOTS = [
  ['#3b82f6', primary.hex, 'primary'],
  ['#2563eb', palette.dark.hex, 'dark (hover)'],
  ['#1d4ed8', palette.darker.hex, 'darker (active / highlight text)'],
  ['#bfdbfe', palette.light.hex, 'light (focus ring)'],
  ['#eff6ff', palette['highlight-bg'].hex, 'highlight-bg'],
  ['#9dc1fb', tint(primary.hex, 50), 'tint 50% white (focus shadow)'],
  ['#8cbeff', scaleLightness(primary.hex, 44), 'tint +44% L'],
  ['#70aeff', scaleLightness(primary.hex, 30), 'tint +30% L'],
  ['#f5f9ff', scale[50], 'scale 50'],
  ['#d0e1fd', scale[100], 'scale 100'],
  ['#abc9fb', scale[200], 'scale 200'],
  ['#85b2f9', scale[300], 'scale 300'],
  ['#609af8', scale[400], 'scale 400'],
  ['#326fd1', scale[600], 'scale 600'],
  ['#295bac', scale[700], 'scale 700'],
  ['#204887', scale[800], 'scale 800'],
  ['#183462', scale[900], 'scale 900'],
  ['rgba(59, 130, 246,', `rgba(${rgb},`, 'primary alpha']
]

// ── transform ──────────────────────────────────────────────────────────────────────────────────────────

const baseFile = join(app, 'node_modules', 'primereact', 'resources', 'themes', base, 'theme.css')
if (!existsSync(baseFile)) die(`base theme not found: ${baseFile} (is primereact installed?)`)
let css = readFileSync(baseFile, 'utf8')

const pkg = JSON.parse(readFileSync(join(app, 'node_modules', 'primereact', 'package.json'), 'utf8'))

const escape = (s) => s.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
const counts = []
for (const [needle, replacement, label] of SLOTS) {
  const re = new RegExp(escape(needle), 'gi')
  const n = (css.match(re) ?? []).length
  if (n === 0) die(`slot "${label}" (${needle}) not found in ${base}/theme.css — primereact@${pkg.version} changed the palette; update the slot map`, 2)
  css = css.replace(re, replacement)
  counts.push([label, needle, replacement, n])
}

// Fonts: drop the bundled Inter faces (they are the only `url()` in the file) and repoint --font-family.
const fontFaces = (css.match(/@font-face\s*\{[^}]*Inter var[^}]*\}\s*/g) ?? []).length
css = css.replace(/@font-face\s*\{[^}]*Inter var[^}]*\}\s*/g, '')
if (fontFamily) {
  css = css.replace(/font-family:\s*"Inter var",\s*sans-serif;/g, `font-family: ${fontFamily};`)
}
if (/url\(/.test(css)) die('the transformed theme still references a url() — the vendored copy would not be self-contained; inspect the base theme', 2)

// ── report ─────────────────────────────────────────────────────────────────────────────────────────────

console.log(`primereact-theme  base=${base}  primereact@${pkg.version}`)
console.log('')
console.log('Palette')
for (const [name, { hex, source }] of Object.entries(palette)) console.log(`  ${name.padEnd(13)} ${hex}   ${source}`)
console.log(`  font-family   ${fontFamily ?? '(unchanged: "Inter var")'}`)
console.log('')
console.log('Replacements')
for (const [label, needle, replacement, n] of counts) console.log(`  ${String(n).padStart(3)}× ${needle.padEnd(20)} → ${replacement.padEnd(20)} ${label}`)
console.log(`  ${String(fontFaces).padStart(3)}× @font-face "Inter var" removed`)
for (const w of warnings) console.log(`\n⚠ ${w}`)

if (dryRun) {
  console.log('\n(dry-run — nothing written)')
  process.exit(0)
}

// ── write + wire ───────────────────────────────────────────────────────────────────────────────────────

const header = `/* Generated by .claude/scripts/primereact-theme.mjs from primereact@${pkg.version} ${base} — re-run the script, do not edit. */\n` +
  `/* primary ${primary.hex} · dark ${palette.dark.hex} · darker ${palette.darker.hex} · light ${palette.light.hex} · highlight-bg ${palette['highlight-bg'].hex} */\n`

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, header + css)
console.log(`\nWrote ${out} (${(Buffer.byteLength(css) / 1024).toFixed(0)} KB)`)

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
      console.log('⚠ no primereact theme import found in src/app/layout.tsx — add `import \'@/styles/primereact-theme.css\'` where the theme was imported')
    }
  }
}
