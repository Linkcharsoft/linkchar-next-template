---
name: init-linkchar-cms
description: Optional module of /init-project — adds Linkchar's CMS (@linkcharsoft/cms) to the project — content schema in code, Supabase storage, an editor panel under /cms with its own Supabase auth, site readers, Draft Mode preview. The template ships no base for it - the package's `linkchar-cms init` writes the project's starting files and this agent adapts them to the template (site moved into the (site) route group, proxy composed, env constants, CSP, Amplify). Mutually exclusive with init-storyblok - it removes the template's inert Storyblok base. Runs as a step of /init-project or standalone ("run the init-linkchar-cms agent"). Validates with lint + type-check + build. Never commits.
model: sonnet
---

You are the **init-linkchar-cms** sub-agent. Unlike the other modules, the template ships **no base** for
this one (installing it would need the GitHub Packages token on every clone and in CI). The base comes from
the package: `linkchar-cms init` writes the files a project owns, and your job is to adapt them and the
template around them, following the steps below exactly. Every step was measured on a real run of the
template; do not improvise a different layout. Keep each file's own line endings (some are CRLF, some LF).

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
brand: string                  # REQUIRED — the product name: panel sidebar, sign-in, emails and page titles
language: es | en              # REQUIRED — the panel's language and the copy you write
locales: [es]                  # REQUIRED — content locales, the first is the default
cmsVersion: 0.11.0             # REQUIRED — exact version of @linkcharsoft/cms, 0.11.0 or later (a file: tarball path only for a local trial)
siteUrl: https://acme.com      # REQUIRED — the production origin
supabasePortBase: 446          # REQUIRED — three digits; local Supabase ports become {base}20…{base}29.
                               #   Must stay below 49152 (Windows reserves blocks above it) and be unique on the machine.
admin: { email, password }     # OPTIONAL — first local superadmin, created only when Docker is running
```

`basePath` is `/cms`: the template already owns `/dashboard` and its own auth. A missing REQUIRED field →
`STOP-BLOCKING / INVALID_INPUT`. The filesystem wins over the brief.

There is no color input: since 0.11.0 the panel wears Inferencia's brand in every project and a project can't
re-theme it. The project only fills the product slot, `branding.name` (`brand`) and `branding.icon` (step 10).
A brief that still carries `primaryColor` is from an older `/init-project`: ignore the field, no STOP.

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
`STORYBLOK_REGION` from the runtime allowlist and the words "nor a Storyblok management token" from the comment
above it. `grep -ri storyblok src next.config.ts amplify.yml .env.example`
must come back empty (docs are step 11). A stale `.next/types/validator.ts` naming `api/draft` is fixed by
the build, not by you.

### 2. Registry and install

- `.npmrc`: **append** `@linkcharsoft:registry=https://npm.pkg.github.com` on a line of its own (the file ends
  without a newline). It already holds `save-prefix=''` and `engine-strict=true`: never overwrite it.
- `pnpm-workspace.yaml`: add `supabase: true` under `allowBuilds` and `'@linkcharsoft/cms'` under
  `minimumReleaseAgeExclude` (pnpm holds back versions published less than a day ago).
- The GitHub Packages token is the developer's, in their user config — never in the project. Without it the
  install fails with 401: `STOP-BLOCKING / MISSING_CREDENTIAL` with the one-line fix
  (`pnpm config set //npm.pkg.github.com/:_authToken <token> --location global`, scope `read:packages`).
- `pnpm add -E @linkcharsoft/cms@{cmsVersion} @supabase/ssr @supabase/supabase-js` and `pnpm add -E -D supabase`.
  Keep `-E`: pnpm 12 ignores `save-prefix` in `.npmrc` and would write `^` ranges. `server-only`, `sass` and
  `tailwindcss@3` are already there.

### 3. Supabase project files

- `pnpm exec supabase init` when `supabase/` does not exist.
- `supabase/config.toml`: `project_id` = the package.json name; every `543xx` port, commented lines included, to
  `{supabasePortBase}xx` (`inspector_port = 8083` stays); in the `[auth]` section itself (not `[auth.email]`,
  which has its own `enable_signup`): `site_url = "http://localhost:3000"`,
  `additional_redirect_urls = ["http://localhost:3000", "http://127.0.0.1:3000"]`, **`enable_signup = false`**
  (Supabase lets anyone sign up by default, and every user gets a panel profile), `minimum_password_length = 10`,
  `password_requirements = "letters_digits"`; under `[auth.mfa.totp]`: `enroll_enabled = true`,
  `verify_enabled = true`; under `[storage.vector]`: `enabled = false` (`supabase init` turns vector buckets on,
  the CMS does not use them, and a free hosted project rejects `supabase config push` while they are on).

### 4. Run the package's init

```bash
node node_modules/@linkcharsoft/cms/cli/linkchar-cms.js init --name "{brand}" --base-path cms --locales {locales joined by ,} --panel-locale {language} --site-url {siteUrl} --src src
```

