#!/usr/bin/env node
/**
 * render-audit.mjs — deterministic runtime invariant sweep for the design-import flows.
 *
 * WHY THIS IS A SCRIPT AND NOT AN AGENT
 * -------------------------------------
 * Every defect this catches survives lint, type-check, `pnpm build` and every grep in
 * `design-validation` — they are only observable once a browser lays the page out. But the
 * measuring itself is arithmetic over `offsetWidth` / `offsetTop` / `getComputedStyle`, so it
 * must NOT be delegated to a model: an agent asked to "measure and report" can return ✅ without
 * having measured, and that failure is indistinguishable from a real pass. Numbers here come from
 * an artefact no model writes. Two runs of the same tree produce the same findings.
 *
 * WHAT IT DOES NOT COVER — say this out loud in any report that quotes it:
 *   · a breakpoint mapped to the wrong width, or a typeface swapped — both render coherently
 *   · a spacing loss that is not degenerate (72px shipped as 40px); only a collapse to 0 is caught
 *   · anything on a route it could not reach (see the SKIPPED list — "could not verify" ≠ "OK")
 * A green run means "0 runtime-invariant violations", never "the design was reproduced".
 *
 * USAGE
 *   node <this> --app <appDir> [--routes /,/a,/b] [--widths 1440,900,390] [--port 4123]
 *               [--base-url http://localhost:3000] [--out <dir>] [--param slug=foo] [--no-screenshots]
 *
 *   --app          app root (default: cwd). Must hold package.json + node_modules.
 *   --routes       comma list. Default: derived from src/app/ ** /page.tsx.
 *   --widths       comma list of viewport widths. Default 1440,900,390.
 *   --port         port for the server this script spawns and kills. Default 4123
 *                  (deliberately NOT 3000 — never collide with the user's own server).
 *   --base-url     reuse an already-running server instead of spawning one.
 *   --no-build     serve the existing .next instead of rebuilding. Only when you know it is current
 *                  — a stale build means auditing code that is no longer on disk.
 *   --param k=v    fill a dynamic segment ([k]) for every route that carries it. Repeatable.
 *   --out          artefact dir (JSON + screenshots). Default: <tmp>/render-audit-<appName>.
 *
 * EXIT CODES  0 = no MEASURED findings · 1 = MEASURED findings present · 2 = the audit itself failed.
 *             1 is a RESULT, not a crash. Only 2 means the sweep did not happen.
 */

import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/* ────────────────────────────── args ────────────────────────────── */

const argv = process.argv.slice(2)
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 || i === argv.length - 1 ? fallback : argv[i + 1]
}
const has = (name) => argv.includes(`--${name}`)
const list = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : null)

const APP = path.resolve(flag('app', process.cwd()))
const WIDTHS = (list(flag('widths')) || ['1440', '900', '390']).map(Number).filter((n) => n > 0)
const PORT = Number(flag('port', '4123'))
const BASE_URL = flag('base-url')
const SCREENSHOTS = !has('no-screenshots')
const SKIP_BUILD = has('no-build')
const OUT = path.resolve(flag('out', path.join(os.tmpdir(), `render-audit-${path.basename(APP)}`)))
const PARAMS = Object.fromEntries(
  argv.flatMap((a, i) => (a === '--param' && argv[i + 1] ? [argv[i + 1].split('=')] : [])),
)

/* Playwright and Next are resolved FROM THE APP, not from this script's repo — the script lives in
 * the template's .claude/ tree but audits whatever app it is pointed at. */
const appRequire = createRequire(pathToFileURL(path.join(APP, 'package.json')))

/* ────────────────────────── route discovery ────────────────────────── */

function discoverRoutes(appDir) {
  const root = path.join(appDir, 'src', 'app')
  if (!fs.existsSync(root)) return []
  const found = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === 'api') continue
        walk(p)
      } else if (e.name === 'page.tsx' || e.name === 'page.jsx') {
        const rel = path.relative(root, dir).split(path.sep).filter(Boolean)
        const segs = rel.filter((s) => !(s.startsWith('(') && s.endsWith(')'))) // route groups
        found.push('/' + segs.join('/'))
      }
    }
  }
  walk(root)
  return [...new Set(found.map((r) => (r === '/' ? '/' : r.replace(/\/$/, ''))))].sort()
}

