---
name: datatable
description: Scaffolds a complete paginated DataTable screen — types + API client + screen with useTableParams + SearchInput + Filters + DataTable + Paginator + SASS + page wrapper. Use this instead of /new-screen whenever the requested screen is a list/table with pagination, filters, search, or sorting.
---

Scaffold a paginated DataTable screen. Arguments: **$ARGUMENTS**

Parse the arguments:
- First word = `ScreenName` — PascalCase, must end in `Page` (append `Page` if missing). Example: `UsersPage`, `InvoicesPage`.
- Second word = `resource` — kebab-case plural for API paths and file names. Example: `users`, `invoices`, `order-items`.
- Third word = `route` — URL path. If omitted, default to `/dashboard/{resource}`.
- Optional flag `columns:a,b,c` — comma-separated list of column fields. If omitted, leave 2–3 placeholder columns with `TODO` markers.
- Optional flag `filters:a,b,c` — comma-separated filter keys. If omitted, include only `search` and `ordering`.

Examples:
- `UsersPage users /dashboard/users`
- `InvoicesPage invoices /dashboard/invoices columns:id,number,total,status`
- `OrderItemsPage order-items` → route=`/dashboard/order-items`

If the user's input is ambiguous, make a reasonable default and state your assumption clearly at the start of your response. Do NOT stop and ask — scaffolding is the goal, the user can refine after.

Derive:
- `ResourceType` = PascalCase singular + `Type` (e.g. `UserType`, `OrderItemType`)
- `ResourceName` = PascalCase singular (e.g. `User`)
- `ResourcesName` = PascalCase plural (e.g. `Users`)

---

## Step 0 — Reconnaissance

Before writing anything, in parallel:

1. Read `src/screens/ExamplePage/ExamplePage.tsx` and `src/screens/ExamplePage/ExamplePage.sass` — this is your canonical reference. Every pattern you generate must match it.
2. Read `src/hooks/useTableParams.ts` — understand the `defaultParams` schema, return values, and the `sortProps` behavior.
3. Check if these files already exist (with Glob):
   - `src/types/api/{resource}.ts`
   - `src/api/{resource}.ts`
   - `src/screens/{ScreenName}/{ScreenName}.tsx`
   - `src/app/{route}/page.tsx`
4. Read `src/proxy.ts` so you know whether proxy updates are needed (they are NOT for protected routes, which is the default for dashboard screens).

Decision rules:
- If the screen file already exists → STOP and tell the user it exists. Do not overwrite.
- If the types or API file exists → reuse them. Read them and integrate with whatever functions/types are already there. Do NOT overwrite.
- If the API file is missing → create it from scratch in Step 2 using the `new-api` skill conventions.

---

## Step 1 — Types file

Location: `src/types/api/{resource}.ts`

If the file does NOT exist, create it with this shape (adapted to any column names the user specified):

```ts
export interface ResourceType {
  id: number
  // TODO: fill in real fields — placeholders only
  created_at: string
  updated_at: string
}
```

If the file exists, leave it alone. The screen must import whatever type already exists.

Rules:
- `interface`, not `type`
- `Type` suffix on every model
- Single quotes, no semicolons, 2-space indent

---

## Step 2 — API client

Location: `src/api/{resource}.ts`

If the file does NOT exist, create it with at minimum the list function (required by DataTable):

```ts
import { customFetch } from './customFetch'
import type { ResourceType } from '@/types/api/{resource}'
import type { PaginatedResponse } from '@/types/general'

const BASE_PATH = '/{resource}/'

export const getResourcesName = async (path: string = BASE_PATH, token: string) => {
  return await customFetch<PaginatedResponse<Array<ResourceType>>>({
    path,
    method: 'GET',
    token
  })
}
```

If the file exists, verify there is a list function matching this signature. If not, ADD it via Edit. Do not duplicate or rename existing functions.

Rules:
- `customFetch` from relative path `./customFetch`, types from `@/types/api/{resource}`
- `path` arg defaults to `BASE_PATH` so it accepts the `stringParams` query string from `useTableParams`
- NEVER include `/api` prefix in paths
- Trailing slash on paths
- `token` is always the second arg for authenticated endpoints

---

## Step 3 — Screen component

Location: `src/screens/{ScreenName}/{ScreenName}.tsx`

Generate the full screen using `ExamplePage.tsx` as the structural reference. The shape must match this (adapt `{placeholders}`):

