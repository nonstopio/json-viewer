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

test("a folded branch folds its own values too, not just its children", async ({
  page,
}, testInfo) => {
  // Folding used to hide a node's nested children but leave its scalar fields
  // on the card, so a "folded" node stayed as tall as an open one and a graph
  // with one branch picked still read as a wall of cards.
  await loadGraph(page, buildGraphJson(), `gfold-${testInfo.workerIndex}.json`);

  const sibling = page
    .locator(".react-flow__node", {hasText: "service_5"})
    .first();
  await expect(sibling).toContainText("svc 5");

  await navRow(page, "service_3").click();

  // Head and child count only — the picked branch keeps its values.
  await expect(sibling).not.toContainText("svc 5");
  await expect(sibling).toContainText("service_5");
  await expect(
    page.locator(".react-flow__node", {hasText: "service_3"}).first()
  ).toContainText("svc 3");
});

test("a branch picked in one tab is the branch the other tab opens on", async ({
  page,
}, testInfo) => {
  // The selection is shared, but each view kept its own idea of what was open:
  // arriving in the Visualizer showed the whole document however deep you had
  // drilled in the Viewer, and picking here never folded the tree back there.
  const file = join(tmpdir(), `gcarry-${testInfo.workerIndex}.json`);
  writeFileSync(file, buildGraphJson());
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(file); // → Viewer
  await expect(page.getByTestId("json-navigator")).toBeVisible();

  // Pick in the Viewer, then cross over.
  await navRow(page, "service_3").click();
  await page.getByRole("button", {name: "Visualizer", exact: true}).click();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();

  // The graph opens folded to that branch…
  await expect.poll(() => nodesTitled(page, "config")).toBe(1);
  // …and framed, rather than parked over the layout it replaced. (The camera
  // used to fit the unfolded graph, leaving an empty canvas.)
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const pane = document.querySelector(".react-flow__pane");
          const node = [...document.querySelectorAll(".react-flow__node")].find(
            (n) => (n.textContent ?? "").includes("service_3")
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

  // Pick a different branch here, and cross back.
  await navRow(page, "service_7").click();
  await page.getByRole("button", {name: "Viewer", exact: true}).click();

  // The tree is folded to it too: service_7 open to its leaves, the rest shut.
  await expect(
    page.locator(".json-node", {hasText: "team7"}).first()
  ).toBeVisible();
  await expect(page.locator(".json-node", {hasText: "team3"})).toHaveCount(0);
  await expect(
    page.getByTestId("nav-graph").locator("input:checked")
  ).toHaveCount(1);
});