/** Fill `[slug]` from --param; return null when we cannot, so the route is SKIPPED, not silently dropped. */
function resolveRoute(route) {
  if (!route.includes('[')) return route
  let out = route
  for (const m of route.matchAll(/\[(?:\.\.\.)?([^\]]+)\]/g)) {
    const v = PARAMS[m[1]]
    if (!v) return null
    out = out.replace(m[0], v)
  }
  return out
}

/* ────────────────────────── dev server lifecycle ────────────────────────── */
/* The script owns the server. The model never starts or kills one — that is where the zombie
 * processes came from. Spawned on a dedicated port, torn down in `finally`, tree-killed on Windows. */

let serverProc = null

async function probe(url, timeoutMs = 2000) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const r = await fetch(url, { signal: ac.signal, redirect: 'manual' })
    return r.status < 500
  } catch { return false } finally { clearTimeout(t) }
}

async function startServer() {
  if (BASE_URL) {
    if (!(await probe(BASE_URL))) throw new Error(`--base-url ${BASE_URL} is not responding`)
    return BASE_URL
  }
  const url = `http://127.0.0.1:${PORT}`
  if (await probe(url)) throw new Error(`port ${PORT} is already in use — pass --port or --base-url`)

  const nextBin = appRequire.resolve('next/dist/bin/next')

  /* PRODUCTION build, never `next dev`. Measured: under `next dev` the app does not hydrate in
   * WebKit, so every interactive probe fails for a reason that has nothing to do with the import
   * — the same build reports the menu as broken on all 10 routes in dev and healthy in prod. The
   * production bundle is also the more faithful thing to audit (real CSS, no dev overlay, no
   * dev-only scripts), and Step 6 already builds, so this costs the flow nothing new. */
  if (!SKIP_BUILD) {
    const build = spawnSync(process.execPath, [nextBin, 'build'], {
      cwd: APP, encoding: 'utf8', timeout: 900_000,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    })
    if (build.status !== 0) {
      throw new Error(`\`next build\` failed — the sweep cannot audit an app that does not build:\n${(build.stdout || '').slice(-1500)}${(build.stderr || '').slice(-1500)}`)
    }
  } else if (!fs.existsSync(path.join(APP, '.next', 'BUILD_ID'))) {
    throw new Error('--no-build was passed but there is no .next build to serve')
  }

  serverProc = spawn(process.execPath, [nextBin, 'start', '-p', String(PORT)], {
    cwd: APP,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', BROWSER: 'none' },
  })
  let log = ''
  serverProc.stdout.on('data', (d) => { log += d })
  serverProc.stderr.on('data', (d) => { log += d })

  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    if (serverProc.exitCode !== null) throw new Error(`dev server exited (${serverProc.exitCode}):\n${log.slice(-2000)}`)
    if (await probe(url)) return url
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`dev server did not become ready in 180s:\n${log.slice(-2000)}`)
}

function stopServer() {
  if (!serverProc || serverProc.exitCode !== null) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(serverProc.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    try { process.kill(serverProc.pid, 'SIGKILL') } catch { /* already gone */ }
  }
}
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stopServer(); process.exit(2) })

/* ────────────────────────── in-page collectors ──────────────────────────
 * Everything below runs inside the browser. Two rules hold throughout:
 *   1. LAYOUT metrics use offsetWidth / offsetTop / offsetHeight, never getBoundingClientRect.
 *      The screens use framer-motion `whileInView` reveals (`initial={{ y: 26 }}`); a residual
 *      transform shifts a client rect but never touches the offset box, so offsets measure the
 *      layout the CSS actually produced instead of the animation frame we happened to sample.
 *   2. Nothing is estimated. Every finding carries the two numbers it was derived from.
 */

