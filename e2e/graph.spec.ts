import {test, expect, type Page} from "@playwright/test";
import {writeFileSync} from "fs";
import {join} from "path";
import {tmpdir} from "os";

// E2E coverage for the Graph view: nodes render, the toolbar works,
// collapse/expand-all behaves, and — the bug we just fixed — searching a node
// zooms to fit it instead of just panning at the current (fit-to-view) zoom.

// A wide/nested document so the whole-graph fit is zoomed OUT (scale < 1).
// That's what makes the "search must zoom IN" assertion meaningful.
function buildGraphJson(): string {
  const data: Record<string, unknown> = {};
  for (let i = 0; i < 12; i++) {
    data[`service_${i}`] = {
      id: i,
      name: `svc ${i}`,
      config: {enabled: true, region: `r${i}`, meta: {owner: `team${i}`}},
    };
  }
  data.target = {deep: {preferences: {theme: "dark"}}};
  return JSON.stringify(data);
}

async function loadGraph(page: Page, json: string, name: string) {
  const file = join(tmpdir(), name);
  writeFileSync(file, json);
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(file); // → Viewer tab
  await page.getByRole("button", {name: "Graph", exact: true}).click();
  // Wait for React Flow to mount nodes.
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
}

// Current zoom scale from the viewport transform (`translate(...) scale(z)`).
function viewportScale(page: Page): Promise<number> {
  return page.locator(".react-flow__viewport").evaluate((el) => {
    const m = (el as HTMLElement).style.transform.match(/scale\(([\d.]+)\)/);
    return m ? parseFloat(m[1]) : 1;
  });
}

const TOOLBAR_LABELS = [
  "Center first item (⇧1)",
  "Fit to center (⇧2)",
  "Zoom out",
  "Zoom in",
  "Export as PNG (⌘S)",
  "Search",
  "Rotate layout",
  "Collapse all",
  "Settings",
];

test("renders nodes and the full toolbar with no console errors", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await loadGraph(page, buildGraphJson(), `graph-${testInfo.workerIndex}.json`);

  // Root plus many container nodes are present.
  await expect(
    page.locator(".react-flow__node", {hasText: "root"})
  ).toBeVisible();
  expect(await page.locator(".react-flow__node").count()).toBeGreaterThan(10);

  for (const label of TOOLBAR_LABELS) {
    await expect(page.locator(`button[aria-label="${label}"]`)).toBeVisible();
  }

  expect(errors).toEqual([]);
});

test("collapse-all reduces to the root node, expand-all restores", async ({
  page,
}, testInfo) => {
  await loadGraph(
    page,
    buildGraphJson(),
    `collapse-${testInfo.workerIndex}.json`
  );
  const full = await page.locator(".react-flow__node").count();
  expect(full).toBeGreaterThan(10);

  await page.locator('button[aria-label="Collapse all"]').click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);

  // The button flips to expand mode; expanding restores the whole graph.
  await page.locator('button[aria-label="Expand all"]').click();
  await expect(page.locator(".react-flow__node")).toHaveCount(full);
});

test("search zooms to fit the matched node and cycles matches", async ({
  page,
}, testInfo) => {
  await loadGraph(
    page,
    buildGraphJson(),
    `search-${testInfo.workerIndex}.json`
  );

  // Whole-graph fit leaves us zoomed out.
  const fitScale = await viewportScale(page);

  await page.locator('button[aria-label="Search"]').click();
  const input = page.locator('input[placeholder^="Search nodes"]');
  await input.fill("preferences"); // one deep match

  // Exactly one node is highlighted, and it's the match.
  const highlighted = page.locator(".react-flow__node:has(.ring-2)");
  await expect(highlighted).toHaveCount(1);
  await expect(highlighted).toContainText("preferences");

  // The fix: it must zoom IN to the node, not stay at the fit-to-view scale.
  await expect.poll(() => viewportScale(page)).toBeGreaterThan(fitScale + 0.1);

  // A term with many matches cycles on Enter, moving the camera each step.
  await input.fill("config");
  await expect(page.getByText(/^1\/\d+$/)).toBeVisible();
  const before = await page
    .locator(".react-flow__viewport")
    .evaluate((el) => (el as HTMLElement).style.transform);

  await input.press("Enter");
  await expect(page.getByText(/^2\/\d+$/)).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".react-flow__viewport")
        .evaluate((el) => (el as HTMLElement).style.transform)
    )
    .not.toBe(before);
});

test("rotate layout re-lays-out without losing nodes", async ({
  page,
}, testInfo) => {
  await loadGraph(
    page,
    buildGraphJson(),
    `rotate-${testInfo.workerIndex}.json`
  );
  const count = await page.locator(".react-flow__node").count();

  await page.locator('button[aria-label="Rotate layout"]').click();
  await expect(page.locator(".react-flow__node")).toHaveCount(count);
});
