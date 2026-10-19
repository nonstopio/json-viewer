import {test, expect} from "@playwright/test";

// CodeMirror draws a drag selection in a layer behind the text, so the
// active-line fill on the cursor's own line must stay translucent or it hides
// the selection. Checked in both grounds, since the fill is a colour-mix of
// --ink and resolves differently in each.

for (const mode of ["ink", "paper"]) {
  test(`a drag selection on the active line is visible (${mode})`, async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(
      (m) => document.documentElement.setAttribute("data-mode", m),
      mode
    );
    await page.locator(".cm-content").click();
    await page.keyboard.insertText('{\n  "path": "E:\\\\logs\\\\log.txt"\n}');

    const line = page.locator(".cm-line").nth(1);
    const box = (await line.boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + 8);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 8, {steps: 5});
    await page.mouse.up();

    expect(await page.evaluate(() => getSelection()!.toString())).not.toBe("");
    await expect(page.locator(".cm-selectionBackground")).toHaveCount(1);
    await expect(page.locator(".cm-activeLine")).toHaveCount(1);

    const alpha = await line.evaluate((el) => {
      const c = getComputedStyle(el).backgroundColor;
      return c.includes("/") ? parseFloat(c.split("/")[1]) : 1;
    });
    // Translucent so the selection shows through, but not gone: the active
    // line is still marked.
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(0.3);
  });
}