const COLLECTOR = /* js */ `(() => {
  const cs = (el) => getComputedStyle(el)
  const px = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0 }
  const rendered = (el) => el.offsetWidth > 0 || el.offsetHeight > 0

  /* Siblings of a screen routinely share every class (three <section class="X--Light"> in a row),
   * so the ordinal is load-bearing: without it three distinct offenders collapse into one
   * indistinguishable row and the reader cannot tell which band to fix. */
  const sel = (el) => {
    if (!el || el === document.body) return 'body'
    const cls = String(el.className || '').split(/\\s+/).filter(Boolean).slice(0, 3).join('.')
    const own = el.tagName.toLowerCase() + (cls ? '.' + cls : '')
    const p = el.parentElement
    if (!p) return own
    const twins = [...p.children].filter((c) => c.tagName === el.tagName)
    const ord = twins.length > 1 ? ':nth(' + (twins.indexOf(el) + 1) + ')' : ''
    if (p === document.body) return own + ord
    const pcls = String(p.className || '').split(/\\s+/).filter(Boolean).slice(0, 2).join('.')
    return p.tagName.toLowerCase() + (pcls ? '.' + pcls : '') + ' > ' + own + ord
  }

  const contentWidth = (el) => el.clientWidth - px(cs(el).paddingLeft) - px(cs(el).paddingRight)

  const paints = (el) => {
    const s = cs(el)
    if (s.backgroundImage && s.backgroundImage !== 'none') return s.backgroundImage.slice(0, 60)
    const m = s.backgroundColor.match(/rgba?\\(([^)]+)\\)/)
    if (!m) return null
    const parts = m[1].split(',').map((x) => parseFloat(x))
    const a = parts.length > 3 ? parts[3] : 1
    return a > 0.01 ? s.backgroundColor : null
  }
  const bgBehind = (el) => {
    let a = el.parentElement
    while (a) { const b = paints(a); if (b) return b; a = a.parentElement }
    return cs(document.documentElement).backgroundColor
  }

  const F = []
  const add = (severity, check, detail) => F.push({ severity, check, ...detail })

  /* ── 1 · CONTAINER_SHRINK — container-custom that does not fill what it is allowed to ──
   * container-custom sets max-width + margin:0 auto + gutter but NOT width. A block child fills
   * its parent anyway; a FLEX item shrinks to its content, so the row stops filling its bar and a
   * space-between inside it has nothing left to distribute. Expected = min(max-width, available). */
  for (const el of document.querySelectorAll('.container-custom')) {
    if (!rendered(el)) continue
    const s = cs(el)
    if (s.display === 'none' || s.position === 'absolute' || s.position === 'fixed') continue
    const p = el.parentElement
    if (!p) continue
    const avail = contentWidth(p)
    const maxW = s.maxWidth === 'none' ? Infinity : px(s.maxWidth)
    const expected = Math.min(maxW, avail)
    const actual = el.offsetWidth
    if (expected - actual > 1) {
      add('MEASURED', 'CONTAINER_SHRINK', {
        selector: sel(el), expected: Math.round(expected), actual: Math.round(actual),
        note: 'parent display:' + cs(p).display + ' · available ' + Math.round(avail) + 'px · max-width ' + s.maxWidth,
      })
    }
  }

  /* ── 2 · BACKGROUND_CLIPPED — a painting band that stops short of its parent ──
   * container-custom caps max-width, so on the SAME element as the background it clips the paint:
   * the band reads as an inset box instead of a full-width strip. Restricted to structural elements
   * (top-level sections, header/footer, and anything carrying container-custom) so ordinary painted
   * cards and buttons — legitimately narrower than their parent — never enter the candidate set. */
  const bandCandidates = new Set()
  document.querySelectorAll('main > *, main > * > *, section, header, footer, .container-custom')
    .forEach((e) => bandCandidates.add(e))
  for (const el of bandCandidates) {
    if (!rendered(el)) continue
    const s = cs(el)
    if (s.position === 'absolute' || s.position === 'fixed' || s.display === 'inline') continue
    const bg = paints(el)
    if (!bg) continue
    const p = el.parentElement
    if (!p) continue
    const avail = contentWidth(p)
    const actual = el.offsetWidth
    if (avail - actual > 1) {
      const behind = bgBehind(el)
      add('MEASURED', 'BACKGROUND_CLIPPED', {
        selector: sel(el), expected: Math.round(avail), actual: Math.round(actual),
        note: 'paints ' + bg + ' · behind it ' + behind
          + (behind === bg ? ' · INVISIBLE TODAY (same colour behind) — still wrong, breaks the moment the page bg changes' : ' · VISIBLE'),
        invisibleToday: behind === bg,
      })
    }
  }

  /* ── 3 · HORIZONTAL_OVERFLOW — the page scrolls sideways ── */
  const de = document.documentElement
  if (de.scrollWidth - de.clientWidth > 1) {
    const offenders = []
    for (const el of document.body.querySelectorAll('*')) {
      if (!rendered(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0) continue
      if (r.right > de.clientWidth + 1 || r.left < -1) {
        let a = el.parentElement, clipped = false
        while (a) { if (cs(a).overflowX !== 'visible') { clipped = true; break } a = a.parentElement }
        if (!clipped) offenders.push(sel(el) + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + ']')
      }
    }
    add('MEASURED', 'HORIZONTAL_OVERFLOW', {
      selector: 'document', expected: de.clientWidth, actual: de.scrollWidth,
      note: offenders.slice(0, 5).join(' · ') || 'no unclipped offender isolated',
    })
  }

  /* ── 4 · FLUSH_HEADING — a heading block sitting at 0px from the block after it ──
   * SUSPECT, not MEASURED: the design may genuinely abut. It is the degenerate case of a spacing
   * value lost in translation (the only one a source-free check can see) and is also a defect in
   * its own right per CONVENTIONS' vertical-rhythm rule. Adjudicate against the source CSS rule. */
  const blocks = (parent) => [...parent.children].filter((c) => {
    const s = cs(c)
    if (s.display === 'none' || s.display === 'contents') return false
    if (s.position === 'absolute' || s.position === 'fixed') return false
    return c.offsetHeight > 0
  })
  const descend = (el) => { let cur = el; for (let i = 0; i < 4; i++) { const b = blocks(cur); if (b.length === 1) cur = b[0]; else break } return cur }
  const headingish = (el) => el.matches('h1,h2,h3,h4,h5,h6') || !!el.querySelector('h1,h2,h3,h4,h5,h6')
  const seenPairs = new Set()
  for (const sec of document.querySelectorAll('main section, main > *')) {
    const row = descend(sec)
    const b = blocks(row)
    for (let i = 0; i < b.length - 1; i++) {
      const A = b[i], B = b[i + 1]
      if (A.offsetParent !== B.offsetParent) continue
      const gap = B.offsetTop - (A.offsetTop + A.offsetHeight)
      /* Only a COLLAPSED gap counts. A large negative gap means the two are laid out side by side
       * (grid/flex columns), which is not a vertical-rhythm question at all — the first draft
       * reported a 2-column split as "-652px" and that is noise, not a finding. */
      if (gap > 0.5 || gap < -0.5) continue
      if (!headingish(A)) continue
      const key = sel(A) + '|' + sel(B)
      if (seenPairs.has(key)) continue
      seenPairs.add(key)
      add('SUSPECT', 'FLUSH_HEADING', {
        selector: sel(A), expected: '> 0px', actual: Math.round(gap) + 'px',
        note: 'followed flush by ' + sel(B) + ' — check the source rule for this block\\'s margin-bottom',
      })
    }
  }

  return F
})()`

