import {test, expect, type Page} from "@playwright/test";
import {writeFileSync} from "fs";
import {join} from "path";
import {tmpdir} from "os";

// E2E coverage for the reworked Viewer tab: the expand/collapse buttons moved
// out of the search row and next to the "JSON Tree" title, the search box no
// longer stretches across the toolbar, and the unused "Property Details" table
// was replaced by the Navigator panel (breadcrumb + drill-down + isolate).

// A document with one wide container (so collapsing it genuinely reflows the
// tree), one deep chain (so drilling needs several levels), and three
// `marker` keys in different casings (so case sensitivity is observable).
function buildFixture(): string {
  const alpha: Record<string, string> = {};
  for (let i = 0; i < 40; i++) alpha[`alphaKey${i}`] = `value ${i}`;
  // `beta` comes first so both it and the head of `alpha` are inside the
  // virtualized window without scrolling.
  return JSON.stringify({
    beta: {level2: {marker: "second", level3: {target: "found me", depth: 3}}},
    alpha,
    gamma: [{id: 0, MARKER: "third"}, {id: 1}, {id: 2}],
    Marker: "first",
  });
}

// Load JSON through the file-upload path (the JSON tab is a virtualized editor,
// not a fillable textarea). Uploading auto-switches to the Viewer tab.
async function loadViewer(page: Page, json: string, name: string) {
  const file = join(tmpdir(), name);
  writeFileSync(file, json);
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(page.getByTestId("json-navigator")).toBeVisible();
}

const navRow = (page: Page, key: string) =>
  page.getByTestId("nav-row").filter({hasText: key}).first();

const searchInput = (page: Page) =>
  page.locator('input[placeholder^="Search JSON"]');

// The match counter only renders while a query has hits.
const matchCounter = (page: Page) => page.getByText(/^\d+ of \d+$/);

test("expand/collapse-all sit in the tree header, not in the search row", async ({
  page,
}, testInfo) => {
  // Guards the relocation: the two fold buttons used to live to the left of the
  // search input and must now sit immediately after the "JSON Tree" title.
  await loadViewer(
    page,
    buildFixture(),
    `vn-fold-${testInfo.workerIndex}.json`
  );

  const title = page.getByText("JSON Tree", {exact: true});
  const expandAll = page.getByRole("button", {name: "Expand all nodes"});
  const collapseAll = page.getByRole("button", {name: "Collapse all nodes"});

  // Only one of each while the fullscreen overlay is closed.
  await expect(expandAll).toHaveCount(1);
  await expect(collapseAll).toHaveCount(1);

  const titleBox = (await title.boundingBox())!;
  const expandBox = (await expandAll.boundingBox())!;
  const collapseBox = (await collapseAll.boundingBox())!;
  const inputBox = (await searchInput(page).boundingBox())!;

  // Right of the title, on the same header line…
  expect(expandBox.x).toBeGreaterThan(titleBox.x + titleBox.width - 1);
  expect(collapseBox.x).toBeGreaterThan(expandBox.x);
  expect(Math.abs(expandBox.y - titleBox.y)).toBeLessThan(titleBox.height);

  // …and below the search row, which is where they used to be.
  expect(expandBox.y).toBeGreaterThan(inputBox.y + inputBox.height);

  // They still do their job from the new position.
  await collapseAll.click();
  await expect(page.locator(".json-node")).toHaveCount(1);
  await expandAll.click();
  // Virtualization caps how many rows are mounted, so assert "many again"
  // rather than the document's row count.
  expect(await page.locator(".json-node").count()).toBeGreaterThan(5);
});

test("the search box is capped in width and stays left-aligned", async ({
  page,
}, testInfo) => {
  // Guards the narrowed input: it used to be `flex-1` and swallow the toolbar.
  await loadViewer(
    page,
    buildFixture(),
    `vn-width-${testInfo.workerIndex}.json`
  );

  const inputBox = (await searchInput(page).boundingBox())!;
  const viewport = await page.evaluate(() => window.innerWidth);

  expect(inputBox.width).toBeLessThan(viewport / 2);
  expect(inputBox.width).toBeLessThanOrEqual(460); // max-w-md === 28rem
  // Still the first thing in the row, not centred or pushed right.
  expect(inputBox.x).toBeLessThan(100);

  // The case-sensitivity button follows it immediately instead of floating at
  // the far end of a stretched row.
  const aaBox = (await page
    .getByRole("button", {name: "Aa", exact: true})
    .boundingBox())!;
  expect(aaBox.x).toBeGreaterThan(inputBox.x + inputBox.width - 1);
  expect(aaBox.x).toBeLessThan(inputBox.x + inputBox.width + 40);
});