```tsx
'use client'
import './{ScreenName}.sass'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { Paginator } from 'primereact/paginator'
import useSWR from 'swr'
import { useMediaQuery } from 'usehooks-ts'
import { get{ResourcesName} } from '@/api/{resource}'
import CustomButton from '@/components/CustomButton/CustomButton'
import Filters from '@/components/Filters/Filters'
import SearchInput from '@/components/SearchInput/SearchInput'
import { useTableParams } from '@/hooks/useTableParams'
import useUserStore from '@/stores/userStore'
import type { FilterItem } from '@/components/Filters/Filters'

interface Props {
  searchParams: { [key: string]: string | string[] | undefined }
}

const {ScreenName} = ({ searchParams }: Props) => {
  const { token } = useUserStore()
  const isMobile = useMediaQuery('(max-width: 768px)')

  const {
    params,
    stringParams,
    first,
    sortProps,
    setParam,
    setPagination,
    resetParams
  } = useTableParams({
    searchParams,
    defaultParams: {
      page: { type: 'number', value: 1 },
      page_size: { type: 'number', value: 10 },
      search: { type: 'string' },
      ordering: { type: 'string' }
      // TODO: add filter params here (see ExamplePage for all shapes)
    }
  })

  const FILTERS: FilterItem['filters'] = [
    // TODO: add filter definitions here — see ExamplePage for pill/dropdown/date/date-range shapes
  ]

  const {
    data,
    isLoading
  } = useSWR(
    token ? `/{resource}/?${stringParams}` : null,
    (path) => get{ResourcesName}(path, token!),
    { refreshInterval: 60000 }
  )

  return (
    <main id='main' className='{ScreenName}'>
      <section className='{ScreenName}__Content'>
        <header className='{ScreenName}__Filters'>
          <div className='flex items-center gap-4 xl:gap-5'>
            <span className='text-primary text-bold-16 hidden xl:inline'>{Title}</span>

            <SearchInput
              initialValue={params.search}
              onChange={(value) => setParam('search', value)}
              disabled={isLoading}
            />

            <div className='flex items-center gap-2'>
              <span className='text-bold-14'>{data?.data.count || 0}</span>
              <span>Results</span>
            </div>
          </div>

          <Filters
            filters={FILTERS}
            cleanFilters={resetParams}
            locale='es'
            disabled={isLoading}
          />
        </header>

        <header className='{ScreenName}__Filters--Mobile'>
          <div className='flex items-center gap-2'>
            <SearchInput
              initialValue={params.search}
              onChange={(value) => setParam('search', value)}
              disabled={isLoading}
            />
            <Filters
              filters={FILTERS}
              cleanFilters={resetParams}
              locale='es'
              disabled={isLoading}
            />
          </div>

          <div className='flex flex-col items-center gap-2'>
            <div className='flex items-center gap-2'>
              <span className='text-bold-14'>{data?.data.count || 0}</span>
              <span>Results</span>
            </div>
          </div>
        </header>

        <DataTable
          className='Table'
          dataKey='id'
          scrollable
          scrollHeight='100%'
          value={data?.data?.results}
          rows={params.page_size}
          emptyMessage={
            <div className='flex size-full flex-col items-center justify-center gap-4'>
              <i className='pi pi-search text-28' aria-hidden='true'></i>
              <span className='text-bold-16'>No results found</span>
              <CustomButton variant='primary' onClick={resetParams}>
                <i className='pi pi-trash text-14' aria-hidden='true' />
                <span className='text-14'>Clear filters</span>
              </CustomButton>
            </div>
          }
          loading={isLoading}
          sortField={sortProps?.sortField}
          sortOrder={sortProps?.sortOrder}
          onSort={sortProps?.onSort}
          removableSort
        >
          <Column field='id' header='ID' sortable />
          {/* TODO: add real columns */}
        </DataTable>

        {(Number(data?.data?.count) > 0) && (
          <Paginator
            className='Paginator'
            first={first}
            rows={params.page_size}
            totalRecords={data?.data.count}
            rowsPerPageOptions={[10, 20, 30]}
            onPageChange={(e) => {
              setPagination({
                page: e.page + 1,
                page_size: e.rows
              })
            }}
            pt={{
              root: { className: 'bg-transparent p-0 flex-nowrap' },
              RPPDropdown: { root: { className: '!w-[80px]' }, select: { 'aria-label': 'Rows per page' } },
              firstPageButton: { 'aria-label': 'First page' },
              prevPageButton: { 'aria-label': 'Previous page' },
              nextPageButton: { 'aria-label': 'Next page' },
              lastPageButton: { 'aria-label': 'Last page' }
            }}
            template={isMobile
              ? 'PrevPageLink CurrentPageReport NextPageLink RowsPerPageDropdown'
              : 'FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown'
            }
            currentPageReportTemplate={'{currentPage} of {totalPages}'}
          />
        )}
      </section>
    </main>
  )
}

export default {ScreenName}
```

Adaptation rules:
- Replace every `{ScreenName}` with the actual PascalCase name.
- Replace every `{ResourcesName}` with the plural PascalCase (e.g. `getUsers`).
- Replace `{resource}` with the kebab-case plural (e.g. `users`).
- Replace `{Title}` with a humanized title (e.g. `Users`).
- If the user provided columns, replace the `{/* TODO: add real columns */}` marker with real `<Column field="..." header="..." sortable />` entries.
- If the user provided filters, fill `FILTERS` and `defaultParams` accordingly. Use `ExamplePage` as the reference for every filter shape.
- Imports must be alphabetized within groups: external → `@/` → relative → type imports LAST.
- `'use client'` is mandatory (screens use hooks).
- Never import `motion` — only `m` from `framer-motion`.
- Never use `process.env` — only `@/constants/env`.
- Use `classNames` from `primereact/utils` for conditional classes, never `clsx`.