/** Tag every anchor that carries a colour of its own; one probe per (class, own colour, parent colour),
 *  deduplicated across the whole sweep — the same component reappears on every route. */
const hoverCandidates = (alreadySeen) => /* js */ `(() => {
  const seen = new Set(${JSON.stringify(alreadySeen)})
  const sel = (el) => {
    const cls = String(el.className || '').split(/\\s+/).filter(Boolean).slice(0, 3).join('.')
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '')
  }
  const out = []
  let i = 0
  for (const a of document.querySelectorAll('a')) {
    if (!(a.offsetWidth > 0 && a.offsetHeight > 0)) continue
    const p = a.parentElement
    if (!p) continue
    const base = getComputedStyle(a).color
    const parent = getComputedStyle(p).color
    if (base === parent) continue          // no colour of its own → the global reset is a no-op here
    const key = String(a.className || '(noclass)') + '|' + base + '|' + parent
    if (seen.has(key)) continue
    seen.add(key)
    const id = 'ra' + (i++)
    a.setAttribute('data-render-audit', id)
    out.push({ id, key, selector: sel(a), base, parent })
  }
  return out
})()`

/** Strip `color` from every `a:hover` rule in the loaded stylesheets; returns how many it neutralised.
 *  This is the A/B half of the hover check — see the comment at its call site. */
