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

test("a multi-MB document renders a bounded, interactive graph (no freeze)", async ({
  page,
}, testInfo) => {
  // A few-MB array — tens of thousands of objects. Uncapped this froze the tab.
  const items: unknown[] = [];
  let size = 2;
  let i = 0;
  while (size < 3_000_000) {
    const obj = {id: i, name: `Person ${i}`, email: `p${i}@example.com`};
    items.push(obj);
    size += JSON.stringify(obj).length + 1;
    i++;
  }
  const json = JSON.stringify(items);

  const started = Date.now();
  await loadGraph(page, json, `big-${testInfo.workerIndex}.json`);
  const renderMs = Date.now() - started;

  // The graph is capped, not exploded into tens of thousands of DOM nodes.
  expect(await page.locator(".react-flow__node").count()).toBeLessThanOrEqual(
    800
  );
  // And it rendered quickly rather than hanging.
  expect(renderMs).toBeLessThan(15_000);

  // The user is warned that the view is truncated.
  await expect(page.getByText(/showing .*of .*nodes/i)).toBeVisible();

  // Still interactive: zooming in responds.
  const before = await page
    .locator(".react-flow__viewport")
    .evaluate((el) => (el as HTMLElement).style.transform);
  await page.locator('button[aria-label="Zoom in"]').click();
  await expect
    .poll(() =>
      page
        .locator(".react-flow__viewport")
        .evaluate((el) => (el as HTMLElement).style.transform)
    )
    .not.toBe(before);
});

test("search counts each matching field as a separate hit and highlights the text", async ({
  page,
}, testInfo) => {
  // "ajay" occurs in two fields of the SAME node (firstName + email).
  const json = JSON.stringify({
    user: {firstName: "Ajay", lastName: "Kumar", email: "ajay.kumar@x.com"},
  });
  await loadGraph(page, json, `occur-${testInfo.workerIndex}.json`);

  await page.locator('button[aria-label="Search"]').click();
  await page.locator('input[placeholder^="Search nodes"]').fill("ajay");

  // Two occurrences → 2 matches, not 1 (the per-node-collapse bug).
  await expect(page.getByText(/^1\/2$/)).toBeVisible();

  // Both occurrences are wrapped in <mark> for visible text highlighting.
  const marks = page.locator(".react-flow__node mark");
  await expect.poll(() => marks.count()).toBeGreaterThanOrEqual(2);
  await expect(marks.first()).toHaveText(/ajay/i);
});

// Reads the current viewport transform (translate + scale).
function viewportTransform(page: Page): Promise<string> {
  return page
    .locator(".react-flow__viewport")
    .evaluate((el) => (el as HTMLElement).style.transform);
}
function scaleOf(t: string): number {
  const m = t.match(/scale\(([\d.]+)\)/);
  return m ? parseFloat(m[1]) : 1;
}

test("edges render with a visible stroke (not near-black on dark)", async ({
  page,
}, testInfo) => {
  await loadGraph(page, buildGraphJson(), `edges-${testInfo.workerIndex}.json`);

  const paths = page.locator(".react-flow__edge-path");
  await expect.poll(() => paths.count()).toBeGreaterThan(5);

  // Every edge must use our explicit slate stroke, not React Flow's dark
  // default (rgb(62,62,62)) that was invisible on the dark canvas.
  const stroke = await paths
    .first()
    .evaluate((el) => getComputedStyle(el).stroke);
  expect(["rgb(148, 163, 184)", "rgb(100, 116, 139)"]).toContain(stroke);
});

test("scroll pans the canvas, and center-first zooms to a readable level", async ({
  page,
}, testInfo) => {
  await loadGraph(page, buildGraphJson(), `pan-${testInfo.workerIndex}.json`);

  // The wide graph fits zoomed out.
  const fit = await viewportTransform(page);
  expect(scaleOf(fit)).toBeLessThan(1);

  // Wheel scroll must PAN (translate moves) without changing zoom.
  await page.locator(".react-flow__pane").hover();
  await page.mouse.wheel(40, 200);
  await expect.poll(() => viewportTransform(page)).not.toBe(fit);
  expect(scaleOf(await viewportTransform(page))).toBeCloseTo(scaleOf(fit), 2);

  // Center-first must zoom in to a readable scale (>= 1), not keep the fit zoom.
  await page.locator('button[aria-label="Center first item (⇧1)"]').click();
  await expect
    .poll(async () => scaleOf(await viewportTransform(page)))
    .toBeGreaterThanOrEqual(1);
});
