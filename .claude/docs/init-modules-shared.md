# init-modules-shared — Shared protocol for the optional-module agents

> **Scope.** This file is `Read` at pre-flight by every agent under `.claude/agents/init/` — the
> `init-{provider}` agents that complete a module whose base the template already ships, and the
> `init-remove-*` agents that strip a feature the template ships by default. It is **not a subagent**
> (nothing invokes it) and **not a code convention**.
>
> - **Code conventions** — what valid *output* looks like — live in [`.claude/CONVENTIONS.md`](../CONVENTIONS.md). Read that too.
> - **This file** holds what is shared across the module agents and is NOT a code convention: the
>   delegation contract, the file-boundary rule, the validation gate, the commit rule and the report shape.
> - **Module-specific mechanics** (which files form the module, which brief fields it needs, what it
>   adapts) stay in each agent's own `.md`.
>
> The design-import flows have their own twin of this file, [`design-import-shared.md`](./design-import-shared.md).
> Section C there is the reference for anything not restated here; the rules below are the same rules
> with the module-specific parts swapped in.

---

## A. What a module agent is

The template ships a **working, inert base** for every optional module: it compiles, lints and
type-checks on every template change, so it cannot drift silently — but nothing mounts it and it does
nothing until its environment variables are set. A module agent has one of two jobs:

- **`init-{provider}`** — *complete* that base for one project: rename, translate, shape the fields,
  mount it where the brief says, and fill the environment. It adapts real files; it never generates the
  module from prose, which is what keeps every project's copy recognisably the same code.
- **`init-remove-{feature}`** — *strip* a feature the template ships by default (auth, Sentry, …) when a
  project does not want it, and leave the toolkit and the docs coherent without it.

Agents are named after the **provider or feature they touch** (`init-resend`, not `init-contact-form`)
so that reading the name says which vendor a project depends on.

## B. Two ways to be invoked — same brief either way

1. **As a step of `/init-project`** — the orchestrator runs the questionnaire, builds the brief and
   delegates. Removals run before additions, so an addition lands on the project's final shape.
2. **Standalone, any time later** — the developer asks the main session to *"run the `init-resend`
   agent"* weeks after the init. The main session gathers the same brief and delegates the same way.

**You never have a user to ask.** Whoever invokes you gathers the answers first. Your `.md` lists the
brief's fields; a missing REQUIRED field is `STOP-BLOCKING / INVALID_INPUT`, not a guess. When the brief
disagrees with the filesystem, **the filesystem wins** — implement that and report the discrepancy.

## C. Stay inside the module's file set

- **An add agent edits only:** the module's base files (listed in its `.md`), the mount point the brief
  names, `.env.local` / `.env.example`, and the doc rows the module owns (its `CONVENTIONS.md` reuse-table
  rows, its `CLAUDE.md` lines). Nothing else.
- **A remove agent deletes an explicit list of roots**, then lets `pnpm run type-check` and `grep` find
  what still points at them. The type-checker is the reference list; the hand-written part of the agent is
  only the acoplamiento `tsc` cannot see (docs, skills, `.env.example`, `amplify.yml`).
- **Every removal is reported on its own line** as `DELETED: {path} — {reason}`. Never file it under a
  tidy-up heading. Replacing a file wholesale is a deletion of whatever was not carried over.

## D. Docs must stay true

A project whose docs describe a feature it no longer has, or omit one it now has, lies to the next agent
that reads them. So a module agent also updates the lines the module owns: the reuse-table rows in
`CONVENTIONS.md`, the module's lines in `CLAUDE.md`, and its block in `.env.example`. A remove agent
additionally reviews the skills that assume the feature exists (`/new-screen` and `/new-table` edit
`proxy.ts`; `/openapi-import` and `/new-api-resource` emit token-last handlers) — that review is part of
removing auth, not an afterthought.

## E. Validation gate — three commands, always

```bash
pnpm run lint-check --fix
pnpm run type-check
pnpm run build
```

All three, in that order, for every module agent. Additions create or mount components and touch a route;
removals delete routes. Per [`design-import-shared.md` § C3b/C3c](./design-import-shared.md#c3b-an-agent-that-creates-or-changes-a-component-must-run-pnpm-run-build),
`lint` and `type-check` miss a broken server/client boundary and validate `typedRoutes` against the
*previous* route tree — only `build` proves the result. A removal agent also runs
`node .claude/scripts/render-audit.mjs` so every remaining route is rendered once.

A gate failure is yours to fix before returning, not the invoker's problem later.

**One failure that is not yours: `Missing environment variables` from `src/constants/env.ts`.** Right after
`/init-project`, `.env.local` carries an empty `NEXT_PUBLIC_API_URL` (no backend is defined yet), and `next
build` throws while collecting page data — on every route, before your changes matter. Measured on the first
full run. Do not write the variable into any file (that is the developer's value); re-run the gate with it
supplied inline for that one command, from the Bash tool:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000 pnpm run build
```

Then report `build=✅` and add `(NEXT_PUBLIC_API_URL supplied inline: .env.local has none yet)` to the
`Notes:` line. Any other build error is yours.

## F. Commit — the invoker commits, one commit per module

You do **not** commit. Return your report; the invoker (the `/init-project` orchestrator or the main
session) stages your files and commits **one commit per module**, single line, no body:

```
[ FEATURE ] Add contact form with Resend
[ REFACTOR ] Remove Sentry
```

Keeping the commit in one place is what keeps the `[ TYPE ]` convention and the no-attribution rule
enforced once instead of per agent.

## G. Report shape

Before the footer, report **what changed** in a scannable form: files created / modified / `DELETED:`,
the decisions taken (fields shaped, mount point, language), and the developer checklist the module needs
(accounts to create, env vars to fill, DNS to verify). The report is data for the invoker's checkpoint,
not an essay.

STOPs follow [CONVENTIONS > STOP Protocol](../CONVENTIONS.md#stop-protocol) (same fenced format and
severities). The init flows add two categories to that table:

| Category | Severity | When | Next agent |
| -------- | -------- | ---- | ---------- |
| `MODULE_BASE_MISSING` | BLOCKING | A file the module's base inventory lists is not on disk (the project deleted or moved it) | `user_decision` |
| `MOUNT_DEFERRED` | ADVISORY | The brief names a mount target that is not real yet (the template's demo `HomePage`); the module is adapted but left unmounted | `user_decision` (mount it when the real screen exists) |

End with this exact footer:

```
---
Workload: model={haiku|sonnet|opus}, tool_calls≈{N}, files_touched={M}
Validation: lint=✅/❌, type-check=✅/❌, build=✅/❌
Notes: {one-line count summary}
```