test("search still counts matches and navigates between them", async ({
  page,
}, testInfo) => {
  // Guards that narrowing the input did not break search/match navigation.
  await loadViewer(
    page,
    buildFixture(),
    `vn-search-${testInfo.workerIndex}.json`
  );

  await searchInput(page).fill("marker");
  // Three `marker` keys, case-insensitive by default.
  await expect(matchCounter(page)).toHaveText("1 of 3");

  await searchInput(page).press("Enter");
  await expect(matchCounter(page)).toHaveText("2 of 3");

  await page.locator('button[data-tooltip^="Next match"]').click();
  await expect(matchCounter(page)).toHaveText("3 of 3");

  // Wraps forward, and Shift+Enter walks back.
  await searchInput(page).press("Enter");
  await expect(matchCounter(page)).toHaveText("1 of 3");
  await searchInput(page).press("Shift+Enter");
  await expect(matchCounter(page)).toHaveText("3 of 3");
  await page.locator('button[data-tooltip^="Previous match"]').click();
  await expect(matchCounter(page)).toHaveText("2 of 3");

  // The matches are highlighted in the tree while the query is live…
  expect(await page.locator(".json-node mark").count()).toBeGreaterThan(0);

  // …and the clear button drops both the counter and the highlighting.
  await page.locator('button[data-tooltip="Clear search"]').click();
  await expect(searchInput(page)).toHaveValue("");
  await expect(matchCounter(page)).toHaveCount(0);
  await expect(page.locator(".json-node mark")).toHaveCount(0);
});

test("the case-sensitivity toggle narrows the matches", async ({
  page,
}, testInfo) => {
  // Guards the `Aa` toggle, which shares the re-laid-out search row.
  await loadViewer(
    page,
    buildFixture(),
    `vn-case-${testInfo.workerIndex}.json`
  );

  await searchInput(page).fill("marker");
  await expect(matchCounter(page)).toHaveText("1 of 3");

  // Only `beta.level2.marker` is lowercase.
  await page.getByRole("button", {name: "Aa", exact: true}).click();
  await expect(matchCounter(page)).toHaveText("1 of 1");

  await page.getByRole("button", {name: "Aa", exact: true}).click();
  await expect(matchCounter(page)).toHaveText("1 of 3");
});

test("the navigator drills down and the breadcrumb walks back up", async ({
  page,
}, testInfo) => {
  // Guards the panel that replaced the Property Details table: each container
  // row descends one level and the crumb strip is the way back.
  await loadViewer(
    page,
    buildFixture(),
    `vn-drill-${testInfo.workerIndex}.json`
  );

  // Root level lists every top-level key with a container summary/preview.
  await expect(page.getByTestId("nav-row")).toHaveCount(4);
  await expect(navRow(page, "alpha")).toContainText("40 keys");
  await expect(navRow(page, "gamma")).toContainText("3 items");
  await expect(navRow(page, "Marker")).toContainText('"first"');

  await navRow(page, "beta").click();
  await expect(page.getByTestId("nav-breadcrumb")).toContainText("beta");
  await expect(navRow(page, "level2")).toBeVisible();

  await navRow(page, "level2").click();
  await expect(navRow(page, "level3")).toBeVisible();

  await navRow(page, "level3").click();
  await expect(navRow(page, "target")).toContainText('"found me"');

  // Back up two levels via the breadcrumb.
  await page
    .getByTestId("nav-breadcrumb")
    .getByRole("button", {name: "beta", exact: true})
    .click();
  await expect(navRow(page, "level2")).toBeVisible();
  await expect(page.getByTestId("nav-row")).toHaveCount(1);
});

