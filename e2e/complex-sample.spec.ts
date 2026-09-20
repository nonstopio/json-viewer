import {test, expect} from "@playwright/test";

// The "Load Complex Test JSON" button exists to show what the tool does, so
// the sample behind it has two properties worth pinning: it is varied enough
// to exercise every shape the viewer renders, and it is small enough that the
// Visualizer draws all of it. Both are easy to break by editing the sample —
// growing it past the truncation threshold turns the demo into an apology
// notice, and trimming it removes the shapes it is there to demonstrate.

test("the complex sample loads, parses, and covers every value shape", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", {name: "Load Complex Test JSON"}).click();

  // It parses — the toolbar actions that need valid JSON come alive.
  await expect(page.getByRole("button", {name: "Share"})).toBeEnabled();

  await page.getByRole("button", {name: "Viewer", exact: true}).click();
  await expect(page.locator(".json-tree-container")).toBeVisible();

  // The tree is virtualized, so off-screen rows aren't in the DOM — search
  // the parsed model instead, which is what these shapes need to survive in.
  const search = page.locator('input[placeholder^="Search JSON"]');
  const hits = async (q: string) => {
    await search.fill(q);
    await expect(page.getByText(/^\d+ of \d+$/)).toBeVisible();
    const text = await page.getByText(/^\d+ of \d+$/).textContent();
    return Number(text!.split(" of ")[1]);
  };

  expect(await hits("null")).toBeGreaterThan(0); // nulls
  expect(await hits("142.75")).toBeGreaterThan(0); // floats
  expect(await hits("-2.41")).toBeGreaterThan(0); // negatives
  expect(await hits("मैकेनिकल")).toBeGreaterThan(0); // unicode
  expect(await hits("warehouse")).toBeGreaterThan(2); // repeated keys
});

test("the complex sample renders in the Visualizer without truncation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", {name: "Load Complex Test JSON"}).click();
  await page.getByRole("button", {name: "Visualizer", exact: true}).click();

  await expect(page.locator(".react-flow__node").first()).toBeVisible();

  // The notice only appears when the graph had to drop nodes to stay
  // responsive. If this fires, the sample has outgrown its purpose.
  await expect(
    page.getByText("Large documents aren’t supported yet")
  ).toHaveCount(0);

  // Enough nodes to look like a real payload, few enough to stay readable.
  const count = await page.locator(".react-flow__node").count();
  expect(count).toBeGreaterThan(50);
  expect(count).toBeLessThan(150);
});