const DISABLE_GLOBAL_A_HOVER_COLOR = /* js */ `(() => {
  let n = 0
  const visit = (rules) => {
    for (const r of rules) {
      /* A CSSStyleRule ALSO exposes .cssRules under CSS nesting (empty, but truthy), so an
       * \`if (r.cssRules) recurse; continue\` skips every style rule in the document. Test the
       * style rule FIRST, then recurse only into a non-empty child list. */
      if (r.selectorText && r.style && r.style.getPropertyValue('color')
          && /(^|,)\\s*a:hover\\s*(,|$)/.test(r.selectorText)) {
        r.style.removeProperty('color')
        n++
      }
      if (r.cssRules && r.cssRules.length) visit(r.cssRules)   // @media / @layer / @supports / nesting
    }
  }
  for (const ss of document.styleSheets) { try { visit(ss.cssRules) } catch { /* cross-origin */ } }
  return n
})()`

/** Trigger the on-scroll reveals and settle, so hover probes and screenshots see the real page. */
const SETTLE = /* js */ `(async () => {
  const step = Math.max(200, window.innerHeight * 0.8)
  for (let y = 0; y < document.body.scrollHeight; y += step) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)) }
  window.scrollTo(0, 0)
  try { await document.fonts.ready } catch {}
  await new Promise((r) => setTimeout(r, 400))
})()`

/* ────────────────────────── the sweep ────────────────────────── */

const findings = []
const skipped = []
const notes = []
const hoverSeen = new Set()
const push = (route, width, f) => findings.push({ route, width, ...f })

async function auditRoute(page, baseUrl, route, width, skipHover) {
  const target = resolveRoute(route)
  if (!target) {
    skipped.push({ route, width, level: 'route', reason: 'dynamic segment with no --param value — NOT verified' })
    return
  }
  let res
  try {
    res = await page.goto(baseUrl + target, { waitUntil: 'load', timeout: 120_000 })
  } catch (e) {
    skipped.push({ route, width, level: 'route', reason: `navigation failed: ${String(e).split('\n')[0]}` })
    return
  }
  const landed = new URL(page.url()).pathname
  if (landed !== target) {
    skipped.push({ route, width, level: 'route', reason: `redirected to ${landed} (route-protected?) — NOT verified` })
    return
  }
  if (res && res.status() >= 400) {
    skipped.push({ route, width, level: 'route', reason: `HTTP ${res.status()} — NOT verified` })
    return
  }

  await page.evaluate(SETTLE)

  for (const f of await page.evaluate(COLLECTOR)) push(route, width, f)

  /* ── 5 · HOVER_COLOR_INHERIT — the global `a:hover { color: unset }` trap ──
   * `a:hover` is 0,1,1 and outranks a root class's 0,1,0; `unset` on an inherited property means
   * INHERIT, so a link-rooted component that sets its own colour takes its PARENT's colour on
   * hover. The signature is exact: hoverColour === parentColour && hoverColour !== baseColour.
   * A designed hover colour also changes the colour, but lands on the design's value, not the
   * parent's — so intentional inversions (the ghost button variants) do not match. This is the
   * predicate the naive "does a &:hover exist?" check gets wrong: ObraCard already had a &:hover
   * (the image scale) while the colour bug was live. */
  if (skipHover) return  // hover is a pointer state, not a responsive one; probe it once, at the widest viewport

  const candidates = await page.evaluate(hoverCandidates([...hoverSeen]))
  const ambiguous = []
  for (const c of candidates) {
    hoverSeen.add(c.key)
    const first = await probeHoverColour(page, c, route, width)
    if (first === null) continue                 // could not hover — already recorded as SKIPPED
    if (first === c.base) continue               // colour does not move on hover
    if (first !== c.parent) {                    // moved to a value that is not the parent's → the design's own
      notes.push(`intentional hover colour · ${route} · ${c.selector}: ${c.base} → ${first}`)
      continue
    }
    ambiguous.push({ ...c, hover: first })
  }
  if (!ambiguous.length) return

  /* "Hover colour equals the parent's colour" is necessary but NOT sufficient: a footer link whose
   * design genuinely brightens `white/78` to full white lands on the parent's colour by coincidence,
   * and the first draft of this check reported it as a defect. So run the experiment instead of
   * inferring: neutralise `color` in the global `a:hover` rule and hover again.
   *   · colour MOVES once the reset is gone → the reset was producing it → defect.
   *   · colour STAYS               → an explicit `&:hover` rule produces it → intentional.
   * This is also why the predicate is not "does a `&:hover` exist?" — ObraCard already had one (the
   * image scale) while its colour bug was live. */
  const neutralised = await page.evaluate(DISABLE_GLOBAL_A_HOVER_COLOR)
  if (!neutralised) {
    for (const c of ambiguous) notes.push(`hover colour equals parent but no global a:hover colour rule exists · ${route} · ${c.selector}`)
    return
  }
  await page.mouse.move(0, 0)
  for (const c of ambiguous) {
    const second = await probeHoverColour(page, c, route, width)
    if (second === null) continue
    if (second !== c.hover) {
      push(route, width, {
        severity: 'MEASURED', check: 'HOVER_COLOR_INHERIT', selector: c.selector,
        expected: c.base, actual: c.hover,
        note: `hover took the PARENT's colour (${c.parent}); with the global a:hover colour neutralised it is ${second} instead — so the reset is what changes it. Pin the colour under &:hover.`,
      })
    } else {
      notes.push(`intentional hover colour (explicit rule, equals parent) · ${route} · ${c.selector}: ${c.base} → ${c.hover}`)
    }
  }
}

