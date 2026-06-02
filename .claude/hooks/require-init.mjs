#!/usr/bin/env node
// PreToolUse guard (Layer 2): forces Claude to run /init-project before editing
// project files on a fresh template clone.
//
// Blocks Edit/Write/MultiEdit/NotebookEdit while the project is still the raw
// template (package.json name === 'linkchar-next-template') UNLESS the bypass
// LINKCHAR_TEMPLATE_DEV is set (template maintainers) — read from the process env
// OR straight from .claude/settings.local.json ("env" key).
//
// /init-project's first action renames package.json `name` via the Bash tool (which
// this hook does NOT intercept), so the rename itself lifts the block for the rest of
// the run — no marker file needed.
//
// The Husky `pre-commit` guard (Layer 1) reads the SAME settings.local.json, so the
// bypass is configured in ONE place and covers both layers. Reading the file directly
// (not only process.env) means changes apply without reloading Claude Code.
// Exit code 2 blocks the tool and feeds the stderr message back to Claude.

import fs from 'node:fs'

// Consume stdin (the tool-call JSON) so the hook doesn't hang on the pipe.
try { fs.readFileSync(0, 'utf8') } catch { /* no stdin — fine */ }

// Bypass: shell/process env first, then .claude/settings.local.json. Any non-empty
// value counts (presence-based, like the shell guard) — remove the key to re-arm.
let bypass = process.env.LINKCHAR_TEMPLATE_DEV
if (!bypass) {
  try {
    bypass = (JSON.parse(fs.readFileSync('.claude/settings.local.json', 'utf8')).env || {}).LINKCHAR_TEMPLATE_DEV
  } catch { /* missing or invalid JSON — treat as no bypass */ }
}
if (bypass) process.exit(0)

let pkg
try {
  pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
} catch {
  // No readable package.json — not our concern, let the edit through.
  process.exit(0)
}

// Already initialized — the rename (Step 1 of /init-project) changed the name away
// from the template slug, so editing is unblocked from here on.
if (pkg.name !== 'linkchar-next-template') process.exit(0)

console.error(
  '⛔ This project has not been initialized from the Linkchar template.\n' +
  'You MUST run the /init-project skill before editing any project file.\n' +
  'It renames the app to the new product and unblocks editing automatically.\n' +
  '\n' +
  'Maintaining the template itself? Add the bypass to .claude/settings.local.json\n' +
  '(gitignored, personal) — the same file the pre-commit guard reads:\n' +
  '\n' +
  '    { "env": { "LINKCHAR_TEMPLATE_DEV": "1" } }\n' +
  '\n' +
  'This hook reads that file directly, so the change applies immediately (no reload).'
)
process.exit(2)
