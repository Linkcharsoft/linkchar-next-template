#!/usr/bin/env node
// unpack.mjs — deterministic extractor for a Claude Design canvas (an Artifact of type "Design") saved to disk.
//
// INPUT — the ROOT folder the Artifact tool saved the canvas into (claude-design-import SKILL.md, Step 0):
//   <root>/project/canvas.json              the canvas index: boards (artboards), order, launch, pages, notes, designSystems
//   <root>/project/**/*.dc.html             one Design Component page per artboard (`<x-dc>` markup + `<helmet>` + DCLogic class)
//   <root>/project/assets/*, *.js, *.css    files the artboards link relatively
//   <root>/project/ds/<folder>/tokens.json  the design system the canvas installed (optional)
//   <root>/<32hex>.<ext>                    every asset-store file the artboards reference as `/_blob/<id>`, saved by id
// OUTPUT — the IR every downstream step reads:
//   source/{slug}.markup.html + .logic.js + .helmet.css, source/support/*, assets/img/*, assets/media/*, assets/fonts/*,
//   assets/contact-sheet.jpg, design-system/*.tokens.json, inventory.json, tokens.json, fonts.json, nav-graph.json, components.json
//
// Usage: node unpack.mjs <root-dir> <outDir> [--url <artifact url>] [--entry <board.dc.html>] [--scope entry|all] [--plan] [--allow-broken-links]
//   --entry  names the board that is the site's home when it is not the canvas's own entry (an exploration canvas
//            whose deliverable is one variant board) — the parent decides it at Step 0.5 and re-runs.
//   --scope  `entry` (default when --entry is given) limits screens, images, media, fonts and the raw scan to the boards
//            REACHABLE from the entry (links + <dc-import>); `all` (default otherwise) covers the whole canvas.
//   --plan   stop after the reachability pass and write plan.json: the boards in scope and every /_blob/ id they need,
//            so Step 0a can fetch only those assets. Needs project/ only; missing blobs are expected here.

import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync, statSync, readdirSync, copyFileSync } from 'node:fs'
import { join, dirname, basename, resolve, relative, posix } from 'node:path'
import { createHash } from 'node:crypto'

const die = (msg) => { console.error(`\n[unpack] ERROR: ${msg}\n`); process.exit(1) }

