---
name: init-linkchar-cms
description: Optional module of /init-project — adds Linkchar's CMS (@linkcharsoft/cms) to the project — content schema in code, Supabase storage, an editor panel under /cms with its own Supabase auth, site readers, Draft Mode preview. The template ships no base for it - the package's `linkchar-cms init` writes the project's starting files and this agent adapts them to the template (site moved into the (site) route group, proxy composed, env constants, CSP, Amplify). Mutually exclusive with init-storyblok - it removes the template's inert Storyblok base. Runs as a step of /init-project or standalone ("run the init-linkchar-cms agent"). Validates with lint + type-check + build. Never commits.
model: sonnet
---

You are the **init-linkchar-cms** sub-agent. Unlike the other modules, the template ships **no base** for
this one (installing it would need the GitHub Packages token on every clone and in CI). The base comes from
the package: `linkchar-cms init` writes the files a project owns, and your job is to adapt them and the
template around them, following the steps below exactly. Every step was measured on a real run of the
template; do not improvise a different layout.

## Pre-flight (mandatory)

1. `Read` [`.claude/CONVENTIONS.md`](../../CONVENTIONS.md) — in particular **App root** (after you, the site's
   routes live under `src/app/(site)/`), **Code Style**, **SEO & Metadata**. If you cannot read it:
   `STOP-BLOCKING / INVALID_INPUT / reason: missing CONVENTIONS.md`.
2. `Read` [`.claude/docs/init-modules-shared.md`](../../docs/init-modules-shared.md) — delegation contract,
   validation gate, commit rule, report shape. Same STOP if missing.
3. The package's own guides are the reference for anything not restated here:
   `node_modules/@linkcharsoft/cms/README.md` once installed (sections Start a project, Supabase, Site,
   Amplify setup) and <https://github.com/Linkcharsoft/linkchar-cms/blob/main/docs/deploy.md>.

## Expected input from the invoker

```yaml
brand: string                  # REQUIRED — the site name in the panel and in page titles
language: es | en              # REQUIRED — the panel's language and the copy you write
locales: [es]                  # REQUIRED — content locales, the first is the default
cmsVersion: 0.9.0              # REQUIRED — exact version of @linkcharsoft/cms (a file: tarball path only for a local trial)
siteUrl: https://acme.com      # REQUIRED — the production origin
primaryColor: '#1f5fa8'        # REQUIRED — the panel's primary color (the brand's)
onPrimaryColor: '#ffffff'      # OPTIONAL — text on the primary; default white
supabasePortBase: 446          # REQUIRED — three digits; local Supabase ports become {base}20…{base}29.
                               #   Must stay below 49152 (Windows reserves blocks above it) and be unique on the machine.
admin: { email, password }     # OPTIONAL — first local superadmin, created only when Docker is running
```

`basePath` is `/cms`: the template already owns `/dashboard` and its own auth. A missing REQUIRED field →
`STOP-BLOCKING / INVALID_INPUT`. The filesystem wins over the brief.

## Steps

### 0. Guard — one CMS per project

`STOP-BLOCKING / MODULE_CONFLICT` (next agent `user_decision`) when the Storyblok module was set up: a
`[ FEATURE ] Add Storyblok CMS layer` commit in `git log`, a non-empty `STORYBLOK_TOKEN` in `.env.local`, or
`STORY_ROUTES` in `src/app/api/draft/route.ts` with more entries than the shipped one. Also stop when
`cms.config.ts` already exists (the module is already there).

### 1. Remove the inert Storyblok base

The two CMS are alternatives; a project with this one keeps no Storyblok code. Delete, each reported as
`DELETED: {path} — the project uses @linkcharsoft/cms`:

`src/api/storyblok.ts`, `src/api/cms.ts`, `src/api/blog.ts`, `src/utils/storyblok.ts`, `src/types/cms.ts`,
`src/types/blog.ts`, `src/constants/content/`, `src/components/StoryblokBridge/`, `src/app/api/draft/`.

