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

// The regression this file exists for. The beam sits on bands that are
// conditionally rendered, so switching tabs unmounts and remounts them — and
// a remounted element restarts its CSS animation from the top. Checking only
// the initial load misses it entirely: the page settles, and then every tab
// switch replays the beam for as long as the session lasts.
test("a tab switch after the intro replays nothing", async ({page}) => {
  await page.clock.install();
  await page.goto("/");

  // The intro really does happen.
  await expect(page.locator(".intro")).toBeAttached();

  // Past the intro window (the footer beam is the longest, 13s on a 5s delay).
  await page.clock.fastForward("00:25");
  await expect(page.locator(".intro")).toHaveCount(0);

  // getAnimations() returns transitions as well as animations. A transition
  // is interaction feedback — a colour settling under the pointer — and is
  // not what "runs once on load" is about, so only named animations count.
  // Flush pending style before reading: a CSS animation on an element the
  // click just mounted does not exist until the next style recalc, so reading
  // straight away is an assertion that passes whether or not the gate is
  // there. A forced layout is clock-independent; rAF is not, and the fake
  // clock installed above would never fire it.
  const running = () =>
    page.evaluate(() => {
      document.body.getBoundingClientRect();
      return document
        .getAnimations()
        .filter((a) => a.playState === "running")
        .filter((a): a is CSSAnimation => "animationName" in a)
        .map((a) => a.animationName);
    });

  // The fake clock advances JS timers, not the compositor's animation
  // timeline, so the arrival animations on the never-unmounting layers are
  // still mid-flight. They are not what this test is about — land them, so
  // anything running afterwards can only have been started by a remount.
  await page.evaluate(() =>
    document.getAnimations().forEach((a) => a.finish())
  );
  expect(await running()).toEqual([]);

  await page.getByRole("button", {name: "Load Complex Test JSON"}).click();
  expect(await running()).toEqual([]);

  for (const tab of ["Viewer", "Visualizer", "JSON", "Viewer"]) {
    await page.getByRole("button", {name: tab, exact: true}).click();
    expect(await running()).toEqual([]);
  }
});
