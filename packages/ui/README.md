# @mosaic/ui

Mosaic design system — Material Design 3 (Layer 2 of `.system/DESIGN.md`),
seeded from brand blue `#319EFF`.

- `src/styles.css` — MD3 color roles as CSS variables, light + dark schemes.
- `tailwind-preset.cjs` — MD3 theme mapping (colors, shapes, elevation, type scale).
- `src/*.tsx` — primitives (cva + cn + tokens, shadcn-compatible pattern).
- `src/chartColors.ts` — the only file outside the token layer allowed literal colors.

## Adding shadcn components

`components.json` is wired to this package. From the repo root:

    pnpm dlx shadcn@latest add dialog --cwd packages/ui

Then restyle the generated component with MD3 tokens (never shadcn's default
palette) and export it via the package `exports` map. Brand-layer styling
(neon spectrum, Michroma, scanlines) must never enter these components.
