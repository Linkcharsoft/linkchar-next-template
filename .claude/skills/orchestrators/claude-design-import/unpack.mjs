#!/usr/bin/env node
// unpack.mjs — deterministic multi-format extractor for a Claude Design "Standalone HTML" export.
//
// A Claude Design export is a self-contained page using a private "__bundler" envelope:
//   <script type="__bundler/manifest">      { uuid: {mime, compressed, data(base64)} }
//   <script type="__bundler/ext_resources"> [ {id, uuid}, ... ]  (aliases)  OR  { "Page.dc": [...] } (page map)
//   <script type="__bundler/template">       "<...inner HTML as a JSON string...>"  OR  { pages:{...}, entry:"X.dc" }
//
// The envelope is shared; the CONTENT comes in three flavors this script normalizes into ONE
// intermediate representation (IR) so the downstream pipeline stays format-agnostic:
//   - babel   : a React SPA (`<script type="text/babel">`, `function` components). A screen registry drives
//               routing, but its SHAPE is not mandated — flat `{key: Comp}` (GIVXO) and nested
//               `{key: {c: Comp, role}}` (Homfix/TocToc) both occur; THEMES/window.HOST/GUEST/HOST_TABS
//               appear in SOME exports (GIVXO) and not others (TocToc has none). Read the registry, don't
//               assume the shape. This flavor is NOT dead: Claude Design's system prompt now mandates DC for
//               NEW UI, but existing .jsx projects still edit and export as babel.
//   - dclogic : Claude Design's NATIVE format — `<x-dc>` markup + `class Component extends DCLogic` + `<helmet>`.
//               Single-page (template=string, routing via `state.page`) OR multi-page (template={pages,entry}).
//   - vanilla : plain HTML/CSS/JS, no component framework (best-effort — no reference sample).
//   - Next.js is NOT a standalone-HTML export (it's a code/zip export) → out of scope here.
//
// SCOPE: this reads a "Standalone HTML" export, which bundles ONE design. A design that links to sibling
// .dc pages will be PARTIAL — the siblings aren't in the bundle (see the partial-export guard below). The
// "Project archive" .zip DOES contain every .dc.html, but ingesting a raw project tree is not wired in yet.
//
// Usage:  node unpack.mjs <url-or-path> <outDir> [--allow-partial]

import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync, statSync, readdirSync } from 'node:fs'
import { join, dirname, basename, resolve } from 'node:path'
import zlib from 'node:zlib'

const EXPECTED_SHAPE = { blocks: ['manifest', 'ext_resources', 'template'] }
const die = (msg) => { console.error(`\n[unpack] ERROR: ${msg}\n`); process.exit(1) }

const argv = process.argv.slice(2)
const allowPartial = argv.includes('--allow-partial')
const [input, outDir] = argv.filter((a) => !a.startsWith('--'))
if (!input || !outDir) die('usage: node unpack.mjs <url-or-path> <outDir> [--allow-partial]')