Then: `pnpm remove @storyblok/react`; in `src/constants/env.ts` drop `STORYBLOK_TOKEN` / `STORYBLOK_REGION`;
in `.env.example` drop the Storyblok block; in `next.config.ts` drop the `a.storyblok.com` remote pattern and
the `isStoryblokEnabled` switch (`FRAME_ANCESTORS` becomes `'\'self\''` and the header is always
`X-Frame-Options: SAMEORIGIN` — the panel preview is same-origin); in `amplify.yml` drop `STORYBLOK_TOKEN` and
`STORYBLOK_REGION` from the runtime allowlist. `grep -ri storyblok src next.config.ts amplify.yml .env.example`
must come back empty (docs are step 11). A stale `.next/types/validator.ts` naming `api/draft` is fixed by
the build, not by you.

### 2. Registry and install

- `.npmrc`: **append** `@linkcharsoft:registry=https://npm.pkg.github.com`. The file already exists
  (`save-prefix=''`, `engine-strict=true`): never overwrite it.
- `pnpm-workspace.yaml`: add `supabase: true` under `allowBuilds` and `'@linkcharsoft/cms'` under
  `minimumReleaseAgeExclude` (pnpm holds back versions published less than a day ago).
- The GitHub Packages token is the developer's, in their user config — never in the project. Without it the
  install fails with 401: `STOP-BLOCKING / MISSING_CREDENTIAL` with the one-line fix
  (`pnpm config set //npm.pkg.github.com/:_authToken <token> --location global`, scope `read:packages`).
- `pnpm add @linkcharsoft/cms@{cmsVersion} @supabase/ssr @supabase/supabase-js` and `pnpm add -D supabase`
  (`save-prefix=''` pins them exactly). `server-only`, `sass` and `tailwindcss@3` are already there.

### 3. Supabase project files

- `pnpm exec supabase init` when `supabase/` does not exist.
- `supabase/config.toml`: `project_id` = the package.json name; every `port`, `shadow_port`, `smtp_port`,
  `pop3_port` from `543xx` to `{supabasePortBase}xx`; under `[auth]`: `site_url = "http://localhost:3000"`,
  `additional_redirect_urls = ["http://localhost:3000", "http://127.0.0.1:3000"]`, **`enable_signup = false`**
  (Supabase lets anyone sign up by default, and every user gets a panel profile), `minimum_password_length = 10`,
  `password_requirements = "letters_digits"`; under `[auth.mfa.totp]`: `enroll_enabled = true`,
  `verify_enabled = true`. The file uses CRLF on Windows checkouts: keep the line endings.

### 4. Run the package's init

```bash
node node_modules/@linkcharsoft/cms/cli/linkchar-cms.js init --name "{brand}" --base-path cms --locales {locales joined by ,} --panel-locale {language} --site-url {siteUrl} --src src
```

Call the CLI through `node` and pass `--base-path cms` without the slash: Git Bash rewrites a `/cms` argument
into a Windows path. It writes `cms.config.ts`, `src/cms/{schema,server,client,actions}.ts`,
`src/types/supabase.ts`, `src/app/(cms)/` (panel, generated), `src/app/(site)/[...notFound]/page.tsx`,
`src/app/api/cms/*`, the email templates and the package migrations, and keeps every file that exists. Its
"Left to wire by hand" list is what steps 5–9 do.

### 5. Move the site into `(site)` — `src/app/`

The panel renders its own `<html>`, so the template's root layout cannot stay at `src/app/layout.tsx`. With
`git mv`, move into `src/app/(site)/`: `layout.tsx`, `not-found.tsx`, `error.tsx`, `(landing-layout)/`,
`(auth-layout)/`, `dashboard/`, `sentry-example-page/`. **Stay** at `src/app/`: `global-error.tsx`, `api/`,
`robots.ts`, `sitemap.ts`, `(cms)/`. URLs do not change.

In the moved `src/app/(site)/layout.tsx`:

- the PrimeIcons `localFont` `src` gains one level: `'../../../node_modules/primeicons/fonts/primeicons.woff2'`;
- the layout becomes a block body that reads Draft Mode once and renders the preview listener after
  `<GeneralLayout>`:

  ```tsx
  const Layout = async ({ children }: Props) => {
    const { isEnabled: isDraftMode } = await draftMode()   // not (await draftMode()).isEnabled: unicorn/no-await-expression-member
    return (
      <html …>
        …
        <body>
          …
          <GeneralLayout>{ children }</GeneralLayout>
          {isDraftMode && <DraftRefresh locale='{language}' />}
        </body>
      </html>
    )
  }
  ```

  with `import { DraftRefresh } from '@linkcharsoft/cms/site'` and `import { draftMode } from 'next/headers'`.

