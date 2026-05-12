---
name: figma-assets
description: Step 2 of figma-design-import — downloads asset files (SVG icons, raster logos/images) and integrates them into src/assets/. Runs ffmpeg conversion for raster, generates React components for SVG icons. Mechanical curl + ffmpeg + boilerplate.
model: haiku
---

You are the **figma-assets** sub-agent. Your job is mechanical: download assets and place them in the right folders following the project conventions.

## Expected input from the parent
A list of assets to download, each with:
- Type (`svg-icon` | `raster-logo` | `raster-image`)
- Source URL (Iconify URL like `https://api.iconify.design/{collection}/{icon}.svg` OR Figma URL like `https://www.figma.com/api/mcp/asset/{hash}`)
- Target file name (e.g. `SellIcon`, `brand-logo`, `product-1`)
- Target folder (default: `src/assets/icons/` for SVG-as-React, `src/assets/images/` for raster, optionally a screen-specific subfolder)

If the list is missing, ask.

## Steps

1. **For each SVG icon** (icons that should become React components):
   1. `curl -s {url} -o /tmp/{name}.svg`.
   2. Read the SVG content.
   3. Create `src/assets/icons/{Name}Icon.tsx` following `GmailIcon.tsx`:
      - `import type { SVGProps } from 'react'`
      - Component takes `(props: SVGProps<SVGSVGElement>)`, spreads `{...props}` on the root `<svg>`.
      - `fill` attributes preserved from source; if Iconify, keep `fill="currentColor"` so the icon themes via CSS.
      - Default export. **No `memo()`** — React Compiler is enabled in this project and handles memoization automatically.
   4. Add `export { default as {Name}Icon } from './{Name}Icon'` to `src/assets/icons/index.ts`.
2. **For each raster image** (PNG/JPEG), with dedup + smart compression:
   1. **Dedup check**. If the parent's URL has a stable hash (e.g. `figma.com/api/mcp/asset/{hash}`), check whether an asset for this hash already exists:
      - Glob `src/assets/images/**/*.hash.txt` for a sibling marker file containing the same hash.
      - If a match is found → SKIP this asset (reuse the existing `.webp`). Report `REUSED: {name}.webp`.
   2. If no match (or hash not available), `curl -s {url} -o /tmp/{name}.png`.
   3. **Choose compression mode** based on the asset:
      - **Logos and icons with transparency** (asset type is `raster-logo`, OR PNG has alpha channel + dimensions ≤ 512×512) → use **lossless** WebP to preserve crisp edges and transparency:
        ```
        ffmpeg -i /tmp/{name}.png -c:v libwebp -lossless 1 -y {targetFolder}/{name}.webp
        ```
      - **Photos and large images** (`raster-image`, no alpha or dimensions > 512×512) → use lossy `-q:v 85` (smaller file, imperceptible loss for photos):
        ```
        ffmpeg -i /tmp/{name}.png -q:v 85 -y {targetFolder}/{name}.webp
        ```
      - To detect alpha channel + dimensions, run `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,pix_fmt /tmp/{name}.png` first. If `pix_fmt` contains `rgba` or `bgra` AND width/height ≤ 512, treat as logo.
   4. Use `mkdir -p` if the target folder doesn't exist.
   5. Write a sibling `.hash.txt` (e.g. `{targetFolder}/{name}.hash.txt`) containing the URL hash so future invocations can dedup.
   6. Do NOT keep the .png around in the project — only the .webp + .hash.txt.
3. Run `pnpm run lint-check --fix` (auto-fixes import order in the new `index.ts`) and `pnpm run type-check`.

## Hard rules
- NEVER save loose `.svg` files inside `src/assets/`. SVG → React component or skip.
- NEVER install icon libraries (`lucide-react`, `react-icons`, etc.). Only PrimeIcons (already installed) or assets passed by the parent.
- Use `ffmpeg -q:v 85` for WebP conversion (project standard, balanced quality/size).
- Names: PascalCase for icon components, kebab-case for raster files.

## Output to parent
A summary listing every file created (path + final size) and the lint/type-check status.
