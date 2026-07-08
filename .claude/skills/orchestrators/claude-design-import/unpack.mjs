#!/usr/bin/env node
// unpack.mjs — deterministic extractor for a Claude Design "Standalone HTML" export.
//
// A Claude Design export is a self-contained React SPA in one .html using a private
// "__bundler" format:
//   <script type="__bundler/manifest">      { uuid: {mime, compressed, data(base64)} }
//   <script type="__bundler/ext_resources"> [ {id, uuid}, ... ]   (named-asset aliases)
//   <script type="__bundler/template">       "<...the real inner HTML doc as a JSON string...>"
// The inner template references component source + assets by UUID:
//   <script type="text/babel" src="<uuid>">  -> a JSX component file (may be gzip'd in the manifest)
//   <script type="text/babel">...</script>   -> the inline entry (createRoot render)
//   @font-face { src: url("<uuid>") }         -> a woff2 font (we only record the family, never re-embed)
//   image/* manifest entries                  -> raster assets (base64, sometimes gzip'd)
//
// This script downloads (or reads) the export, decodes/decompresses everything, and writes a clean
// working-tree the claude-design-import orchestrator consumes. It is deterministic on purpose:
// parsing the bundle with code (not an LLM) is cheaper and never hallucinates.
//
// Usage:  node unpack.mjs <url-or-path> <outDir>
//
// Outputs under <outDir>/:
//   template.html                 the inner HTML document (UUID refs left intact)
//   jsx/NN_<slug>.jsx             each component source + the entry, in template order
//   assets/img/<name>.<ext>       decoded raster assets (named by ext_resources alias when known)
//   fonts.json                    font families referenced (for next/font/google mapping)
//   tokens.json                   THEMES/BRAND design-token object + a raw hex/size/font scan
//   nav-graph.json                window.HOST/GUEST/... registries, HOST_TABS, go()/goRoot() targets
//   components.json               every top-level function, classified screen | primitive/helper
//   inventory.json                the summary the orchestrator reads first (counts, flavor, target signals)

import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import zlib from 'node:zlib'

// ─────────────────────────────────────────────────────────── format version guard
// The __bundler format is proprietary and may change. We record the shape we expect so a
// future format change fails loudly here instead of producing silently-incomplete output.
const EXPECTED_SHAPE = { blocks: ['manifest', 'ext_resources', 'template'] }

const die = (msg) => { console.error(`\n[unpack] ERROR: ${msg}\n`); process.exit(1) }

// ─────────────────────────────────────────────────────────── args
const [, , input, outDirArg] = process.argv
if (!input || !outDirArg) die('usage: node unpack.mjs <url-or-path> <outDir>')
const outDir = outDirArg

// ─────────────────────────────────────────────────────────── helpers
const MIME_EXT = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
  'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/avif': 'avif',
}

// Decode a manifest entry to a Buffer, transparently decompressing when flagged.
function decodeEntry(entry) {
  let buf = Buffer.from(entry.data, 'base64')
  if (entry.compressed) {
    for (const fn of [zlib.gunzipSync, zlib.inflateSync, zlib.inflateRawSync, zlib.brotliDecompressSync]) {
      try { return fn(buf) } catch { /* try next codec */ }
    }
    throw new Error('could not decompress a compressed manifest entry (tried gzip/inflate/raw/brotli)')
  }
  return buf
}

// Pull the raw inner text of a <script type="__bundler/NAME"> block.
function extractBundlerBlock(html, name) {
  const re = new RegExp(`<script type="__bundler/${name}">([\\s\\S]*?)</script>`, 'i')
  const m = html.match(re)
  return m ? m[1].trim() : null
}

// Walk a balanced bracketed literal starting at the opening bracket index; string/escape aware.
// Returns the substring including both brackets, or null if unbalanced.
function extractBalanced(src, openIdx) {
  const open = src[openIdx]
  const close = open === '{' ? '}' : open === '[' ? ']' : null
  if (!close) return null
  let depth = 0, i = openIdx, quote = null
  for (; i < src.length; i++) {
    const c = src[i]
    if (quote) {
      if (c === '\\') { i++; continue }
      if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue }
    if (c === open) depth++
    else if (c === close) { depth--; if (depth === 0) return src.slice(openIdx, i + 1) }
  }
  return null
}

// Best-effort eval of a pure-data object/array literal (design tokens). Guarded; returns null on failure.
function evalLiteral(text) {
  try { return Function(`"use strict";return (${text});`)() } catch { return null }
}