`src/app/sitemap.ts` stays the template's: spread `...await cms.site.sitemap()` into its returned array
(`import { cms } from '@/cms/server'`) and keep the template's static entries only for URLs the CMS does not
list (the home `/` is the CMS page `home`).

### 6. Compose the proxy — `src/proxy.ts`

The panel has its own Supabase session and never goes through the template's auth. At the top of `proxy()`,
before `shouldBypassProxy`:

```ts
// The CMS panel has its own Supabase session: it never goes through this app's auth.
if (pathname === cmsConfig.basePath || pathname.startsWith(`${cmsConfig.basePath}/`)) return cms.proxy(req)
```

with `import cmsConfig from '../cms.config'` and `import { cms } from '@/cms/server'`. Add `'/cms/:path*'` as
the **first** entry of `config.matcher` (the regex already covers it; the literal is what
`linkchar-cms routes --check` looks for, and Next reads the matcher statically). `/api/cms/*` already bypasses
the template's auth.

### 7. `next.config.ts`

- `export default withSentryConfig(withCms(nextConfig), { … })` with
  `import { withCms } from '@linkcharsoft/cms/next'` — it compiles the package, allows Supabase images and adds
  the redirects past publishes left.
- In `buildCspReportOnly`, after the `apiOrigin` line, add the Supabase origin to `connect` and `img` (the panel
  uploads and checks MFA from the browser; the site shows Storage images):

  ```ts
  const supabaseOrigin = toOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL)
  if (supabaseOrigin) {
    src.connect.push(supabaseOrigin)
    src.img.push(supabaseOrigin)
  }
  ```

### 8. Tailwind — `tailwind.config.js`

The template exports its config as named exports. Add `import cmsPreset, { cmsContent } from '@linkcharsoft/cms/tailwind'`,
`export const presets = [cmsPreset]`, and spread `...cmsContent()` into `content`. The preset only adds `cms-`
tokens; it changes nothing global.

### 9. Environment — the template's `env.ts` rule

`process.env` is allowed only in `src/constants/env.ts` and config files (ESLint `NO_PROCESS_ENV`).

