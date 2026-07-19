import {test, expect} from "@playwright/test";

// Regression guard for the large-file freeze: a multi-MB JSON array used to
// mount tens of thousands of tree rows (and detail-panel rows), locking the
// tab. The tree is now virtualized and the detail panel is capped, so only a
// handful of rows should ever be mounted regardless of file size.

// Build a >5MB JSON array of realistic records (mirrors the shape users load).
function buildLargeJson(targetBytes: number): string {
  const items: unknown[] = [];
  let size = 2; // "[]"
  let i = 0;
  while (size < targetBytes) {
    const obj = {
      name: `Person Number ${i} Longnamehere`,
      email: `person.number.${i}@examplecompany.com`,
      address: `${1000 + i} Some Reasonably Long Street Name\nSomeCity, ST ${10000 + (i % 90000)}`,
      phone: `+1-555-${String(1000000 + i).slice(-7)} x${i % 9999}`,
      website: "https://examplefile.com",
    };
    items.push(obj);
    size += JSON.stringify(obj).length + 1;
    i++;
  }
  return JSON.stringify(items);
}

test("loads a >5MB JSON without freezing and stays virtualized", async ({
  page,
}) => {
  const json = buildLargeJson(5 * 1024 * 1024 + 200_000); // ~5.2MB
  expect(json.length).toBeGreaterThan(5 * 1024 * 1024);

  await page.goto("/");

  // Paste into the input and parse (this switches to the Viewer tab).
  await page.locator("textarea").fill(json);
  const started = Date.now();
  await page.getByRole("button", {name: "Parse JSON"}).click();

  // The tree must render (not freeze). Generous timeout catches a real freeze;
  // in practice this is well under a second.
  const firstRow = page.locator(".json-node").first();
  await expect(firstRow).toBeVisible({timeout: 15_000});
  const renderMs = Date.now() - started;

  // The core invariant: virtualization keeps the mounted row count tiny even
  // though the document has ~30k top-level items. If virtualization regresses,
  // this explodes into the thousands and the assertion fails.
  const mountedRows = await page.locator(".json-node").count();
  expect(mountedRows).toBeLessThan(200);

  // Detail panel (root array selected) must be capped, not rendering 30k rows.
  await expect(page.getByText(/Showing first \d+ of \d+/)).toBeVisible();

  // Memory guard: an un-virtualized render of this file consumed multiple GB.
  // The bounded render should sit in the low hundreds of MB. performance.memory
  // is Chromium-only, so only assert when it's present.
  const heapMB = await page.evaluate(() => {
    const m = (performance as unknown as {memory?: {usedJSHeapSize: number}})
      .memory;
    return m ? m.usedJSHeapSize / 1048576 : null;
  });
  if (heapMB !== null) {
    expect(heapMB).toBeLessThan(500);
  }

  // eslint-disable-next-line no-console
  console.log(
    `load.spec: ${(json.length / 1024 / 1024).toFixed(2)}MB rendered in ${renderMs}ms, ${mountedRows} rows mounted, heap ${heapMB ? heapMB.toFixed(0) + "MB" : "n/a"}`
  );

  // Sanity: the tree is interactive — toggling the root row collapses it to a
  // single row (and doesn't freeze). The root auto-expands on load, so its
  // toggle is the first aria-labelled button in the tree.
  await page.locator(".json-node button[aria-label]").first().click();
  await expect(page.locator(".json-node")).toHaveCount(1);
});

test("shows long values in full (wraps to multiple lines, not truncated)", async ({
  page,
}) => {
  const longValue =
    "LONG_VALUE_START " +
    "lorem ipsum dolor sit amet ".repeat(30) +
    "LONG_VALUE_END";
  const json = JSON.stringify({shortKey: "small", description: longValue});

  await page.goto("/");
  await page.locator("textarea").fill(json);
  await page.getByRole("button", {name: "Parse JSON"}).click();

  const descRow = page.locator(".json-node", {hasText: "description"});
  const shortRow = page.locator(".json-node", {hasText: "shortKey"});
  await expect(descRow).toBeVisible();

  // The entire value must be present in the tree — nothing truncated away.
  await expect(descRow).toContainText("LONG_VALUE_START");
  await expect(descRow).toContainText("LONG_VALUE_END");

  // And it must actually wrap: the long-value row is much taller than a
  // single-line row (guards against a regression back to one-line truncation).
  const descBox = await descRow.boundingBox();
  const shortBox = await shortRow.boundingBox();
  expect(descBox).not.toBeNull();
  expect(shortBox).not.toBeNull();
  expect(descBox!.height).toBeGreaterThan(shortBox!.height * 3);
});