/** Move the real pointer onto the element and return its computed colour, or null if the hover did
 *  not land (fixed header covering it, off-screen, detached). A hover we could not perform is a
 *  SKIPPED, never a pass — `matches(':hover')` is what proves the probe actually happened. */
async function probeHoverColour(page, c, route, width) {
  const loc = page.locator(`[data-render-audit="${c.id}"]`)
  try {
    await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {}) // fixed chrome cannot scroll; that is fine
    /* Ask the page which point actually HITS this element rather than assuming its centre is free.
     * A fixed header sits above the page (its own links are hittable at their centre) while a card
     * under that header is not — one rule covers both, and a genuinely unreachable element returns
     * null and becomes a SKIPPED instead of a silent pass. */
    const pt = await page.evaluate((id) => {
      const el = document.querySelector(`[data-render-audit="${id}"]`)
      if (!el) return null
      const r = el.getBoundingClientRect()
      for (const fy of [0.5, 0.75, 0.25]) {
        for (const fx of [0.5, 0.25, 0.75]) {
          const x = r.left + r.width * fx
          const y = r.top + r.height * fy
          if (x < 1 || y < 1 || x > innerWidth - 1 || y > innerHeight - 1) continue
          const hit = document.elementFromPoint(x, y)
          if (hit && (hit === el || el.contains(hit))) return { x, y }
        }
      }
      return null
    }, c.id)
    if (!pt) throw new Error('no point of the element is reachable by the pointer (covered or off-screen)')
    await page.mouse.move(pt.x, pt.y)
    if (!(await loc.evaluate((e) => e.matches(':hover')))) throw new Error('pointer did not land')
    return await loc.evaluate((e) => getComputedStyle(e).color)
  } catch (e) {
    skipped.push({ route, width, level: 'element', reason: `hover probe on ${c.selector} — NOT verified: ${String(e.message || e).split('\n')[0]}` })
    return null
  }
}

/* ── 6 · MOBILE_NAV — the narrow-viewport menu actually opens ──
 * Runs on the page auditRoute already loaded and settled: a fresh `goto` + immediate click tests
 * React hydration timing, not the menu, and the first draft reported all 10 routes as broken for
 * exactly that reason. The retry below is the second guard on the same hazard. */
async function auditMobileNav(page, route, width) {
  const target = resolveRoute(route)
  if (!target) return
  try {
    const toggle = page.locator('[aria-expanded]').first()
    if (!(await toggle.count()) || !(await toggle.isVisible())) {
      skipped.push({ route, width, level: 'feature', reason: 'no [aria-expanded] toggle found at this width — mobile nav NOT verified' })
      return
    }
    const controls = await toggle.getAttribute('aria-controls')
    const isOpen = async () => (controls
      ? page.evaluate((id) => { const el = document.getElementById(id); return !!el && (el.offsetWidth > 0 || el.offsetHeight > 0) }, controls)
      : (await toggle.getAttribute('aria-expanded')) === 'true')

    let opened = false
    for (let attempt = 0; attempt < 2 && !opened; attempt++) {
      await toggle.click({ timeout: 5000 })
      for (let i = 0; i < 10 && !opened; i++) { await page.waitForTimeout(200); opened = await isOpen() }
    }
    const expanded = await toggle.getAttribute('aria-expanded')
    if (!opened) {
      push(route, width, {
        severity: 'MEASURED', check: 'MOBILE_NAV_DID_NOT_OPEN', selector: '[aria-expanded]',
        expected: 'panel rendered after click', actual: `aria-expanded=${expanded}, panel not rendered`,
        note: 'the narrow-viewport menu toggle did not reveal its panel',
      })
    }
  } catch (e) {
    skipped.push({ route, width, level: 'feature', reason: `mobile-nav probe failed: ${String(e).split('\n')[0]}` })
  }
}

