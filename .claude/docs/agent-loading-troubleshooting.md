# When a sub-agent silently doesn't load

> **Scope.** A troubleshooting playbook for one specific Claude Code failure, kept out of `CLAUDE.md`
> because it describes the harness, not this project. Read it when you have the symptom below.
> Upstream issue: [#14018](https://github.com/anthropics/claude-code/issues/14018).

## The symptom

Sub-agents live in `.claude/agents/**` (scanned recursively). **A project agent can silently fail to
load**: no error, no warning — it just never appears in the available-agent list, and every skill that
delegates to it breaks at that step. Because nothing is printed, the first sign is usually a skill
failing halfway through with `Agent type not found`.

## How to check, in one call

The available-agent list is not printed anywhere, so probe it: invoke any agent with a trivial prompt.
If it is missing, the error names *every* agent that IS registered — the full inventory in one shot.
Compare that against `find .claude/agents -name '*.md'`; a count mismatch is the whole diagnosis.

## The remedy: rewrite the file's content substantially, then restart Claude Code

A *small* edit is NOT enough. What was tried, and what it did:

| What was done to the file | Result |
| --- | --- |
| whole-file rewrite (every line changed) | ✅ loads |
| content edited, **one line** | ❌ still missing |
| `touch` only (mtime changes, bytes identical) | ❌ still missing |
| nothing (control, across two restarts) | ❌ still missing |

So it behaves like a cache that **remembers a failed parse and is keyed on content, not mtime** —
restarting alone does not clear it. The trigger for the initial failure is unknown and looks
non-deterministic; the stuck files were valid and byte-identical in frontmatter structure to the ones
that loaded.

The rewrite that revived the last batch of stuck agents happened to be a CRLF→LF conversion. **Do not
read that as "CRLF breaks the loader"** — agents and skills with CRLF load fine. The only variable that
separated the failed attempt from the successful one was **how much of the file changed**, which is why
the table records size rather than line endings. (`.gitattributes` pins `.claude/**` to LF regardless,
so a checkout cannot silently revert a revived agent.)

## Do NOT waste time on these — all tested and ruled out as causes

A colon-space in `description:`, description length, `model:` value, mtime, BOM, CRLF vs LF, invisible
unicode, an agent cap, `permissions.deny`, managed-settings, `~/.claude/agents`.

That list was produced by tabulating every agent in the repo against its loaded/not-loaded state. It is
worth trusting rather than re-deriving: the colon-space hypothesis in particular looks perfect on a
small sample (within the `openapi/` folder alone the correlation was exact) and dies as soon as the
sample widens — `design-validation` loads carrying two colon-spaces. **The transferable lesson is the
method: a hypothesis that fits 4 files can die on 17, so widen the sample before editing anything.**

## Hygiene that is correct on its own merits

**`.claude/agents/` is for agent files ONLY.** A `.md` there without valid `name:`/`description:`
frontmatter is not an agent; shared docs that agents merely `Read` belong in `.claude/docs/` (that is
why `design-import-shared.md` and this file live there). This was once suspected of poisoning the scan
of its own directory — that turned out to be confounded with a content change and is **not**
established. Keep the separation because it is correct, not as a fix.

## After adding or renaming an agent

**Restart and verify it appears** before relying on it.