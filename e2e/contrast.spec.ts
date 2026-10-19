import {test, expect} from "@playwright/test";

// Contrast guard for the colour roles in src/styles/tokens.css. Each text
// role must reach 4.5:1 on every surface it is drawn on, in both grounds.
// Values are read from the live page (so color-mix() tints resolve exactly as
// the browser paints them) and flattened through a canvas pixel.

const TEXT = [
  "ink",
  "dim",
  "faint",
  "error",
  "warning",
  "success",
  "info",
  "json-key",
  "json-string",
  "json-number",
  "json-boolean",
  "json-null",
  "json-object",
  "json-array",
  "json-punct",
];
const SURFACE = ["bg", "panel", "mass", "hover", "sel", "code-bg"];

for (const mode of ["ink", "paper"] as const) {
  test(`${mode}: every text role is readable on every surface`, async ({
    page,
  }) => {
    await page.goto("/");
    const failures = await page.evaluate(
      ({mode, TEXT, SURFACE}) => {
        document.documentElement.setAttribute("data-mode", mode);
        const ctx = document.createElement("canvas").getContext("2d", {
          willReadFrequently: true,
        })!;
        const rgb = (role: string, under?: number[]) => {
          const v = getComputedStyle(document.documentElement)
            .getPropertyValue(`--${role}`)
            .trim();
          ctx.canvas.width = ctx.canvas.height = 1;
          ctx.clearRect(0, 0, 1, 1);
          if (under) {
            ctx.fillStyle = `rgb(${under.join(",")})`;
            ctx.fillRect(0, 0, 1, 1);
          }
          ctx.fillStyle = v;
          ctx.fillRect(0, 0, 1, 1);
          return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
        };
        const lum = (c: number[]) => {
          const f = (x: number) => {
            x /= 255;
            return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
        };
        const ratio = (a: number[], b: number[]) => {
          const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
          return (hi + 0.05) / (lo + 0.05);
        };
        const out: string[] = [];
        const page0 = rgb("bg");
        for (const s of SURFACE) {
          const bg = rgb(s, page0);
          for (const t of TEXT) {
            // Code never sits on the plain well: the editor and the tree use
            // --code-bg, which paper lightens for exactly this reason.
            if (t.startsWith("json-") && s === "mass") continue;
            const r = ratio(rgb(t, bg), bg);
            if (r < 4.5) out.push(`${t} on ${s}: ${r.toFixed(2)}`);
          }
        }
        return out;
      },
      {mode, TEXT, SURFACE}
    );
    expect(failures).toEqual([]);
  });
}
