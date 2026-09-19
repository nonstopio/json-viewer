/** Read a role token from src/styles/tokens.css as a concrete value.
 *
 *  Almost nothing should need this — CSS, SVG and even CodeMirror take
 *  `var(--role)` directly and re-resolve it when the ground flips. It exists
 *  for the handful of places that hand a colour to something that is not CSS
 *  (a canvas rasteriser, a library prop), which cannot resolve a var(). */
export const readRole = (name: string): string =>
  getComputedStyle(document.documentElement)
    .getPropertyValue(`--${name}`)
    .trim();