test("clicking a navigator row expands the node's ancestors in the tree", async ({
  page,
}, testInfo) => {
  // Guards revealNode(): a node three levels down is not in the flat tree list
  // until its collapsed ancestors are expanded.
  await loadViewer(
    page,
    buildFixture(),
    `vn-reveal-${testInfo.workerIndex}.json`
  );

  // level3's contents are folded away on load (only the first two levels
  // auto-expand).
  await expect(page.locator(".json-node", {hasText: "found me"})).toHaveCount(
    0
  );

  await navRow(page, "beta").click();
  await navRow(page, "level2").click();
  await navRow(page, "level3").click();

  await expect(
    page.locator(".json-node", {hasText: "found me"}).first()
  ).toBeVisible();
});

test("a selection deep in a long document is scrolled into the tree viewport", async ({
  page,
}, testInfo) => {
  // Guards the scroll-into-view effect in JsonTree: with virtualization the
  // picked row is not even mounted, so the user would otherwise see nothing.
  const data: Record<string, unknown> = {};
  for (let i = 0; i < 150; i++) data[`key${i}`] = `value ${i}`;
  data.needle = "bottom of the document";
  await loadViewer(
    page,
    JSON.stringify(data),
    `vn-scroll-${testInfo.workerIndex}.json`
  );

  const scroller = page.locator(".json-tree-container");
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(0);

  await navRow(page, "needle").click();

  const needleRow = page.locator(".json-node", {hasText: "needle"}).first();
  await expect(needleRow).toBeVisible();
  await expect
    .poll(async () => scroller.evaluate((el) => el.scrollTop), {timeout: 5000})
    .toBeGreaterThan(0);

  // And it really is inside the visible part of the tree pane, not just mounted.
  const paneBox = (await scroller.boundingBox())!;
  const rowBox = (await needleRow.boundingBox())!;
  expect(rowBox.y).toBeGreaterThanOrEqual(paneBox.y - 1);
  expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(
    paneBox.y + paneBox.height + 1
  );
});

test("the isolate button keeps one node open and folds its siblings", async ({
  page,
}, testInfo) => {
  // Guards the per-row isolate action — the whole point of the panel is to cut
  // the scrolling needed to reach one branch.
  await loadViewer(
    page,
    buildFixture(),
    `vn-isolate-${testInfo.workerIndex}.json`
  );

  // alpha, beta and gamma are all expanded on load.
  await expect(page.locator(".json-node", {hasText: "alphaKey0"})).toHaveCount(
    1
  );
  await expect(page.locator(".json-node", {hasText: "level2"})).toHaveCount(1);

  await page.getByRole("button", {name: 'Show only "beta"'}).click();

  // alpha's 40 rows and gamma's items are folded away; beta stays open.
  await expect(page.locator(".json-node", {hasText: "alphaKey0"})).toHaveCount(
    0
  );
  await expect(page.locator(".json-node", {hasText: "level2"})).toHaveCount(1);
  await expect(
    page.locator(".json-node", {hasText: "alpha"}).first()
  ).toBeVisible();

  // Isolating also makes it the current level in the navigator.
  await expect(page.getByTestId("nav-breadcrumb")).toContainText("beta");
});

test("the navigator shows an empty state and the old table view is gone", async ({
  page,
}) => {
  // Guards the removal of JsonTableView: no "Property Details" panel anywhere,
  // loaded or not, and the navigator explains itself when there is no data.
  await page.goto("/");
  await page.getByRole("button", {name: "Viewer", exact: true}).click();

  await expect(page.getByTestId("json-navigator")).toContainText(
    "Load JSON to navigate its structure"
  );
  await expect(page.getByText("Property Details")).toHaveCount(0);
});

test("no Property Details panel once JSON is loaded either", async ({
  page,
}, testInfo) => {
  // Same removal guard, but with data present — that is when the old table
  // used to render.
  await loadViewer(
    page,
    buildFixture(),
    `vn-gone-${testInfo.workerIndex}.json`
  );

  await expect(page.getByText("Property Details")).toHaveCount(0);
  await expect(page.getByTestId("json-navigator")).toBeVisible();
});