const slugify = (s) => (s || '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'x'

// ─────────────────────────────────────────────────────────── 1. get the export HTML
let html
if (/^https?:\/\//i.test(input)) {
  console.log(`[unpack] downloading ${input}`)
  const res = await fetch(input)
  if (!res.ok) die(`download failed: HTTP ${res.status}`)
  html = await res.text()
} else {
  console.log(`[unpack] reading ${input}`)
  try { html = readFileSync(input, 'utf8') } catch (e) { die(`cannot read file: ${e.message}`) }
}

// ─────────────────────────────────────────────────────────── 2. parse the three __bundler blocks
const rawManifest = extractBundlerBlock(html, 'manifest')
const rawExt = extractBundlerBlock(html, 'ext_resources')
const rawTemplate = extractBundlerBlock(html, 'template')
if (!rawManifest || !rawTemplate) {
  die(`unexpected export shape — missing __bundler blocks (expected ${EXPECTED_SHAPE.blocks.join(', ')}). ` +
      `This may be a non-standard Claude Design export (vanilla/next flavor) or a format change.`)
}

let manifest, ext = [], template
try { manifest = JSON.parse(rawManifest) } catch (e) { die(`manifest is not valid JSON: ${e.message}`) }
if (rawExt) { try { ext = JSON.parse(rawExt) } catch { ext = [] } }
try { template = JSON.parse(rawTemplate) } catch (e) { die(`template is not valid JSON string: ${e.message}`) }

// alias map: uuid -> friendly id (from ext_resources)
const aliasByUuid = {}
for (const r of ext) if (r && r.uuid && r.id) aliasByUuid[r.uuid] = r.id

// ─────────────────────────────────────────────────────────── 3. reset output tree
rmSync(outDir, { recursive: true, force: true })
mkdirSync(join(outDir, 'jsx'), { recursive: true })
mkdirSync(join(outDir, 'assets', 'img'), { recursive: true })
writeFileSync(join(outDir, 'template.html'), template, 'utf8')

// ─────────────────────────────────────────────────────────── 4. component source (babel scripts + entry)
const babelUuids = [...template.matchAll(/<script type="text\/babel" src="([^"]+)"/g)].map((m) => m[1])
const jsxFiles = []
let idx = 0
for (const uuid of babelUuids) {
  const entry = manifest[uuid]
  if (!entry) { console.warn(`[unpack] warn: babel script ${uuid} not in manifest`); continue }
  let src
  try { src = decodeEntry(entry).toString('utf8') } catch (e) { console.warn(`[unpack] warn: ${uuid}: ${e.message}`); continue }
  const firstName = (src.match(/function\s+([A-Z][A-Za-z0-9]*)/) || src.match(/(?:window\.)?([A-Z_]{3,})\s*=/) || [])[1]
  const file = `jsx/${String(idx).padStart(2, '0')}_${slugify(firstName)}.jsx`
  writeFileSync(join(outDir, file), src, 'utf8')
  jsxFiles.push({ file, uuid, bytes: src.length, compressed: !!entry.compressed })
  idx++
}
// inline entry
const inlineEntry = template.match(/<script type="text\/babel">([\s\S]*?)<\/script>/)
if (inlineEntry) {
  const file = `jsx/${String(idx).padStart(2, '0')}_entry.jsx`
  writeFileSync(join(outDir, file), inlineEntry[1], 'utf8')
  jsxFiles.push({ file, uuid: null, bytes: inlineEntry[1].length, entry: true })
}

// concatenated source for scanning (single pass over everything)
const allSrc = jsxFiles.map((f) => readFileSync(join(outDir, f.file), 'utf8')).join('\n')

// ─────────────────────────────────────────────────────────── 5. images
const images = []
for (const [uuid, entry] of Object.entries(manifest)) {
  if (!entry.mime || !entry.mime.startsWith('image/')) continue
  const extName = MIME_EXT[entry.mime] || 'bin'
  const base = aliasByUuid[uuid] ? slugify(aliasByUuid[uuid]) : uuid.slice(0, 8)
  const rel = `assets/img/${base}.${extName}`
  try {
    writeFileSync(join(outDir, rel), decodeEntry(entry))
    images.push({ file: rel, uuid, mime: entry.mime, alias: aliasByUuid[uuid] || null })
  } catch (e) { console.warn(`[unpack] warn: image ${uuid}: ${e.message}`) }
}

// ─────────────────────────────────────────────────────────── 6. fonts (record families; never re-embed woff2)
const fontFaces = []
for (const m of template.matchAll(/@font-face\s*\{([\s\S]*?)\}/g)) {
  const block = m[1]
  const family = (block.match(/font-family:\s*['"]([^'"]+)['"]/) || [])[1]
  if (!family) continue
  fontFaces.push({
    family,
    style: (block.match(/font-style:\s*([^;]+);/) || [])[1]?.trim() || null,
    weight: (block.match(/font-weight:\s*([^;]+);/) || [])[1]?.trim() || null,
  })
}
const fontFamilies = [...new Set(fontFaces.map((f) => f.family))]

// ─────────────────────────────────────────────────────────── 7. tokens (THEMES/BRAND + raw scan)
let themes = null, brand = null
{
  const ti = allSrc.search(/const\s+THEMES\s*=\s*\{/)
  if (ti >= 0) {
    const objText = extractBalanced(allSrc, allSrc.indexOf('{', ti))
    if (objText) themes = evalLiteral(objText)
  }
  brand = (allSrc.match(/const\s+BRAND\s*=\s*['"]([^'"]+)['"]/) || [])[1] || null
}
const rawScan = {
  hexColors: [...new Set([...allSrc.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)].map((m) => m[0].toLowerCase()))].sort(),
  fontSizes: [...new Set([...allSrc.matchAll(/fontSize:\s*(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1])))].sort((a, b) => a - b),
  fontFamiliesInCss: [...new Set([...allSrc.matchAll(/font(?:Family|Display|Body)?:\s*["']([^"']*(?:Sans|Serif|Grotesque|Garamond|Moda|Outfit|Jakarta)[^"']*)["']/g)].map((m) => m[1]))],
  cssVars: [...new Set([...allSrc.matchAll(/var\((--[a-z-]+)/g)].map((m) => m[1]))].sort(),
}

// ─────────────────────────────────────────────────────────── 8. nav graph (registries, tabs, transitions)
const registries = {}
// Registry values are component references (Capitalized identifiers); matching only those
// filters out plain data objects that happen to be assigned to a window.* global.
function mergeRegistry(name, objText) {
  const map = registries[name] || (registries[name] = {})
  for (const m of objText.matchAll(/([a-zA-Z0-9_]+)\s*:\s*([A-Z][A-Za-z0-9_]*)\b/g)) map[m[1]] = m[2]
}
// direct assignment: window.NAME = { ... }
for (const m of allSrc.matchAll(/window\.([A-Z][A-Z0-9_]*)\s*=\s*\{/g)) {
  const objText = extractBalanced(allSrc, allSrc.indexOf('{', m.index))
  if (objText) mergeRegistry(m[1], objText)
}
// augmentation: Object.assign(window.NAME, { ... }) — onboarding / extra screens attach this way
for (const m of allSrc.matchAll(/Object\.assign\(\s*window\.([A-Z][A-Z0-9_]*)\s*,\s*\{/g)) {
  const objText = extractBalanced(allSrc, allSrc.indexOf('{', m.index + m[0].length - 1))
  if (objText) mergeRegistry(m[1], objText)
}
// drop accidental non-registry captures (no component mappings found)
for (const k of Object.keys(registries)) if (!Object.keys(registries[k]).length) delete registries[k]
const arrLiteral = (name) => {
  const i = allSrc.search(new RegExp(`window\\.${name}\\s*=\\s*\\[`))
  if (i < 0) return null
  const t = extractBalanced(allSrc, allSrc.indexOf('[', i))
  return t ? evalLiteral(t) : null
}
const navGraph = {
  registries, // e.g. { GUEST: {welcome:'Welcome',...}, HOST: {...} }
  tabs: arrLiteral('HOST_TABS'),
  transitions: [...new Set([...allSrc.matchAll(/\b(?:go|goRoot)\(\s*['"]([a-zA-Z0-9_]+)['"]/g)].map((m) => m[1]))].sort(),
}

// ─────────────────────────────────────────────────────────── 9. components (classify)
// map every top-level function -> the file it lives in
const fnToFile = {}
for (const f of jsxFiles) {
  const src = readFileSync(join(outDir, f.file), 'utf8')
  for (const m of src.matchAll(/function\s+([A-Z][A-Za-z0-9]*)\s*\(/g)) if (!fnToFile[m[1]]) fnToFile[m[1]] = f.file
}
// screen component names = registry values, tagged with their role (registry name)
const screenOf = {} // ComponentName -> {registry, key}
for (const [regName, map] of Object.entries(registries)) {
  for (const [key, comp] of Object.entries(map)) screenOf[comp] = { registry: regName, key }
}
const components = Object.entries(fnToFile).map(([name, file]) => ({
  name, file,
  kind: screenOf[name] ? 'screen' : 'primitive-or-helper',
  registry: screenOf[name]?.registry || null,
  screenKey: screenOf[name]?.key || null,
})).sort((a, b) => (a.kind < b.kind ? -1 : 1) || a.name.localeCompare(b.name))

// ─────────────────────────────────────────────────────────── 10. flavor + target signals
const hasBabel = /type="text\/babel"/.test(template)
const hasReact = /ReactDOM|createRoot|React\.|from ['"]react['"]/.test(allSrc + template)
const hasNext = /next\/|__NEXT_DATA__|_app|getServerSideProps/.test(allSrc + template)
const flavor = hasNext ? 'next' : hasBabel ? 'babel-inline' : hasReact ? 'react' : 'vanilla'

const iosChrome = /IOSStatusBar|IOSNavBar|IOSDevice|safe-area-inset/.test(allSrc)
const maxWidths = [...allSrc.matchAll(/maxWidth:\s*(\d{3,4})/g)].map((m) => Number(m[1]))
const phoneWidth = maxWidths.some((w) => w >= 360 && w <= 480)
const wideWidth = maxWidths.some((w) => w >= 1000)
const targetSignals = {
  iosChrome, hasBottomTabs: !!navGraph.tabs, phoneFrameMaxWidth: phoneWidth, wideDesktopWidth: wideWidth,
  maxWidthsSeen: [...new Set(maxWidths)].sort((a, b) => a - b),
  guess: (iosChrome || phoneWidth || navGraph.tabs) && !wideWidth ? 'mobile-app' : wideWidth ? 'web' : 'unknown',
}

// ─────────────────────────────────────────────────────────── 11. write structured artifacts
const write = (name, obj) => writeFileSync(join(outDir, name), JSON.stringify(obj, null, 2), 'utf8')
write('fonts.json', { families: fontFamilies, faces: fontFaces })
write('tokens.json', { brand, themes, rawScan })
write('nav-graph.json', navGraph)
write('components.json', components)

const screens = components.filter((c) => c.kind === 'screen')
const inventory = {
  source: input,
  flavor,
  targetSignals,
  counts: {
    manifestEntries: Object.keys(manifest).length,
    images: images.length, fonts: fontFamilies.length,
    jsxFiles: jsxFiles.length, functions: components.length,
    screens: screens.length, primitives: components.length - screens.length,
    registries: Object.keys(registries).length,
  },
  registries: Object.fromEntries(Object.entries(registries).map(([k, v]) => [k, Object.keys(v)])),
  jsxFiles, // [{ file, uuid, bytes, ... }] — uuid→file map (null uuid = inline entry)
  tabs: navGraph.tabs,
  screens: screens.map((s) => ({ key: s.screenKey, component: s.name, role: s.registry, file: s.file })),
  fontFamilies,
  images: images.map((i) => ({ file: i.file, uuid: i.uuid, alias: i.alias, mime: i.mime })),
  brand,
  tokenNamespaces: themes ? Object.keys(themes) : [],
  notes: [
    `flavor=${flavor} (${flavor === 'babel-inline' ? 'React + Babel runtime, inline styles — the fully-supported case' : 'non-primary flavor — orchestrator should adapt / flag'})`,
    `target guess=${targetSignals.guess} — parent confirms at Step 0.5 checkpoint`,
  ],
}
write('inventory.json', inventory)

// ─────────────────────────────────────────────────────────── done
console.log(`[unpack] flavor=${flavor} target≈${targetSignals.guess}`)
console.log(`[unpack] jsx=${jsxFiles.length} images=${images.length} fonts=${fontFamilies.length} screens=${screens.length} primitives=${inventory.counts.primitives}`)
console.log(`[unpack] registries: ${Object.entries(inventory.registries).map(([k, v]) => `${k}(${v.length})`).join(', ') || 'none'}${navGraph.tabs ? ` tabs(${navGraph.tabs.length})` : ''}`)
console.log(`[unpack] wrote working tree to ${outDir}`)