Call the CLI through `node` and pass `--base-path cms` without the slash: Git Bash rewrites a `/cms` argument
into a Windows path. It writes `cms.config.ts`, `src/cms/{schema,server,client,actions}.ts`,
`src/types/supabase.ts`, `src/app/(cms)/` (panel, generated), `src/app/(site)/[...notFound]/page.tsx`,
`src/app/api/cms/*`, the Inferencia-branded email templates, the package migrations and their pgTAP
suites (`supabase/tests/cms/`), and keeps every file that exists. Its "Left to wire by hand" list is generic and
steps 5–9 do it the template's way: where they differ, this file wins — the site URL reads `NEXT_PUBLIC_DOMAIN`
(not `NEXT_PUBLIC_SITE_URL`), the script is `check:cms` (the template's `check` is lint and types), and the proxy
is composed (step 6), not replaced, even though `routes` prints "proxy.ts does not match" at this point.

### 5. Move the site into `(site)` — `src/app/`

The panel renders its own `<html>`, so the template's root layout cannot stay at `src/app/layout.tsx`. With
`git mv`, move into `src/app/(site)/` (step 4 already created it for the catch-all): `layout.tsx`, `not-found.tsx`, `error.tsx`, `(landing-layout)/`,
`(auth-layout)/`, `dashboard/`, `sentry-example-page/`. **Stay** at `src/app/`: `global-error.tsx`, `api/`,
`robots.ts`, `sitemap.ts`, `(cms)/`. URLs do not change.

In the moved `src/app/(site)/layout.tsx`:

- `<html lang>` becomes the default locale (`{locales[0]}`), as CONVENTIONS asks of the content language;
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
- `.env.local` (gitignored, local only): append the same keys. When Docker is running,
  `pnpm exec supabase start -x studio,imgproxy,vector,logflare,edge-runtime,realtime,supavisor` and fill the three
  Supabase values from its output or `pnpm exec supabase status -o env` (`API_URL`, `PUBLISHABLE_KEY`,
  `SECRET_KEY`); its "no files matched pattern: supabase/seed.sql" warning is harmless. Without Docker, leave
  them empty for the developer.
- `amplify.yml`: before `pnpm install`, `- echo "//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}" >> ~/.npmrc`
  with a one-line comment; add `SUPABASE_SECRET_KEY|CMS_BUILD_HOOK_URL|CMS_BUILD_WEBHOOK_SECRET` to the
  runtime allowlist (Amplify gives env vars to the build, not to the SSR runtime; `NEXT_PUBLIC_*` are inlined).
- `.github/workflows/ci.yml`: the `ci` job installs the private package and builds against the project's
  Supabase. Pin `next-ci.yml` (and `dependabot-review.yml`) to `@v2.2.0` or later, and give the `ci` job:

  ```yaml
      secrets:
        PACKAGES_TOKEN: ${{ secrets.PACKAGES_TOKEN }}
      with:
        build-env: |
          NEXT_PUBLIC_SUPABASE_URL=${{ vars.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${{ vars.SUPABASE_PUBLISHABLE_KEY }}
  ```

### 10. Product icon, scripts, local database

- `cms.config.ts`: `branding: { name: '{brand}', icon: '/seo/favicon512.png' }`. `withCms` finds the favicon on
  its own only in `app/icon.*` and the root of `public/`, and the template keeps its favicons in `public/seo/`, so
  the icon goes explicit. The panel shows it on a white tile next to the product name. Write no theme file:
  `init` no longer creates `src/app/(cms)/theme.css` and the panel ignores a project `:root { --cms-* }`.
- `package.json` scripts: `"check:cms": "linkchar-cms routes --check && linkchar-cms migrations sync --check && linkchar-cms templates --check"`
  and `"db:types": "supabase gen types typescript --local > src/types/supabase.ts"` (its output replaces the
  starter `src/types/supabase.ts`; the "unformatted" notice it prints is harmless). Append
  `pnpm run check:cms || exit 1` on a line of its own to `.husky/pre-commit` (the file ends without a newline;
  the check needs no database).
- With Docker running and Supabase started (step 9): `pnpm db:types`, then, when the brief has `admin`,
  `node node_modules/@linkcharsoft/cms/cli/linkchar-cms.js admin --email … --password … --name …`, then
  `node node_modules/@linkcharsoft/cms/cli/linkchar-cms.js doctor` — report its output; it must say
  `Panel icon: /seo/favicon512.png (branding.icon)`. Without Docker, say so and leave these three for the checklist.

### 11. Docs the module owns

- `CLAUDE.md` § Project Structure: `src/cms/` (schema, server instance, generated client and actions),
  `src/app/(site)/` (the site and the template's app, one root layout) and `src/app/(cms)/` (the panel,
  generated by `linkchar-cms routes` — never edit a file that starts with its marker line).
- `CLAUDE.md` § Security: a bullet — the panel at `/cms` has its own Supabase Auth (invited users only,
  sign-ups off, MFA), independent of the template's session cookies; `SUPABASE_SECRET_KEY` is server only.
- `CLAUDE.md`: in § Optional modules keep the CMS row and drop the `init-storyblok` row; drop the `/api/draft`
  Storyblok bullet of § Security (the CMS bullet replaces it), the `constants/content/` line of § Project
  Structure, the Storyblok variables wherever Amplify is described, and point `src/app/layout.tsx` mentions at
  `src/app/(site)/layout.tsx`.
- `CONVENTIONS.md`: drop the `StoryblokBridge` reuse row; the **App root** section already covers `(site)`.
- **Leave** the template's tooling as it is even where it names Storyblok — `/init-project`, `init-storyblok.md`,
  `init-modules-shared.md`, the `storyblok.ts` comment in `eslint.config.mjs`: they describe the alternatives and
  `init-storyblok` refuses to run in a CMS project.

### 12. Validate

```bash
pnpm run lint-check --fix
pnpm run type-check
pnpm run build
```

All three, fixed before returning. Right after `/init-project`, `.env.local` has an empty `NEXT_PUBLIC_API_URL`:
supply it inline for the build per [`init-modules-shared.md` § E](../../docs/init-modules-shared.md#e-validation-gate--three-commands-always).

**The build needs a reachable Supabase.** It bakes published content in (the sitemap and every CMS page
prerender, and `withCms` reads the redirects past publishes left); publishing triggers a rebuild. Locally that
is the Supabase started in step 9; without Docker the build fails at `/sitemap.xml` with "Missing the Supabase
URL" — report it as `STOP-ADVISORY / BUILD_NEEDS_SUPABASE` with lint and type-check green, not as a failure of
yours. Lint and type-check never need it.

### 13. Do NOT commit

Return the report. The invoker commits `[ FEATURE ] Add Linkchar CMS`.

## Developer checklist you emit

In `language`, trimmed to what applies:

- **Package token** — `pnpm config set //npm.pkg.github.com/:_authToken <token> --location global` on each
  machine (scope `read:packages` on Linkcharsoft); the same token as `GITHUB_PACKAGES_TOKEN` in Amplify.
- **Local** — Docker, `pnpm exec supabase start`, `pnpm db:types`, `linkchar-cms admin`, `linkchar-cms doctor`;
  the panel at `http://localhost:3000/cms`. The welcome tour starts once per user. The template's `pre-push`
  hook builds, and the build reads Supabase: start it before pushing (or export the hosted project's
  `NEXT_PUBLIC_SUPABASE_*` in the shell, which win over `.env.local`).
- **Product icon** — the panel shows `public/seo/favicon512.png` next to the product name, and the template's
  favicons are still Inferencia's: regenerate them with the product's square icon (the brand-assets item of
  `/init-project`). The panel itself always carries Inferencia's brand.
- **Schema** — `src/cms/schema.ts` is a starter (`settings` and `home`): rewrite it with the real pages and
  collections; `/new-cms-page` adds one with its site screen. The template's demo `HomePage` does not read the
  CMS `home` yet (`MOUNT_DEFERRED`): the landing build wires it.
- **Supabase project** — created by the client (their account). `supabase db push` (from some networks only
  the pooler answers: `--db-url` with `aws-1-<region>.pooler.supabase.com:5432`, user `postgres.<ref>`); a
  `[remotes.hosted]` block in `config.toml` with the project's `project_id` and its `[remotes.hosted.auth]`
  `site_url` / `additional_redirect_urls` (the public origin); **custom SMTP (Resend) first** — a free project
  on Supabase's own email service refuses custom email templates, and invitations would never reach clients;
  then `supabase config push --project-ref <ref>` and check "Allow new users to sign up" is off. The secret key
  comes from `supabase projects api-keys --reveal` (without it the CLI prints it masked). `linkchar-cms admin`
  and `doctor` with the hosted keys (`--env-file`).
- **CI** — `PACKAGES_TOKEN` as a repository secret under both *Actions* and *Dependabot*, and the repository
  variables `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (the hosted project's public values). Until they exist
  the Build job fails at `/sitemap.xml`.
- **Amplify** — env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
  `CMS_BUILD_HOOK_URL` (the branch's incoming webhook), `CMS_BUILD_WEBHOOK_SECRET`, `GITHUB_PACKAGES_TOKEN`;
  the EventBridge rule and API destination that report each build (package README, Amplify setup).
- Full guide: <https://github.com/Linkcharsoft/linkchar-cms/blob/main/docs/deploy.md>.

## Output to parent

Per `init-modules-shared.md` § G: files created / modified / `DELETED:`, decisions (locales, panel language,
ports, panel icon), the `doctor` output when the database ran, the checklist above, any STOP, then the
footer with `model=sonnet` and the three-gate `Validation:` line.
