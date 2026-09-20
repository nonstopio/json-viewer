import {test, expect, type Page} from "@playwright/test";

// The design system names exactly three families (src/styles/tokens.css).
// Anything else on screen is a fallback that crept in — a library's own
// stylesheet, a `font-family` written past the tokens — and it is invisible
// in review because the substitute usually looks close enough.
const FAMILIES = /^(Inter|Archivo|"?JetBrains Mono"?)\b/;

/** Every element that paints its own text in something other than ours. */
async function strays(page: Page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    const ours = /^(Inter|Archivo|"?JetBrains Mono"?)\b/;
    return [...document.querySelectorAll("*")]
      .filter((el) =>
        [...el.childNodes].some(
          (n) => n.nodeType === 3 && n.textContent!.trim()
        )
      )
      .filter((el) => !ours.test(getComputedStyle(el).fontFamily))
      .map((el) => ({
        tag: el.tagName,
        cls: String(el.className).slice(0, 40),
        font: getComputedStyle(el).fontFamily,
      }));
  });
}

test("no view renders text in a font outside the design system", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", {name: "Load Complex Test JSON"}).click();

  expect(await strays(page)).toEqual([]);

  // The editor's gutter is the interesting one: CodeMirror's base theme sets
  // a bare `monospace` there, so it renders in the OS default unless the
  // theme overrides it. The first gutter element is CodeMirror's hidden
  // width-measurement node — it is asserted on deliberately, because it sizes
  // the gutter and must measure in the same font the line numbers paint in.
  await expect(page.locator(".cm-content")).toBeVisible();
  await expect(page.locator(".cm-gutterElement").first()).toHaveCSS(
    "font-family",
    /JetBrains Mono/
  );

  await page.getByRole("button", {name: "Viewer", exact: true}).click();
  await expect(page.locator(".json-tree-container")).toBeVisible();
  expect(await strays(page)).toEqual([]);

  await page.getByRole("button", {name: "Visualizer", exact: true}).click();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  expect(await strays(page)).toEqual([]);

  // The About panel is styled outside the bundle, so it has its own chance
  // to miss the tokens.
  await page.locator("[data-about-open]").click();
  await expect(page.locator(".about-panel")).toBeVisible();
  expect(await strays(page)).toEqual([]);
  await expect(page.locator(".seo-content h1")).toHaveCSS(
    "font-family",
    /Archivo/
  );
});

test("the page requests exactly one font stylesheet, and only used weights", async ({
  page,
}) => {
  await page.goto("/");
  const links = await page
    .locator('link[rel="stylesheet"][href*="fonts.googleapis"]')
    .evaluateAll((els) => els.map((e) => (e as HTMLLinkElement).href));

  expect(links).toHaveLength(1);
  // Weights nothing paints are dead bytes on every first load.
  expect(links[0]).toContain("family=Archivo:wght@800;900");
  expect(links[0]).toContain("family=Inter:wght@400;500;600;700");
  expect(links[0]).toContain("family=JetBrains+Mono:wght@400;500;600");
  expect(links[0]).toContain("display=swap");
  expect(FAMILIES.test("Inter")).toBe(true);
});
