---
name: init-project
description: Initialize a fresh clone of the Linkchar Next template into a new product. Takes a single display name, renames every product-identity reference (package.json, app metadata, manifest, HomePage), empties not-yet-defined SEO fields, generates `.env.local` with a fresh `AUTH_SECRET`, resets the version, self-removes the bootstrap enforcement, and creates the project's first commit. Leaves company/template infrastructure (default domain, `linkchar-*` cookies, backend email, authors) untouched. Run this ONCE, before any other work on a new project — the Husky pre-commit guard and the Claude PreToolUse hook both block edits/commits until it has run.
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

## Step 0 — Guard: validate input & initialization state

First, validate the input: if `$ARGUMENTS` is empty, STOP and ask for the product display name before doing anything else.

Then `Read` `package.json` and check the `name` field.

- If `name` is **NOT** `linkchar-next-template`, the project was already initialized. **STOP** and tell the user: "This project looks already initialized (`name` is `<current>`). Re-running /init-project would overwrite product identity. Confirm explicitly if you want to proceed." Do not continue without an explicit go-ahead.
- If `name` IS `linkchar-next-template`, continue.

---

## Step 1 — Rename the package name first (this unblocks editing)

The PreToolUse hook blocks `Edit`/`Write` while `package.json` `name` is still `linkchar-next-template`. So the very first change — renaming `name` to the slug — MUST go through the **Bash tool** (which the hook doesn't intercept), with a surgical string replace that touches only that line:

```bash
node -e "const fs=require('fs');const f='package.json';fs.writeFileSync(f, fs.readFileSync(f,'utf8').replace('\"linkchar-next-template\"','\"<slug>\"'))"
```

Replace `<slug>` with the derived slug. The string `"linkchar-next-template"` appears only as the `name` value, so nothing else changes (no JSON re-serialization, no reformatting). Once `name` is the slug, the hook exits 0 and every subsequent `Edit`/`Write` is allowed normally — no marker file, no bypass needed.

**Do this before any `Edit`/`Write`.** Then `Read` `package.json` to confirm `name` is now the slug before continuing.

---

## Step 2 — Rename the rest of the product identity (Cubeta A)

`Edit`/`Write` are unblocked now. Apply `displayName` / `slug` to the remaining fields. Edit only these — leave everything else in each file intact.

**`package.json`**
- `version`: `0.11.0` (or whatever it is) → `0.1.0`  *(`name` was already done in Step 1)*

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

> Do NOT touch the Three.js shader, the "Coming Soon" text, the `logo.svg`, the "Powered by Inferencia" link, or `HomePage.sass`. The demo HomePage stays (with the new product name) until the developer manually removes it and uninstalls `three`.

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
- `public/seo/*` brand assets: not editable here (flagged as a manual TODO in Step 9).

---

## Step 5 — Generate `.env.local` (+ `AUTH_SECRET`, local domain)

- If `.env.local` already exists, do NOT overwrite it. Tell the user it exists and skip to Step 6 (still mention they may need a valid `AUTH_SECRET`).
- Otherwise, generate a 32-char secret with the Bash tool (must be exactly 32 chars — `src/utils/crypto.ts` enforces `AUTH_SECRET.length === 32`):

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

- `Read` `.env.example`, then `Write` `.env.local` with identical contents except:
  - `AUTH_SECRET=<the generated value>`
  - `NEXT_PUBLIC_DOMAIN=http://localhost:3000` — a sane local default so metadata/SEO URLs resolve in dev.

  Leave every other variable empty (the developer fills them per environment). `.env.local` is gitignored.

> **The app still won't boot until `NEXT_PUBLIC_API_URL` is set.** `src/constants/env.ts` throws `Missing environment variables` when `DOMAIN`, `API_URL`, or `APP_ENV` is absent. `APP_ENV` falls back to `NODE_ENV` and `DOMAIN` is seeded above, so `NEXT_PUBLIC_API_URL` is the one the developer MUST fill before `pnpm start` works. This is surfaced in the Step 9 checklist.

---

## Step 6 — Validate

Run and fix any errors before finishing:

```bash
pnpm run lint-check --fix
pnpm run type-check
```

---

## Step 7 — Remove the bootstrap enforcement (self-uninstall)

The init guards exist only to force THIS skill to run on a fresh clone. Now that the project is renamed they're spent, so remove them — the new product shouldn't carry template-bootstrap plumbing. The rename already turned every guard into a no-op (`name` is the slug → the hook exits 0), so removing them changes no behavior; it only cleans up. Editing these files is allowed for the same reason.

Do it in **this order**, so you never leave a hook registration pointing at a deleted file:

1. **Prune the enforcement note in `CLAUDE.md`** — delete the blockquote that begins with `> **`/init-project` is enforced on fresh clones.**` (it documents guards that are about to disappear; leaving it would be false). Remove its surrounding blank line cleanly, but keep the `/init-project` row in the skills table.
2. **Restore `.husky/pre-commit`** to its original single line (drop the whole guard block):

   ```sh
   pnpm run check || exit 1
   ```

3. **Unregister the hook in `.claude/settings.json`** — remove the `PreToolUse` matcher entry that runs `node .claude/hooks/require-init.mjs`. If `hooks` then ends up empty and the file has no other keys, delete `.claude/settings.json` entirely (the template ships it solely for this hook). If a maintainer added other settings/hooks, keep the file and remove only this entry.
4. **Delete the hook script** with the Bash tool: `rm -f .claude/hooks/require-init.mjs` (and remove `.claude/hooks/` if it's now empty).

Leave the `.gitignore` `.claude/settings.local.json` line and the eslint `.claude/` ignore — they're harmless and not worth the churn.

---

## Step 8 — Create the first project commit

Capture the initialized state as the project's first commit. By now `.husky/pre-commit` is back to its original `pnpm run check` (Step 7 dropped the guard), so committing just re-runs lint + type-check — which already passed in Step 6.

1. Confirm you're inside a git work tree: `git rev-parse --is-inside-work-tree`. If it fails (not a repo), skip this step and note it in the summary.
2. Stage everything, **including the Step 7 deletions** (`require-init.mjs`, possibly `settings.json`): `git add -A`. (`.env.local` stays out — it's gitignored.)
3. Commit with a plain, convention-matching message — single line, **NO body, NO `Co-Authored-By` / AI-attribution trailer** (use the Bash tool):

   ```bash
   git commit -m "[ CHORE ] Initialize project as <displayName>"
   ```

If the pre-commit check fails, fix the reported errors and retry — but **prefer fixing via the Bash tool here**. Step 7 already deleted `require-init.mjs`, yet this session still has the hook registered (it loaded at startup), so an `Edit`/`Write` now would make it run a missing script: `node` exits 1 (not 2), which Claude Code surfaces as a harmless warning and lets the edit through — it just adds noise. Bash edits sidestep it. Do NOT push — leave that to the developer.

---

## Step 9 — Summary + manual TODO checklist

Post a short summary of what changed (the slug/displayName used, files renamed, the generated `AUTH_SECRET` in `.env.local`, that the bootstrap enforcement was removed, and the first commit's hash), then this checklist of things the skill cannot automate:

- [ ] **Environment (blocking)**: the app will NOT start until `NEXT_PUBLIC_API_URL` is set in `.env.local` (`env.ts` throws on missing `DOMAIN`/`API_URL`/`APP_ENV`; `DOMAIN` is seeded to `localhost` and `APP_ENV` falls back to `NODE_ENV`). Fill Sentry/Clarity vars too when you wire those up.
- [ ] **Brand assets** in `public/seo/` (favicons, `social-banner.webp`, `splash.webp`) still carry Inferencia/Linkchar branding — regenerate for the new product.
- [ ] **HomePage demo**: remove the Three.js shader content (and the "Coming Soon" / "Powered by Inferencia" markup) in `src/screens/HomePage/HomePage.tsx` and run `pnpm remove three @types/three` once you build the real landing.
- [ ] **Metadata**: fill `description`, `keywords`, and the OpenGraph/Twitter descriptions once the product is defined.
- [ ] **Sentry cleanup before prod**: delete `src/app/sentry-example-page/` + `src/app/api/sentry-example-api/route.ts` and the `/sentry-example-page` line in `src/proxy.ts` (see CLAUDE.md "Cleanup before production").

---

## Notes

- This skill is **idempotent-guarded**, not idempotent: the Step 0 check prevents accidental re-runs, and Step 7 removes the enforcement so the guards never fire again in the initialized product.
- The renaming of `package.json` `name` (Step 1, via Bash) is the single mechanism that disarms both enforcement layers — the PreToolUse hook (Layer 2) and the Husky `pre-commit` guard (Layer 1) both key off that name. Step 7 then deletes them outright. Until the rename, `Read` is always allowed (it isn't in the hook matcher), so Step 0's `Read` and the pre-flight work fine.
- Template maintainers working on the template ITSELF (not a product) never run this skill; they bypass both layers by setting `LINKCHAR_TEMPLATE_DEV` in `.claude/settings.local.json` (`"env"` key) or the shell.
