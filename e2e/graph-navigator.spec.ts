import {test, expect, type Page} from "@playwright/test";
import {writeFileSync} from "fs";
import {join} from "path";
import {tmpdir} from "os";

// E2E coverage for the Navigator inside the Visualizer: the same panel the
// Viewer tab carries, floated over the canvas as a window that can be folded
// away, and wired so ticking a branch opens that branch in the graph.

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
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
}

const navRow = (page: Page, key: string) =>
  page.getByTestId("nav-row").filter({hasText: key}).first();

// Count the graph nodes whose title is exactly `title` (node titles are the
// key that holds them, so "config" names one node per service).
const nodesTitled = (page: Page, title: string) =>
  page.locator(".react-flow__node").filter({hasText: title}).count();

test("the Navigator rides along in the Visualizer and folds away on demand", async ({
  page,
}, testInfo) => {
  await loadGraph(page, buildGraphJson(), `gnav-${testInfo.workerIndex}.json`);

  const panel = page.getByTestId("json-navigator");
  await expect(panel).toBeVisible();

  const opener = page.getByRole("button", {name: "Open the Navigator"});
  await expect(opener).toHaveCount(0);

  await page.getByRole("button", {name: "Minimize the Navigator"}).click();
  await expect(panel).toHaveCount(0);
  await expect(opener).toBeVisible();

  await opener.click();
  await expect(panel).toBeVisible();
  await expect(opener).toHaveCount(0);
});

test("ticking a branch opens it in the graph and folds the rest away", async ({
  page,
}, testInfo) => {
  // The Navigator's contract, same as in the Viewer: one branch open, its
  // whole subtree with it, everything beside it closed.
  await loadGraph(page, buildGraphJson(), `gpick-${testInfo.workerIndex}.json`);

  const before = await page.locator(".react-flow__node").count();
  expect(await nodesTitled(page, "config")).toBe(12);

  await navRow(page, "service_3").click();

  // Only service_3 keeps its children; the other eleven collapse to their head.
  await expect.poll(() => nodesTitled(page, "config")).toBe(1);
  expect(await page.locator(".react-flow__node").count()).toBeLessThan(before);

  // And the opened branch is framed, not left somewhere off canvas.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const pane = document.querySelector(".react-flow__pane");
          const node = [...document.querySelectorAll(".react-flow__node")].find(
            (n) => (n.textContent ?? "").includes("owner")
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
        }),
      {timeout: 5_000}
    )
    .toBe(true);

  // Ticking it again hands the document back to its top level.
  await navRow(page, "service_3").click();
  await expect.poll(() => nodesTitled(page, "config")).toBe(0);
});

// The card element inside a React Flow node wrapper — the one that carries the
// selection styling.
const cardOf = (page: Page, title: string) =>
  page.locator(".react-flow__node", {hasText: title}).first().locator("> div");

const backgrounds = (page: Page, title: string) =>
  cardOf(page, title).evaluate((el) => {
    const s = getComputedStyle(el);
    return {image: s.backgroundImage, color: s.backgroundColor};
  });

test("picking a branch washes the whole object, not just its head card", async ({
  page,
}, testInfo) => {
  // Parity with the tree, where a picked object is washed down its whole
  // subtree: on the canvas every card inside the branch carries the wash, and
  // nothing outside it does.
  await loadGraph(page, buildGraphJson(), `gwash-${testInfo.workerIndex}.json`);

  const plain = await backgrounds(page, "service_5");
  expect(plain.image).toBe("none");

  await navRow(page, "service_3").click();

  // The head card is the solid selection colour, distinct from an untouched
  // card, and rings itself.
  const head = await backgrounds(page, "service_3");
  expect(head.color).not.toBe(plain.color);
  expect(
    await cardOf(page, "service_3").evaluate(
      (el) => getComputedStyle(el).boxShadow
    )
  ).not.toBe("none");

  // Everything inside the branch is washed…
  for (const title of ["config", "meta"]) {
    expect((await backgrounds(page, title)).image).toContain("gradient");
  }

  // …and its siblings are left alone.
  expect((await backgrounds(page, "service_5")).image).toBe("none");
});