// ─────────────────────────────────────────────────────────── helpers
const MIME_EXT = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
  'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/avif': 'avif',
}
// ext → mime, for archive images copied from disk (no manifest mime to read).
const EXT_MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', avif: 'image/avif',
}
function decodeEntry(entry) {
  let buf = Buffer.from(entry.data, 'base64')
  if (entry.compressed) {
    for (const fn of [zlib.gunzipSync, zlib.inflateSync, zlib.inflateRawSync, zlib.brotliDecompressSync]) {
      try { return fn(buf) } catch { /* next codec */ }
    }
    throw new Error('could not decompress a compressed manifest entry (tried gzip/inflate/raw/brotli)')
  }
  return buf
}
function extractBundlerBlock(html, name) {
  const re = new RegExp(`<script type="__bundler/${name}">([\\s\\S]*?)</script>`, 'i')
  const m = html.match(re)
  return m ? m[1].trim() : null
}
// Walk a balanced bracketed literal from the opening bracket; string/escape aware.
function extractBalanced(src, openIdx) {
  const open = src[openIdx]
  const close = open === '{' ? '}' : open === '[' ? ']' : null
  if (!close) return null
  let depth = 0, quote = null
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i]
    if (quote) { if (c === '\\') { i++; continue } if (c === quote) quote = null; continue }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue }
    if (c === open) depth++
    else if (c === close) { depth--; if (depth === 0) return src.slice(openIdx, i + 1) }
  }
  return null
}
// Split an object literal's body into TOP-LEVEL [key, valueText] pairs; nesting- and string-aware.
// Needed because a registry entry's value is not always a bare component: the flat `{ home: Home }`
// shape and the nested `{ home: { c: Home, role:'x' } }` shape are both real (see mergeRegistry).
function topLevelEntries(objText) {
  const body = (objText || '').trim().slice(1, -1)
  const out = []
  let depth = 0, quote = null, buf = '', key = null
  const flush = () => { if (key !== null && buf.trim()) out.push([key, buf]); key = null; buf = '' }
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (quote) { buf += c; if (c === '\\') { buf += body[++i] ?? '' } else if (c === quote) quote = null; continue }
    if (c === '"' || c === "'" || c === '`') { quote = c; buf += c; continue }
    if ('{(['.includes(c)) depth++
    else if ('})]'.includes(c)) depth--
    if (depth === 0 && c === ':' && key === null) { key = buf.trim().replace(/^['"]|['"]$/g, ''); buf = ''; continue }
    if (depth === 0 && c === ',') { flush(); continue }
    buf += c
  }
  flush()
  return out
}
const evalLiteral = (text) => { try { return Function(`"use strict";return (${text});`)() } catch { return null } }
const slugify = (s) => (s || '').replace(/\.dc$/i, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'x'
const familyOf = (stack) => { const m = (stack || '').match(/^\s*['"]?([^'",]+)/); return m ? m[1].trim() : null }
const uniq = (a) => [...new Set(a)]
const scanHex = (s) => uniq([...s.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)].map((m) => m[0].toLowerCase())).sort()
const scanCssVars = (s) => uniq([...s.matchAll(/var\((--[a-z-]+)/g)].map((m) => m[1])).sort()
// CSS font-size scan: px + rem (rem→px @16). clamp()/vw responsive sizes aren't captured (reported separately).
const scanFontSizes = (s) => uniq([...s.matchAll(/font-size:\s*(\d+(?:\.\d+)?)\s*(px|rem)/g)].map((m) => (m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1])))).sort((a, b) => a - b)

// ── Color clustering (design-import-shared.md § B2) ───────────────────────────
// A `tokenSource=inline+helmet` rawScan dumps 40+ hexes; the parent must reduce that to a
// token palette by hand — slow and irreproducible. So pre-group it here: tag each hex with
// the CSS role(s) it appears in + a usage count, then single-link cluster by per-channel
// Δ ≤ 4 (B2 rule 3: at that distance it's the same colour to the eye — role NAMES a cluster, it
// never splits one). Output is a HINT: the parent reviews and names, it does not recompute.
const HEX = '#[0-9a-fA-F]{6}\\b|#[0-9a-fA-F]{3}\\b'
const expandHex = (h) => (h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h)
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const chanDelta = (a, b) => { const x = rgbOf(a), y = rgbOf(b); return Math.max(...x.map((v, i) => Math.abs(v - y[i]))) }
const lumaOf = (h) => { const [r, g, b] = rgbOf(h); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 }
const satOf = (h) => { const [r, g, b] = rgbOf(h).map((v) => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx }

// Role of a CSS/JSX property name. Handles kebab CSS (`background-color`, dclogic/vanilla) and camel JSX
// (`backgroundColor`, babel) in one place — normalising away the `-` makes both collapse onto the same prefix.
// Returns null for properties that can't carry a palette colour, so the scan skips them.
function roleOfProp (prop) {
  if (prop.startsWith('--')) return 'var' // a CSS custom property IS the token source for inline+helmet
  const p = prop.toLowerCase().replace(/-/g, '')
  if (p.startsWith('background')) return 'background'
  if (p.startsWith('border') || p.startsWith('outline')) return 'border'
  if (p === 'color') return 'text'
  if (p.endsWith('shadow')) return 'shadow'
  if (p === 'fill' || p === 'stroke' || p === 'stopcolor') return 'icon'
  if (p === 'accentcolor' || p === 'caretcolor') return 'text'
  return null
}

// Every `…-gradient(...)` expression, paren-balanced so nested `rgba(...)` stops don't truncate it.
function gradientSpans (src) {
  const out = []
  const re = /(?:linear|radial|conic)-gradient\(/g
  let m
  while ((m = re.exec(src))) {
    let depth = 0
    for (let i = m.index + m[0].length - 1; i < src.length && i - m.index < 800; i++) {
      if (src[i] === '(') depth++
      else if (src[i] === ')' && --depth === 0) { out.push(src.slice(m.index, i + 1)); break }
    }
  }
  return out
}

// A HINT for the parent, not a decision — it reviews and names. Role wins FIRST: a gradient stop or a
// border keeps its role's family even when saturated (a saturated brand colour whose dominantRole is
// `border` comes out `line`, never `brand-or-semantic`). Only past those two does saturated
// mid-lightness → brand/semantic, and past that the CSS role + luminance pick the family.
function suggestFamily (hex, role) {
  const l = lumaOf(hex), s = satOf(hex)
  if (role === 'gradient') return 'gradient-stop'
  if (role === 'border') return 'line'
  if (s >= 0.55 && l > 0.25 && l < 0.8) return 'brand-or-semantic'
  if (role === 'text' || role === 'icon') return l < 0.25 ? 'ink' : l < 0.65 ? 'muted' : 'muted-light'
  if (role === 'background' || role === 'shadow') return l > 0.85 ? 'tint' : l < 0.25 ? 'ink' : 'brand-or-semantic'
  return l < 0.25 ? 'ink' : l > 0.85 ? 'tint' : 'muted'
}

function clusterHexes (src) {
  const roles = {}, total = {}
  const bump = (h, role) => { h = expandHex(h.toLowerCase()); (roles[h] ||= {})[role] = (roles[h][role] || 0) + 1; total[h] = (total[h] || 0) + 1 }

  // 1) Gradients FIRST — every stop (not just the first), balanced-paren so a nested `rgba(...)` can't
  //    truncate the span. Then MASK each span out: otherwise the `background:` declaration below re-counts
  //    stop 1 and inflates `uses` / skews `dominantRole` (most gradients are `background:<gradient>`).
  let masked = src
  for (const g of gradientSpans(src)) {
    for (const m of g.matchAll(new RegExp(HEX, 'g'))) bump(m[0], 'gradient')
    masked = masked.replace(g, ' '.repeat(g.length)) // same length keeps the rest of the string intact
  }

  // 2) Every `prop: value` declaration, and EVERY hex in the value — a lazy `[^;}]*?(hex)` stops at the
  //    first one, silently dropping e.g. the 2nd colour of `box-shadow:0 1px 0 #fff, 0 8px 24px #0d2740`.
  for (const m of masked.matchAll(/(--[a-zA-Z][\w-]*|[a-zA-Z][\w-]*)\s*:\s*([^;{}]*)/g)) {
    const role = roleOfProp(m[1])
    if (!role) continue
    for (const h of m[2].matchAll(new RegExp(HEX, 'g'))) bump(h[0], role)
  }

  // 3) SVG presentation ATTRIBUTES (`stroke="#..."`), which are not `prop: value` declarations.
  for (const m of masked.matchAll(new RegExp(`(?:stroke|fill|stop-color)\\s*=\\s*["'](${HEX})`, 'g'))) bump(m[1], 'icon')

  // B2.1: pure white/black are Tailwind defaults, never tokens — keep them out of the clusters.
  const NEUTRAL = new Set(['#ffffff', '#000000'])
  const pool = uniq(scanHex(src).map(expandHex)).filter((h) => !NEUTRAL.has(h)).sort((a, b) => lumaOf(a) - lumaOf(b))

  const groups = []
  for (const h of pool) {
    const hit = groups.find((g) => g.some((x) => chanDelta(x, h) <= 4))
    if (hit) hit.push(h); else groups.push([h])
  }
  return groups.map((hexes) => {
    const roleTally = {}
    let uses = 0
    for (const h of hexes) { uses += total[h] || 0; for (const [r, n] of Object.entries(roles[h] || {})) roleTally[r] = (roleTally[r] || 0) + n }
    const dominantRole = Object.entries(roleTally).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown'
    const representative = hexes.slice().sort((a, b) => (total[b] || 0) - (total[a] || 0))[0]
    return { representative, hexes, uses, roles: roleTally, dominantRole, suggestedFamily: suggestFamily(representative, dominantRole) }
  }).sort((a, b) => b.uses - a.uses)
}
// pick body/display from @font-face weights: lightest family → body text, heaviest → display/headings.
// (first/last-by-appearance is a coin flip — StreetBuild's Gotham Ultra 400-900 vs Gill Sans 400 needs the weight.)
function pickBrandFonts(faces, bodyFamily = null) {
  if (!faces.length) return null
  const byFam = {}
  for (const f of faces) { const nums = (String(f.weight || '400').match(/\d+/g) || ['400']).map(Number); byFam[f.family] = Math.max(byFam[f.family] || 0, Math.max(...nums)) }
  const fams = Object.keys(byFam)
  const sorted = [...fams].sort((a, b) => byFam[a] - byFam[b])
  // An explicit `body { font-family: X }` rule names the body face outright — prefer it. This matters most for
  // usage-derived families: they have no weight, so every one defaults to 400 and the sort below degenerates to
  // insertion order, which would assign body/display essentially at random.
  if (bodyFamily && fams.includes(bodyFamily)) {
    return { body: bodyFamily, display: sorted.filter((f) => f !== bodyFamily).pop() || bodyFamily, families: fams }
  }
  return { body: sorted[0], display: sorted[sorted.length - 1], families: fams }
}
// target detection (mobile-app vs web) — format-agnostic; drives the screen agent's responsive strategy.
function computeTargetSignals(str, navModel) {
  const iosChrome = /IOSStatusBar|IOSNavBar|IOSDevice|safe-area-inset/.test(str)
  const maxWidths = uniq([...str.matchAll(/max-width:\s*(\d{3,4})px|maxWidth:\s*(\d{3,4})/g)].map((m) => Number(m[1] || m[2])))
  const phone = maxWidths.some((w) => w >= 360 && w <= 480)
  const wide = maxWidths.some((w) => w >= 1000) || navModel === 'multi-page'
  const guess = navModel === 'multi-page' ? 'web' : (iosChrome || phone) && !wide ? 'mobile-app' : wide ? 'web' : 'unknown'
  return { iosChrome, phoneFrameMaxWidth: phone, wideWidth: wide, maxWidthsSeen: maxWidths.sort((a, b) => a - b), guess }
}

// ─────────────────────────────────────────────────────────── archive ingestion (Project archive .zip, unzipped)
// A "Project archive" is the user's WHOLE Claude Design project folder, NOT a single design: it holds several
// designs, version-copies (`- export`, `deploy/`, `v2`), bundled variants (`(standalone)`/`(offline)`/`-print`,
// each carrying its own __bundler envelope), older iterations, and `uploads/` briefs. The handoff README names
// the ONE primary design; everything else is context or noise. So archive ingestion = resolve the dependency
// CLOSURE from the README's entry and ignore the rest. Unlike the standalone path, this reads RAW source files
// (no envelope, no base64/gzip) — it reuses the same per-format parsers by SYNTHESIZING the `template` they expect.
const IMG_REF = /\.(png|jpe?g|webp|gif|svg|avif)(?:[?#]|$)/i
const readText = (p) => readFileSync(p, 'utf8')

// The handoff README's entry line: **Read `<slug>/project/<rel>` in full.** — the path is relative to the zip root.
function findReadmeEntry(dir) {
  const shallow = [join(dir, 'README.md'), ...readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => join(dir, d.name, 'README.md'))]
  for (const readmePath of shallow) {
    if (!existsSync(readmePath)) continue
    const m = readText(readmePath).match(/\*\*Read\s+`([^`]+)`\s+in full/i)
    return { readmePath, entryRel: m ? m[1] : null }
  }
  return null
}

// Every LOCAL image referenced by the closure source (src/href/url()/ext-resource-dependency), resolved to a real
// file. Mirrors the standalone bundler, which inlines only referenced images — unreferenced files (other designs,
// variants) are correctly skipped.
function collectArchiveImages(srcList, baseDir) {
  const refs = new Set()
  const attrRefs = new Set()
  for (const src of srcList) {
    for (const m of src.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/gi)) if (IMG_REF.test(m[1])) { refs.add(m[1]); attrRefs.add(m[1]) }
    for (const m of src.matchAll(/url\(\s*['"]?([^'")]+?)['"]?\s*\)/gi)) if (IMG_REF.test(m[1])) { refs.add(m[1]); attrRefs.add(m[1]) }
    for (const m of src.matchAll(/ext-resource-dependency"\s+content="([^"]+)"/gi)) if (IMG_REF.test(m[1])) { refs.add(m[1]); attrRefs.add(m[1]) }
    // DATA-DRIVEN refs. The attribute scans above see only what is literally in the markup — but the dclogic
    // idiom is `<sc-for list="{{ fotos }}">` rendering `src="{{ item.img }}"`, with the REAL paths living as bare
    // quoted string literals in the page's `.logic.js` data array (`{ img: './carrusel-01.jpg' }`). Those match
    // none of the patterns above, so a design whose images are all data-driven extracted as ~0 images while
    // `inventory.json` reported the count with no warning at all. Measured on Tercer Milenium: 7 of 34 found.
    // A bare-literal scan is deliberately broad; false positives are harmless because the resolve+existsSync
    // gate below drops anything that is not a real file on disk.
    for (const m of src.matchAll(/['"]([^'"\s>]+\.(?:png|jpe?g|webp|gif|svg|avif))['"]/gi)) refs.add(m[1])
  }
  const out = []
  for (const ref of refs) {
    // Remote/data refs have no file to copy. They are NOT dropped on the floor — `collectRemoteImages` picks the
    // remote ones up separately and the IR surfaces them; see the WARNING it raises.
    if (/^(https?:|data:)/i.test(ref)) continue
    const p = resolve(baseDir, ref.replace(/[?#].*$/, ''))
    if (existsSync(p) && statSync(p).isFile()) out.push({ srcPath: p, ref, dataDriven: !attrRefs.has(ref) })
  }
  return out
}

// Images the design references by URL instead of shipping (stock photos, a CDN). They are in NEITHER ingestion
// path's output: not in the standalone's base64 manifest, not on disk for the archive closure. So `images[]` — the
// list every downstream step reads — silently omits them, and an import that trusts it ships the design with those
// photos missing. Nothing downstream catches that: it compiles, type-checks and passes every convention grep.
// (Measured on Hologramas: 17 local logos in images[], while the hero, the about photo and all 5 service-card
// photos were remote — 7 images, including the LCP one.) Surface them so Step 0.5 must make a decision.
// ONE entry per distinct IMAGE, not per distinct URL: a CDN serves the same photo at several sizes via a query
// param (`?w=600` in a preview card, `?w=700` in a detail card — the same file), so the query is a rendition
// and must not split the asset. Keying on the full URL would hand the parent 12 "images" for 7 photos and have
// Step 2 download and convert each twice.
//
// But the identity is NOT the bare path either: `?fit=crop&w=400&h=400` (a square avatar) and `?w=1600` (a wide
// hero) are the same SOURCE photo rendered at different aspect ratios — merging them gives every call site one
// file at the wrong crop, plus whichever `alt` happened to land first. So the key is path + the params that
// change the IMAGE (crop/format/filters) + the aspect ratio when both dimensions are pinned; only the pure
// SIZE params are stripped as renditions.
const SIZE_PARAMS = new Set(['w', 'width', 'h', 'height', 'dpr', 'q', 'quality'])
function renditionKey(url) {
  const [path, qs] = url.split('?')
  if (!qs) return path
  const params = [...new URLSearchParams(qs)]
  const others = params.filter(([k]) => !SIZE_PARAMS.has(k.toLowerCase()))
    .map(([k, v]) => `${k.toLowerCase()}=${v}`).sort()
  const num = (n) => { const p = params.find(([k]) => k.toLowerCase() === n); return p ? Number(p[1]) : 0 }
  const w = num('w') || num('width'), h = num('h') || num('height')
  // Both dimensions pinned ⇒ the aspect ratio is part of the intent (a crop), not a size step.
  const ar = w && h ? `ar=${(w / h).toFixed(2)}` : ''
  return [path, ...others, ar].filter(Boolean).join('|')
}
// Largest rendition wins as the fetch URL (best source quality). Read EVERY size signal a CDN might use, not
// just `w=`: `h=`-only sizing is common, and some CDNs put the dimensions in the path (`/800x600/`). Falls back
// to 0 when nothing is readable — then first-seen wins and `renditions` still shows the parent what it missed.
function pixelSizeOf(u) {
  const q = (re) => Number((u.match(re) || [])[1]) || 0
  const seg = u.match(/\/(\d{2,5})x(\d{2,5})(?:[/?.]|$)/)
  return Math.max(
    q(/[?&](?:w|width)=(\d+)/i), q(/[?&](?:h|height)=(\d+)/i),
    seg ? Math.max(Number(seg[1]), Number(seg[2])) : 0,
  )
}
// CSS properties whose url() is ALWAYS an image. Needed because many CDN URLs carry no file extension at all
// (unsplash `photo-1234?w=1600`), so an extension test drops exactly the remote hero background that is
// typically the LCP element. Outside these properties an extension IS still required — a url() in `src:`
// (@font-face) or `cursor:` is not an image.
const IMAGE_PROPS = /^(?:background|background-image|mask|mask-image|-webkit-mask-image|border-image|border-image-source|list-style-image|content|shape-outside|offset-path)$/i
// Slice out each `<img …>` tag, ending at the first `>` that is NOT inside a quoted attribute value — so
// `alt="ancho > 100"` can't truncate the tag and silently drop the image. Deliberately a hand-rolled scan and
// NOT a regex: the natural quote-aware pattern (`<img\b(?:"[^"]*"|'[^']*'|[^>"'])*>`) is a nested
// alternation-with-star, which backtracks catastrophically on an unterminated tag — measured at 86 SECONDS on a
// 200KB run, versus ~1ms for this scan. Linear, single pass, no backtracking.
function imgTags(src) {
  const out = []
  const re = /<img\b/gi
  let m
  while ((m = re.exec(src))) {
    let quote = null, end = -1
    for (let i = m.index + 4; i < src.length; i++) {
      const c = src[i]
      if (quote) { if (c === quote) quote = null; continue }
      if (c === '"' || c === "'") { quote = c; continue }
      if (c === '>') { end = i; break }
    }
    if (end < 0) break            // unterminated tag — nothing parseable after it
    out.push(src.slice(m.index, end + 1))
    re.lastIndex = end + 1
  }
  return out
}
// Largest candidate of a `srcset` attribute value. Size comes from the DESCRIPTOR (`… 800w` / `… 2x`) first —
// candidates usually differ by PATH (`s-400.jpg`), which `pixelSizeOf` cannot read — then from the URL.
// Ties keep the EARLIEST candidate (strictly-greater replaces), because declaration order is meaningful:
// a `<picture>` lists its preferred format first, so an unmeasurable `<source>`/`<img>` pair must resolve to
// the `<source>`. A plain `.sort().pop()` would silently pick the last one — the JPEG fallback.
const largest = (cands) => cands.reduce((best, c) => (best && best.size >= c.size ? best : c), null)
function bestSrcsetCandidate(setValue) {
  return largest((setValue || '').split(',').map((c) => c.trim().split(/\s+/))
    .filter(([u]) => u && /^https?:/i.test(u))
    .map(([u, d]) => ({ u, size: Number((String(d || '').match(/^(\d+(?:\.\d+)?)[wx]$/i) || [])[1]) || pixelSizeOf(u) })))
}
function collectRemoteImages(srcList) {
  const byUrl = new Map()
  const add = (url, from, alt) => {
    const key = renditionKey(url)
    if (!byUrl.has(key)) byUrl.set(key, { url, alt: alt || null, uses: 0, from, renditions: new Set() })
    const e = byUrl.get(key)
    e.uses++
    e.renditions.add(url)
    if (pixelSizeOf(url) > pixelSizeOf(e.url)) e.url = url   // prefer the biggest variant as the source to fetch
    if (!e.alt && alt) e.alt = alt   // the naming context the parent needs; `alias` is null on a dclogic export
  }
  const URL_IN = /url\(\s*['"]?(https?:\/\/[^'")]+?)['"]?\s*\)/gi
  const blank = (s) => ' '.repeat(s.length)   // same-length mask keeps every other offset intact
  for (const raw of srcList) {
    if (typeof raw !== 'string') continue

    // 1) MASK HTML COMMENTS FIRST. A commented-out `<img>` is dead markup — collecting it would put a photo
    //    that the design does not render in front of the user as a decision, and (under "download+convert")
    //    have Step 2 fetch it. Masking rather than deleting keeps every subsequent index/offset unchanged.
    let src = raw.replace(/<!--[\s\S]*?-->/g, blank)

    // 2) `<picture>` is ONE image expressed as several candidates (`<source>` formats + an `<img>` fallback).
    //    Handle it as a UNIT and mask it out, or the pass below re-adds the fallback and one photo is
    //    reported — and downloaded — twice, under two different paths that `renditionKey` cannot merge
    //    (`pic.webp` vs `pic.jpg` share no path). Prefer the largest candidate across the whole element.
    src = src.replace(/<picture\b[\s\S]*?<\/picture>/gi, (block) => {
      const alt = (block.match(/\balt\s*=\s*["']([^"']*)["']/i) || [])[1]
      const cands = []
      for (const m of block.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
        const b = bestSrcsetCandidate(m[1]); if (b) cands.push(b)
      }
      for (const tag of imgTags(block)) {
        const u = (tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i) || [])[1]
        if (u && /^https?:/i.test(u)) cands.push({ u, size: pixelSizeOf(u) })
      }
      const best = largest(cands)
      if (best) add(best.u, 'picture', alt)
      return blank(block)
    })

    // 3) Plain <img> tags: the tag itself proves it's an image, so accept ANY http(s) src.
    for (const tag of imgTags(src)) {
      const url = (tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i) || [])[1]
      if (url && /^https?:/i.test(url)) add(url, 'img', (tag.match(/\balt\s*=\s*["']([^"']*)["']/i) || [])[1])
      // `srcset` without a `src` is a real pattern. Its candidates are renditions of ONE image by definition,
      // so contribute only the LARGEST — adding them all would report N assets for one photo (the exact
      // over-count `renditionKey` exists to prevent, which it cannot catch here since the variants usually
      // differ by PATH, `s-400.jpg` vs `s-800.jpg`, not by query).
      if (!url) {
        const best = bestSrcsetCandidate((tag.match(/\bsrcset\s*=\s*["']([^"']+)["']/i) || [])[1])
        if (best) add(best.u, 'img', (tag.match(/\balt\s*=\s*["']([^"']*)["']/i) || [])[1])
      }
    }
    // CSS url(…): an image extension is required in general (a url() may point at a font or a cursor), EXCEPT
    // inside an image-only property, where extensionless CDN URLs are the norm (see IMAGE_PROPS).
    // The property is found by looking BACKWARDS from the `url(` through a bounded window. Do NOT "simplify"
    // this into a forward `prop\s*:\s*([^;{}]*)` declaration scan: `[a-zA-Z][\w-]*` followed by `\s*:` is
    // quadratic on any long run without a colon (a minified bundle inside the template) — measured at 86
    // SECONDS on 200KB. The bounded look-back is linear.
    for (const m of src.matchAll(URL_IN)) {
      const before = src.slice(Math.max(0, m.index - 120), m.index)
      const prop = (before.match(/(-{0,2}[a-zA-Z][\w-]{0,40})\s*:\s*[^;{}]*$/) || [])[1]
      if (IMG_REF.test(m[1]) || (prop && IMAGE_PROPS.test(prop))) add(m[1], 'css', null)
    }
  }
  return [...byUrl.values()]
    .sort((a, b) => b.uses - a.uses)
    .map((e) => ({ ...e, renditions: e.renditions.size > 1 ? [...e.renditions] : undefined }))
}

// Resolve the README entry → classify its format → build the `template` the parsers expect + the real-image list.
// Returns { template, format, navModel, images, entryRel } or dies with guidance.
function ingestArchive(dir) {
  const found = findReadmeEntry(dir)
  if (!found) die(`archive has no README.md — not a recognized Claude Design "Project archive". Point at the unzipped handoff (Export → .zip → "Project archive"/"Send to coding agent"), whose README names the primary design.`)
  if (!found.entryRel) die(`archive README (${found.readmePath}) has no "**Read \`…\` in full**" line — cannot identify the primary design. Entry-detection-without-README is not wired yet.`)

  // entryRel is relative to the zip root = the parent of the slug dir that holds the README.
  const base = dirname(dirname(found.readmePath))
  let entryFull = resolve(base, found.entryRel)
  if (!existsSync(entryFull)) die(`archive README names entry "${found.entryRel}" but it is not on disk at ${entryFull}. Unzip may be incomplete, or the README path is unexpected.`)

  const entryDir = dirname(entryFull)
  // The README can name a BUNDLED variant (`(offline)`, `(standalone-src)`) — a self-contained __bundler export,
  // not raw source. (GIVXO's handoff points at "GIVXO App (offline) v3.html".) Reading it as raw source misreads
  // the escaped envelope; hand it to the standalone path instead, which decodes the envelope properly.
  const rawEntry = readText(entryFull)
  if (/<script type="__bundler\/(?:manifest|template)"/.test(rawEntry)) {
    return { bundledStandalone: rawEntry, entryRel: found.entryRel }
  }
  // Read a doc AND inline its local <link> stylesheets — in a Project archive the CSS lives in sibling files
  // (styles.css), not inlined as in a Standalone, so without this the parsers miss colors/sizes/fonts entirely.
  const readDoc = (file) => inlineLocalCss(readText(file), dirname(file))
  const entrySrc = readDoc(entryFull)
  // Detect babel by the entry EXTENSION too (`.jsx`), not only the `text/babel` marker: a README can point
  // straight at a `.jsx`, whose content carries no `type="text/babel"` string and would otherwise fall through
  // to a wrong `vanilla` classification and produce garbage.
  const format = /\.jsx$/i.test(entryFull) || /type="text\/babel"/.test(entrySrc) ? 'babel'
    : /<x-dc\b|data-dc-script|extends\s+DCLogic/.test(entrySrc) ? 'dclogic'
      : 'vanilla'

  if (format === 'dclogic') {
    // BFS the sibling-.dc.html closure from the entry. Relative same-dir links only, so `deploy/` copies and
    // bundled variants (not linked from the root entry) are excluded for free.
    const bySlug = {}
    const entrySlug = slugify(basename(entryFull).replace(/\.html$/i, ''))
    const queue = [[entrySlug, entryFull, entrySrc]]
    const seen = new Set()
    while (queue.length) {
      const [slug, file, src] = queue.shift()
      if (seen.has(slug)) continue
      seen.add(slug); bySlug[slug] = src
      for (const m of src.matchAll(/href="([^"]+\.dc\.html)"/gi)) {
        if (/^[a-z]+:\/\//i.test(m[1])) continue
        const childFile = resolve(dirname(file), m[1].replace(/[?#].*$/, ''))
        if (!existsSync(childFile)) continue
        const childSlug = slugify(basename(childFile).replace(/\.html$/i, ''))
        if (!seen.has(childSlug)) queue.push([childSlug, childFile, readDoc(childFile)])
      }
    }
    const slugs = Object.keys(bySlug)
    const template = slugs.length > 1 ? { pages: bySlug, entry: entrySlug } : bySlug[entrySlug]
    const navModel = slugs.length > 1 ? 'multi-page' : 'single-page-sections'
    return { template, format, navModel, images: collectArchiveImages(Object.values(bySlug), entryDir), entryRel: found.entryRel }
  }

  if (format === 'vanilla') {
    return { template: entrySrc, format, navModel: 'single-page', images: collectArchiveImages([entrySrc], entryDir), entryRel: found.entryRel }
  }

  // babel — a clean, intentional STOP (not a crash). The archive path exists to fix ONE thing the standalone
  // botches: multi-PAGE dclogic truncated to a single page. A babel design is a single-SPA with an internal
  // screen registry, so its Standalone HTML export already bundles the WHOLE app (every screen + jsx) with no
  // truncation — the archive would add nothing but risk. So route babel through the standalone, deliberately.
  die(`ARCHIVE ENTRY IS BABEL (React/JSX) — this flow does not import a babel design from a Project archive, by design.\n` +
    `  Primary design: "${found.entryRel}"\n\n` +
    `  Why: the archive path fixes multi-PAGE dclogic (which the standalone truncates). A babel design is one SPA\n` +
    `  with an internal screen registry — its Standalone HTML export already captures the entire app, untruncated.\n\n` +
    `  Do this instead: in Claude Design, open that design and Export → Standalone HTML, then run this script on\n` +
    `  the .html file. (babel is the pre-June-2026 generation format; new designs are dclogic and DO use archives.)`)
}

// ─────────────────────────────────────────────────────────── 1. dispatch: Project archive (dir) vs Standalone HTML (file/URL)
const isArchive = !/^https?:\/\//i.test(input) && existsSync(input) && statSync(input).isDirectory()

let manifest = {}, extParsed = null, template, format, navModel
let archiveImages = null, archiveEntryRel = null, archiveBundled = false
let html = null   // set when we take the envelope path: a real Standalone, OR an archive entry that is bundled
if (isArchive) {
  console.log(`[unpack] reading Project archive ${input}`)
  const a = ingestArchive(input)
  archiveEntryRel = a.entryRel
  if (a.bundledStandalone) {
    html = a.bundledStandalone; archiveBundled = true
    console.log(`[unpack] archive entry is a bundled standalone (__bundler) → envelope path`)
  } else {
    template = a.template; format = a.format; navModel = a.navModel; archiveImages = a.images
  }
} else if (/^https?:\/\//i.test(input)) {
  console.log(`[unpack] downloading ${input}`)
  const res = await fetch(input)
  if (!res.ok) die(`download failed: HTTP ${res.status}`)
  html = await res.text()
} else {
  console.log(`[unpack] reading ${input}`)
  try { html = readFileSync(input, 'utf8') } catch (e) { die(`cannot read file: ${e.message}`) }
}

// Envelope path — the private __bundler envelope of a Standalone HTML (file/URL) or an archive's bundled entry.
if (html !== null) {
  const rawManifest = extractBundlerBlock(html, 'manifest')
  const rawExt = extractBundlerBlock(html, 'ext_resources')
  const rawTemplate = extractBundlerBlock(html, 'template')
  if (!rawManifest || !rawTemplate) {
    die(`unexpected export shape — missing __bundler blocks (expected ${EXPECTED_SHAPE.blocks.join(', ')}). ` +
        `Not a recognized Claude Design standalone-HTML export. If this is a "Project archive" .zip, unzip it and pass the FOLDER.`)
  }
  try { manifest = JSON.parse(rawManifest) } catch (e) { die(`manifest is not valid JSON: ${e.message}`) }
  if (rawExt) { try { extParsed = JSON.parse(rawExt) } catch { extParsed = null } }
  try { template = JSON.parse(rawTemplate) } catch (e) { die(`template block is not valid JSON: ${e.message}`) }
}

// ext_resources may be an ARRAY of aliases (babel/dclogic-single) or an OBJECT page-map (dclogic-multi).
// Guard both — a raw `for..of` over an object throws (this was the StreetBuild crash). (Archive: no aliases.)
const extAliases = Array.isArray(extParsed) ? extParsed : []
const aliasByUuid = {}
for (const r of extAliases) if (r && r.uuid && r.id) aliasByUuid[r.uuid] = r.id

// ─────────────────────────────────────────────────────────── 3. detect format
// isMultiPage/templateStr are derived from `template` for BOTH sources (archive synthesizes the same shape).
const isMultiPage = template && typeof template === 'object' && template.pages && template.entry
const templateStr = typeof template === 'string' ? template : JSON.stringify(template)
function detectFormat() {
  if (isMultiPage) {
    const anyPage = Object.values(template.pages)[0] || ''
    if (/<x-dc\b|data-dc-script|extends\s+DCLogic/.test(anyPage)) return { format: 'dclogic', navModel: 'multi-page' }
    if (/type="text\/babel"/.test(anyPage)) return { format: 'babel', navModel: 'multi-page' }
    return { format: 'vanilla', navModel: 'multi-page' }
  }
  if (typeof template !== 'string') die('template is neither a string nor a {pages,entry} page-map — unrecognized shape.')
  if (/<x-dc\b|data-dc-script|extends\s+DCLogic/.test(template)) return { format: 'dclogic', navModel: 'single-page-sections' }
  if (/type="text\/babel"/.test(template)) return { format: 'babel', navModel: 'screen-registry' }
  return { format: 'vanilla', navModel: 'single-page' }
}
if (!format) ({ format, navModel } = detectFormat())  // archive sets these directly; standalone detects from the envelope

// ─────────────────────────────────────────────────────────── 4. reset output tree + shared assets
rmSync(outDir, { recursive: true, force: true })
mkdirSync(join(outDir, 'source'), { recursive: true })
mkdirSync(join(outDir, 'assets', 'img'), { recursive: true })

// images — from the base64 manifest (standalone) OR copied from real files (archive).
const images = []
if (archiveImages) {
  // Archive: copy referenced files. There is NO uuid — identity is the original relative ref (`srcRef`), which
  // the screen agent uses to map a source `<img src>` to its converted asset (the standalone's uuid analogue).
  const used = {}
  for (const { srcPath, ref, dataDriven } of archiveImages) {
    const ext = (basename(srcPath).match(/\.([a-z0-9]+)$/i) || [, 'bin'])[1].toLowerCase()
    let base = slugify(basename(ref).replace(/\.[^.]+$/, '')) || 'img'
    if (used[base]) base = `${base}-${used[base]++}`; else used[base] = 1   // distinct files, same basename (os/x.png vs oslogos/x.png)
    const rel = `assets/img/${base}.${ext}`
    try { writeFileSync(join(outDir, rel), readFileSync(srcPath)); images.push({ file: rel, uuid: null, mime: EXT_MIME[ext] || 'application/octet-stream', alias: ref, srcRef: ref, dataDriven: !!dataDriven }) }
    catch (e) { console.warn(`[unpack] warn: image ${ref}: ${e.message}`) }
  }
} else {
  for (const [uuid, entry] of Object.entries(manifest)) {
    if (!entry.mime || !entry.mime.startsWith('image/')) continue
    const ext = MIME_EXT[entry.mime] || 'bin'
    const base = aliasByUuid[uuid] ? slugify(aliasByUuid[uuid]) : uuid.slice(0, 8)
    const rel = `assets/img/${base}.${ext}`
    try { writeFileSync(join(outDir, rel), decodeEntry(entry)); images.push({ file: rel, uuid, mime: entry.mime, alias: aliasByUuid[uuid] || null }) }
    catch (e) { console.warn(`[unpack] warn: image ${uuid}: ${e.message}`) }
  }
}

// @font-face families across the whole export (helmet + template). Shared helper.
function scanFontFaces(str) {
  const faces = []
  for (const m of str.matchAll(/@font-face\s*\{([\s\S]*?)\}/g)) {
    const b = m[1]
    const family = (b.match(/font-family:\s*['"]([^'"]+)['"]/) || [])[1]
    if (family) faces.push({ family, weight: (b.match(/font-weight:\s*([^;]+);/) || [])[1]?.trim() || null })
  }
  return faces
}
// Google-Fonts <link> families. A Standalone export INLINES Google Fonts as @font-face (scanFontFaces finds
// them); a raw .dc.html/.html in a Project archive keeps the `<link href="fonts.googleapis.com/css2?family=…">`
// instead, so without this the archive path derives ZERO brand fonts. `family=` params carry the weights (`wght@…`),
// which pickBrandFonts needs to tell body from display.
function scanGoogleFontLinks(str) {
  const out = []
  for (const link of str.matchAll(/fonts\.googleapis\.com\/css2\?([^"'\s>]+)/gi)) {
    for (const fam of link[1].replace(/&amp;/g, '&').matchAll(/family=([^&:]+)(?::[^&]*?wght@([0-9;.]+))?/gi)) {
      const family = decodeURIComponent(fam[1].replace(/\+/g, ' ')).trim()
      if (family) out.push({ family, weight: fam[2] ? fam[2].replace(/;/g, ' ') : null })
    }
  }
  return out
}
// Primary (first, non-generic) family of every `font-family:` declaration — the last-resort source when a font
// is loaded by a mechanism this script can't inline (Typekit/Adobe `use.typekit`, self-hosted CSS): the @font-face
// lives in a remote sheet, but the family NAME is right there in the usage. No weights, so body/display can't be
// told apart — best-effort, flagged in notes. NOTE: such a family is likely NOT on Google Fonts.
const GENERIC_FAMILY = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-sans-serif', 'ui-serif', 'ui-monospace', 'inherit', 'initial', 'unset', 'revert', '-apple-system', 'blinkmacsystemfont'])
function scanFontFamilyUsage(str) {
  const out = []
  for (const m of str.matchAll(/font-family:\s*([^;}{]+)/gi)) {
    const first = m[1].split(',')[0].trim().replace(/^['"]|['"]$/g, '')
    if (first && !/^var\(/i.test(first) && !GENERIC_FAMILY.has(first.toLowerCase())) out.push(first)
  }
  return uniq(out)
}
// The family named by an explicit `body { font-family: … }` rule. A far stronger body/display signal than the
// max-weight heuristic in `pickBrandFonts`, and the only one that works at all for usage-derived families (which
// carry no weight — see below).
function scanBodyFontFamily(str) {
  const m = str.match(/(?:^|[};>\s])body\s*\{[^}]*?font-family:\s*([^;}]+)/i)
  if (!m) return null
  const first = m[1].split(',')[0].trim().replace(/^['"]|['"]$/g, '')
  return first && !/^var\(/i.test(first) && !GENERIC_FAMILY.has(first.toLowerCase()) ? first : null
}
// Brand faces from the source, most reliable first: @font-face → Google-Fonts <link> → font-family usage.
//
// The usage tier is ADDITIVE, not a last-resort fallback. It used to run only `if (!faces.length)`, which meant a
// design that declares one family properly and uses a SECOND one only in inline styles silently lost the second.
// Measured on Tercer Milenium: `acumin-pro` was found (named in the helmet's `body` rule) while `fertigo-pro` —
// the display serif on all 31 headings, set via inline `style="font-family:'fertigo-pro'…"` — was not, and
// `inventory.brandFonts` reported a single family with no warning. Callers must therefore pass the FULL source
// (markup included), not just the helmet/stylesheet.
function gatherFaces(str) {
  const faces = scanFontFaces(str)
  const seen = new Set(faces.map((f) => f.family))
  for (const lf of scanGoogleFontLinks(str)) if (!seen.has(lf.family)) { faces.push(lf); seen.add(lf.family) }
  for (const fam of scanFontFamilyUsage(str)) if (!seen.has(fam)) { faces.push({ family: fam, weight: null, fromUsage: true }); seen.add(fam) }
  return faces
}
// Inline a Project archive's LOCAL <link rel="stylesheet" href="styles.css"> as a <style> block, so the parsers
// (which scan one doc string for tokens/fonts) see the CSS the way they would in a Standalone (all-inlined) export.
// Remote sheets (Google/Typekit) are left as links — they can't be inlined and are handled by the font scanners.
function inlineLocalCss(html, baseDir) {
  return html.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, (tag) => {
    const href = (tag.match(/href=["']([^"']+)["']/i) || [])[1]
    if (!href || /^(https?:|\/\/|data:)/i.test(href)) return tag
    const p = resolve(baseDir, href.replace(/[?#].*$/, ''))
    if (!existsSync(p)) return tag
    try { return `<style data-inlined-from="${href}">\n${readText(p)}\n</style>` } catch { return tag }
  })
}

// ─────────────────────────────────────────────────────────── 5. per-format parsers → normalized IR
// Each parser returns: { sourceFiles:[{file,bytes}], screens:[{key,component,role,file,section?}],
//   components:[{name,file,kind}], tokens:{themes?,brand?,rawScan}, brandFonts, fonts, extra:{} }
//   rawScan.clusters:[{representative,hexes[],uses,roles{},dominantRole,suggestedFamily}] — B2 pre-grouping (Δ≤4, role-tagged)
const write = (rel, content) => { writeFileSync(join(outDir, rel), content, 'utf8'); return rel }

function parseBabel() {
  if (typeof template !== 'string') die('babel multi-page export is not supported — expected a single inner-HTML template string.')
  // template is the inner HTML string; component source lives in manifest via <script type="text/babel" src=uuid>.
  write('template.html', template)
  const babelUuids = [...template.matchAll(/<script type="text\/babel" src="([^"]+)"/g)].map((m) => m[1])
  const jsxFiles = []
  let idx = 0
  mkdirSync(join(outDir, 'source', 'jsx'), { recursive: true })
  for (const uuid of babelUuids) {
    const entry = manifest[uuid]; if (!entry) { console.warn(`[unpack] warn: babel script ${uuid} not in manifest`); continue }
    let src; try { src = decodeEntry(entry).toString('utf8') } catch (e) { console.warn(`[unpack] warn: ${uuid}: ${e.message}`); continue }
    const firstName = (src.match(/function\s+([A-Z][A-Za-z0-9]*)/) || src.match(/(?:window\.)?([A-Z_]{3,})\s*=/) || [])[1]
    const file = write(`source/jsx/${String(idx).padStart(2, '0')}_${slugify(firstName)}.jsx`, src)
    jsxFiles.push({ file, uuid, bytes: src.length, compressed: !!entry.compressed }); idx++
  }
  const inline = template.match(/<script type="text\/babel">([\s\S]*?)<\/script>/)
  if (inline) jsxFiles.push({ file: write(`source/jsx/${String(idx).padStart(2, '0')}_entry.jsx`, inline[1]), uuid: null, bytes: inline[1].length, entry: true })

  const allSrc = jsxFiles.map((f) => readFileSync(join(outDir, f.file), 'utf8')).join('\n')

  // tokens: THEMES object + brand + raw scan
  let themes = null, brand = null
  const ti = allSrc.search(/const\s+THEMES\s*=\s*\{/)
  if (ti >= 0) { const t = extractBalanced(allSrc, allSrc.indexOf('{', ti)); if (t) themes = evalLiteral(t) }
  brand = (allSrc.match(/const\s+BRAND\s*=\s*['"]([^'"]+)['"]/) || [])[1] || null
  let brandFonts = null
  if (themes && brand && themes[brand]) {
    const t = themes[brand], body = familyOf(t.fontBody), display = familyOf(t.fontDisplay)
    brandFonts = { body, display, families: uniq([body, display].filter(Boolean)) }
  }
  const rawScan = {
    hexColors: scanHex(allSrc),
    clusters: clusterHexes(allSrc), // B2 pre-grouping (babel usually has THEMES — this is a cross-check)
    fontSizes: uniq([...allSrc.matchAll(/fontSize:\s*(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]))).sort((a, b) => a - b),
    cssVars: scanCssVars(allSrc),
  }

  // registries → screens (window.X = {} + Object.assign, with const fallback)
  const registries = {}
  const nestedRegistries = new Set()
  // A registry maps a screen key → its component. TWO shapes are real, and babel mandates neither:
  //   flat   — `{ home: HomeScreen, ... }`                     (GIVXO)
  //   nested — `{ home: { c: HomeScreen, role:'cliente' }, ... }`  (Homfix/TocToc)
  // Scanning the whole object body for `key: Component` matches the INNER pairs of the nested shape, so
  // every screen collapses onto one bogus key (measured on Homfix: 16 screens → 1 entry named "c").
  // Split the top level first, THEN read each value.
  const mergeRegistry = (name, objText) => {
    const map = registries[name] || (registries[name] = {})
    for (const [key, val] of topLevelEntries(objText)) {
      const bare = val.match(/^\s*([A-Z][A-Za-z0-9_]*)\s*$/)
      if (bare) { map[key] = bare[1]; continue }
      const inner = val.match(/[a-zA-Z0-9_]+\s*:\s*([A-Z][A-Za-z0-9_]*)\b/)
      if (inner) { map[key] = inner[1]; nestedRegistries.add(name) }
    }
  }
  const dropEmpty = () => { for (const k of Object.keys(registries)) if (!Object.keys(registries[k]).length) delete registries[k] }
  for (const m of allSrc.matchAll(/window\.([A-Z][A-Z0-9_]*)\s*=\s*\{/g)) { const t = extractBalanced(allSrc, allSrc.indexOf('{', m.index)); if (t) mergeRegistry(m[1], t) }
  for (const m of allSrc.matchAll(/Object\.assign\(\s*window\.([A-Z][A-Z0-9_]*)\s*,\s*\{/g)) { const t = extractBalanced(allSrc, allSrc.indexOf('{', m.index + m[0].length - 1)); if (t) mergeRegistry(m[1], t) }
  dropEmpty()
  let usedRegistryFallback = false
  if (!Object.keys(registries).length) {
    usedRegistryFallback = true
    const routingName = /^(GUEST|HOST|ROUTES?|SCREENS?|PAGES?|VIEWS?|NAV|STACK|ROUTER)/
    for (const m of allSrc.matchAll(/(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*\{/g)) { if (!routingName.test(m[1])) continue; const t = extractBalanced(allSrc, allSrc.indexOf('{', m.index)); if (t) mergeRegistry(m[1], t) }
    for (const m of allSrc.matchAll(/Object\.assign\(\s*([A-Z][A-Z0-9_]*)\s*,\s*\{/g)) { if (!routingName.test(m[1])) continue; const t = extractBalanced(allSrc, allSrc.indexOf('{', m.index + m[0].length - 1)); if (t) mergeRegistry(m[1], t) }
    dropEmpty()
  }
  const arrLit = (name) => { const i = allSrc.search(new RegExp(`(?:window\\.|(?:export\\s+)?const\\s+)${name}\\s*=\\s*\\[`)); if (i < 0) return null; const t = extractBalanced(allSrc, allSrc.indexOf('[', i)); return t ? evalLiteral(t) : null }

  // fnToFile (top-level only) + components
  const fnToFile = {}
  for (const f of jsxFiles) {
    const src = readFileSync(join(outDir, f.file), 'utf8')
    for (const m of src.matchAll(/^(?:export\s+)?function\s+([A-Z][A-Za-z0-9]*)\s*\(/gm)) if (!fnToFile[m[1]]) fnToFile[m[1]] = f.file
    for (const m of src.matchAll(/^(?:export\s+)?const\s+([A-Z][A-Za-z0-9]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_]+)\s*=>|^(?:export\s+)?const\s+([A-Z][A-Za-z0-9]*)\s*=\s*(?:async\s*)?function\b/gm)) { const n = m[1] || m[2]; if (n && !fnToFile[n]) fnToFile[n] = f.file }
  }
  const screenOf = {}
  for (const [reg, map] of Object.entries(registries)) for (const [key, comp] of Object.entries(map)) screenOf[comp] = { registry: reg, key }
  const components = Object.entries(fnToFile).map(([name, file]) => ({ name, file, kind: screenOf[name] ? 'screen' : 'primitive-or-helper' }))
  const screens = []
  for (const [reg, map] of Object.entries(registries)) for (const [key, comp] of Object.entries(map)) screens.push({ key, component: comp, role: reg, file: fnToFile[comp] || null })

  return {
    sourceFiles: jsxFiles, screens, components, tokens: { themes, brand, rawScan }, brandFonts,
    fonts: scanFontFaces(template), tokenSource: themes ? 'themes-object' : 'inline+helmet',
    targetSignals: computeTargetSignals(`${allSrc}\n${template}`, navModel),
    extra: { registries, tabs: arrLit('HOST_TABS'), usedRegistryFallback, nestedRegistries: [...nestedRegistries], jsxFiles },
  }
}

// Parse one DCLogic document string (the inner HTML of an .dc): split helmet / x-dc markup / logic class.
function parseDcDoc(docStr, slug) {
  const helmet = [...docStr.matchAll(/<helmet>([\s\S]*?)<\/helmet>/gi)].map((m) => m[1]).join('\n')
  const logic = [...docStr.matchAll(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n\n') // ALL logic blocks
  // markup = the x-dc body minus ALL helmets and ALL logic scripts (global strip — a doc may have several)
  let markup = ''
  const xi = docStr.indexOf('<x-dc')
  if (xi >= 0) {
    const openEnd = docStr.indexOf('>', xi) + 1
    const xend = docStr.indexOf('</x-dc>', openEnd)
    markup = docStr.slice(openEnd, xend > 0 ? xend : docStr.length)
      .replace(/<helmet>[\s\S]*?<\/helmet>/gi, '')
      .replace(/<script[^>]*data-dc-script[^>]*>[\s\S]*?<\/script>/g, '').trim()
  }
  const markupFile = write(`source/${slug}.markup.html`, markup)
  const logicFile = write(`source/${slug}.logic.js`, logic)
  // The helmet holds the doc's REAL CSS — @media breakpoints, @font-face, CSS vars — and the markup above
  // strips it out. Write it as its own file or that CSS reaches disk for single-page only (via template.html)
  // and NOT AT ALL for multi-page, leaving the design's breakpoints unreadable in the format that has N of them.
  const helmetFile = helmet.trim() ? write(`source/${slug}.helmet.css`, helmet) : null
  // state.page section keys (single-page routing) + go() targets
  const pageVals = uniq([...docStr.matchAll(/(?:page:\s*|page\s*===\s*|go\(\s*)['"]([a-zA-Z0-9_-]+)['"]/g)].map((m) => m[1]))
  // dc-import child components
  const imports = uniq([...docStr.matchAll(/<dc-import\s+name="([^"]+)"/g)].map((m) => m[1]))
  // Cross-DC navigation is a plain RELATIVE link: `<a href="Equipo.dc.html">`. Collected so the caller can
  // check every target actually made it into the bundle (see danglingPages). Skip absolute URLs
  // (`https://…/Foo.dc.html`) — those point at a deployed page, not a sibling expected inside this bundle.
  const dcHrefs = uniq([...docStr.matchAll(/href="([^"]*\.dc\.html)"/gi)].map((m) => m[1]).filter((h) => !/^[a-z]+:\/\//i.test(h)))
  return { slug, markupFile, logicFile, helmetFile, helmet, logic, docStr, pageVals, imports, dcHrefs, bytes: markup.length + logic.length }
}

function parseDcLogic() {
  const docs = []
  if (isMultiPage) {
    for (const [pageName, pageHtml] of Object.entries(template.pages)) docs.push(parseDcDoc(String(pageHtml), slugify(pageName) || 'page'))
  } else {
    write('template.html', template)
    docs.push(parseDcDoc(template, 'app'))
  }
  const allSrc = docs.map((d) => d.docStr).join('\n')
  const helmetAll = docs.map((d) => d.helmet).join('\n')

  // tokens: no THEMES — scan inline styles + helmet CSS vars/@font-face
  const rawScan = {
    hexColors: scanHex(allSrc),
    clusters: clusterHexes(allSrc), // B2 pre-grouping — the parent names these instead of clustering 40+ hexes by hand
    fontSizes: scanFontSizes(allSrc),
    clampFontSizes: (allSrc.match(/font-size:\s*clamp\(/g) || []).length, // responsive sizes NOT captured — read from source
    cssVars: scanCssVars(allSrc),
  }
  // allSrc, NOT helmetAll: the @font-face/<link> tiers live in the helmet (a subset of allSrc), but the usage tier
  // must see the MARKUP too — a dclogic design routinely sets its display face in inline `style="font-family:…"`
  // and never declares it anywhere else.
  const faces = gatherFaces(allSrc)
  const brandFonts = pickBrandFonts(faces, scanBodyFontFamily(helmetAll))

  const importsAll = uniq(docs.flatMap((d) => d.imports))
  const components = importsAll.map((name) => ({ name, file: null, kind: 'primitive-or-helper' })) // dc-import children

  // A Standalone HTML bundles ONE design, so a cross-DC `href` can point at a page that is NOT in the bundle.
  // Measured on Tercer Milenium: the landing links to 4 siblings, the 26MB standalone carries none of them
  // (34 manifest entries, zero HTML), and the flow happily reported `screens=1` — a 5-page site silently
  // imported as 1. Collect the misses here; the caller decides (a bare WARNING would be read past).
  const knownSlugs = new Set(docs.map((d) => d.slug))
  const danglingPages = uniq(docs.flatMap((d) => d.dcHrefs)).filter((h) => !knownSlugs.has(slugify(h.replace(/\.html$/i, ''))))

  let screens
  if (isMultiPage) {
    // one screen/route per .dc page
    screens = docs.map((d) => ({ key: d.slug, component: d.slug, role: 'page', file: d.markupFile, entry: slugify(template.entry) === d.slug }))
  } else {
    // single-page: state.page values are SECTIONS of one screen (navModel = single-page-sections)
    const d = docs[0]
    const sections = d.pageVals.length ? d.pageVals : ['main']
    screens = sections.map((s) => ({ key: s, component: 'App', role: 'section', file: d.markupFile, section: true }))
  }
  return {
    sourceFiles: docs.map((d) => ({ markup: d.markupFile, logic: d.logicFile, bytes: d.bytes })),
    screens, components, tokens: { themes: null, brand: null, rawScan }, brandFonts,
    fonts: faces, tokenSource: 'inline+helmet',
    targetSignals: computeTargetSignals(allSrc, navModel),
    extra: { dcDocs: docs.map((d) => ({ slug: d.slug, sections: d.pageVals, imports: d.imports })), entry: isMultiPage ? slugify(template.entry) : null, danglingPages },
  }
}

function parseVanilla() {
  // DEFENSIVE — no reference sample. Treat the whole page as one screen; tokens from inline styles + <style>.
  const bodyMatch = templateStr.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const body = bodyMatch ? bodyMatch[1] : templateStr
  const markupFile = write('source/index.markup.html', body)
  const styleBlocks = [...templateStr.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n\n')
  // The <style> blocks live in <head> (for an archive, inlined from the linked styles.css) — the body markup
  // above excludes them, so write them out or the screen agent reconstructs the design with NO CSS.
  if (styleBlocks.trim()) write('source/index.styles.css', styleBlocks)
  const rawScan = {
    hexColors: scanHex(templateStr),
    clusters: clusterHexes(templateStr), // B2 pre-grouping — the parent names these instead of clustering 40+ hexes by hand
    fontSizes: scanFontSizes(templateStr),
    clampFontSizes: (templateStr.match(/font-size:\s*clamp\(/g) || []).length,
    cssVars: scanCssVars(templateStr),
  }
  const faces = gatherFaces(templateStr)   // @font-face (standalone) + Google-Fonts <link> (archive raw .html) + usage
  const brandFonts = pickBrandFonts(faces, scanBodyFontFamily(templateStr))
  return {
    sourceFiles: [{ markup: markupFile, bytes: body.length }],
    screens: [{ key: 'index', component: 'Index', role: 'page', file: markupFile }],
    components: [], tokens: { themes: null, brand: null, rawScan }, brandFonts,
    fonts: faces, tokenSource: 'inline+css',
    targetSignals: computeTargetSignals(templateStr, navModel),
    extra: { defensive: true, styleBytes: styleBlocks.length },
  }
}

if (typeof template !== 'string' && !isMultiPage) die('template is an object but not a {pages,entry} page-map — unrecognized shape; aborting instead of guessing.')
const ir = format === 'babel' ? parseBabel() : format === 'dclogic' ? parseDcLogic() : parseVanilla()

// Remote images — scan the REAL source strings, not `templateStr` (JSON.stringify escapes the quotes, `src=\"…\"`,
// which the attribute regexes would miss).
//
// This runs AFTER the parser, not before, because of babel: there `template` is only the page SHELL, and every
// component — so every `<img>` — lives in the manifest as a `text/babel` script that `parseBabel` decodes to
// `source/jsx/*.jsx`. Scanning `template` alone made `remoteImages` structurally 0 for EVERY babel design
// (measured on GIVXO: 9 `<img>` in the jsx, 0 in template.html). dclogic/vanilla carry their markup in
// `template` itself and are unaffected by the move.
//
// Note the JSX caveat: React writes `src={expr}` far more often than `src="…"`, and only the literal form is
// collectable. A computed URL is not something Step 2 could download anyway, but it does mean a babel
// `remoteImages` is a floor, not a census — say so rather than implying full coverage.
const remoteImages = collectRemoteImages([
  ...(isMultiPage ? Object.values(template.pages) : [template]),
  ...(format === 'babel' ? ir.extra.jsxFiles.map((f) => readFileSync(join(outDir, f.file), 'utf8')) : []),
])

// ── Partial-export guard ──────────────────────────────────────────────────────
// "Standalone HTML" exports ONE design, not the project. When that design links to sibling .dc pages,
// they are simply absent from the bundle — nothing downstream can notice, because a 1-page extraction of
// a 5-page site is indistinguishable from a genuine 1-page site. This is the ONE failure mode that is
// both silent and total, so it aborts by default rather than adding a note nobody reads.
if (ir.extra.danglingPages && ir.extra.danglingPages.length && !allowPartial) {
  const list = ir.extra.danglingPages.map((p) => `  - ${p}`).join('\n')
  if (isArchive) {
    // In an archive every page IS on disk, so a dangling link means the design references a page the project
    // genuinely doesn't contain — a broken link in the source, not a truncated export.
    die(`BROKEN LINKS — the primary design links to ${ir.extra.danglingPages.length} .dc page(s) that are not present anywhere in the archive:\n${list}\n` +
      `  These are dead links in the design itself (a deleted/renamed page). Re-run with --allow-partial to import\n` +
      `  the design as-is (those links stay dead ends), or fix the source in Claude Design and re-export.`)
  }
  die(`PARTIAL EXPORT — the design links to ${ir.extra.danglingPages.length} sibling page(s) that are NOT in this bundle:\n${list}\n` +
    `  A "Standalone HTML" export carries ONE design, not the whole project, so those pages were never\n` +
    `  bundled. Importing this would silently produce a site with them missing.\n\n` +
    `  Options:\n` +
    `    - Export the whole project as a "Project archive" .zip, unzip it, and pass the FOLDER — it contains\n` +
    `      every .dc.html, so multi-page designs import complete (this is the recommended path).\n` +
    `    - Or export each linked page as its OWN Standalone HTML and import them one at a time.\n` +
    `    - Or re-run with --allow-partial to import only the design in this bundle (its links stay dead ends).`)
}

// ─────────────────────────────────────────────────────────── 6. write structured artifacts (normalized IR)
const writeJson = (name, obj) => writeFileSync(join(outDir, name), JSON.stringify(obj, null, 2), 'utf8')
const fontFamilies = uniq(ir.fonts.map((f) => f.family))
writeJson('fonts.json', { families: fontFamilies, faces: ir.fonts })
writeJson('tokens.json', ir.tokens)
writeJson('nav-graph.json', { navModel, ...ir.extra })
writeJson('components.json', ir.components)

const screenComponents = uniq(ir.screens.map((s) => s.component))
const dupComponents = format === 'babel' && ir.screens.length !== screenComponents.length
const usageFonts = ir.fonts.filter((f) => f.fromUsage).map((f) => f.family)
const notes = [
  `format=${format}, navModel=${navModel}, tokenSource=${ir.tokenSource}`,
  isArchive && !archiveBundled ? `source=Project archive — the ONE design named by the handoff README (${archiveEntryRel}). Its dependency closure (linked pages/CSS/images) was resolved from disk; version-copies, bundled variants and other designs in the archive were correctly ignored.` : null,
  isArchive && archiveBundled ? `source=Project archive — the README named a PRE-BUNDLED variant (${archiveEntryRel}); it carries its own __bundler envelope, so it was decoded via the standalone path (no on-disk closure). If this is a multi-page design, a bundled variant may hold only ONE page — prefer the raw .dc.html entry if the import looks short.` : null,
  format === 'vanilla' ? 'WARNING: vanilla flavor — DEFENSIVE/best-effort extraction (no reference sample). Inspect source/index.markup.html manually.' : null,
  format === 'dclogic' && navModel === 'single-page-sections' ? `navModel=single-page-sections — this is ONE screen with sections (${ir.screens.map((s) => s.key).join(', ')}), not separate routes. Orchestrator: implement as a single screen (section switching), NOT route/step/modal per key.` : null,
  format === 'dclogic' && navModel === 'multi-page' ? `navModel=multi-page — ${ir.screens.length} web pages → ${ir.screens.length} routes (entry: ${ir.extra.entry}).` : null,
  ir.tokenSource !== 'themes-object' ? 'tokenSource=inline+helmet — NO THEMES object; the tokens agent scans inline styles + <helmet> CSS vars/@font-face (see tokens.json.rawScan + brandFonts).' : null,
  ir.tokens.rawScan.clampFontSizes ? `NOTE: ${ir.tokens.rawScan.clampFontSizes} clamp() font-size(s) not captured in rawScan (responsive display sizes) — the screen agent reads them directly from source.` : null,
  `target guess=${ir.targetSignals.guess} — parent confirms mobile-app|web at the Step 0.5 checkpoint (drives responsive).`,
  dupComponents ? `NOTE: ${ir.screens.length} registry keys → ${screenComponents.length} unique components (some routes share a component).` : null,
  ir.extra.usedRegistryFallback ? 'NOTE: no window.* registries — used the const-registry NAME heuristic; double-check screens[] for spurious entries.' : null,
  ir.extra.nestedRegistries && ir.extra.nestedRegistries.length
    ? `NOTE: registry ${ir.extra.nestedRegistries.join(', ')} uses the NESTED shape ({key: {c: Component, ...}}) — each screen's component was read from its inner entry, and screens[].role is the registry NAME, not the per-entry role. If the entries carry their own role (e.g. role:'cliente'), read it from source at Step 0.5.`
    : null,
  ir.extra.danglingPages && ir.extra.danglingPages.length
    ? `WARNING: PARTIAL EXPORT accepted via --allow-partial — ${ir.extra.danglingPages.length} linked page(s) are absent from this bundle (${ir.extra.danglingPages.join(', ')}). screens[] covers ONLY the bundled design; those links are dead ends. Tell the user before implementing.`
    : null,
  remoteImages.length
    ? `WARNING: ${remoteImages.length} REMOTE image(s) are referenced by URL and are NOT part of this export — they are absent from images[] and from assets/img/ (${remoteImages.slice(0, 4).map((r) => r.url.replace(/^https?:\/\//, '').slice(0, 52)).join(', ')}${remoteImages.length > 4 ? ', …' : ''}). Read remoteImages[] — each carries its alt= for naming and a use count. Step 0.5 MUST decide WITH THE USER: (a) download + convert to WebP in Step 2, (b) keep them remote (needs images.remotePatterns in next.config.ts), or (c) placeholders. Skipping this ships the design with those photos missing, and NOTHING downstream catches it — missing images compile, type-check and pass every convention grep.`
    : null,
  images.filter((i) => i.dataDriven).length
    ? `NOTE: ${images.filter((i) => i.dataDriven).length} of ${images.length} image(s) are DATA-DRIVEN — referenced from a .logic.js data array (\`{ img: './x.jpg' }\` rendered through \`src="{{ item.img }}"\`), not from a literal src= in the markup. They are in images[] and on disk, flagged \`dataDriven: true\`. Step 0.5: cross-check images.length against the distinct image paths in source/ before delegating Step 2 — this scan is deliberately broad but it is a heuristic, and a path built by string concatenation at runtime is still invisible to it.` : null,
  !ir.screens.length ? 'WARNING: no screens/sections derived — inspect source/ manually (unrecognized structure).' : null,
  !ir.brandFonts ? 'WARNING: could not derive brandFonts — inspect source/helmet for the fonts used.' : null,
  usageFonts.length ? `NOTE: brand font(s) ${usageFonts.join(', ')} came from font-family USAGE (no @font-face / Google <link> in the source) — likely loaded via Typekit/Adobe or self-hosted, so probably NOT on Google Fonts. Confirm the loader at Step 0.5 before the tokens agent tries next/font/google; weights are unknown (body≈display).` : null,
  ir.brandFonts && ir.brandFonts.families.length > 4 ? `NOTE: ${ir.brandFonts.families.length} font families detected (${ir.brandFonts.families.join(', ')}) — unusually many. The design may load a big set but USE only a few. Review at Step 0.5 and load only what's actually rendered; loading all via next/font/google is an LCP/bundle regression.` : null,
].filter(Boolean)

const inventory = {
  source: input, sourceMode: isArchive ? 'archive' : 'standalone', archiveEntry: archiveEntryRel,
  format, navModel, tokenSource: ir.tokenSource, targetSignals: ir.targetSignals,
  counts: {
    manifestEntries: Object.keys(manifest).length, images: images.length, remoteImages: remoteImages.length,
    fonts: fontFamilies.length, brandFonts: ir.brandFonts ? ir.brandFonts.families.length : 0,
    screens: ir.screens.length, components: ir.components.length,
  },
  screens: ir.screens,            // authoritative list (routes / sections / pages depending on navModel)
  components: ir.components,
  brandFonts: ir.brandFonts,      // fonts actually used — LOAD THESE
  fontFamilies,                   // superset of @font-face families
  // `uuid` is the standalone identity; `srcRef` (original relative path) is the archive identity — the screen
  // agent maps a source `<img src>` to its converted asset by whichever the export provided.
  images: images.map((i) => ({ file: i.file, uuid: i.uuid, srcRef: i.srcRef || null, alias: i.alias, mime: i.mime, dataDriven: !!i.dataDriven })),
  // Referenced by URL, NOT shipped in the export — deliberately a SEPARATE list, not `images[]` entries with a
  // null `file`, so an agent looping over images[] can never hit a path that isn't on disk. Each: { url, alt,
  // uses, from }. `alt` is the naming context (dclogic has no `alias`). Requires a Step 0.5 decision — see notes.
  // `from` is `img` | `picture` | `css`, and records where the URL was FIRST seen, not everywhere it appears:
  // the same photo used as an <img> and as a CSS background reports the first one only. Treat it as a hint for
  // naming/among-which-markup, never as "this image is only used in one place" — `uses` is the count that matters.
  remoteImages,
  registries: ir.extra.registries ? Object.fromEntries(Object.entries(ir.extra.registries).map(([k, v]) => [k, Object.keys(v)])) : undefined,
  tabs: ir.extra.tabs,
  entry: ir.extra.entry,
  brand: ir.tokens.brand,
  tokenNamespaces: ir.tokens.themes ? Object.keys(ir.tokens.themes) : [],
  notes,
}
writeJson('inventory.json', inventory)

// ─────────────────────────────────────────────────────────── done
console.log(`[unpack] format=${format} navModel=${navModel} tokenSource=${ir.tokenSource}`)
console.log(`[unpack] screens=${ir.screens.length} components=${ir.components.length} images=${images.length}${remoteImages.length ? `(+${remoteImages.length} remote)` : ''} fonts=${fontFamilies.length} (brand: ${ir.brandFonts ? ir.brandFonts.families.join('+') : 'none'})`)
if (inventory.registries) console.log(`[unpack] registries: ${Object.entries(inventory.registries).map(([k, v]) => `${k}(${v.length})`).join(', ')}${ir.extra.tabs ? ` tabs(${ir.extra.tabs.length})` : ''}`)
for (const n of notes.filter((n) => n.startsWith('WARNING'))) console.warn(`[unpack] ${n}`)
console.log(`[unpack] wrote working tree to ${outDir}`)