---
name: init-project
description: Initialize a fresh clone of the Linkchar Next template into a new product. Takes a single display name, renames every product-identity reference (package.json, app metadata, manifest, HomePage), empties not-yet-defined SEO fields, generates `.env.local` with a fresh `AUTH_SECRET`, and resets the version. Leaves company/template infrastructure (default domain, `linkchar-*` cookies, backend email, authors) untouched. Run this ONCE, before any other work on a new project — the Husky pre-commit guard and the Claude PreToolUse hook both block edits/commits until it has run.
---

Initialize a new product from this template. Arguments: **$ARGUMENTS**

The single argument is the **display name** of the new product (everything after the command, may contain spaces and capitalization).

Derive from it:
- `displayName` = the argument verbatim, trimmed (e.g. `Mi App`, `Acme Dashboard`). Used in UI/metadata.
- `slug` = lowercase → spaces/underscores to `-` → strip every char that isn't `[a-z0-9-]` → collapse repeated `-` → trim leading/trailing `-` (e.g. `Mi App` → `mi-app`, `Acme Dashboard!` → `acme-dashboard`). Used for `package.json` `name`. Must be a valid npm package name; if the result is empty, STOP and ask for a usable name.

---

## Pre-flight — Read CONVENTIONS.md (mandatory)

Before doing anything, `Read` [`.claude/CONVENTIONS.md`](../../CONVENTIONS.md). If you cannot read it, STOP and report `STOP-BLOCKING / category: INVALID_INPUT / reason: missing CONVENTIONS.md`.

---

## Step 0 — Guard: is it already initialized?

`Read` `package.json` and check the `name` field.

- If `name` is **NOT** `linkchar-next-template`, the project was already initialized. **STOP** and tell the user: "This project looks already initialized (`name` is `<current>`). Re-running /init-project would overwrite product identity. Confirm explicitly if you want to proceed." Do not continue without an explicit go-ahead.
- If `name` IS `linkchar-next-template`, continue.

If `$ARGUMENTS` is empty, STOP and ask for the product display name.

---

## Step 1 — Unblock edits (create the marker)

The PreToolUse hook (`.claude/hooks/require-init.mjs`) blocks `Edit`/`Write` while the project is still the raw template. To let THIS skill perform its edits, create the marker file the hook recognizes — **with the Bash tool**, never Write/Edit (a Write here would be blocked by the very hook you're unblocking):

```bash
touch .init-in-progress
```

The marker is gitignored and removed in the final step. If anything below fails, still run the cleanup in Step 7 so the marker never lingers.

---

## Step 2 — Rename product identity (Cubeta A)

Apply `displayName` / `slug` to the fields below. Edit only these — leave everything else in each file intact.

**`package.json`**
- `name`: `linkchar-next-template` → `slug`
- `version`: `0.11.0` (or whatever it is) → `0.1.0`

**`src/app/layout.tsx`** (the `metadata` / `viewport` exports)
- `applicationName` → `displayName`
- `title.default` → `displayName`
- `title.template` → `'%s | ' + displayName` (e.g. `%s | Mi App`)
- `openGraph.title` → `displayName`
- `openGraph.siteName` → `displayName`
- `openGraph.images[0].alt` → `displayName`
- `twitter.title` → `displayName`
- `twitter.images.alt` → `displayName`
- `appleWebApp.title` → `displayName`

**`public/manifest.json`**
- `name` → `displayName`
- `short_name` → `displayName`

**`src/screens/HomePage/HomePage.tsx`**
- `const PRODUCT_NAME = 'Linkchar'` → `displayName`

> Do NOT touch the Three.js shader, the "Coming Soon" text, the `logo.svg`, or `HomePage.sass`. The demo HomePage stays (with the new product name) until the developer manually removes it and uninstalls `three`.

---

## Step 3 — Empty not-yet-defined fields (Cubeta B)

These describe a product that isn't defined yet — blank them rather than carry template copy:

**`src/app/layout.tsx`**
- `description` → `''`
- `keywords` → `[]`
- `openGraph.description` → `''`
- `twitter.description` → `''`

**`public/manifest.json`**
- `description` → `''`

---

## Step 4 — Do NOT touch (Cubeta C — company/template infrastructure)

Leave these exactly as they are. They reference Linkchar-the-company / template plumbing, not the new product. Listed so you don't "helpfully" change them:

- `src/app/layout.tsx`: `metadataBase` fallback `'https://linkchar.com'`; `authors`, `creator`, `publisher`; `twitter.creator` `'@linkchar'`; `verification.other.me` (`hola@inferencia.io`, `inferencia.io`).
- `src/constants/auth.ts`: `SESSION_COOKIE_NAME` (`linkchar-session`), `LISTENER_COOKIE_NAME` (`linkchar-listener`), `AUTH_BACKEND_EMAIL_ADDRESS` (`base@linkchar.com`).
- `README.md`: untouched entirely (kept as template baseline — the developer revises it later).
- `public/seo/*` brand assets: not editable here (flagged as a manual TODO in Step 8).

---

## Step 5 — Generate `.env.local` + `AUTH_SECRET`

- If `.env.local` already exists, do NOT overwrite it. Tell the user it exists and skip to Step 6 (still mention they may need a valid `AUTH_SECRET`).
- Otherwise, generate a 32-char secret with the Bash tool (must be exactly 32 chars — `src/utils/crypto.ts` enforces `AUTH_SECRET.length === 32`):

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

- `Read` `.env.example`, then `Write` `.env.local` with identical contents except set `AUTH_SECRET=<the generated value>`. Leave every other variable empty (the developer fills them per environment). `.env.local` is gitignored.

---

## Step 6 — Validate

Run and fix any errors before finishing:

```bash
pnpm run lint-check --fix
pnpm run type-check
```

---

## Step 7 — Remove the marker (always)

Remove the marker so the hook re-arms (by now `package.json` `name` is the slug, so editing stays unblocked anyway, but don't leave the file around). Use the Bash tool:

```bash
rm -f .init-in-progress
```

---

## Step 8 — Summary + manual TODO checklist

Post a short summary of what changed (files + the slug/displayName used, the generated `AUTH_SECRET` location), then this checklist of things the skill cannot automate:

- [ ] **Brand assets** in `public/seo/` (favicons, `social-banner.webp`, `splash.webp`) still carry Inferencia/Linkchar branding — regenerate for the new product.
- [ ] **HomePage demo**: remove the Three.js shader content in `src/screens/HomePage/HomePage.tsx` and run `pnpm remove three @types/three` once you build the real landing.
- [ ] **Metadata**: fill `description`, `keywords`, and the OpenGraph/Twitter descriptions once the product is defined.
- [ ] **Environment**: complete the rest of `.env.local` (`NEXT_PUBLIC_DOMAIN`, `NEXT_PUBLIC_API_URL`, Sentry, Clarity, …).
- [ ] **Sentry cleanup before prod**: delete `src/app/sentry-example-page/` + `src/app/api/sentry-example-api/route.ts` and the `/sentry-example-page` line in `src/proxy.ts` (see CLAUDE.md "Cleanup before production").

---

## Notes

- This skill is **idempotent-guarded**, not idempotent: the Step 0 check prevents accidental re-runs after the rename.
- The renaming of `package.json` `name` is what disarms both enforcement layers (Husky `pre-commit` Layer 1 + the PreToolUse hook Layer 2). After a successful run, normal development proceeds without the marker.
- Template maintainers working on the template ITSELF (not a product) bypass both layers with `LINKCHAR_TEMPLATE_DEV=1` instead of running this skill.