const argv = process.argv.slice(2)
const allowBrokenLinks = argv.includes('--allow-broken-links')
const planOnly = argv.includes('--plan')
const VALUE_FLAGS = ['--url', '--entry', '--scope']
const flagValue = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] || null : null }
const artifactUrl = flagValue('--url')
const entryOverride = flagValue('--entry')
const scope = flagValue('--scope') || (entryOverride ? 'entry' : 'all')
if (!['entry', 'all'].includes(scope)) die(`--scope must be entry or all (got ${scope})`)
const positional = argv.filter((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes(argv[i - 1]))
const [input, outDir] = positional
if (!input || !outDir) die('usage: node unpack.mjs <root-dir> <outDir> [--url <artifact url>] [--entry <board.dc.html>] [--scope entry|all] [--plan] [--allow-broken-links]')

// ─────────────────────────────────────────────────────────── helpers
const EXT_MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  svg: 'image/svg+xml', avif: 'image/avif', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mp3: 'audio/mpeg', ogg: 'audio/ogg',
  woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf',
  css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', json: 'application/json', pdf: 'application/pdf',
}
const MIME_EXT = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/avif': 'avif' }
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif'])
const MEDIA_EXT = new Set(['mp4', 'webm', 'mov', 'mp3', 'ogg'])
const FONT_EXT = new Set(['woff2', 'woff', 'ttf', 'otf'])
const SCRIPT_EXT = new Set(['js', 'mjs'])
const extOf = (p) => (basename(p).match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase()
const slugify = (s) => (s || '').replace(/\.dc$/i, '').replace(/&(?:amp|#38);/g, '&').replace(/&[a-z#0-9]+;/g, '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'x'
const uniq = (a) => [...new Set(a)]
const readText = (p) => readFileSync(p, 'utf8')
const sha1 = (b) => createHash('sha1').update(b).digest('hex')
const toPosix = (p) => p.split('\\').join('/')
const BLOB_RE = /\/_blob\/([0-9a-f]{32})/i
const scanHex = (s) => uniq([...s.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)].map((m) => m[0].toLowerCase())).sort()
// Digits and uppercase belong in the name class: a numbered scale (`--grey-05/10/20`) is the commonest token naming shape.
const scanCssVars = (s) => uniq([...s.matchAll(/var\((--[a-zA-Z0-9_-]+)/g)].map((m) => m[1])).sort()
// px + rem (rem→px @16); a leading-dot literal (`.74rem`) is what a minifier emits. `em` is parent-relative: no correct ×16.
const scanFontSizes = (s) => uniq([...s.matchAll(/font-size:\s*(\d*\.?\d+)\s*(px|rem)/g)].map((m) => (m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1])))).sort((a, b) => a - b)

// ── Color clustering (design-import-shared.md § B2) ───────────────────────────
// Tag each hex with the CSS role(s) it appears in + a usage count, then single-link cluster by per-channel Δ ≤ 4.
// Output is a HINT: the parent reviews and names, it does not recompute.
const HEX = '#[0-9a-fA-F]{6}\\b|#[0-9a-fA-F]{3}\\b'
const expandHex = (h) => (h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h)
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const chanDelta = (a, b) => { const x = rgbOf(a), y = rgbOf(b); return Math.max(...x.map((v, i) => Math.abs(v - y[i]))) }
const lumaOf = (h) => { const [r, g, b] = rgbOf(h); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 }
const satOf = (h) => { const [r, g, b] = rgbOf(h).map((v) => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx }

function roleOfProp (prop) {
  if (prop.startsWith('--')) return 'var'
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
// Role wins first: a gradient stop or a border keeps its family even when saturated.
function suggestFamily (hex, role) {
  const l = lumaOf(hex), s = satOf(hex)
  if (role === 'gradient') return 'gradient-stop'
  if (role === 'border') return 'line'
  if (role === 'hover' || role === 'active' || role === 'focus') return 'state'
  if (s >= 0.55 && l > 0.25 && l < 0.8) return 'brand-or-semantic'
  if (role === 'text' || role === 'icon') return l < 0.25 ? 'ink' : l < 0.65 ? 'muted' : 'muted-light'
  if (role === 'background' || role === 'shadow') return l > 0.85 ? 'tint' : l < 0.25 ? 'ink' : 'brand-or-semantic'
  return l < 0.25 ? 'ink' : l > 0.85 ? 'tint' : 'muted'
}
// Blank every [start,len] span in ONE pass (same length, so every other offset survives).
function maskSpans (s, spans) {
  if (!spans.length) return s
  spans.sort((a, b) => a[0] - b[0])
  let out = '', pos = 0
  for (const [i, len] of spans) {
    const end = i + len
    if (end <= pos) continue
    const start = Math.max(i, pos)
    out += s.slice(pos, start) + ' '.repeat(end - start)
    pos = end
  }
  return out + s.slice(pos)
}
// First top-level comma that separates two PROPERTIES, or -1 (a comma inside parens or not followed by `key:` is the value's).
const NEXT_KEY = /\s*['"]?(?:--)?[a-zA-Z][\w-]{0,80}['"]?\s*:/y
function propSeparatorComma (v) {
  let depth = 0
  for (let i = 0; i < v.length; i++) {
    const c = v[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === ',' && depth === 0) { NEXT_KEY.lastIndex = i + 1; if (NEXT_KEY.test(v)) return i }
  }
  return -1
}
function clusterHexes (src) {
  const roles = {}, total = {}
  const bump = (h, role) => { h = expandHex(h.toLowerCase()); (roles[h] ||= {})[role] = (roles[h][role] || 0) + 1; total[h] = (total[h] || 0) + 1 }
  let masked = src
  // state attributes first: `style-hover="color:#FE00FE"` is a STATE colour, not the element's text colour
  for (const m of src.matchAll(/style-(hover|active|focus)\s*=\s*"([^"]*)"/gi)) {
    for (const h of m[2].matchAll(new RegExp(HEX, 'g'))) bump(h[0], m[1].toLowerCase())
    masked = masked.slice(0, m.index) + ' '.repeat(m[0].length) + masked.slice(m.index + m[0].length)
  }
  for (const g of gradientSpans(masked)) {
    for (const m of g.matchAll(new RegExp(HEX, 'g'))) bump(m[0], 'gradient')
    masked = masked.replace(g, ' '.repeat(g.length))
  }
  // The `{0,80}` identifier bound is load-bearing: unbounded it is quadratic on a long run without a colon (73s on 200k chars).
  const consumed = []
  const decl = /(--[a-zA-Z][\w-]{0,80}|[a-zA-Z][\w-]{0,80})\s*:\s*([^;{}]*)/g
  let d
  while ((d = decl.exec(masked))) {
    const head = d[0].length - d[2].length
    let value = d[2]
    const cut = propSeparatorComma(value)
    if (cut >= 0) { value = value.slice(0, cut); decl.lastIndex = d.index + head + cut }
    const role = roleOfProp(d[1])
    if (!role) continue
    for (const h of value.matchAll(new RegExp(HEX, 'g'))) bump(h[0], role)
    consumed.push([d.index, head + value.length])
  }
  for (const m of masked.matchAll(new RegExp(`(?:stroke|fill|stop-color)\\s*=\\s*["'](${HEX})`, 'g'))) { bump(m[1], 'icon'); consumed.push([m.index, m[0].length]) }
  // hexes that exist ONLY as a string literal (a palette array in the logic) — seen, but not in a role-bearing position
  for (const m of maskSpans(masked, consumed).matchAll(new RegExp(`["'\`]\\s*(${HEX})\\s*["'\`]`, 'g'))) bump(m[1], 'literal')

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

// ── Fonts ─────────────────────────────────────────────────────────────────────
const GENERIC_FAMILY = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-sans-serif', 'ui-serif', 'ui-monospace', 'inherit', 'initial', 'unset', 'revert', '-apple-system', 'blinkmacsystemfont'])
const firstFamily = (stack) => { const f = stack.split(',')[0].trim().replace(/^['"]|['"]$/g, ''); return f && !/^var\(/i.test(f) && !GENERIC_FAMILY.has(f.toLowerCase()) ? f : null }
// A face whose `src` is a `/_blob/<id>` or a project file is SELF-HOSTED (an upload on the canvas), not Google.
function scanFontFaces (str) {
  const faces = []
  for (const m of str.matchAll(/@font-face\s*\{([\s\S]*?)\}/g)) {
    const b = m[1]
    const family = (b.match(/font-family:\s*['"]?([^'";]+)['"]?/) || [])[1]?.trim()
    if (!family) continue
    const src = (b.match(/src:\s*([^;]+)/) || [])[1] || ''
    const local = (src.match(/url\(\s*['"]?([^'")]+?)['"]?\s*\)/) || [])[1] || null
    faces.push({ family, weight: (b.match(/font-weight:\s*([^;]+);/) || [])[1]?.trim() || null, selfHosted: !!local && !/^https?:/i.test(local), src: local })
  }
  return faces
}
function scanGoogleFontLinks (str) {
  const out = []
  for (const link of str.matchAll(/fonts\.googleapis\.com\/css2\?([^"'\s>]+)/gi)) {
    for (const fam of link[1].replace(/&amp;/g, '&').matchAll(/family=([^&:]+)(?::[^&]*?wght@([0-9;.]+))?/gi)) {
      const family = decodeURIComponent(fam[1].replace(/\+/g, ' ')).trim()
      if (family) out.push({ family, weight: fam[2] ? fam[2].replace(/;/g, ' ') : null, google: true })
    }
  }
  return out
}
// Stylesheet <link>s of font providers that are NOT Google: the family is served by a remote CSS the project cannot
// load (next/font/google does not know it, and a by-name load falls back silently). Fontshare names the families in
// the URL; Typekit/Bunny/others only identify the kit, so the families are matched from usage.
const FONT_PROVIDERS = [
  { provider: 'fontshare', host: /api\.fontshare\.com/i, families: (u) => [...u.matchAll(/f(?:%5B%5D|\[\])=([a-z0-9-]+)(?:@([0-9,]+))?/gi)].map((m) => ({ family: m[1].split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '), weight: m[2] ? m[2].replace(/,/g, ' ') : null })) },
  { provider: 'typekit', host: /use\.typekit\.net/i, families: () => [] },
  { provider: 'bunny', host: /fonts\.bunny\.net/i, families: (u) => [...u.matchAll(/family=([^&:|]+)(?::([0-9,]+))?/gi)].map((m) => ({ family: decodeURIComponent(m[1].replace(/\+/g, ' ')), weight: m[2] ? m[2].replace(/,/g, ' ') : null })) },
  { provider: 'fonts.com', host: /fast\.fonts\.net|fonts\.com/i, families: () => [] },
]
function scanRemoteFontLinks (str) {
  const out = []
  for (const link of str.matchAll(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const href = link[1].replace(/&amp;/g, '&')
    const p = FONT_PROVIDERS.find((x) => x.host.test(href))
    if (!p) continue
    const fams = p.families(href)
    if (fams.length) for (const f of fams) out.push({ ...f, remote: { provider: p.provider, cssUrl: href } })
    else out.push({ family: null, weight: null, remote: { provider: p.provider, cssUrl: href } })
  }
  return out
}
function scanFontFamilyUsage (str) {
  const out = []
  for (const m of str.matchAll(/font-family:\s*((?:'[^']*'|"[^"]*"|[^;}{"'])+)/gi)) { const f = firstFamily(m[1]); if (f) out.push(f) }
  return uniq(out)
}
function scanBodyFontFamily (str) {
  const m = str.match(/(?:^|[};>\s])body\s*\{[^}]*?font-family:\s*([^;}]+)/i)
  return m ? firstFamily(m[1]) : null
}
function scanAllFontFamilyMentions (str) {
  const out = new Set()
  for (const m of str.matchAll(/font-family:\s*((?:'[^']*'|"[^"]*"|[^;}{"'])+)/gi)) {
    for (const part of m[1].split(',')) {
      const fam = part.trim().replace(/^['"]|['"]$/g, '').toLowerCase()
      if (fam && !/^var\(/i.test(fam)) out.add(fam)
    }
  }
  return out
}
// The face the HEADINGS render in: an inline `font-family` on <h1>–<h3>, or a helmet rule whose selector names them.
// This, not the heaviest declared weight, is what "display" means — measured: a canvas declared Inter for one 10px strip
// and nothing else, and the max-weight heuristic promoted it to the display face while every heading inherited the body.
function scanHeadingFontFamily (markups, css) {
  const tally = {}
  const add = (f) => { if (f) tally[f] = (tally[f] || 0) + 1 }
  for (const m of markups) for (const h of m.matchAll(/<h[1-3]\b[^>]*\bstyle\s*=\s*"([^"]*)"/gi)) { const f = (h[1].match(/font-family\s*:\s*([^;"]+)/i) || [])[1]; if (f) add(firstFamily(f)) }
  for (const r of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/(^|[\s,>+~])h[1-3]\b/i.test(r[1])) continue
    const f = (r[2].match(/font-family\s*:\s*([^;}]+)/i) || [])[1]
    if (f) add(firstFamily(f))
  }
  return Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || null
}
// Per-family usage count: how many `font-family` declarations start with it. A face used in one 10px strip is `secondary`.
function countFamilyUses (str) {
  const tally = {}
  for (const m of str.matchAll(/font-family:\s*((?:'[^']*'|"[^"]*"|[^;}{"'])+)/gi)) { const f = firstFamily(m[1]); if (f) tally[f] = (tally[f] || 0) + 1 }
  return tally
}
// @font-face → Google <link> → other providers' <link> → usage (ADDITIVE: a display face set only inline must not vanish).
// Declared ≠ used: a face the design loads but never references is dead weight — marked `used:false` so the parent drops it.
function gatherFaces (str) {
  const faces = scanFontFaces(str)
  const seen = new Set(faces.map((f) => f.family))
  for (const lf of scanGoogleFontLinks(str)) if (!seen.has(lf.family)) { faces.push(lf); seen.add(lf.family) }
  const kits = []
  for (const rf of scanRemoteFontLinks(str)) {
    if (!rf.family) { kits.push(rf.remote); continue }
    if (!seen.has(rf.family)) { faces.push(rf); seen.add(rf.family) }
  }
  for (const fam of scanFontFamilyUsage(str)) if (!seen.has(fam)) { faces.push({ family: fam, weight: null, fromUsage: true, remote: kits[0] || undefined }); seen.add(fam) }
  const mentioned = scanAllFontFamilyMentions(str)
  const uses = countFamilyUses(str)
  for (const f of faces) { f.used = f.fromUsage || mentioned.has(f.family.toLowerCase()); f.uses = uses[f.family] || 0 }
  return faces
}
function pickBrandFonts (faces, bodyFamily, headingFamily) {
  if (!faces.length) return null
  const used = faces.filter((f) => f.used !== false)
  if (used.length) faces = used
  const fams = uniq(faces.map((f) => f.family))
  const body = bodyFamily && fams.includes(bodyFamily) ? bodyFamily : faces.slice().sort((a, b) => (b.uses || 0) - (a.uses || 0))[0].family
  const display = headingFamily && fams.includes(headingFamily) && headingFamily !== body ? headingFamily : null
  const secondary = faces.filter((f) => f.family !== body && f.family !== display).map((f) => ({ family: f.family, uses: f.uses || 0 }))
  return { body, display, secondary, families: fams }
}

// ── Images ────────────────────────────────────────────────────────────────────
// Inline `data:` images: decode to real files AND strip them out of the written source (a 7 MB artboard is usually base64).
const DATA_URI = /data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)/gi
function extractDataUriImages (src, acc) {
  return src.replace(DATA_URI, (whole, mime, b64, offset) => {
    let buf
    try { buf = Buffer.from(b64.replace(/\s+/g, ''), 'base64') } catch { return whole }
    if (!buf.length) return whole
    const key0 = sha1(buf)
    const hit = acc.bySha.get(key0)
    if (hit) return hit.ref
    const ext = MIME_EXT[mime.toLowerCase()] || 'bin'
    const W = 300
    const head = src.slice(Math.max(0, offset - W), offset)
    const tail = src.slice(offset + whole.length, offset + whole.length + W)
    const alt = ((head + ' ' + tail).match(/alt\s*=\s*"([^"]{2,60})"/i) || [])[1]
    const key = (head.match(/["'{,]\s*["']([A-Za-z0-9_-]{1,40})["']\s*:\s*["']$/) || [])[1]
    const name = (alt && slugify(alt)) || (key && slugify(key)) || `inline-${String(acc.images.length + 1).padStart(2, '0')}`
    const ref = `inline/${name}.${ext}`
    const rec = { dataBuf: buf, ref, mime, inline: true }
    acc.bySha.set(key0, rec); acc.images.push(rec)
    return ref
  })
}
// Drop an inline copy byte-identical to a file the design also ships (one logo inlined at one call site, a file at another).
function mergeImages (fileImgs, inlineImgs) {
  if (!inlineImgs.length) return fileImgs
  const bySize = new Map()
  for (const l of fileImgs) {
    try { const s = statSync(l.srcPath).size; if (!bySize.has(s)) bySize.set(s, []); bySize.get(s).push(l.srcPath) } catch { /* unreadable: the writer reports it */ }
  }
  const kept = inlineImgs.filter((im) => {
    const cands = bySize.get(im.dataBuf.length)
    if (!cands) return true
    const h = sha1(im.dataBuf)
    return !cands.some((p) => { try { return sha1(readFileSync(p)) === h } catch { return false } })
  })
  return [...fileImgs, ...kept]
}
// Remote images (referenced by URL, never shipped) — ONE entry per distinct image, not per rendition.
const SIZE_PARAMS = new Set(['w', 'width', 'h', 'height', 'dpr', 'q', 'quality'])
function renditionKey (url) {
  const [path, qs] = url.split('?')
  if (!qs) return path
  const params = [...new URLSearchParams(qs)]
  const others = params.filter(([k]) => !SIZE_PARAMS.has(k.toLowerCase())).map(([k, v]) => `${k.toLowerCase()}=${v}`).sort()
  const num = (n) => { const p = params.find(([k]) => k.toLowerCase() === n); return p ? Number(p[1]) : 0 }
  const w = num('w') || num('width'), h = num('h') || num('height')
  const ar = w && h ? `ar=${(w / h).toFixed(2)}` : ''
  return [path, ...others, ar].filter(Boolean).join('|')
}
function pixelSizeOf (u) {
  const q = (re) => Number((u.match(re) || [])[1]) || 0
  const seg = u.match(/\/(\d{2,5})x(\d{2,5})(?:[/?.]|$)/)
  return Math.max(q(/[?&](?:w|width)=(\d+)/i), q(/[?&](?:h|height)=(\d+)/i), seg ? Math.max(Number(seg[1]), Number(seg[2])) : 0)
}
const IMG_REF = /\.(png|jpe?g|webp|gif|svg|avif)(?:[?#]|$)/i
const IMAGE_PROPS = /^(?:background|background-image|mask|mask-image|-webkit-mask-image|border-image|border-image-source|list-style-image|content|shape-outside|offset-path)$/i
// Each `<img …>` tag, quote-aware, hand-rolled (the regex form backtracks catastrophically on an unterminated tag).
function tagsOf (src, name) {
  const out = []
  const re = new RegExp(`<${name}\\b`, 'gi')
  let m
  while ((m = re.exec(src))) {
    let quote = null, end = -1
    for (let i = m.index + name.length + 1; i < src.length; i++) {
      const c = src[i]
      if (quote) { if (c === quote) quote = null; continue }
      if (c === '"' || c === "'") { quote = c; continue }
      if (c === '>') { end = i; break }
    }
    if (end < 0) break
    out.push(src.slice(m.index, end + 1))
    re.lastIndex = end + 1
  }
  return out
}
const imgTags = (src) => tagsOf(src, 'img')
const attrOf = (tag, name) => (tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i')) || [])[1]
const hasAttr = (tag, name) => new RegExp(`\\s${name}(?:\\s|=|>|$)`, 'i').test(tag)
const largest = (cands) => cands.reduce((best, c) => (best && best.size >= c.size ? best : c), null)
function bestSrcsetCandidate (setValue) {
  return largest((setValue || '').split(',').map((c) => c.trim().split(/\s+/))
    .filter(([u]) => u && /^https?:/i.test(u))
    .map(([u, d]) => ({ u, size: Number((String(d || '').match(/^(\d+(?:\.\d+)?)[wx]$/i) || [])[1]) || pixelSizeOf(u) })))
}
function collectRemoteImages (srcList) {
  const byUrl = new Map()
  const add = (url, from, alt) => {
    const key = renditionKey(url)
    if (!byUrl.has(key)) byUrl.set(key, { url, alt: alt || null, uses: 0, from, renditions: new Set() })
    const e = byUrl.get(key)
    e.uses++
    e.renditions.add(url)
    if (pixelSizeOf(url) > pixelSizeOf(e.url)) e.url = url
    if (!e.alt && alt) e.alt = alt
  }
  const URL_IN = /url\(\s*['"]?(https?:\/\/[^'")]+?)['"]?\s*\)/gi
  const blank = (s) => ' '.repeat(s.length)
  for (const raw of srcList) {
    let src = raw.replace(/<!--[\s\S]*?-->/g, blank)
    src = src.replace(/<picture\b[\s\S]*?<\/picture>/gi, (block) => {
      const alt = attrOf(block, 'alt')
      const cands = []
      for (const m of block.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) { const b = bestSrcsetCandidate(m[1]); if (b) cands.push(b) }
      for (const tag of imgTags(block)) {
        const u = attrOf(tag, 'src')
        if (u && /^https?:/i.test(u)) cands.push({ u, size: pixelSizeOf(u) })
      }
      const best = largest(cands)
      if (best) add(best.u, 'picture', alt)
      return blank(block)
    })
    for (const tag of imgTags(src)) {
      const url = attrOf(tag, 'src')
      if (url && /^https?:/i.test(url)) add(url, 'img', attrOf(tag, 'alt'))
      if (!url) {
        const best = bestSrcsetCandidate(attrOf(tag, 'srcset'))
        if (best) add(best.u, 'img', attrOf(tag, 'alt'))
      }
    }
    for (const m of src.matchAll(URL_IN)) {
      const before = src.slice(Math.max(0, m.index - 120), m.index)
      const prop = (before.match(/(-{0,2}[a-zA-Z][\w-]{0,40})\s*:\s*[^;{}]*$/) || [])[1]
      if (IMG_REF.test(m[1]) || (prop && IMAGE_PROPS.test(prop))) add(m[1], 'css', null)
    }
  }
  return [...byUrl.values()].sort((a, b) => b.uses - a.uses).map((e) => ({ ...e, renditions: e.renditions.size > 1 ? [...e.renditions] : undefined }))
}

// ─────────────────────────────────────────────────────────── 1. locate the canvas
const root = resolve(input)
if (!existsSync(root) || !statSync(root).isDirectory()) die(`not a directory: ${input}. Pass the ROOT folder the Artifact tool saved the canvas into (it holds project/canvas.json).`)
const projectDir = existsSync(join(root, 'project', 'canvas.json')) ? join(root, 'project')
  : existsSync(join(root, 'canvas.json')) ? root : null
if (!projectDir) die(`no project/canvas.json under ${root} — not a saved Design canvas. Read the artifact's project/ files with the Artifact tool first (claude-design-import SKILL.md, Step 0).`)
const blobDir = projectDir === root ? dirname(root) : root
let canvas
try { canvas = JSON.parse(readText(join(projectDir, 'canvas.json'))) } catch (e) { die(`project/canvas.json is not valid JSON: ${e.message}`) }
const boardsMeta = canvas.boards && typeof canvas.boards === 'object' ? canvas.boards : {}
const order = Array.isArray(canvas.order) ? canvas.order : Object.keys(boardsMeta)
const title1Notes = Object.entries(canvas.notes || {}).filter(([, n]) => n && n.kind === 'title1' && typeof n.text === 'string')
  .map(([id, n]) => ({ id, text: n.text, x: Number(n.x) || 0, y: Number(n.y) || 0, maxW: Number(n.maxW) || null }))
// everything the author wrote on the canvas that is not a heading: stickies hold briefs and post-design feedback
const stickyNotes = Object.entries(canvas.notes || {}).filter(([, n]) => n && n.kind !== 'title1' && typeof n.text === 'string' && n.text.trim())
  .map(([id, n]) => ({ id, kind: n.kind || 'sticky', text: n.text, x: Number(n.x) || 0, y: Number(n.y) || 0, page: n.page || null }))

// every .dc.html under project/ except project/ds/ IS an artboard, listed in `boards` or not (the type's own rule)
function walk (dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) { if (!(dir === projectDir && e.name === 'ds')) walk(p, out) } else out.push(p)
  }
  return out
}
const projectFiles = walk(projectDir)
const relOf = (p) => toPosix(relative(projectDir, p))
const boardFiles = projectFiles.filter((p) => /\.dc\.html$/i.test(p))
if (!boardFiles.length) die(`no .dc.html artboard under ${projectDir} — the canvas has no artboards, or project/ was not fully read.`)

const canvasEntryRel = (canvas.launch && canvas.launch.view === 'focused' && canvas.launch.file) || order[0] || (existsSync(join(projectDir, 'Main.dc.html')) ? 'Main.dc.html' : relOf(boardFiles[0]))
if (entryOverride && !existsSync(join(projectDir, entryOverride))) die(`--entry "${entryOverride}" is not a file under ${projectDir}. Boards on disk:\n  ${boardFiles.map(relOf).join('\n  ')}`)
const entryRel = entryOverride || canvasEntryRel
const slugOfRel = (rel) => slugify(rel.replace(/\.dc\.html$/i, ''))

// a board's group = the title1 note nearest ABOVE it whose horizontal span covers it (a title names SEVERAL artboards)
function groupOf (meta) {
  if (!meta || meta.x === undefined) return null
  let best = null
  for (const n of title1Notes) {
    if (n.y > meta.y) continue
    if (meta.x < n.x - 1 || (n.maxW && meta.x > n.x + n.maxW)) continue
    if (!best || n.y > best.y) best = n
  }
  return best ? best.text : null
}

// ─────────────────────────────────────────────────────────── 2. read every artboard (+ support files)
rmSync(outDir, { recursive: true, force: true })
for (const d of ['source', 'source/support', 'assets/img', 'assets/media', 'assets/fonts', 'design-system']) mkdirSync(join(outDir, d), { recursive: true })
const write = (rel, content) => { writeFileSync(join(outDir, rel), content, 'utf8'); return rel }
const writeJson = (name, obj) => writeFileSync(join(outDir, name), JSON.stringify(obj, null, 2), 'utf8')

const blobFiles = new Map()   // id → absolute path of the saved asset (`<id>.<ext>`)
for (const e of readdirSync(blobDir, { withFileTypes: true })) {
  const m = e.isFile() && e.name.match(/^([0-9a-f]{32})\.([a-z0-9]+)$/i)
  if (m) blobFiles.set(m[1].toLowerCase(), join(blobDir, e.name))
}
const blobUse = new Map()     // id → Set(usedAs)
const noteBlob = (id, usedAs) => { if (!blobUse.has(id)) blobUse.set(id, new Set()); blobUse.get(id).add(usedAs) }

// Inline every stylesheet an artboard links — a project file OR an uploaded `/_blob/<id>` — as a <style> block, so the
// token/font scanners see the CSS. Measured: one canvas keeps its whole stylesheet (63 KB, every token) in a blob linked
// from <head>; without this it extracted as "no CSS, no breakpoints, 4 colours". A font provider's sheet stays a <link>.
function inlineStylesheets (html, fileDir) {
  return html.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, (tag) => {
    const href = (tag.match(/href=["']([^"']+)["']/i) || [])[1]
    if (!href || /^(https?:|\/\/|data:)/i.test(href)) return tag
    const bm = href.match(BLOB_RE)
    let p
    if (bm) { const id = bm[1].toLowerCase(); noteBlob(id, 'stylesheet'); p = blobFiles.get(id) } else p = resolve(fileDir, href.replace(/[?#].*$/, ''))
    if (!p || !existsSync(p)) return tag
    try { return `<style data-inlined-from="${href}">\n${readText(p)}\n</style>` } catch { return tag }
  })
}
const inlineAcc = { images: [], bySha: new Map() }
const readDoc = (file) => extractDataUriImages(inlineStylesheets(readText(file), dirname(file)), inlineAcc)

// Split one artboard into helmet / x-dc markup / logic — the three files the agents read.
function parseDcDoc (docStr, slug) {
  const helmet = [...docStr.matchAll(/<helmet>([\s\S]*?)<\/helmet>/gi)].map((m) => m[1]).join('\n')
  const logic = [...docStr.matchAll(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n\n')
  const propsAttr = (docStr.match(/<script[^>]*data-dc-script[^>]*\sdata-props='([^']*)'/) || docStr.match(/<script[^>]*data-dc-script[^>]*\sdata-props="([^"]*)"/) || [])[1] || null
  let dataProps = null
  if (propsAttr) { try { dataProps = JSON.parse(propsAttr.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')) } catch { dataProps = null } }
  let markup = ''
  const xi = docStr.indexOf('<x-dc')
  if (xi >= 0) {
    const openEnd = docStr.indexOf('>', xi) + 1
    const xend = docStr.indexOf('</x-dc>', openEnd)
    markup = docStr.slice(openEnd, xend > 0 ? xend : docStr.length)
  } else {
    const b = docStr.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    markup = b ? b[1] : docStr
  }
  markup = markup.replace(/<helmet>[\s\S]*?<\/helmet>/gi, '').replace(/<script[^>]*data-dc-script[^>]*>[\s\S]*?<\/script>/g, '').trim()
  // the <head> stylesheets inlined above sit OUTSIDE <x-dc>; lift them into the helmet file so the CSS reaches disk once
  const headStyles = [...docStr.matchAll(/<style data-inlined-from="[^"]*">[\s\S]*?<\/style>/gi)].map((m) => m[0]).join('\n')
  const css = [headStyles, helmet].filter((s) => s.trim()).join('\n')
  const markupFile = write(`source/${slug}.markup.html`, markup)
  const logicFile = write(`source/${slug}.logic.js`, logic)
  const helmetFile = css.trim() ? write(`source/${slug}.helmet.css`, css) : null
  const pageVals = uniq([...docStr.matchAll(/(?:page:\s*|page\s*===\s*|go\(\s*)['"]([a-zA-Z0-9_-]+)['"]/g)].map((m) => m[1]))
  const imports = uniq([...docStr.matchAll(/<dc-import\s+name="([^"]+)"/g)].map((m) => m[1]))
  const dcHrefs = uniq([...docStr.matchAll(/href="([^"]*\.dc\.html)(?:[?#][^"]*)?"/gi)].map((m) => m[1]).filter((h) => !/^[a-z]+:\/\//i.test(h)))
  // runtime code the board loads besides its logic: dynamic imports, <script src>, workers — a three.js module on one canvas
  const moduleRefs = uniq([
    ...[...docStr.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]),
    ...[...docStr.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]),
    ...[...docStr.matchAll(/new\s+Worker\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]),
  ].filter((r) => !/support\.js$/.test(r) && !/^(https?:)?\/\//i.test(r)))
  const cssOnly = css.replace(/<\/?style[^>]*>/gi, '')
  return { slug, markupFile, logicFile, helmetFile, helmet: cssOnly, markup, logic, docStr, dataProps, pageVals, imports, dcHrefs, moduleRefs, isDc: xi >= 0, bytes: markup.length + logic.length }
}

const docs = []
for (const file of boardFiles) {
  const rel = relOf(file)
  const meta = boardsMeta[rel] || null
  const d = parseDcDoc(readDoc(file), slugOfRel(rel))
  const preview = d.dataProps && d.dataProps.$preview ? d.dataProps.$preview : null
  docs.push({
    ...d, rel, file,
    title: (meta && meta.title) || null,
    w: (meta && meta.w) || (preview && preview.width) || null,
    h: (meta && meta.h) || (preview && preview.height) || null,
    expand: (meta && meta.expand) || null,
    isInteractive: !!(meta && meta.is_interactive),
    page: (meta && meta.page) || null,
    unlisted: !meta,
    group: groupOf(meta),
    orderIndex: order.indexOf(rel),
    entry: rel === entryRel,
    fileBytes: statSync(file).size,
  })
}
docs.sort((a, b) => (a.orderIndex < 0 ? 1e9 : a.orderIndex) - (b.orderIndex < 0 ? 1e9 : b.orderIndex))
if (!docs.some((d) => d.entry)) console.warn(`[unpack] warn: entry "${entryRel}" (canvas launch/order) is not an artboard on disk — no board marked entry`)

// Support files the artboards link relatively (`<script src="./gx-jobs.js">`): copied as-is so the screen agent can read
// the data arrays they hold. `support.js` is the editor runtime — never shipped, never read.
const supportFiles = []
for (const p of projectFiles) {
  const rel = relOf(p)
  if (/\.dc\.html$/i.test(p) || rel === 'canvas.json' || rel === 'support.js') continue
  if (/\.(js|mjs|css|json|txt|md)$/i.test(p)) {
    const out = `source/support/${rel.replace(/\//g, '__')}`
    writeFileSync(join(outDir, out), extractDataUriImages(readText(p), inlineAcc), 'utf8')
    supportFiles.push({ rel, file: out, kind: 'support', importedBy: [], externalImports: [] })
  }
}

// ─────────────────────────────────────────────────────────── 3. link graph, kinds, scope, navModel
const bySlug = Object.fromEntries(docs.map((d) => [d.slug, d]))
const resolveHref = (fromRel, href) => {
  const clean = href.replace(/[?#].*$/, '')
  return clean.startsWith('/') ? clean.slice(1) : posix.normalize(posix.join(posix.dirname(fromRel), clean))
}
const brokenLinks = []
for (const d of docs) {
  d.linksTo = []
  for (const h of d.dcHrefs) {
    const t = slugOfRel(resolveHref(d.rel, h))
    if (bySlug[t]) { if (t !== d.slug) d.linksTo.push(t) } else brokenLinks.push({ from: d.slug, href: h })
  }
  d.linksTo = uniq(d.linksTo)
  d.importedFiles = d.imports.map((name) => ({ name, slug: slugOfRel(posix.join(posix.dirname(d.rel), `${name}.dc.html`)) }))
}
const inDegree = Object.fromEntries(docs.map((d) => [d.slug, 0]))
const importedBy = {}
for (const d of docs) {
  for (const t of d.linksTo) inDegree[t]++
  for (const { slug } of d.importedFiles) { if (bySlug[slug]) (importedBy[slug] ||= []).push(d.slug) }
}
for (const d of docs) { d.inDegree = inDegree[d.slug]; d.importedBy = uniq(importedBy[d.slug] || []); d.kind = d.importedBy.length ? 'component' : 'page' }
const missingImports = uniq(docs.flatMap((d) => d.importedFiles.filter(({ slug }) => !bySlug[slug]).map(({ name }) => name)))

if (brokenLinks.length && !allowBrokenLinks && !planOnly) {
  die(`BROKEN LINKS — ${brokenLinks.length} link(s) point at a .dc.html that is not on the canvas:\n` +
    brokenLinks.map((b) => `  - ${b.from} → ${b.href}`).join('\n') +
    `\n  Every artboard of the canvas is on disk, so these are dead links in the design itself (a deleted or renamed artboard) —\n` +
    `  OR project/ was not fully read. Check the Step 0 download first; then fix the canvas, or re-run with --allow-broken-links\n` +
    `  to import as-is (those links stay dead ends).`)
}

// Scope: with --entry the deliverable is usually ONE cluster of an exploration canvas — everything the entry reaches by
// links or <dc-import>. Measured: a 22-board canvas where the entry reached 2 boards and 20 of 160 blobs; a whole-canvas
// inventory made the parent grep the two boards by hand for colours, sizes and assets.
const entryDoc0 = docs.find((d) => d.entry) || docs[0]
const reachable = new Set()
if (scope === 'entry' && entryDoc0) {
  const queue = [entryDoc0.slug]
  while (queue.length) {
    const s = queue.shift()
    if (reachable.has(s) || !bySlug[s]) continue
    reachable.add(s)
    queue.push(...bySlug[s].linksTo, ...bySlug[s].importedFiles.map((x) => x.slug))
  }
}
const inScope = (d) => scope === 'all' || reachable.has(d.slug)
const scopedDocs = docs.filter(inScope)
const outOfScope = docs.filter((d) => !inScope(d))
const pageDocs = scopedDocs.filter((d) => d.kind === 'page')
const navModel = pageDocs.length > 1 ? 'multi-page' : 'single-page-sections'
const entryDoc = scopedDocs.find((d) => d.entry) || pageDocs[0] || scopedDocs[0]
// ORPHAN ENTRY: first-in-order is a convention, not a guarantee of the home. Fire only on a true orphan next to a real
// navigation hub (≥2 in-links), so a hub-and-spoke landing (home in-degree 0) never trips it.
let entryLinkage = null
if (navModel === 'multi-page' && entryDoc) {
  const others = pageDocs.filter((d) => d.slug !== entryDoc.slug).map((d) => d.inDegree)
  const maxOther = others.length ? Math.max(...others) : 0
  if (entryDoc.inDegree === 0 && maxOther >= 2) entryLinkage = { entry: entryDoc.slug, inDegree, maxOther, hubs: pageDocs.filter((d) => d.inDegree === maxOther).map((d) => d.slug) }
}
// a cluster the entry does not reach but that is itself a hub is a second deliverable candidate the brief may have missed
const outOfScopeHubs = outOfScope.filter((d) => d.kind === 'page' && d.inDegree >= 3)

let screens
if (navModel === 'multi-page') {
  screens = pageDocs.map((d) => ({ key: d.slug, component: d.slug, role: 'page', file: d.markupFile, entry: d.entry, title: d.title, group: d.group, w: d.w, h: d.h, expand: d.expand, isInteractive: d.isInteractive, inDegree: d.inDegree, canvasPage: d.page }))
} else {
  const d = entryDoc
  const sections = d.pageVals.length ? d.pageVals : ['main']
  screens = sections.map((s) => ({ key: s, component: d.slug, role: 'section', file: d.markupFile, section: true, title: d.title, w: d.w, h: d.h, expand: d.expand }))
}
const components = [
  ...scopedDocs.filter((d) => d.kind === 'component').map((d) => ({ name: basename(d.rel).replace(/\.dc\.html$/i, ''), slug: d.slug, file: d.markupFile, logic: d.logicFile, kind: 'dc-import', importedBy: d.importedBy, w: d.w, h: d.h, title: d.title, group: d.group })),
  ...missingImports.map((name) => ({ name, slug: null, file: null, kind: 'dc-import', importedBy: [], missing: true })),
]

// ─────────────────────────────────────────────────────────── 4. assets (scoped)
// Runtime modules the boards load: a blob is copied to source/support/<name>.js (named from its header comment), a project
// file is already there. Each gets `kind: module`, who imports it, and what it pulls from a CDN (`three@0.184.0`).
const moduleBySrc = new Map()
const modulesMissing = []
for (const d of scopedDocs) {
  for (const ref of d.moduleRefs) {
    const bm = ref.match(BLOB_RE)
    let p, srcRef = ref
    if (bm) { const id = bm[1].toLowerCase(); srcRef = `/_blob/${id}`; noteBlob(id, 'module'); p = blobFiles.get(id); if (!p) { modulesMissing.push({ id, ref: srcRef, usedAs: 'module', alt: d.slug }); continue } } else { p = resolve(projectDir, ref.replace(/[?#].*$/, '').replace(/^\//, '')); if (!existsSync(p)) continue; srcRef = relOf(p) }
    let rec = moduleBySrc.get(srcRef)
    if (!rec) {
      rec = supportFiles.find((s) => s.rel === srcRef)
      if (!rec) {
        const text = readText(p)
        const headerName = (text.match(/^\s*(?:\/\/|\/\*\*?)\s*([A-Za-z][\w.-]{1,40}\.m?js)\b/) || [])[1] || (text.match(/^\s*(?:\/\/|\/\*\*?)\s*([A-Za-z][\w -]{2,40}?)\s*(?:\*\/|$)/m) || [])[1]
        const name = `${slugify(headerName || `${d.slug}-module-${srcRef.slice(7, 15)}`)}.js`
        const out = `source/support/${name}`
        writeFileSync(join(outDir, out), text, 'utf8')
        rec = { rel: srcRef, file: out, kind: 'module', importedBy: [], externalImports: [] }
        supportFiles.push(rec)
      }
      rec.kind = 'module'
      const text = readText(join(outDir, rec.file))
      rec.externalImports = uniq([...text.matchAll(/(?:from|import\()\s*['"]((?:https?:)?\/\/[^'"]+)['"]/g)].map((m) => m[1]))
      moduleBySrc.set(srcRef, rec)
    }
    if (!rec.importedBy.includes(d.slug)) rec.importedBy.push(d.slug)
  }
}
const moduleFiles = supportFiles.filter((s) => s.kind === 'module')
const scanSources = [...scopedDocs.map((d) => d.docStr), ...supportFiles.map((s) => readText(join(outDir, s.file)))]
// Every ref an artboard makes to a file: `/_blob/<id>`, a relative project path, or a bare string literal in the logic/data
// (`{ img: 'assets/x.jpg' }` rendered through `src="{{ item.img }}"`). The literal scan is broad on purpose; the on-disk
// gate below drops anything that is not a real file.
const fileRefs = new Map()   // ref (as written) → { attr: seen in markup, alt, boards, tag }
const noteRef = (ref, attr, alt, board, tag) => {
  if (/^(https?:|data:|#|mailto:|tel:)/i.test(ref) || ref.startsWith('inline/')) return
  const e = fileRefs.get(ref) || { attr: false, alt: null, boards: new Set(), tag: null }
  e.attr = e.attr || attr
  if (!e.alt && alt) e.alt = alt
  if (board) e.boards.add(board)
  if (!e.tag && tag) e.tag = tag
  fileRefs.set(ref, e)
}
const scanRefs = (src, board) => {
  for (const tag of imgTags(src)) {
    const s = attrOf(tag, 'src'), alt = attrOf(tag, 'alt')
    if (s) noteRef(s, true, alt, board)
    for (const m of (attrOf(tag, 'srcset') || '').split(',')) { const u = m.trim().split(/\s+/)[0]; if (u) noteRef(u, true, alt, board) }
  }
  for (const name of ['video', 'audio', 'source']) for (const tag of tagsOf(src, name)) { const s = attrOf(tag, 'src'); if (s) noteRef(s, true, null, board, name === 'source' ? null : tag); const po = attrOf(tag, 'poster'); if (po) noteRef(po, true, null, board) }
  for (const m of src.matchAll(/url\(\s*['"]?([^'")]+?)['"]?\s*\)/gi)) noteRef(m[1], true, null, board)
  for (const m of src.matchAll(/['"]((?:\.{0,2}\/)?[\w./-]+\.(?:png|jpe?g|webp|gif|svg|avif|mp4|webm|mov|mp3|ogg))['"]/gi)) noteRef(m[1], false, null, board)
  for (const m of src.matchAll(/['"](\/_blob\/[0-9a-f]{32})['"]/gi)) noteRef(m[1], false, null, board)
}
for (const d of scopedDocs) scanRefs(d.docStr, d.slug)
for (const s of supportFiles) scanRefs(readText(join(outDir, s.file)), null)
// a <source> inside <video> carries the src; the <video> tag carries the playback attrs — pair them by proximity
const videoTags = scopedDocs.flatMap((d) => [...d.docStr.matchAll(/<video\b[^>]*>[\s\S]*?<\/video>|<video\b[^>]*\/?>/gi)].map((m) => m[0]))
const images = []
const media = []
const fonts = []
const otherBlobs = []
const missingAssets = [...modulesMissing]
const seenPath = new Set()
for (const [ref, info] of fileRefs) {
  const bm = ref.match(BLOB_RE)
  let p, srcRef = ref
  if (bm) {
    const id = bm[1].toLowerCase()
    srcRef = `/_blob/${id}`
    p = blobFiles.get(id)
    if (!p) { if (!blobUse.has(id)) missingAssets.push({ id, ref: srcRef, usedAs: info.attr ? 'markup' : 'literal', alt: info.alt, boards: [...info.boards] }); continue }
    noteBlob(id, 'asset')
  } else {
    p = resolve(projectDir, ref.replace(/[?#].*$/, '').replace(/^\//, ''))
    if (!existsSync(p) || !statSync(p).isFile()) continue
    srcRef = relOf(p)
  }
  if (seenPath.has(p)) continue
  seenPath.add(p)
  const ext = extOf(p)
  const boards = [...info.boards]
  if (IMAGE_EXT.has(ext)) images.push({ srcPath: p, ref, srcRef, mime: EXT_MIME[ext], alt: info.alt, dataDriven: !info.attr, blob: !!bm, boards })
  else if (MEDIA_EXT.has(ext)) {
    const tag = videoTags.find((t) => t.includes(ref) || t.includes(srcRef)) || info.tag || ''
    media.push({ srcPath: p, srcRef, mime: EXT_MIME[ext], bytes: statSync(p).size, boards, attrs: { autoplay: hasAttr(tag, 'autoplay'), muted: hasAttr(tag, 'muted'), loop: hasAttr(tag, 'loop'), playsinline: hasAttr(tag, 'playsinline'), controls: hasAttr(tag, 'controls'), poster: attrOf(tag, 'poster') || null } })
  } else if (FONT_EXT.has(ext)) fonts.push({ srcPath: p, srcRef, ext })
  else if (!/\.(css|js|mjs)$/i.test(p)) otherBlobs.push({ srcRef, mime: EXT_MIME[ext] || 'application/octet-stream', boards })
}
for (const [id, uses] of blobUse) if (uses.has('stylesheet') && !blobFiles.has(id)) missingAssets.push({ id, ref: `/_blob/${id}`, usedAs: 'stylesheet', alt: null, boards: [] })
const missingList = missingAssets.filter((m, i) => missingAssets.findIndex((o) => o.ref === m.ref) === i)

// ── --plan: stop here and hand Step 0a the exact asset list ──────────────────
if (planOnly) {
  const needed = uniq([...fileRefs.keys(), ...scopedDocs.flatMap((d) => d.moduleRefs), ...[...blobUse.keys()].map((id) => `/_blob/${id}`)]
    .map((r) => (r.match(BLOB_RE) || [])[1]).filter(Boolean).map((id) => id.toLowerCase()))
  const plan = {
    entry: entryDoc ? entryDoc.rel : null, scope, boards: scopedDocs.map((d) => ({ rel: d.rel, slug: d.slug, kind: d.kind })),
    outOfScope: outOfScope.map((d) => ({ rel: d.rel, kind: d.kind, inDegree: d.inDegree, bytes: d.fileBytes })),
    blobs: needed.map((id) => ({ id, saved: blobFiles.has(id), usedAs: [...(blobUse.get(id) || [])].join(',') || (fileRefs.has(`/_blob/${id}`) ? 'asset' : 'ref') })),
    brokenLinks,
  }
  writeJson('plan.json', plan)
  console.log(`[unpack] plan: entry=${plan.entry} scope=${scope} boards=${scopedDocs.length}/${docs.length} blobs=${needed.length} (${plan.blobs.filter((b) => !b.saved).length} not yet saved)`)
  console.log(needed.filter((id) => !blobFiles.has(id)).join('\n'))
  process.exit(0)
}

// name: the parent still decides; this is the best on-disk default (alt → basename → blob-id8)
const used = {}
const uniqueName = (base) => { if (used[base]) base = `${base}-${used[base]++}`; else used[base] = 1; return base }
for (const im of mergeImages(images, inlineAcc.images)) {
  const ext = im.inline ? extOf(im.ref) : extOf(im.srcPath)
  const base = uniqueName(im.inline ? slugify(basename(im.ref).replace(/\.[^.]+$/, '')) : (im.alt && slugify(im.alt).slice(0, 48)) || (im.blob ? `blob-${im.srcRef.slice(7, 15)}` : slugify(basename(im.srcPath).replace(/\.[^.]+$/, ''))))
  const rel = `assets/img/${base}.${ext}`
  try { writeFileSync(join(outDir, rel), im.dataBuf || readFileSync(im.srcPath)) } catch (e) { console.warn(`[unpack] warn: image ${im.srcRef || im.ref}: ${e.message}`); continue }
  if (im.inline) images.push({ file: rel, srcRef: im.ref, mime: im.mime, alt: null, dataDriven: false, inline: true, blob: false, boards: [] })
  else im.file = rel
}
for (const m of media) { const rel = `assets/media/${uniqueName(m.blob ? `media-${m.srcRef.slice(7, 15)}` : slugify(basename(m.srcPath).replace(/\.[^.]+$/, '')))}.${extOf(m.srcPath)}`; try { copyFileSync(m.srcPath, join(outDir, rel)); m.file = rel } catch { m.file = null } }
for (const f of fonts) { const rel = `assets/fonts/${basename(f.srcPath)}`; try { copyFileSync(f.srcPath, join(outDir, rel)); f.file = rel } catch { f.file = null } }
const remoteImages = collectRemoteImages(scanSources)

// Dimensions + alpha per image (sharp is a project dependency), and a contact sheet so the parent can NAME images that
// have no alt — measured: 18 of 18 in-scope images on one canvas were alt="", and the parent had to build the sheet by hand.
let contactSheet = null
let sharpMissing = false
try {
  const sharp = (await import('sharp')).default
  const imgs = images.filter((i) => i.file)
  const tiles = []
  for (const [i, im] of imgs.entries()) {
    try {
      const meta = await sharp(join(outDir, im.file)).metadata()
      im.width = meta.width || null; im.height = meta.height || null; im.hasAlpha = !!meta.hasAlpha; im.format = meta.format || null
      if (meta.format !== 'svg') tiles.push({ i, im })
    } catch { /* unreadable image: stays without dimensions */ }
  }
  if (tiles.length) {
    const TW = 240, TH = 180, LABEL = 34, COLS = 4
    const rows = Math.ceil(tiles.length / COLS)
    const composites = []
    for (const [n, { i, im }] of tiles.entries()) {
      const x = (n % COLS) * TW, y = Math.floor(n / COLS) * (TH + LABEL)
      const thumb = await sharp(join(outDir, im.file)).resize(TW, TH, { fit: 'contain', background: { r: 235, g: 235, b: 235 } }).jpeg({ quality: 80 }).toBuffer()
      const label = `${i + 1}. ${basename(im.file)}${im.width ? ` ${im.width}×${im.height}` : ''}${im.hasAlpha ? ' α' : ''}`.replace(/[<>&]/g, ' ')
      const svg = `<svg width="${TW}" height="${LABEL}"><rect width="${TW}" height="${LABEL}" fill="#fff"/><text x="4" y="14" font-family="sans-serif" font-size="11" fill="#111">${label.slice(0, 40)}</text><text x="4" y="28" font-family="sans-serif" font-size="10" fill="#666">${im.srcRef.slice(0, 44)}</text></svg>`
      composites.push({ input: thumb, left: x, top: y }, { input: Buffer.from(svg), left: x, top: y + TH })
    }
    contactSheet = 'assets/contact-sheet.jpg'
    await sharp({ create: { width: TW * COLS, height: rows * (TH + LABEL), channels: 3, background: '#ffffff' } }).composite(composites).jpeg({ quality: 82 }).toFile(join(outDir, contactSheet))
  }
} catch { sharpMissing = true }

// ─────────────────────────────────────────────────────────── 5. tokens, fonts, design system (scoped)
const allSrc = scanSources.join('\n')
const helmetAll = scopedDocs.map((d) => d.helmet).join('\n')
const rawScan = {
  hexColors: scanHex(allSrc),
  clusters: clusterHexes(allSrc),
  fontSizes: scanFontSizes(allSrc),
  clampFontSizes: (allSrc.match(/font-size:\s*clamp\(/g) || []).length,
  cssVars: scanCssVars(allSrc),
}
const faces = gatherFaces(allSrc)
for (const f of faces) {
  if (!f.selfHosted || !f.src) continue
  const bm = f.src.match(BLOB_RE)
  const local = bm ? blobFiles.get(bm[1].toLowerCase()) : resolve(projectDir, f.src.replace(/^\//, ''))
  const hit = local && fonts.find((x) => x.srcPath === local)
  f.file = hit ? hit.file : null
  if (bm && !blobFiles.has(bm[1].toLowerCase())) missingList.push({ id: bm[1].toLowerCase(), ref: f.src, usedAs: 'font', alt: f.family, boards: [] })
}
const headingFamily = scanHeadingFontFamily(scopedDocs.map((d) => d.markup), helmetAll)
const brandFonts = pickBrandFonts(faces, scanBodyFontFamily(helmetAll), headingFamily)
// render properties the design sets on <body> — the tokens agent copies them, or every face renders heavier than the design
const bodyRule = (helmetAll.match(/(?:^|[};>\s])body\s*\{([^}]*)\}/i) || [])[1] || ''
const bodyRender = Object.fromEntries(['-webkit-font-smoothing', '-moz-osx-font-smoothing', 'text-rendering', 'font-feature-settings', 'font-optical-sizing', 'letter-spacing', 'line-height']
  .map((p) => [p, (bodyRule.match(new RegExp(`${p.replace(/-/g, '\\-')}\\s*:\\s*([^;]+)`, 'i')) || [])[1]?.trim() || null]).filter(([, v]) => v))

// An installed design system ships STRUCTURED tokens (colors per theme, type scale, spacing, radius) — a far better source
// than the hex scan. The parent still names and the agent still applies policy, but the palette is not guessed.
const designSystems = []
const dsDir = join(projectDir, 'ds')
if (existsSync(dsDir)) {
  for (const e of readdirSync(dsDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue
    const tp = join(dsDir, e.name, 'tokens.json')
    if (!existsSync(tp)) continue
    try {
      const tokens = JSON.parse(readText(tp))
      const rec = (canvas.designSystems || []).find((r) => r && r.namespace === e.name) || null
      const out = `design-system/${e.name}.tokens.json`
      writeFileSync(join(outDir, out), JSON.stringify(tokens, null, 2), 'utf8')
      designSystems.push({ folder: e.name, title: (rec && rec.title) || tokens.name || e.name, artifact: (rec && rec.artifact) || null, file: out, tokens })
    } catch (err) { console.warn(`[unpack] warn: ds/${e.name}/tokens.json: ${err.message}`) }
  }
}
const tokenSource = designSystems.length ? 'design-system' : 'inline+helmet'

// target: the canvas SAYS it — a PAGE board is `expand:"fill"` (fluid web page); a phone frame is a fixed 390–430 wide board
const pageWidths = uniq(pageDocs.map((d) => d.w).filter(Boolean)).sort((a, b) => a - b)
const targetSignals = {
  expandFill: pageDocs.some((d) => d.expand === 'fill'),
  boardWidths: pageWidths,
  phoneFrame: pageWidths.length > 0 && pageWidths.every((w) => w <= 480),
  wideWidth: pageWidths.some((w) => w >= 1000),
  iosChrome: /IOSStatusBar|safe-area-inset|home-indicator/i.test(allSrc),
}
targetSignals.guess = (targetSignals.expandFill || targetSignals.wideWidth) && !targetSignals.phoneFrame ? 'web' : targetSignals.phoneFrame ? 'mobile-app' : 'unknown'

// ─────────────────────────────────────────────────────────── 6. write the IR
const fontFamilies = uniq(faces.map((f) => f.family))
writeJson('fonts.json', { families: fontFamilies, faces, files: fonts.map((f) => ({ srcRef: f.srcRef, file: f.file })), bodyRender })
writeJson('tokens.json', { designSystems, rawScan, bodyRender })
const groups = {}
for (const d of docs) if (d.group) (groups[d.group] ||= []).push(d.slug)
const boards = docs.map((d) => ({
  slug: d.slug, rel: d.rel, file: d.markupFile, logic: d.logicFile, helmet: d.helmetFile, title: d.title, group: d.group, kind: d.kind, inScope: inScope(d),
  entry: d.entry, w: d.w, h: d.h, expand: d.expand, isInteractive: d.isInteractive, canvasPage: d.page, unlisted: d.unlisted, isDc: d.isDc,
  linksTo: d.linksTo, inDegree: d.inDegree, importedBy: d.importedBy, imports: d.imports, modules: d.moduleRefs, sections: d.pageVals, bytes: d.bytes, fileBytes: d.fileBytes,
}))
writeJson('nav-graph.json', { navModel, entry: entryDoc ? entryDoc.slug : null, scope, boards, groups, stickyNotes, pages: canvas.pages || [], entryLinkage, brokenLinks, missingImports })
writeJson('components.json', components)
const imageList = images.filter((i) => i.file).map((i) => ({ file: i.file, srcRef: i.srcRef, mime: i.mime, alt: i.alt || null, width: i.width || null, height: i.height || null, hasAlpha: i.hasAlpha ?? null, blob: !!i.blob, dataDriven: !!i.dataDriven, inline: !!i.inline, boards: i.boards || [] }))
const mediaList = media.map(({ srcPath, ...m }) => m)
const BIG_MEDIA = 5 * 1024 * 1024

const realComponents = components.filter((c) => !c.missing)
const unreferenced = pageDocs.filter((d) => !d.entry && d.inDegree === 0)
const unusedFonts = faces.filter((f) => f.used === false).map((f) => f.family)
const usageFonts = faces.filter((f) => f.fromUsage && !f.remote).map((f) => f.family)
const remoteFonts = faces.filter((f) => f.remote && f.used !== false)
const selfHosted = faces.filter((f) => f.selfHosted)
const notes = [
  `source=Design artifact canvas "${canvas.title || basename(root)}" — ${docs.length} artboard(s) on the canvas, ${scopedDocs.length} in scope (${scope}): ${pageDocs.length} page(s), ${realComponents.length} <dc-import> component(s). navModel=${navModel}, tokenSource=${tokenSource}, entry=${entryDoc ? entryDoc.slug : 'none'} (${entryOverride ? `--entry override; the canvas's own entry is ${slugOfRel(canvasEntryRel)}` : canvas.launch && canvas.launch.view === 'focused' ? 'canvas launch.file' : 'first of canvas.order'}).`,
  scope === 'entry' && outOfScope.length ? `SCOPE — ${outOfScope.length} board(s) are NOT reachable from the entry and were left out of screens/images/rawScan (${outOfScope.map((d) => `${d.slug}${d.group ? ` [${d.group}]` : ''} ${Math.round(d.fileBytes / 1024)}KB in=${d.inDegree}`).join(', ')}). Explorations and variants, usually — but Step 0.5 confirms with the user; re-run with --scope all to import everything.` : null,
  outOfScopeHubs.length ? `WARNING: ${outOfScopeHubs.length} board(s) OUTSIDE the entry's reach are navigation HUBS (${outOfScopeHubs.map((d) => `${d.slug} in=${d.inDegree} ${Math.round(d.fileBytes / 1024)}KB`).join(', ')}) — a second cluster of pages linked among themselves. The brief may have missed a deliverable: ASK the user at Step 0.5 before importing only the entry's cluster.` : null,
  Object.keys(groups).length ? `GROUPS — the canvas titles its artboards (title1 notes): ${Object.entries(groups).map(([g, s]) => `"${g}" → ${s.join(', ')}`).join(' · ')}. A group named like explorations/alternatives/backup holds variants, not routes — Step 0.5 decides per group with the user; nothing here classifies by the words.` : 'NOTE: the canvas has no title1 notes — no author grouping of the artboards; classify from links/size/title at Step 0.5.',
  stickyNotes.length ? `NOTE: ${stickyNotes.length} sticky note(s) on the canvas (nav-graph.json → stickyNotes) — the author's briefs and post-design feedback, NOT in the markup. Step 0.5 reads every one and carries actionable items into the screens' Adjustment notes.` : null,
  unreferenced.length ? `NOTE: ${unreferenced.length} page board(s) in scope are linked by NO other board and are not the entry (${unreferenced.map((d) => `${d.slug}${d.group ? ` [${d.group}]` : ''}`).join(', ')}). Each is either a page reached only from the canvas (a variant, a backup, a detail template) or a genuine orphan route — Step 0.5 decides route / skip with the user; do not scaffold them blind.` : null,
  navModel === 'single-page-sections' ? `navModel=single-page-sections — ONE page board${screens.length > 1 ? ` with sections (${screens.map((s) => s.key).join(', ')}) switched by internal state` : ''}: one route, NOT a route per section.` : `navModel=multi-page — ${pageDocs.length} page boards → ${pageDocs.length} routes (entry → "/").`,
  entryLinkage ? `WARNING: ORPHAN ENTRY — "${entryLinkage.entry}" is the entry but NO other board links to it, while ${entryLinkage.hubs.length} board(s) are linked ${entryLinkage.maxOther}× each (${entryLinkage.hubs.join(', ')}). The order on a canvas is editorial, not a route map — Step 0.5 MUST confirm the home with the user before assigning routes; a wrong entry renders, builds and passes every gate.` : null,
  brokenLinks.length ? `WARNING: ${brokenLinks.length} dead link(s) accepted via --allow-broken-links (${brokenLinks.map((b) => `${b.from} → ${b.href}`).join(', ')}) — they stay dead ends. Tell the user.` : null,
  missingImports.length ? `WARNING: <dc-import> names with no artboard on disk: ${missingImports.join(', ')} — a child the canvas does not hold (or a shared component from another artifact). components.json lists them with file=null; Step 0.5 needs a source for each or must drop them.` : null,
  missingList.length ? `WARNING: ${missingList.length} referenced asset(s) were NOT saved under ${toPosix(blobDir)} (${missingList.map((m) => `${m.ref} [${m.usedAs}${m.alt ? `: ${m.alt}` : ''}]`).join(', ')}). The Step 0 download is incomplete — read each id with the Artifact tool (path = the id) and re-run. A missing STYLESHEET blinds the token/font/breakpoint scan; a missing MODULE leaves a behaviour unported; a missing image ships the design without it, and nothing downstream notices.` : null,
  realComponents.length ? `COMPONENTS — <dc-import> children are real artboards with their own source file: ${realComponents.map((c) => `${c.name} ← ${c.file} (used by ${c.importedBy.join(', ')})`).join('; ')}. Cite that file to Step 3; they are NOT routes.` : 'NOTE: no <dc-import> children — components.json is empty; repeated inline regions ARE the components (cite file:lines at Step 0.5).',
  moduleFiles.length ? `MODULES — ${moduleFiles.length} runtime JS module(s) the boards load at runtime (${moduleFiles.map((m) => `${m.file} ← ${m.rel} (used by ${m.importedBy.join(', ')}${m.externalImports.length ? `; imports ${m.externalImports.join(', ')}` : ''})`).join('; ')}). Each must be ported as a client component (next/dynamic, ssr:false when it touches the DOM); check every external import against package.json before Step 3 — a CDN import is not a dependency.` : null,
  tokenSource === 'design-system' ? `tokenSource=design-system — the canvas installed ${designSystems.length} design system(s) (${designSystems.map((d) => `"${d.title}" → ${d.file}`).join(', ')}): STRUCTURED tokens (color.tokens with themes, type.groups[].styles, spacing, radius). Name from these first; rawScan is the cross-check for values the artboards use outside the system.` : 'tokenSource=inline+helmet — no design system installed on the canvas; tokens come from the hex/size scan of inline styles + stylesheets (tokens.json.rawScan + brandFonts).',
  rawScan.clampFontSizes ? `NOTE: ${rawScan.clampFontSizes} clamp() font-size(s) not captured in rawScan (responsive display sizes) — the screen agent reads them from source; they stay plain CSS (CONVENTIONS > Typography).` : null,
  (() => { const unseen = rawScan.clusters.filter((c) => !c.uses); return unseen.length ? `NOTE: ${unseen.length} colour cluster(s) came out uses=0 (${unseen.map((c) => c.representative).join(', ')}) — seen, but never in a role-bearing position; verify against source before discarding.` : null })(),
  `target guess=${targetSignals.guess} — from the boards themselves (expand:"fill" / widths ${pageWidths.join(', ') || 'n/a'}); parent confirms mobile-app|web at the Step 0.5 checkpoint.`,
  brandFonts ? `FONTS — body=${brandFonts.body}, display=${brandFonts.display || 'none (headings inherit the body face)'}${brandFonts.secondary.length ? `, secondary: ${brandFonts.secondary.map((s) => `${s.family} (${s.uses} use${s.uses === 1 ? '' : 's'})`).join(', ')}` : ''}. display = the face h1–h3 actually render in; a secondary face with 1–2 uses is one strip or label, not a type system — load it only if that element survives the import.` : null,
  Object.keys(bodyRender).length ? `NOTE: the design sets render properties on body (${Object.entries(bodyRender).map(([k, v]) => `${k}: ${v}`).join('; ')}) — tokens.json.bodyRender. The tokens agent copies them into general.sass or every face renders heavier than the design (measured: a Mac read the same weights as "bolder" for want of -webkit-font-smoothing).` : null,
  unusedFonts.length ? `WARNING: ${unusedFonts.join(', ')} — declared (@font-face/<link>) but NEVER referenced by any font-family rule. Dead weight; do NOT load. Excluded from brandFonts.` : null,
  !brandFonts ? 'WARNING: could not derive brandFonts — inspect source/*.helmet.css for the fonts used.' : null,
  remoteFonts.length ? `WARNING: ${remoteFonts.length} face(s) come from a NON-Google provider's stylesheet (${remoteFonts.map((f) => `${f.family} ← ${f.remote.provider} ${f.remote.cssUrl}`).join('; ')}). next/font/google does not know them and a by-name load falls back SILENTLY. Before Step 1: download the woff2 files that CSS serves (fetch it with a browser User-Agent, one url() per weight) into assets/fonts/, then pass them as loader: 'local' — or, if the provider forbids self-hosting, keep its <link> and say so.` : null,
  usageFonts.length ? `NOTE: brand font(s) ${usageFonts.join(', ')} came from font-family USAGE only (no @font-face / <link>) — probably not on Google Fonts; confirm the loader at Step 0.5.` : null,
  selfHosted.length ? `NOTE: ${selfHosted.length} SELF-HOSTED face(s) (${selfHosted.map((f) => `${f.family}${f.file ? ` → ${f.file}` : ' (file missing)'}`).join(', ')}) — uploaded font files, not Google Fonts. The tokens agent loads them with next/font/local from assets/fonts/, never next/font/google.` : null,
  brandFonts && brandFonts.families.length > 4 ? `NOTE: ${brandFonts.families.length} font families detected (${brandFonts.families.join(', ')}) — unusually many; load only what renders.` : null,
  remoteImages.length ? `WARNING: ${remoteImages.length} REMOTE image(s) referenced by URL and NOT on the canvas (${remoteImages.slice(0, 4).map((r) => r.url.replace(/^https?:\/\//, '').slice(0, 52)).join(', ')}${remoteImages.length > 4 ? ', …' : ''}). Absent from images[] — Step 0.5 MUST decide with the user: (a) download + convert, (b) keep remote (remotePatterns), (c) placeholders.` : null,
  imageList.filter((i) => i.dataDriven).length ? `NOTE: ${imageList.filter((i) => i.dataDriven).length} of ${imageList.length} image(s) are DATA-DRIVEN (a bare path literal in the logic/support data, rendered through a {{hole}}) — on disk and in images[], flagged dataDriven:true; a path assembled at runtime is still invisible.` : null,
  imageList.filter((i) => i.inline).length ? `NOTE: ${imageList.filter((i) => i.inline).length} image(s) were base64-INLINE in the source — decoded to assets/img/ and replaced in the written source by their inline/<name>.<ext> path (their srcRef).` : null,
  imageList.length && imageList.every((i) => !i.alt) ? `NOTE: none of the ${imageList.length} image(s) carries an alt — names fell back to blob ids. ${contactSheet ? `Look at ${contactSheet} (numbered thumbnails with dimensions) to name them at Step 0.5.` : 'sharp was not available, so no contact sheet was written — open the files to name them.'}` : contactSheet ? `NOTE: ${contactSheet} — numbered thumbnails of every in-scope image with dimensions and alpha (name them at Step 0.5; isLogo = flat marks with alpha).` : null,
  sharpMissing ? 'NOTE: sharp could not be loaded (run from the project root so node_modules resolves) — images[] carry no width/height/hasAlpha and no contact sheet was written.' : null,
  mediaList.length ? `MEDIA — ${mediaList.length} video/audio file(s) (inventory.media): ${mediaList.map((m) => `${m.file || m.srcRef} ${(m.bytes / 1024 / 1024).toFixed(1)}MB${m.bytes > BIG_MEDIA ? ' ⚠ over 5MB' : ''}${m.attrs.autoplay ? ' autoplay' : ''}${m.attrs.loop ? ' loop' : ''}${m.attrs.muted ? ' muted' : ''}`).join('; ')}. Step 2 copies them to public/videos/ as-is (no transcoding); anything over 5MB needs a decision (compress, poster, lazy) at Step 0.5.` : null,
  supportFiles.filter((s) => s.kind === 'support').length ? `NOTE: ${supportFiles.filter((s) => s.kind === 'support').length} support file(s) the artboards link (${supportFiles.filter((s) => s.kind === 'support').map((s) => s.rel).join(', ')}) copied to source/support/ — data arrays and shared scripts live there; included in the image + token scans.` : null,
  otherBlobs.length ? `NOTE: ${otherBlobs.length} other asset(s) referenced (${otherBlobs.map((b) => `${b.srcRef} ${b.mime}`).join(', ')}) — PDF/other; Step 0.5 decides.` : null,
  docs.some((d) => !d.isDc) ? `WARNING: ${docs.filter((d) => !d.isDc).map((d) => d.slug).join(', ')} carry no <x-dc> root — not a Design Component page; the <body> was written as the markup. Inspect before trusting.` : null,
  docs.some((d) => d.unlisted) ? `NOTE: artboard(s) on disk but absent from canvas.json boards (${docs.filter((d) => d.unlisted).map((d) => d.slug).join(', ')}) — the canvas shows them anyway (the type's rule); no title/size metadata for them.` : null,
].filter(Boolean)

const inventory = {
  source: toPosix(root), sourceMode: 'artifact', artifact: { url: artifactUrl, title: canvas.title || null, projectDir: toPosix(projectDir) },
  format: 'dclogic', navModel, scope, tokenSource, targetSignals,
  counts: { boards: docs.length, inScope: scopedDocs.length, pages: pageDocs.length, components: realComponents.length, screens: screens.length, images: imageList.length, media: mediaList.length, modules: moduleFiles.length, remoteImages: remoteImages.length, missingAssets: missingList.length, fonts: fontFamilies.length, brandFonts: brandFonts ? brandFonts.families.length : 0 },
  entry: entryDoc ? entryDoc.slug : null,
  screens,
  components,
  groups,
  outOfScope: outOfScope.map((d) => ({ slug: d.slug, title: d.title, group: d.group, kind: d.kind, inDegree: d.inDegree, fileBytes: d.fileBytes, hub: d.inDegree >= 3 })),
  brandFonts,
  fontFamilies,
  bodyRender,
  images: imageList,
  media: mediaList,
  contactSheet,
  remoteImages,
  missingAssets: missingList,
  designSystems: designSystems.map(({ tokens, ...d }) => d),
  supportFiles,
  notes,
}
writeJson('inventory.json', inventory)

console.log(`[unpack] canvas "${canvas.title || ''}" scope=${scope} navModel=${navModel} tokenSource=${tokenSource} target=${targetSignals.guess}`)
console.log(`[unpack] boards=${scopedDocs.length}/${docs.length} (pages=${pageDocs.length}, components=${realComponents.length}) screens=${screens.length} images=${imageList.length}${remoteImages.length ? `(+${remoteImages.length} remote)` : ''} media=${mediaList.length} modules=${moduleFiles.length}${missingList.length ? ` MISSING=${missingList.length}` : ''} fonts=${fontFamilies.length} (body: ${brandFonts ? brandFonts.body : 'none'}, display: ${brandFonts && brandFonts.display ? brandFonts.display : 'none'})`)
for (const n of notes.filter((n) => n.startsWith('WARNING'))) console.warn(`[unpack] ${n}`)
