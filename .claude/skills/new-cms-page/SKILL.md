---
name: new-cms-page
description: Add a page or a collection to the Linkchar CMS of this project — the entry in src/cms/schema.ts (sections with anchors and `uses`, the SEO section the package adds) and the public site screen that renders it from cms.site (metadata, JSON-LD, images, rich text), so editors fill it from the panel at /cms and preview it. Only in a project where init-linkchar-cms ran.
---

Add CMS content to the site. Arguments: **$ARGUMENTS**

Parse the arguments:

- First word = entry id, camelCase (`servicios`, `posts`) — the key in `src/cms/schema.ts`.
- Second word = `page` (one page, its own URL) or `collection` (many documents: a listing plus a detail per slug).
- Third word = route: the page's path (`/servicios`) or the collection's listing path (`/blog`; details at `/blog/{slug}`).

Examples: `servicios page /servicios` · `posts collection /blog` · `about page /nosotros`.

---

## Step 0 — Pre-flight (mandatory)

1. `Read` [`.claude/CONVENTIONS.md`](../../CONVENTIONS.md): **App root** (routes go under `src/app/(site)/`),
   **SEO & Metadata**, **Image Performance**, **Accessibility**, **Global Container**.
2. Guard: `cms.config.ts` must exist. Without it, STOP and tell the user to run the `init-linkchar-cms` agent first.
3. `Read` `src/cms/schema.ts`, and the package guide for the field kinds and readers:
   `node_modules/@linkcharsoft/cms/README.md` (sections Configure, Field kinds, Site).

---

## Step 1 — Recon and the brief

- STOP when the id already exists in the schema, or when a `page.tsx` already answers the route under the app root.
- Gather what the entry holds before writing anything. Ask in one round (`AskUserQuestion`) when the arguments
  don't say it:
  - **page** — its sections, in order, each with its fields (`text`, `textarea`, `richText`, `image`, `link`,
    `button`, `list`…), and which sections show another entry (`uses`, e.g. a services grid uses `services`).
  - **collection** — singular label and the fields of a document (default: `title`, `slug` from title,
    `excerpt`, `cover` image, `body` rich text), and whether it is `referenceOnly` (authors, categories: no
    pages of their own).
- Labels are in the panel's language (`panelLocale` in `cms.config.ts`); the entry's texts are localized by default.

---

## Step 2 — The schema entry — `src/cms/schema.ts`

Follow the starter's style (`page`, `section`, `collection` and field helpers from `@linkcharsoft/cms/core`).

- **page**: `{id}: page('{Label}', { {section}: section('{Section label}', { …fields }, { anchor: '{section-id}', uses: [...] }) }, { path: '{route}' })`.
  - `anchor` is the `id` of that section's element on the site: the panel preview scrolls to it, and menu
    links point at it. Use kebab-case and keep it equal to the screen's `<section id>`.
  - `uses` lists the entries a section shows: the panel links to them and the sitemap dates the page by them.
  - A page with `path` gets its SEO section automatically. Do not add one.
- **collection**: `{id}: collection('{Label}', { title: text(…), slug: slug({ from: 'title', … }), …, seo: seo({ titleFrom: 'title', descriptionFrom: 'excerpt' }) }, { singularLabel: '{Singular}', titleField: 'title', slugField: 'slug', path: '{route}/:slug' })`,
  plus a **listing page** entry for `{route}` (`page`) with one section that `uses: ['{id}']` — that is what
  gives the listing its own title and SEO and moves its `lastModified` with each new document.

The panel needs no regeneration: its routes come from the config, not from the entries.

---

## Step 3 — The site screens

Create each screen with `/new-screen {Name}Page public {route}` — **one at a time** — and, for a collection,
`/new-screen {Name}PostPage public {route}/[slug]` too. `/new-screen` writes under the app root and adds the
route to `PUBLIC_PATHS` in `src/proxy.ts`. Then wire the content. **Screens never import the CMS**: each
`page.tsx` reads it and passes plain props, typed with `SiteContentOf<'{id}'>` from `@linkcharsoft/cms/site`.

- **page** — `page.tsx`:

  ```tsx
  import { JsonLd } from '@linkcharsoft/cms/site'
  import { cms } from '@/cms/server'
  import {Name}Page from '@/screens/{Name}Page/{Name}Page'

  export const generateMetadata = async () => cms.site.metadata(await cms.site.getEntryContent('{id}'))

  const Page = async () => {
    const page = await cms.site.getEntryContent('{id}')
    return (
      <>
        <JsonLd data={cms.site.jsonLd(page)} />
        <{Name}Page content={page.content} />
      </>
    )
  }

  export default Page
  ```

- **collection listing** — `cms.site.listDocuments('{id}')` for the cards (each document has `content`, `path`,
  `publishedAt`), `getEntryContent('{listing id}')` for the listing's own texts and metadata.
- **collection detail** — `generateStaticParams = () => cms.site.staticParams('{id}')`;
  `cms.site.getDocumentBySlug('{id}', slug)`, `notFound()` when null; `generateMetadata` returns
  `cms.site.metadata(document)` (or `{}` when null); `<JsonLd data={cms.site.jsonLd(document)} />`.
- In the screens: images through `next/image` with `{...imageProps(image, { sizes })}` from
  `@linkcharsoft/cms/site` (it carries alt text and the focal point); rich text through `<RichText value={…} />`;
  links and buttons already carry their resolved `href`. Every top-level section has `container-custom` and the
  `id` its `anchor` names. Hidden sections (`hideable`) come with `_hidden: true`: render nothing then.

Draft Mode needs nothing per page: the `(site)` layout renders `DraftRefresh`, and the readers return drafts to
a signed-in panel user.

---

## Step 4 — Validate

```bash
pnpm run lint-check --fix
pnpm run type-check
pnpm run build
```

Then, with the local Supabase running: open `/cms`, find the new page (or collection) in the menu, fill it,
open the preview and check that each section scrolls into view; publish and open the route.

Commit per [CLAUDE.md § Commit Flow](../../../CLAUDE.md#commit-flow): `[ FEATURE ] Add {Label} page with CMS content`
(or `… collection …`).
