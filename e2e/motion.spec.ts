import {test, expect} from "@playwright/test";

// The ambient motion is an arrival, not a loop. This is a tool people keep
// open next to their work, and something that never stops moving in the
// corner of the eye stops being ambient and becomes something to look away
// from. An `infinite` is easy to reintroduce and impossible to notice in a
// diff, so it is asserted on here.

test("nothing on the page animates forever", async ({page}) => {
  await page.goto("/");

  const infinite = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.effect?.getTiming().iterations === Infinity)
      .map((a) => (a as CSSAnimation).animationName ?? "unnamed")
  );

  expect(infinite).toEqual([]);
});

test("the ambient motion settles, and leaves the ground visible", async ({
  page,
}) => {
  await page.goto("/");

  // Jump every animation to its end rather than waiting out the longest
  // (26s) — the resting state is what matters, not the wall clock.
  await page.evaluate(() => {
    document.getAnimations().forEach((a) => a.finish());
  });

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.getAnimations().filter((a) => a.playState === "running")
            .length
      )
    )
    .toBe(0);

  // Settled, not disappeared: the glow and the grid are what give the app
  // depth, so they have to rest somewhere visible rather than fade out.
  await expect(page.locator(".glow--hi")).toHaveCSS("opacity", "0.55");
  await expect(page.locator(".grid-layer")).toBeVisible();

  // And the seam's beam ends off-screen, so no band is left lit.
  const beamAtRest = await page.evaluate(() => {
    const seam = document.querySelector(".seam")!;
    return getComputedStyle(seam, "::after").backgroundPosition;
  });
  expect(beamAtRest).toMatch(/calc\(0% ?- ?240px\)/);
});