---

## Step 4 — SASS file

Location: `src/screens/{ScreenName}/{ScreenName}.sass`

Generate this exact skeleton, replacing `{ScreenName}`. Note the grid heights — these are critical for scroll behavior and must match `ExamplePage.sass`:

```sass
.{ScreenName}
  width: 100%
  height: 100%
  &__Content
    width: 100%
    height: 100%
    display: grid
    grid-template: 70px 1fr 60px / 1fr
  &__Filters
    width: 100%
    max-width: 100svw
    height: 100%
    padding: 0px 24px
    display: flex
    justify-content: space-between
    align-items: center
    gap: 16px
    @apply bg-neutral-200 text-surface-900
    &--Mobile
      @extend .{ScreenName}__Filters
      flex-direction: column
      display: none
      gap: 8px
  .Table
    height: calc(100vh - 70px - 60px) // Filter - Paginator

@media (max-width: 992px)
  .{ScreenName}
    &__Content
      width: 100%
      height: 100%
      display: grid
      grid-template: 100px 1fr 60px / 1fr
    &__Filters
      display: none
      &--Mobile
        padding: 12px 16px
        display: flex
    .Table
      height: calc(100vh - 100px - 60px) // Filter - Paginator
```

Rules:
- `.sass` indented syntax (NO curly braces, NO semicolons) — enforced by ESLint/hook.
- BEM: `.{ScreenName}`, `.{ScreenName}__Element`, `.{ScreenName}--Modifier`.
- If the screen is nested inside `DashboardLayout` that subtracts its own header height, adjust the `calc()` values. Default assumes the screen occupies the full viewport.

---

## Step 5 — Page wrapper

Location: `src/app/{route}/page.tsx`

```tsx
import {ScreenName} from '@/screens/{ScreenName}/{ScreenName}'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '{Title}',
  alternates: {
    canonical: '{route}'
  }
}

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const Page = async ({ searchParams }: Props) => {
  const params = await searchParams

  return (
    <{ScreenName} searchParams={params}/>
  )
}

export default Page
```

Rules:
- `metadata` MUST include both `title` and `alternates.canonical`.
- Page is `async` and awaits `searchParams` (required for DataTable screens).
- Named `Page`, default export.
- No logic, no UI — thin wrapper only.

---

## Step 6 — proxy.ts (usually skip)

Protected dashboard routes are the default — `proxy.ts` does NOT need changes.

Only update `src/proxy.ts` if the user explicitly requested a public DataTable (rare, would need to add the route to `PUBLIC_PATHS`). Default assumption: protected. Skip this step unless the user said otherwise.

---

## Step 7 — Validation

After all files are written, run:

```bash
pnpm run lint-check --fix
pnpm run type-check
```

If either fails:
1. Read the errors carefully.
2. Fix them directly with Edit — do not abandon the task.
3. Re-run until both pass.

Common failure modes to watch for:
- Missing `await` on `searchParams` in the page wrapper.
- Typo in `useTableParams` `defaultParams` key (must match the string used in `setParam`/`params`).
- Column `field` prop not matching any key in `ResourceType`.
- Imports not alphabetized or type imports not last.
- Single quotes missed.

---

## Step 8 — Final summary

Present a concise summary to the user:

1. **Files created** (full paths, one per line).
2. **Files modified** (if any existing API or proxy was touched).
3. **TODOs left for the user**:
   - Fill `ResourceType` fields in `src/types/api/{resource}.ts`.
   - Replace placeholder columns in the `<DataTable>` with real ones.
   - Add filter definitions to `FILTERS` and `defaultParams` if not already provided.
   - Adjust `.sass` `calc()` heights if the screen is nested inside a layout that subtracts header height.
4. **Validation status**: lint + type-check pass / fail.

Keep the summary under 30 lines. Do not dump file contents — the user can open the files directly.

---

## Hard rules — never violate

- The screen root is `<main id='main' className='{ScreenName}'>`. Layouts do NOT render `<main>` themselves — the screen owns it. Two `<main>` per page = a11y fail.
- NEVER use `motion` from framer-motion (use `m` with `LazyMotion`).
- NEVER use `process.env` (use `@/constants/env`).
- NEVER use native HTML inputs (use PrimeReact `InputText`, `Dropdown`, etc.).
- NEVER use `clsx` (use `classNames` from `primereact/utils`).
- NEVER include `/api` prefix in `customFetch` paths.
- NEVER export the `Props` interface unless another file needs it.
- NEVER overwrite existing screen, API, or types files — reuse or abort.
- ALWAYS use single quotes, no semicolons, 2-space indent.
- ALWAYS use `'use client'` on the screen (hooks).
- ALWAYS use `text-{weight}-{size}` typography, never loose `text-xl` or `font-bold`.
- ALWAYS pass `aria-label` to Paginator nav buttons via `pt`, matching the project's locale. PrimeReact's defaults are English; translate if the project ships in another language.