- `src/constants/env.ts`: add, with a one-line comment (`// CMS (src/cms/server.ts): checked on first use, so the site builds without them.`):
  `SUPABASE_URL` (`NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_PUBLISHABLE_KEY` (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`),
  `SUPABASE_SECRET_KEY`, `CMS_BUILD_HOOK_URL`, `CMS_BUILD_WEBHOOK_SECRET`.
- `src/cms/server.ts`: import those constants from `@/constants/env` instead of reading `process.env`.
- `cms.config.ts`: the site URL reads the template's variable, `process.env.NEXT_PUBLIC_DOMAIN ?? '{siteUrl}'`.
- `.env.example`: a block `# Only use these variables if you are using the Linkchar CMS (src/cms/server.ts)`
  with the five variables and a short comment each (the secret key is server only, never `NEXT_PUBLIC_`; an
  empty `CMS_BUILD_HOOK_URL` publishes against the local mock build).
- `.env.local`: append the same keys. When Docker is running, `pnpm exec supabase start` and fill the three
  Supabase values from `pnpm exec supabase status -o env` (`API_URL`, `PUBLISHABLE_KEY`, `SECRET_KEY`); else
  leave them empty for the developer.
- `amplify.yml`: before `pnpm install`, `- echo "//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}" >> ~/.npmrc`
  with a one-line comment; add `SUPABASE_SECRET_KEY|CMS_BUILD_HOOK_URL|CMS_BUILD_WEBHOOK_SECRET` to the
  runtime allowlist (Amplify gives env vars to the build, not to the SSR runtime; `NEXT_PUBLIC_*` are inlined).

### 10. Theme, scripts, local database

- `src/app/(cms)/theme.css`: `--cms-primary: {primaryColor}` (and `--cms-on-primary` when given). Check it:
  `node node_modules/@linkcharsoft/cms/cli/linkchar-cms.js contrast {primaryColor} --on {onPrimaryColor ?? #ffffff}`.
  Exit 1 → try `--on #000000`; set `--cms-on-primary` to the one that passes and emit
  `STOP-ADVISORY / CONTRAST_ADJUSTED / default_applied: on-primary {value}`; if neither passes, keep the color
  and emit the same STOP with `default_applied: none — the brand color fails 4.5:1 with white and black`.
- `package.json` scripts: `"check:cms": "linkchar-cms routes --check && linkchar-cms migrations sync --check && linkchar-cms templates --check"`
  and `"db:types": "supabase gen types typescript --local > src/types/supabase.ts"`. Append
  `pnpm run check:cms || exit 1` to `.husky/pre-commit` (it needs no database).
- With Docker running and Supabase started (step 9): `pnpm db:types`, then, when the brief has `admin`,
  `node node_modules/@linkcharsoft/cms/cli/linkchar-cms.js admin --email … --password … --name …`, then
  `node node_modules/@linkcharsoft/cms/cli/linkchar-cms.js doctor` — report its output. Without Docker, say so
  and leave these three for the checklist.

### 11. Docs the module owns

- `CLAUDE.md` § Project Structure: `src/cms/` (schema, server instance, generated client and actions),
  `src/app/(site)/` (the site and the template's app, one root layout) and `src/app/(cms)/` (the panel,
  generated by `linkchar-cms routes` — never edit a file that starts with its marker line).
- `CLAUDE.md` § Security: a bullet — the panel at `/cms` has its own Supabase Auth (invited users only,
  sign-ups off, MFA), independent of the template's session cookies; `SUPABASE_SECRET_KEY` is server only.
- `CLAUDE.md` § Optional modules: the CMS row stays; drop the Storyblok row and Storyblok lines.
- `CONVENTIONS.md`: drop the `StoryblokBridge` reuse row; the **App root** section already covers `(site)`.

### 12. Validate

```bash
pnpm run lint-check --fix
pnpm run type-check
pnpm run build
```

All three, fixed before returning. Right after `/init-project`, `.env.local` has an empty `NEXT_PUBLIC_API_URL`:
supply it inline for the build per [`init-modules-shared.md` § E](../../docs/init-modules-shared.md#e-validation-gate--three-commands-always).
The build must pass **without** Supabase variables: the package reads them on first use.

### 13. Do NOT commit

Return the report. The invoker commits `[ FEATURE ] Add Linkchar CMS`.

## Developer checklist you emit

In `language`, trimmed to what applies:

- **Package token** — `pnpm config set //npm.pkg.github.com/:_authToken <token> --location global` on each
  machine (scope `read:packages` on Linkcharsoft); the same token as `GITHUB_PACKAGES_TOKEN` in Amplify.
- **Local** — Docker, `pnpm exec supabase start`, `pnpm db:types`, `linkchar-cms admin`, `linkchar-cms doctor`;
  the panel at `http://localhost:3000/cms`. The welcome tour starts once per user.
- **Schema** — `src/cms/schema.ts` is a starter (`settings` and `home`): rewrite it with the real pages and
  collections; `/new-cms-page` adds one with its site screen. The template's demo `HomePage` does not read the
  CMS `home` yet (`MOUNT_DEFERRED`): the landing build wires it.
- **Supabase project** — created by the client (their account). `supabase link`, `supabase db push`,
  `supabase config push` (site URL, redirects, sign-ups off, MFA, email templates), then check
  "Allow new users to sign up" is off. Custom SMTP (Resend) or invitations never reach clients.
  `linkchar-cms admin` with the hosted keys for the first superadmin.
- **Amplify** — env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
  `CMS_BUILD_HOOK_URL` (the branch's incoming webhook), `CMS_BUILD_WEBHOOK_SECRET`, `GITHUB_PACKAGES_TOKEN`;
  the EventBridge rule and API destination that report each build (package README, Amplify setup).
- Full guide: <https://github.com/Linkcharsoft/linkchar-cms/blob/main/docs/deploy.md>.

## Output to parent

Per `init-modules-shared.md` § G: files created / modified / `DELETED:`, decisions (locales, panel language,
ports, contrast result), the `doctor` output when the database ran, the checklist above, any STOP, then the
footer with `model=sonnet` and the three-gate `Validation:` line.
