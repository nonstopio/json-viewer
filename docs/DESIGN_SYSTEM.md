# Design system

The whole theme lives in **`src/styles/tokens.css`**. To retheme the product,
edit that file. Nothing else should need to change.

## Two layers

1. **A scale** — the accent ramp (`--vd-*`), type families, type scale,
   tracking, radii, motion. Fixed values that mean the same thing everywhere.
2. **Two grounds** — `ink` (dark) and `paper` (light). Each redefines the same
   set of **role** tokens: `--bg`, `--panel`, `--mass`, `--ink`, `--dim`,
   `--faint`, `--line`, `--spot`, the `--json-*` syntax roles, and so on.

The ground is an attribute on `<html>`: `data-mode="ink" | "paper"`. Custom
properties inherit, so flipping that one attribute re-resolves every role for
the whole tree. `index.html` sets it in a blocking inline script before first
paint (no flash); `src/hooks/useTheme.ts` sets it thereafter and is the only
place that writes it.

**There is no `dark:` variant anywhere in this app, and adding one is a bug.**
A `dark:` utility hardcodes a second palette next to the first, which is the
thing the ground swap exists to avoid.

## Naming a role

`tailwind.config.js` maps each role to a utility, so components write
`bg-panel`, `text-dim`, `border-line-2`, `text-json-string`, `bg-spot` /
`text-spot-ink`. **Naming a palette step or a raw hex in a component is a bug**:
it pins that component to one ground and the theme toggle stops working for it.

Tints are their own roles (`--spot-soft`, `--error-soft`) rather than opacity
modifiers, because a `var()` colour cannot carry Tailwind's `<alpha-value>`.
If you need a new tint, add it to both ground blocks.

**Every role must exist in both ground blocks.** A role defined in only one of
them renders one ground's text on the other's surface.

## Components

Three component classes live in `src/index.css`, and they exist because the
alternative is every instance carrying its own stack of utilities — which
makes "they all look alike" a coincidence that holds until the next edit.

- **`.btn`** — every button in the app. Square, a hairline rather than a fill,
  bold body type. Variants differ in loudness, never in shape: `--ghost` (the
  default), `--brand` (the one loud button per view), `--quiet` (borderless,
  for dense rows), `--on` (a toggle that is on), `--icon` (square, icon-only),
  `--sm` (the nav row), `--block` (full width).
- **`.ground`** — the ground picker: a bordered strip of uppercase mono
  segments with the chosen one inverted. Not a dropdown; with three choices
  the current one should be readable without opening anything.
- **`.eyebrow`** — a micro-label: 11px mono, uppercase, wide tracking.

Controls that sit in the nav row take their height from `--nav-control-h`, so
the row reads as one band rather than a set of near-misses.

## Motion

The app is meant to read as alive, not as decorated. Three loops, all slow and
low-contrast, none of them carrying information:

- **`.grid-layer`** — the dot grid behind everything, drifting one tile a
  minute.
- **`.glow` / `.glow--hi` / `.glow--lo`** — two accent glows that breathe and
  wander on different periods, so they never line up twice. These are what
  give the app depth; without them the grounds are flat greys.
- **`.seam`** — one accent beam travelling out and back along the hairlines
  between bands, staggered by `--delay-1` / `--delay-2` so two are never lit
  at once. Always the same gesture, borrowed from Eklavya's shuttle.

Plus `.fade-up`, a one-shot entrance for tab content.

**Animate transforms and opacity, nothing else.** The grid began as a
`background-position` drift on `<body>`; because that is not a composited
property, it repainted the whole viewport every frame — the graph e2e suite
went from 11s to over a minute, which is a user feeling a janky pan. Moving it
to its own layer and drifting it with `transform` fixed both.

For the same reason `.band` has **no `backdrop-filter`**. Eklavya's nav blurs,
but its ground is static; here the glows drift continuously, so a blurred band
re-blurs every frame — measured at better than 2x the graph suite's runtime.
The translucency is what reads as glass; the blur bought almost nothing over a
soft radial gradient.

Everything stops under `prefers-reduced-motion`. Nothing animates to opacity 0,
so killing the animations needs no companion rules to restore a resting state.

## Reaching a token from somewhere that isn't CSS

CSS, SVG (`stroke: var(--graph-edge)`) and CodeMirror all take `var()`
directly and re-resolve on a ground flip — prefer that. For the few consumers
that take a value rather than a stylesheet (the PNG rasteriser, a library
prop), `src/styles/roles.ts` exposes `readRole("graph-bg")`.

## Where the pieces are

| File                        | What it holds                                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/styles/tokens.css`     | the scale and both grounds — **the theme**                                                                             |
| `tailwind.config.js`        | roles → utilities, fonts, radii, shadows                                                                               |
| `src/index.css`             | base (body, grid, scrollbars, selection) and the components: `.btn`, `.ground`, `.eyebrow`, `.json-node`, `.tooltip-*` |
| `src/styles/editorTheme.ts` | the CodeMirror chrome and JSON syntax highlighting, built from the same roles                                          |
| `src/styles/roles.ts`       | `readRole()`, for non-CSS consumers                                                                                    |
| `src/hooks/useTheme.ts`     | light/dark/system → `data-mode`; stored values stay `light`/`dark`/`system` while the labels say Ink/Paper/Auto        |
| `index.html`                | the no-flash ground script, fonts, and the static About panel's styles                                                 |

## The look

Verdigris accent, spent sparingly. Archivo for display (900 weight, tracking
`-0.055em`, sub-1 leading), Inter for body, JetBrains Mono for anything that is
JSON. Square chrome — hairline rules and 2–6px radii, not rounded cards.
Sections separate by a `--line-2` hairline, never by a change of background;
that is what makes one theme toggle able to repaint the whole app.
