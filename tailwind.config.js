/** @type {import('tailwindcss').Config} */

/* Every colour here is a ROLE that resolves through a CSS custom property
   defined in src/styles/tokens.css. Components name roles (bg-panel,
   text-dim, border-line) and never a palette step, so the ground swap in
   tokens.css is the only place the theme lives. That is also why there is
   no `dark:` variant in this app: the custom properties re-resolve when
   <html data-mode> flips, which no utility needs to know about.

   Tints are their own roles (spot-soft, error-soft) rather than opacity
   modifiers, because `var()` colours cannot carry Tailwind's <alpha-value>. */
const role = (name) => `var(--${name})`;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  // Nothing ever adds `.dark` to <html> any more — the ground lives on
  // data-mode. This keeps a stray `dark:` utility inert rather than letting
  // it silently bind to prefers-color-scheme, which is Tailwind's default.
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        disp: [role("font-disp")],
        sans: [role("font-body")],
        mono: [role("font-mono")],
      },
      colors: {
        // surfaces
        bg: role("bg"),
        panel: role("panel"),
        mass: role("mass"),
        hover: role("hover"),
        sel: role("sel"),
        "sel-soft": role("sel-soft"),
        // text
        ink: role("ink"),
        dim: role("dim"),
        faint: role("faint"),
        "faint-2": role("faint-2"),
        // rules
        line: role("line"),
        "line-2": role("line-2"),
        // accent
        spot: role("spot"),
        "spot-ink": role("spot-ink"),
        "spot-soft": role("spot-soft"),
        "spot-line": role("spot-line"),
        // state
        error: role("error"),
        "error-soft": role("error-soft"),
        warning: role("warning"),
        "warning-soft": role("warning-soft"),
        success: role("success"),
        info: role("info"),
        // JSON syntax
        json: {
          key: role("json-key"),
          string: role("json-string"),
          number: role("json-number"),
          boolean: role("json-boolean"),
          null: role("json-null"),
          object: role("json-object"),
          array: role("json-array"),
          punct: role("json-punct"),
        },
        // search highlight
        mark: role("mark"),
        "mark-ink": role("mark-ink"),
        "mark-current": role("mark-current"),
        "mark-current-ink": role("mark-current-ink"),
        // misc
        grid: role("grid"),
        "code-bg": role("code-bg"),
        scrim: role("scrim"),
      },
      borderRadius: {
        none: role("radius-none"),
        sm: role("radius-sm"),
        DEFAULT: role("radius-sm"),
        md: role("radius-md"),
        lg: role("radius-lg"),
        xl: role("radius-lg"),
        "2xl": role("radius-lg"),
        full: role("radius-pill"),
      },
      letterSpacing: {
        display: role("tracking-display"),
        tight: role("tracking-tight"),
        snug: role("tracking-snug"),
        caps: role("tracking-caps"),
        "caps-wide": role("tracking-caps-wide"),
      },
      boxShadow: {
        sm: role("shadow-sm"),
        DEFAULT: role("shadow-sm"),
        md: role("shadow"),
        lg: role("shadow"),
        xl: role("shadow"),
        ring: role("ring"),
        none: "none",
      },
      transitionTimingFunction: {
        DEFAULT: role("ease"),
        ease: role("ease"),
      },
      animation: {
        expand: "expand 0.2s var(--ease)",
        collapse: "collapse 0.2s var(--ease)",
      },
      keyframes: {
        expand: {
          "0%": {opacity: "0", height: "0"},
          "100%": {opacity: "1", height: "auto"},
        },
        collapse: {
          "0%": {opacity: "1", height: "auto"},
          "100%": {opacity: "0", height: "0"},
        },
      },
    },
  },
  plugins: [],
};
