# @speclyy/design-system

Speclyy's shared design system. Consumed by `@speclyy/web` (Next.js) and `@speclyy/marketing` (Astro).

## What's in here

- **Tokens** (`src/styles/tokens.css`) — colors, typography, radii, shadows, motion, spacing. Editorial warm-stone palette with a terracotta accent and sage "complete" status. Reference **semantic tokens** (`var(--bg-app)`, `var(--fg-1)`, `var(--accent)`) in components, never raw palette hexes.
- **Fonts** (`src/styles/fonts.css`) — Fraunces (display serif), Inter Tight (UI/body), JetBrains Mono (codes/SKUs).
- **Component CSS** (`src/styles/components.css`) — buttons, pills, cards, inputs, app nav, toast. Port of the web-app and marketing kits from the design bundle.
- **Tailwind preset** (`tailwind-preset.cjs`) — surfaces the tokens as Tailwind utilities (`bg-paper-50`, `text-ink-900`, `font-display`, `rounded-lg`, etc.). Both apps extend it.
- **React primitives** (`src/components/*`) — `Button`, `Pill`, `Input`, `Textarea`, `Select`, `Field`, `Card`, `Avatar`, `Toast`, `AppNav`, `Logo`.
- **Icons** (`src/icons/index.tsx`) — small set at stroke-width 1.5 (`Plus`, `Download`, `Check`, `ArrowRight`, `Search`, `MoreHorizontal`, `X`, `Sparkle`, `ChevronRight`, `ChevronDown`).
- **Logo assets** (`assets/`) — `speclyy-logo-dark.png` (on light), `speclyy-logo-light.png` (on dark).

## Usage

**Tailwind preset** (both apps):

```js
// tailwind.config.*
const preset = require('@speclyy/design-system/tailwind-preset')
export default { presets: [preset], content: [...] }
```

**Global styles** — once per app, in the root CSS:

```css
@import '@speclyy/design-system/styles/all.css';
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`all.css` bundles fonts + tokens + components in the right order. If you prefer to self-host fonts later, import `tokens.css` and `components.css` directly and skip `fonts.css`.

**React components**:

```tsx
import { Button, Pill, Logo } from '@speclyy/design-system'
import { Plus } from '@speclyy/design-system/icons'
```

## Design principles

- **One accent at a time** — terracotta on the page OR sage, never both at full saturation.
- **Sentence case** in UI copy. No emoji in product UI (the ✨ in the wordmark is the exception).
- **Real punctuation** — em-dash (—), curly quotes, ellipses.
- **Lucide icons at stroke-width 1.5** — editorial, not chunky.
- **Warm over cool** — no pure grays, no SaaS blues.
