import {test, expect, type Page} from "@playwright/test";
import {writeFileSync} from "fs";
import {join} from "path";
import {tmpdir} from "os";

// E2E coverage for the two Visualizer viewport features: a fullscreen toggle
// on the graph toolbar, and "keep the node you just toggled on screen".
// Before the latter, collapsing a large node reflowed the layout under a
// stationary camera — the user was left staring at an empty canvas and had to
// hunt for the node by dragging.

// A wide/nested document: the whole-graph fit is zoomed out and the root sits
// at the far left, so panning it off-screen (and collapsing it) is meaningful.
function buildGraphJson(): string {
  const data: Record<string, unknown> = {};
  for (let i = 0; i < 12; i++) {
    data[`service_${i}`] = {
      id: i,
      name: `svc ${i}`,
      config: {enabled: true, region: `r${i}`, meta: {owner: `team${i}`}},
    };
  }
  return JSON.stringify(data);
}

async function loadGraph(page: Page, json: string, name: string) {
  const file = join(tmpdir(), name);
  writeFileSync(file, json);
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(file); // → Viewer tab
  await page.getByRole("button", {name: "Visualizer", exact: true}).click();
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

// Does the node whose title contains `title` overlap the visible canvas?
function nodeOverlapsPane(page: Page, title: string): Promise<boolean> {
  return page.evaluate((t) => {
    const pane = document.querySelector(".react-flow__pane");
    const node = [...document.querySelectorAll(".react-flow__node")].find((n) =>
      (n.textContent ?? "").includes(t)
    );
    if (!pane || !node) return false;
    const p = pane.getBoundingClientRect();
    const r = node.getBoundingClientRect();
    return (
      r.left < p.right &&
      r.right > p.left &&
      r.top < p.bottom &&
      r.bottom > p.top
    );
  }, title);
}

// How many nodes stick out of the visible canvas (0 == the graph is fitted).
function nodesOutsidePane(page: Page): Promise<number> {
  return page.evaluate(() => {
    const pane = document.querySelector(".react-flow__pane");
    if (!pane) return -1;
    const p = pane.getBoundingClientRect();
    return [...document.querySelectorAll(".react-flow__node")].filter((n) => {
      const r = n.getBoundingClientRect();
      return (
        r.left < p.left - 1 ||
        r.right > p.right + 1 ||
        r.top < p.top - 1 ||
        r.bottom > p.bottom + 1
      );
    }).length;
  });
}

// The expand/collapse control of a node is its only button carrying text (the
// child count); the other one is the icon-only "copy path" button.
function toggleOf(page: Page, title: string) {
  return page
    .locator(".react-flow__node", {hasText: title})
    .first()
    .locator("button", {hasText: /^\d+$/});
}

const isFullscreen = (page: Page) =>
  page.evaluate(() => document.fullscreenElement !== null);

test("the toolbar fullscreen button enters and leaves fullscreen on the graph itself", async ({
  page,
}, testInfo) => {
  // Guards: the fullscreen affordance exists, is labelled, fullscreens the
  // graph wrapper (not the whole page) so the toolbar comes along, and the
  // icon/label flips to an exit control.
  await loadGraph(page, buildGraphJson(), `fs-${testInfo.workerIndex}.json`);

  const enter = page.getByRole("button", {name: "Fullscreen (F)", exact: true});
  await expect(enter).toBeVisible();
  await enter.click();

  const exit = page.getByRole("button", {
    name: "Exit fullscreen (Esc)",
    exact: true,
  });
  await expect(exit).toBeVisible();
  await expect(enter).toHaveCount(0);
  // The fullscreened element contains the toolbar, so the controls stay usable.
  expect(
    await exit.evaluate(
      (el) => document.fullscreenElement?.contains(el) ?? false
    )
  ).toBe(true);

  await exit.click();
  await expect(enter).toBeVisible();
  await expect(exit).toHaveCount(0);
  expect(await isFullscreen(page)).toBe(false);
});

test("'f' toggles fullscreen but is ignored while typing in the graph search box", async ({
  page,
}, testInfo) => {
  // Guards the shortcut and, more importantly, the typing guard: before it,
  // searching for anything containing "f" threw the user into fullscreen.
  await loadGraph(page, buildGraphJson(), `fskey-${testInfo.workerIndex}.json`);

  const enter = page.getByRole("button", {name: "Fullscreen (F)", exact: true});
  const exit = page.getByRole("button", {
    name: "Exit fullscreen (Esc)",
    exact: true,
  });

  await page.keyboard.press("f");
  await expect(exit).toBeVisible();
  await page.keyboard.press("f");
  await expect(enter).toBeVisible();
  expect(await isFullscreen(page)).toBe(false);

  await page.getByRole("button", {name: "Search", exact: true}).click();
  const input = page.locator('input[placeholder^="Search nodes"]');
  await input.press("f");
  await expect(input).toHaveValue("f");
  expect(await isFullscreen(page)).toBe(false);
  await expect(enter).toBeVisible();
});

test("collapsing a node that was panned off-screen brings it back into view", async ({
  page,
}, testInfo) => {
  // The reported bug: collapse a big node and the canvas goes blank because the
  // layout reflows while the camera stays put. Collapsing root is the extreme
  // case — the graph shrinks to that single node.
  await loadGraph(page, buildGraphJson(), `keep-${testInfo.workerIndex}.json`);

  await page.locator(".react-flow__pane").hover();
  // Pan until the root node has left the canvas (panOnScroll is enabled, so a
  // wheel gesture translates rather than zooms).
  await expect
    .poll(
      async () => {
        await page.mouse.wheel(400, 0);
        return nodeOverlapsPane(page, "root");
      },
      {timeout: 15_000}
    )
    .toBe(false);

  // Playwright refuses to click an element outside the viewport, so dispatch
  // the click on the element directly.
  await toggleOf(page, "root").evaluate((el) => (el as HTMLElement).click());
  await expect(page.locator(".react-flow__node")).toHaveCount(1);

  // Polling covers the 350ms pan animation without a fixed sleep.
  await expect
    .poll(() => nodeOverlapsPane(page, "root"), {timeout: 5_000})
    .toBe(true);
});

test("a single node toggle pans without resetting the user's zoom", async ({
  page,
}, testInfo) => {
  // Guards against re-fitting the whole graph on every toggle, which would
  // yank a user who had zoomed in to read one branch back out to the overview.
  await loadGraph(page, buildGraphJson(), `zoom-${testInfo.workerIndex}.json`);

  const fitScale = await viewportScale(page);
  const zoomIn = page.getByRole("button", {name: "Zoom in", exact: true});
  await zoomIn.click();
  await zoomIn.click();
  await expect.poll(() => viewportScale(page)).toBeGreaterThan(fitScale);
  const zoomed = await viewportScale(page);

  const before = await page.locator(".react-flow__node").count();
  await toggleOf(page, "service_0").evaluate((el) =>
    (el as HTMLElement).click()
  );
  await expect
    .poll(() => page.locator(".react-flow__node").count())
    .toBeLessThan(before);

  // Settle past both camera animations (350ms pan / 400ms fit) so a late
  // re-fit would be caught rather than raced.
  await page.waitForTimeout(900);
  expect(await viewportScale(page)).toBeCloseTo(zoomed, 2);
});

test("collapse-all and expand-all re-fit the whole graph", async ({
  page,
}, testInfo) => {
  // Before the fix these left the camera wherever it happened to be, so
  // collapse-all from a panned view showed nothing at all.
  await loadGraph(
    page,
    buildGraphJson(),
    `fitall-${testInfo.workerIndex}.json`
  );
  const full = await page.locator(".react-flow__node").count();
  expect(full).toBeGreaterThan(10);

  // Pan away so a re-fit is observable.
  await page.locator(".react-flow__pane").hover();
  await expect
    .poll(
      async () => {
        await page.mouse.wheel(400, 0);
        return nodeOverlapsPane(page, "root");
      },
      {timeout: 15_000}
    )
    .toBe(false);

  await page.getByRole("button", {name: "Collapse all", exact: true}).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect
    .poll(() => nodeOverlapsPane(page, "root"), {timeout: 5_000})
    .toBe(true);

  await page.getByRole("button", {name: "Expand all", exact: true}).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(full);
  await expect.poll(() => nodesOutsidePane(page), {timeout: 5_000}).toBe(0);
});
