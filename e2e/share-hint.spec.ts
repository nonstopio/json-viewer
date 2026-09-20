import {test, expect} from "@playwright/test";

// A one-time pointer at Share. Sharing is a feature you have to already know
// about to go looking for, so it is announced once — but only after the first
// successful parse, when there is finally something worth sharing. The rules
// it has to keep are: not on page load, dismissible, and never twice.

const hint = '[data-testid="share-hint"]';

// Everything else runs with the hint already dismissed (see
// playwright.config.ts); this file is the one that wants it fresh.
test.use({storageState: {cookies: [], origins: []}});

test("the hint waits for a parse, then shows once and never again", async ({
  page,
}) => {
  await page.goto("/");

  // Not on arrival: there is nothing to share yet, and a pointer at a
  // disabled button teaches nothing.
  await expect(page.locator(hint)).toHaveCount(0);
  await expect(page.getByRole("button", {name: "Share"})).toBeDisabled();

  await page.getByRole("button", {name: "Load Complex Test JSON"}).click();
  await expect(page.locator(hint)).toBeVisible();

  await page.locator(hint).getByRole("button", {name: "Got it"}).click();
  await expect(page.locator(hint)).toHaveCount(0);

  // Gone for good, across reloads.
  await page.reload();
  await page.getByRole("button", {name: "Load Complex Test JSON"}).click();
  await expect(page.getByRole("button", {name: "Share"})).toBeEnabled();
  await expect(page.locator(hint)).toHaveCount(0);
});

test("the hint dismisses on Escape", async ({page}) => {
  await page.goto("/");
  await page.getByRole("button", {name: "Load Complex Test JSON"}).click();
  await expect(page.locator(hint)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator(hint)).toHaveCount(0);
});

test("the hint is anchored under Share and follows the theme", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", {name: "Load Complex Test JSON"}).click();
  const box = page.locator(hint);
  await expect(box).toBeVisible();

  // Anchored below the button it describes, not floating loose.
  const share = await page.getByRole("button", {name: "Share"}).boundingBox();
  const hintBox = await box.boundingBox();
  expect(hintBox!.y).toBeGreaterThan(share!.y);
  expect(hintBox!.x + hintBox!.width).toBeCloseTo(share!.x + share!.width, 0);

  // Square, like the rest of the chrome.
  await expect(box).toHaveCSS("border-radius", "0px");
});
