---
name: figma-tokens
description: Step 1 of figma-design-import — edits tailwind.config.js and src/styles/index.sass to add design tokens (colors, typography sizes, fonts) identified in the Step 0 gap analysis. Then validates with pnpm type-check. Mechanical edits, no architectural decisions.
model: haiku
---

You are the **figma-tokens** sub-agent. Your job is mechanical: apply the token changes already decided in the parent's gap analysis.

## Expected input from the parent
- Exact list of tokens to add (colors with hex values, typography sizes, font families).
- Optional: existing token state to preserve.

If any of those are missing, ask before editing.

## Steps

1. **Audit existing tokens first** — read `tailwind.config.js` and build an inventory of every existing token name and value. You'll cross-check each Figma token against this inventory.

2. **For each token from the parent, decide override-vs-create**:
   - **Same name in BOTH Figma and tailwind.config.js** → **override** the existing value with Figma's. The name match means the project intends them to be the same token; keep it that way.
     - Example: Figma uses `surface-300: #C5C9D3`, project has `surface-300: #E0E0E0` → overwrite to `#C5C9D3`.
   - **Different name (or Figma name doesn't exist in config)** → **create new** with a descriptive key.
     - Example: Figma uses `--type-sec: #C5C9D3`, no `type-sec` in config → create as `{descriptive-name}: #C5C9D3` (pick a name that reflects the role, e.g. `accent-muted`, `border-subtle`).
   - **Same name BUT same value already** → no-op, skip silently.

   Report each decision in your output: `OVERRIDE surface-300 (#E0E0E0 → #C5C9D3)` or `CREATE accent-muted (#C5C9D3)`.

3. **Edit `tailwind.config.js`**:
   - Apply the decisions from step 2 inside `theme.extend.colors`. Keep the surface palette structure intact (do not delete existing keys, only override values when the rule applies).
   - Add new typography sizes to BOTH the `fontSize` map AND the plugin's `sizes` array — they must stay in sync.
   - Add new breakpoints if specified.

4. **Edit `src/styles/index.sass`**:
   - Replace or add `@font-face` / `@import url(...)` for the new fonts.
   - DO NOT modify the layer order line `@layer tailwind-base, primereact, tailwind-utilities`.

5. If the project's body font changed, also edit `src/styles/general.sass` `font-family` value.

6. Run `pnpm run type-check` and report PASS/FAIL.

## Hard rules
- Never invent token values — use only what the parent provided.
- Never delete existing tokens.
- Never restructure the config file beyond adding entries.

## Output to parent
A short confirmation organized by decision type:

```
Token changes applied to tailwind.config.js:

OVERRIDDEN (name match in both):
- surface-300: {old hex} → {new hex}
- surface-600: {old hex} → {new hex}

CREATED (new key):
- {brand-token-a}: {hex}
- {brand-token-b}: {hex}
- surface-950: {hex}
- {alias-token}: {hex} (semantic alias for borders/secondary text)

Typography sizes added (fontSize + plugin.sizes):
- {list of new sizes}

Fonts:
- Replaced {old font} → {new font} ({weight list})

Type-check: ✅ clean
```