/* ────────────────────────── report ────────────────────────── */

const NOT_COVERED = [
  'a breakpoint mapped to the wrong width — the page still renders coherently',
  'a typeface / weight / size swapped for a near-identical one',
  'a spacing loss that is not degenerate (72px shipped as 40px); only a collapse to 0 is visible here',
  'anything on a route listed under SKIPPED below',
]

function report(routes, baseUrl) {
  const measured = findings.filter((f) => f.severity === 'MEASURED')
  const suspect = findings.filter((f) => f.severity === 'SUSPECT')
  const L = []
  L.push('## Runtime invariant sweep (render-audit.mjs)')
  L.push('')
  L.push(`Routes: ${routes.length} · widths: ${WIDTHS.join(', ')} · engine: webkit · base: ${baseUrl}`)
  L.push(`**${measured.length} MEASURED · ${suspect.length} SUSPECT · ${skipped.length} SKIPPED**`)

  /* Coverage is stated up front, in the script, because the alternative was measured and it failed:
   * a shell mangled the "/" route, the home page was never rendered, its 3 defects went unreported,
   * and the reader of the report treated a 9-of-10 sweep as complete. A route-level miss is not a
   * detail to be found further down a SKIPPED list — it changes what the whole run means. */
  const unverified = [...new Set(skipped.filter((s) => s.level === 'route').map((s) => s.route))]
  const covered = routes.length - unverified.length
  L.push(covered === routes.length
    ? `**Coverage: ${covered}/${routes.length} routes rendered at every width.**`
    : `**⚠️ Coverage: ${covered}/${routes.length} routes. NOT rendered at all: ${unverified.map((r) => `\`${r}\``).join(', ')} — any defect on them is UNKNOWN, not absent.**`)
  L.push('')

  const table = (rows, title) => {
    if (!rows.length) { L.push(`### ${title}`, '', '✅ none', ''); return }
    L.push(`### ${title}`, '')
    L.push('| check | route | w | selector | expected | actual | detail |')
    L.push('| --- | --- | ---: | --- | --- | --- | --- |')
    for (const f of rows) {
      L.push(`| ${f.check} | ${f.route} | ${f.width} | \`${f.selector}\` | ${f.expected} | ${f.actual} | ${f.note || ''} |`)
    }
    L.push('')
  }
  table(measured, 'MEASURED — hard predicate, no judgement involved. These are defects.')
  table(suspect, 'SUSPECT — measured anomaly that may be intentional. Adjudicate against the design source.')

  L.push('### SKIPPED — could not verify. This is NOT a pass.', '')
  if (!skipped.length) L.push('_nothing skipped_', '')
  else {
    const byReason = new Map()
    for (const s of skipped) {
      const k = s.reason.replace(/\d+/g, 'N')
      byReason.set(k, (byReason.get(k) || 0) + 1)
    }
    for (const [r, n] of byReason) L.push(`- ${r}${n > 1 ? ` (×${n})` : ''}`)
    L.push('')
  }

  L.push('### Out of scope for this sweep — a green run is NOT evidence of fidelity', '')
  for (const n of NOT_COVERED) L.push(`- ${n}`)
  L.push('')
  if (notes.length) {
    L.push('<details><summary>Hover colour changes judged intentional (' + notes.length + ')</summary>', '')
    for (const n of notes.slice(0, 40)) L.push(`- ${n}`)
    L.push('', '</details>', '')
  }
  return L.join('\n')
}

/* ────────────────────────── main ────────────────────────── */

