import {test, expect} from "@playwright/test";
import {writeFileSync} from "fs";
import {join} from "path";
import {tmpdir} from "os";

// Regression guard: appsettings-style JSON pasted with Windows paths
// (E:\logs\OO.API\log.txt) holds invalid escapes (\l, \O) and used to fail
// with "Invalid JSON format". The cleanup pass now doubles lone backslashes.

async function load(
  page: import("@playwright/test").Page,
  json: string,
  name: string
) {
  const file = join(tmpdir(), name);
  writeFileSync(file, json);
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(file);
}

test("a Windows path with invalid escapes parses with its backslashes intact", async ({
  page,
}, testInfo) => {
  await load(
    page,
    '{\n  "Serilog/WriteTo[1]/Args/path": "E:\\logs\\OO.API\\log.txt"\n}',
    `winpath-${testInfo.workerIndex}.json`
  );
  const row = page.locator(".json-node", {hasText: "Serilog/WriteTo[1]"});
  await expect(row).toBeVisible({timeout: 15_000});
  await expect(row).toContainText("E:\\logs\\OO.API\\log.txt");
});

test("valid escapes survive next to a lone backslash", async ({
  page,
}, testInfo) => {
  // \u0041 and \" are valid and must not be doubled; \U (C:\Users) is not.
  await load(
    page,
    '{"p": "C:\\Users\\x", "a": "\\u0041", "q": "say \\"hi\\""}',
    `winpath-mixed-${testInfo.workerIndex}.json`
  );
  await expect(
    page.locator(".json-node", {hasText: "C:\\Users\\x"})
  ).toBeVisible({timeout: 15_000});
  await expect(page.locator(".json-node", {hasText: '"A"'})).toBeVisible();
  await expect(page.locator(".json-node", {hasText: 'say "hi"'})).toBeVisible();
});

test("dark editor punctuation is readable, not the disabled grey", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    document.documentElement.setAttribute("data-mode", "ink")
  );
  await page.locator(".cm-content").click();
  await page.keyboard.type('{"a": 1}');
  const color = await page.evaluate(() => {
    const el = [...document.querySelectorAll(".cm-line span")].find(
      (s) => s.textContent === ":"
    );
    return el ? getComputedStyle(el).color : null;
  });
  // --faint-2 is #565249 (86,82,73); --faint is #8b857b (139,133,123).
  expect(color).not.toBeNull();
  expect(color).not.toBe("rgb(86, 82, 73)");
  expect(color).toBe("rgb(139, 133, 123)");
});
