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
//   - babel   : a React SPA (`<script type="text/babel">`, `function` components, window.HOST/GUEST, THEMES). (GIVXO)
//   - dclogic : Claude Design's NATIVE format — `<x-dc>` markup + `class Component extends DCLogic` + `<helmet>`.
//               Single-page (template=string, routing via `state.page`) OR multi-page (template={pages,entry}).
//   - vanilla : plain HTML/CSS/JS, no component framework (best-effort — no reference sample).
//   - Next.js is NOT a standalone-HTML export (it's a code/zip export) → out of scope here.
//
// Usage:  node unpack.mjs <url-or-path> <outDir>

import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import zlib from 'node:zlib'

const EXPECTED_SHAPE = { blocks: ['manifest', 'ext_resources', 'template'] }
const die = (msg) => { console.error(`\n[unpack] ERROR: ${msg}\n`); process.exit(1) }

const [, , input, outDir] = process.argv
if (!input || !outDir) die('usage: node unpack.mjs <url-or-path> <outDir>')

// ─────────────────────────────────────────────────────────── helpers
const MIME_EXT = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
  'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/avif': 'avif',
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
const evalLiteral = (text) => { try { return Function(`"use strict";return (${text});`)() } catch { return null } }
const slugify = (s) => (s || '').replace(/\.dc$/i, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'x'
const familyOf = (stack) => { const m = (stack || '').match(/^\s*['"]?([^'",]+)/); return m ? m[1].trim() : null }
const uniq = (a) => [...new Set(a)]
const scanHex = (s) => uniq([...s.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)].map((m) => m[0].toLowerCase())).sort()
const scanCssVars = (s) => uniq([...s.matchAll(/var\((--[a-z-]+)/g)].map((m) => m[1])).sort()
// CSS font-size scan: px + rem (rem→px @16). clamp()/vw responsive sizes aren't captured (reported separately).
const scanFontSizes = (s) => uniq([...s.matchAll(/font-size:\s*(\d+(?:\.\d+)?)\s*(px|rem)/g)].map((m) => (m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1])))).sort((a, b) => a - b)
// pick body/display from @font-face weights: lightest family → body text, heaviest → display/headings.
// (first/last-by-appearance is a coin flip — StreetBuild's Gotham Ultra 400-900 vs Gill Sans 400 needs the weight.)
function pickBrandFonts(faces) {
  if (!faces.length) return null
  const byFam = {}
  for (const f of faces) { const nums = (String(f.weight || '400').match(/\d+/g) || ['400']).map(Number); byFam[f.family] = Math.max(byFam[f.family] || 0, Math.max(...nums)) }
  const fams = Object.keys(byFam)
  const sorted = [...fams].sort((a, b) => byFam[a] - byFam[b])
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

// ─────────────────────────────────────────────────────────── 2. parse the envelope (shared)
const rawManifest = extractBundlerBlock(html, 'manifest')
const rawExt = extractBundlerBlock(html, 'ext_resources')
const rawTemplate = extractBundlerBlock(html, 'template')
if (!rawManifest || !rawTemplate) {
  die(`unexpected export shape — missing __bundler blocks (expected ${EXPECTED_SHAPE.blocks.join(', ')}). ` +
      `Not a recognized Claude Design standalone-HTML export.`)
}
let manifest, extParsed = null, template
try { manifest = JSON.parse(rawManifest) } catch (e) { die(`manifest is not valid JSON: ${e.message}`) }
if (rawExt) { try { extParsed = JSON.parse(rawExt) } catch { extParsed = null } }
try { template = JSON.parse(rawTemplate) } catch (e) { die(`template block is not valid JSON: ${e.message}`) }

// ext_resources may be an ARRAY of aliases (babel/dclogic-single) or an OBJECT page-map (dclogic-multi).
// Guard both — a raw `for..of` over an object throws (this was the StreetBuild crash).
const extAliases = Array.isArray(extParsed) ? extParsed : []
const aliasByUuid = {}
for (const r of extAliases) if (r && r.uuid && r.id) aliasByUuid[r.uuid] = r.id

// ─────────────────────────────────────────────────────────── 3. detect format
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
const { format, navModel } = detectFormat()

// ─────────────────────────────────────────────────────────── 4. reset output tree + shared assets
rmSync(outDir, { recursive: true, force: true })
mkdirSync(join(outDir, 'source'), { recursive: true })
mkdirSync(join(outDir, 'assets', 'img'), { recursive: true })

// images (shared across formats)
const images = []
for (const [uuid, entry] of Object.entries(manifest)) {
  if (!entry.mime || !entry.mime.startsWith('image/')) continue
  const ext = MIME_EXT[entry.mime] || 'bin'
  const base = aliasByUuid[uuid] ? slugify(aliasByUuid[uuid]) : uuid.slice(0, 8)
  const rel = `assets/img/${base}.${ext}`
  try { writeFileSync(join(outDir, rel), decodeEntry(entry)); images.push({ file: rel, uuid, mime: entry.mime, alias: aliasByUuid[uuid] || null }) }
  catch (e) { console.warn(`[unpack] warn: image ${uuid}: ${e.message}`) }
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

// ─────────────────────────────────────────────────────────── 5. per-format parsers → normalized IR
// Each parser returns: { sourceFiles:[{file,bytes}], screens:[{key,component,role,file,section?}],
//   components:[{name,file,kind}], tokens:{themes?,brand?,rawScan}, brandFonts, fonts, extra:{} }
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
    fontSizes: uniq([...allSrc.matchAll(/fontSize:\s*(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]))).sort((a, b) => a - b),
    cssVars: scanCssVars(allSrc),
  }

  // registries → screens (window.X = {} + Object.assign, with const fallback)
  const registries = {}
  const merge = (name, objText) => { const map = registries[name] || (registries[name] = {}); for (const m of objText.matchAll(/([a-zA-Z0-9_]+)\s*:\s*([A-Z][A-Za-z0-9_]*)\b/g)) map[m[1]] = m[2] }
  const dropEmpty = () => { for (const k of Object.keys(registries)) if (!Object.keys(registries[k]).length) delete registries[k] }
  for (const m of allSrc.matchAll(/window\.([A-Z][A-Z0-9_]*)\s*=\s*\{/g)) { const t = extractBalanced(allSrc, allSrc.indexOf('{', m.index)); if (t) merge(m[1], t) }
  for (const m of allSrc.matchAll(/Object\.assign\(\s*window\.([A-Z][A-Z0-9_]*)\s*,\s*\{/g)) { const t = extractBalanced(allSrc, allSrc.indexOf('{', m.index + m[0].length - 1)); if (t) merge(m[1], t) }
  dropEmpty()
  let usedRegistryFallback = false
  if (!Object.keys(registries).length) {
    usedRegistryFallback = true
    const routingName = /^(GUEST|HOST|ROUTES?|SCREENS?|PAGES?|VIEWS?|NAV|STACK|ROUTER)/
    for (const m of allSrc.matchAll(/(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*\{/g)) { if (!routingName.test(m[1])) continue; const t = extractBalanced(allSrc, allSrc.indexOf('{', m.index)); if (t) merge(m[1], t) }
    for (const m of allSrc.matchAll(/Object\.assign\(\s*([A-Z][A-Z0-9_]*)\s*,\s*\{/g)) { if (!routingName.test(m[1])) continue; const t = extractBalanced(allSrc, allSrc.indexOf('{', m.index + m[0].length - 1)); if (t) merge(m[1], t) }
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
    extra: { registries, tabs: arrLit('HOST_TABS'), usedRegistryFallback, jsxFiles },
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
  // state.page section keys (single-page routing) + go() targets
  const pageVals = uniq([...docStr.matchAll(/(?:page:\s*|page\s*===\s*|go\(\s*)['"]([a-zA-Z0-9_-]+)['"]/g)].map((m) => m[1]))
  // dc-import child components
  const imports = uniq([...docStr.matchAll(/<dc-import\s+name="([^"]+)"/g)].map((m) => m[1]))
  return { slug, markupFile, logicFile, helmet, logic, docStr, pageVals, imports, bytes: markup.length + logic.length }
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
    fontSizes: scanFontSizes(allSrc),
    clampFontSizes: (allSrc.match(/font-size:\s*clamp\(/g) || []).length, // responsive sizes NOT captured — read from source
    cssVars: scanCssVars(allSrc),
  }
  const faces = scanFontFaces(helmetAll)
  const brandFonts = pickBrandFonts(faces)

  const importsAll = uniq(docs.flatMap((d) => d.imports))
  const components = importsAll.map((name) => ({ name, file: null, kind: 'primitive-or-helper' })) // dc-import children

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
    extra: { dcDocs: docs.map((d) => ({ slug: d.slug, sections: d.pageVals, imports: d.imports })), entry: isMultiPage ? slugify(template.entry) : null },
  }
}

function parseVanilla() {
  // DEFENSIVE — no reference sample. Treat the whole page as one screen; tokens from inline styles + <style>.
  const bodyMatch = templateStr.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const body = bodyMatch ? bodyMatch[1] : templateStr
  const markupFile = write('source/index.markup.html', body)
  const styleBlocks = [...templateStr.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n')
  const rawScan = {
    hexColors: scanHex(templateStr),
    fontSizes: scanFontSizes(templateStr),
    clampFontSizes: (templateStr.match(/font-size:\s*clamp\(/g) || []).length,
    cssVars: scanCssVars(templateStr),
  }
  const faces = scanFontFaces(templateStr)
  const brandFonts = pickBrandFonts(faces)
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

// ─────────────────────────────────────────────────────────── 6. write structured artifacts (normalized IR)
const writeJson = (name, obj) => writeFileSync(join(outDir, name), JSON.stringify(obj, null, 2), 'utf8')
const fontFamilies = uniq(ir.fonts.map((f) => f.family))
writeJson('fonts.json', { families: fontFamilies, faces: ir.fonts })
writeJson('tokens.json', ir.tokens)
writeJson('nav-graph.json', { navModel, ...ir.extra })
writeJson('components.json', ir.components)

const screenComponents = uniq(ir.screens.map((s) => s.component))
const dupComponents = format === 'babel' && ir.screens.length !== screenComponents.length
const notes = [
  `format=${format}, navModel=${navModel}, tokenSource=${ir.tokenSource}`,
  format === 'vanilla' ? 'WARNING: vanilla flavor — DEFENSIVE/best-effort extraction (no reference sample). Inspect source/index.markup.html manually.' : null,
  format === 'dclogic' && navModel === 'single-page-sections' ? `navModel=single-page-sections — this is ONE screen with sections (${ir.screens.map((s) => s.key).join(', ')}), not separate routes. Orchestrator: implement as a single screen (section switching), NOT route/step/modal per key.` : null,
  format === 'dclogic' && navModel === 'multi-page' ? `navModel=multi-page — ${ir.screens.length} web pages → ${ir.screens.length} routes (entry: ${ir.extra.entry}).` : null,
  ir.tokenSource !== 'themes-object' ? 'tokenSource=inline+helmet — NO THEMES object; the tokens agent scans inline styles + <helmet> CSS vars/@font-face (see tokens.json.rawScan + brandFonts).' : null,
  ir.tokens.rawScan.clampFontSizes ? `NOTE: ${ir.tokens.rawScan.clampFontSizes} clamp() font-size(s) not captured in rawScan (responsive display sizes) — the screen agent reads them directly from source.` : null,
  `target guess=${ir.targetSignals.guess} — parent confirms mobile-app|web at the Step 0.5 checkpoint (drives responsive).`,
  dupComponents ? `NOTE: ${ir.screens.length} registry keys → ${screenComponents.length} unique components (some routes share a component).` : null,
  ir.extra.usedRegistryFallback ? 'NOTE: no window.* registries — used the const-registry NAME heuristic; double-check screens[] for spurious entries.' : null,
  !ir.screens.length ? 'WARNING: no screens/sections derived — inspect source/ manually (unrecognized structure).' : null,
  !ir.brandFonts ? 'WARNING: could not derive brandFonts — inspect source/helmet for the fonts used.' : null,
].filter(Boolean)

const inventory = {
  source: input, format, navModel, tokenSource: ir.tokenSource, targetSignals: ir.targetSignals,
  counts: {
    manifestEntries: Object.keys(manifest).length, images: images.length,
    fonts: fontFamilies.length, brandFonts: ir.brandFonts ? ir.brandFonts.families.length : 0,
    screens: ir.screens.length, components: ir.components.length,
  },
  screens: ir.screens,            // authoritative list (routes / sections / pages depending on navModel)
  components: ir.components,
  brandFonts: ir.brandFonts,      // fonts actually used — LOAD THESE
  fontFamilies,                   // superset of @font-face families
  images: images.map((i) => ({ file: i.file, uuid: i.uuid, alias: i.alias, mime: i.mime })),
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
console.log(`[unpack] screens=${ir.screens.length} components=${ir.components.length} images=${images.length} fonts=${fontFamilies.length} (brand: ${ir.brandFonts ? ir.brandFonts.families.join('+') : 'none'})`)
if (inventory.registries) console.log(`[unpack] registries: ${Object.entries(inventory.registries).map(([k, v]) => `${k}(${v.length})`).join(', ')}${ir.extra.tabs ? ` tabs(${ir.extra.tabs.length})` : ''}`)
for (const n of notes.filter((n) => n.startsWith('WARNING'))) console.warn(`[unpack] ${n}`)
console.log(`[unpack] wrote working tree to ${outDir}`)