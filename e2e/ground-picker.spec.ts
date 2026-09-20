import {test, expect} from "@playwright/test";

// The ground picker is a segmented strip, not a dropdown: with three choices,
// the current one should be readable without opening anything. It is also the
// only control that writes <html data-mode>, which is what re-resolves every
// role token in src/styles/tokens.css — so if this stops applying, the whole
// theme stops switching.

test("the ground picker applies a ground without opening anything", async ({
  page,
}) => {
  await page.goto("/");
  const picker = page.getByRole("group", {name: "Colour ground"});
  await expect(picker).toBeVisible();

  // All three choices are on screen at once — nothing to expand.
  await expect(picker.getByRole("button")).toHaveText(["Ink", "Paper", "Auto"]);

  await picker.getByRole("button", {name: "Paper"}).click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "paper");
  await expect(picker.getByRole("button", {name: "Paper"})).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  await picker.getByRole("button", {name: "Ink"}).click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "ink");

  // The choice survives a reload, and is applied before first paint rather
  // than after React mounts — so there is no flash of the other ground.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "ink");
});

test("a ground swap re-resolves every role, including outside the bundle", async ({
  page,
}) => {
  await page.goto("/");
  const picker = page.getByRole("group", {name: "Colour ground"});
  const role = (name: string) =>
    page.evaluate(
      (n) =>
        getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
      `--${name}`
    );

  await picker.getByRole("button", {name: "Ink"}).click();
  const ink = {
    bg: await role("bg"),
    ink: await role("ink"),
    string: await role("json-string"),
  };

  await picker.getByRole("button", {name: "Paper"}).click();
  const paper = {
    bg: await role("bg"),
    ink: await role("ink"),
    string: await role("json-string"),
  };

  // Surfaces, text and syntax all move — a ground defines the whole set, not
  // just the page colour.
  expect(paper.bg).not.toBe(ink.bg);
  expect(paper.ink).not.toBe(ink.ink);
  expect(paper.string).not.toBe(ink.string);

  // The About panel is styled by a <style> block in index.html, outside the
  // bundle entirely. It still has to follow the ground. (body transitions its
  // colours, so this polls rather than reading once.)
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          getComputedStyle(document.querySelector(".about-panel")!)
            .backgroundColor
      )
    )
    .toBe("rgb(231, 227, 218)"); // paper's --panel
});

// The chrome is square — hairline rules, not rounded cards. A stray
// `rounded-*` from a utility class or a library's own stylesheet is the
// easiest way for that to erode, and it reads as "almost right" rather than
// as wrong, so it survives review. The only exception is a genuine circle:
// the spinner and the scrollbar thumb are round because they are not boxes.
test("no box in the app has rounded corners", async ({page}) => {
  const ROUND_BY_NATURE = /animate-spin/;

  const rounded = async () =>
    page.evaluate(
      (pattern) =>
        [...document.querySelectorAll("*")]
          .filter((el) => {
            const r = getComputedStyle(el).borderRadius;
            return r && r !== "0px" && r !== "0%";
          })
          .filter((el) => !new RegExp(pattern).test(String(el.className)))
          .map(
            (el) =>
              `${el.tagName}.${String(el.className).slice(0, 40)} → ${
                getComputedStyle(el).borderRadius
              }`
          ),
      ROUND_BY_NATURE.source
    );

  await page.goto("/");
  await page.getByRole("button", {name: "Load Complex Test JSON"}).click();
  expect(await rounded()).toEqual([]);

  await page.getByRole("button", {name: "Viewer", exact: true}).click();
  await expect(page.locator(".json-tree-container")).toBeVisible();
  expect(await rounded()).toEqual([]);

  // React Flow ships its own stylesheet, and its handles default to circles.
  await page.getByRole("button", {name: "Visualizer", exact: true}).click();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  expect(await rounded()).toEqual([]);
});