async function main() {
  if (!fs.existsSync(path.join(APP, 'package.json'))) throw new Error(`no package.json at ${APP}`)
  const routes = list(flag('routes')) || discoverRoutes(APP)
  if (!routes.length) throw new Error('no routes to audit — pass --routes')

  /* Reject a corrupted route list before anything else. Git Bash / MSYS rewrites a bare `/`
   * argument into a Windows path, so `--routes "/,/a"` silently arrives as
   * `["C:/Program Files/Git/", "/a"]` — the home page then fails to navigate and is reported as
   * one SKIPPED row among many. Measured: a real Step 6 run audited 9 of 10 routes that way and
   * read as a complete sweep. A malformed route is bad INPUT, not a page that could not be
   * reached, so it aborts the run instead of degrading it. */
  const malformed = routes.filter((r) => !r.startsWith('/') || /^\/[A-Za-z]:/.test(r) || r.includes('\\'))
  if (malformed.length) {
    throw new Error(
      `malformed route(s): ${JSON.stringify(malformed)}\n`
      + 'Every route must be a URL path starting with "/". If a bare "/" turned into a filesystem\n'
      + 'path, your shell rewrote it — run this from PowerShell, or prefix the command with\n'
      + 'MSYS_NO_PATHCONV=1 under Git Bash. Aborting: a partial sweep reads like a complete one.',
    )
  }
  fs.mkdirSync(OUT, { recursive: true })

  const { webkit } = appRequire('playwright-webkit')
  const baseUrl = await startServer()
  const browser = await webkit.launch()
  const widest = Math.max(...WIDTHS)
  const narrowest = Math.min(...WIDTHS)

  try {
    for (const width of [...WIDTHS].sort((a, b) => b - a)) {
      const ctx = await browser.newContext({
        viewport: { width, height: 900 },
        reducedMotion: 'reduce', // kill the reveal transforms at the source; offsets are transform-free anyway
        deviceScaleFactor: 1,
      })
      /* Stub third-party SCRIPTS. Two reasons, and the second is the one that bit:
       *  · a sweep that reaches the network is not reproducible — the whole point of this file;
       *  · the template loads React Scan from unpkg in dev via a `beforeInteractive` <Script>. When
       *    that request is blocked or slow the page never hydrates, and every interactive check
       *    fails for a reason that has nothing to do with the import. The first run of this script
       *    reported "mobile nav did not open" on all 10 routes for exactly that.
       * Only scripts are stubbed: images and stylesheets still load, so geometry is untouched. */
      const origin = new URL(baseUrl).origin
      await ctx.route('**/*', (route) => {
        const req = route.request()
        if (req.resourceType() === 'script' && !req.url().startsWith(origin)) {
          return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
        }
        return route.continue()
      })
      const page = await ctx.newPage()
      for (const route of routes) {
        await auditRoute(page, baseUrl, route, width, width !== widest)
        if (SCREENSHOTS && resolveRoute(route)) {
          const name = (route === '/' ? 'root' : route.replace(/[^\w-]+/g, '_').replace(/^_/, '')) + `@${width}.png`
          try { await page.screenshot({ path: path.join(OUT, name), fullPage: true }) } catch { /* non-fatal */ }
        }
        if (width === narrowest) await auditMobileNav(page, route, width)
      }
      await ctx.close()
    }
  } finally {
    await browser.close().catch(() => {})
    stopServer()
  }

  const measured = findings.filter((f) => f.severity === 'MEASURED')
  const unverified = [...new Set(skipped.filter((s) => s.level === 'route').map((s) => s.route))]
  const payload = {
    appDir: APP, baseUrl, widths: WIDTHS, routes,
    coverage: { requested: routes.length, rendered: routes.length - unverified.length, unverifiedRoutes: unverified },
    summary: { measured: measured.length, suspect: findings.length - measured.length, skipped: skipped.length },
    findings, skipped, intentionalHoverChanges: notes, notCovered: NOT_COVERED,
  }
  fs.writeFileSync(path.join(OUT, 'render-audit.json'), JSON.stringify(payload, null, 2))
  const md = report(routes, baseUrl)
  fs.writeFileSync(path.join(OUT, 'render-audit.md'), md)
  process.stdout.write(md + `\n\nArtefacts: ${OUT}\n`)
  process.exit(measured.length ? 1 : 0)
}

main().catch((e) => {
  stopServer()
  process.stderr.write(`render-audit FAILED (the sweep did not run): ${e && e.stack ? e.stack : e}\n`)
  process.exit(2)
})
