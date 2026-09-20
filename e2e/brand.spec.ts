import {test, expect, Page} from "@playwright/test";
import {readFileSync} from "fs";

// Per-domain branding (src/brand.ts + netlify/edge-functions/brand.ts).
// `?brand=` stands in for the hostname so both brands are reachable locally.

const favicon = (page: Page) =>
  page.getAttribute('link[rel="icon"]:not([sizes])', "href");

test("the default brand is NonStop io", async ({page}) => {
  await page.goto("/");

  await expect(page.locator("footer")).toContainText(
    "NonStop io Technologies Pvt. Ltd."
  );
  expect(await page.title()).toContain("JSON Viewer Online");
  expect(await favicon(page)).toBe("/favicon.png");
});

test("ajson carries no NonStop marks", async ({page}) => {
  await page.goto("/?brand=ajson");

  const footer = page.locator("footer");
  await expect(footer).toContainText("Ajay Kumar");
  await expect(footer).not.toContainText(/nonstop/i);

  // Every NonStop social profile must be gone, and the only remaining profile
  // link is Ajay's.
  const hrefs = await footer
    .locator("a")
    .evaluateAll((els) => els.map((el) => (el as HTMLAnchorElement).href));
  expect(
    hrefs.filter((h) => /nonstopio\.com|linkedin|twitter/i.test(h))
  ).toEqual([]);
  expect(hrefs).toContain("https://github.com/ProjectAJ14");
});

test("the footer credits the author with a linked GitHub picture", async ({
  page,
}) => {
  // The credit belongs to the person, not the brand, so it stands under both.
  for (const url of ["/", "/?brand=ajson"]) {
    await page.goto(url);

    const footer = page.locator("footer");
    await expect(footer).toContainText("Built by");

    const avatar = footer.locator('img[alt="Ajay Kumar"]');
    await expect(avatar).toHaveAttribute(
      "src",
      "https://github.com/ProjectAJ14.png?size=64"
    );
    // Wrapped in the link to the profile, not floating beside it.
    await expect(
      footer.locator('a[href="https://github.com/ProjectAJ14"] img')
    ).toHaveCount(1);
  }
});

test("ajson swaps the title and the whole icon set", async ({page}) => {
  await page.goto("/?brand=ajson");

  expect(await page.title()).toBe(
    "AJSON – JSON Formatter, Validator & Graph Visualizer"
  );
  expect(await favicon(page)).toBe("/brand/ajson/favicon.png");
  expect(await page.getAttribute('link[rel="apple-touch-icon"]', "href")).toBe(
    "/brand/ajson/apple-touch-icon.png"
  );
  expect(
    await page.getAttribute('meta[property="og:site_name"]', "content")
  ).toBe("AJSON");
  expect(await page.getAttribute('meta[property="og:image"]', "content")).toBe(
    "https://ajson.netlify.app/brand/ajson/og-image.png"
  );
  expect(await page.getAttribute('link[rel="canonical"]', "href")).toBe(
    "https://ajson.netlify.app"
  );
});

test("the brand icon set is actually served", async ({request}) => {
  for (const file of [
    "favicon.png",
    "favicon-16x16.png",
    "favicon-32x32.png",
    "apple-touch-icon.png",
    "icon-192.png",
    "icon-512.png",
    "og-image.png",
    "manifest.json",
  ]) {
    const res = await request.get(`/brand/ajson/${file}`);
    expect(res.status(), `${file} should be served`).toBe(200);
  }
});

// The edge function swaps one marked block. If index.html ever grows a NonStop
// tag outside it, the swap silently leaves that tag on the ajson domain — so
// assert the invariant rather than trusting it.
test("every NonStop head tag lives inside the swappable block", () => {
  const html = readFileSync("index.html", "utf8");
  const BLOCK = /<!-- brand:start -->[\s\S]*?<!-- brand:end -->/;

  expect(BLOCK.test(html), "index.html must keep the brand markers").toBe(true);

  const stripped = html.replace(BLOCK, "");
  const head = stripped.slice(0, stripped.indexOf("</head>")).toLowerCase();
  expect(head).not.toContain("nonstop");
});
