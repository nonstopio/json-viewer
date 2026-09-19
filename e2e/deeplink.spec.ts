import {test, expect, Page} from "@playwright/test";

// Deep links (src/utils/deepLink.ts): a link carries the document, either
// inline in the URL or by clipboard hand-off when it's too big to fit.

// Mirror of the producer side (public/open.js) so these tests fail if the two
// encodings ever drift apart.
async function encode(json: string): Promise<string> {
  const stream = new Blob([json])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const DOC = JSON.stringify({deepLink: "works", items: [1, 2, 3]});

function treeRow(page: Page, text: string) {
  return page.locator(".json-node", {hasText: text});
}

test("compressed #data link loads the document and opens the tree", async ({
  page,
}) => {
  await page.goto(`/#data=${await encode(DOC)}`);

  await expect(treeRow(page, "deepLink")).toBeVisible();
  await expect(treeRow(page, "works")).toBeVisible();

  // The payload must not survive in the address bar: no replay on refresh, and
  // nothing to leak by copying the URL after editing.
  expect(await page.evaluate(() => window.location.href)).not.toContain(
    "data="
  );
});

test("raw JSON travels in ?data= without any encoding", async ({page}) => {
  await page.goto(`/?data=${encodeURIComponent('{"plain":"json"}')}`);

  await expect(treeRow(page, "plain")).toBeVisible();
  await expect(treeRow(page, "json")).toBeVisible();
});

test("a literal % in raw JSON survives (not decoded twice)", async ({page}) => {
  // URLSearchParams already percent-decodes; decoding again would turn the
  // `%25` in this document back into a bare `%` and corrupt the value.
  await page.goto(`/?data=${encodeURIComponent('{"rate":"100%"}')}`);

  await expect(treeRow(page, "100%")).toBeVisible();
});

test("view= picks the tab the link lands on", async ({page}) => {
  await page.goto(`/#data=${await encode(DOC)}&view=graph`);

  // The Visualizer renders the document as a node graph rather than a tree.
  await expect(page.locator(".react-flow")).toBeVisible({timeout: 15_000});
  await expect(treeRow(page, "deepLink")).toHaveCount(0);
});

test("view=text opens the editor with the document loaded", async ({page}) => {
  await page.goto(`/#data=${await encode(DOC)}&view=text`);

  await expect(page.locator(".cm-content")).toContainText("deepLink");
});

test("a damaged link reports itself instead of failing silently", async ({
  page,
}) => {
  await page.goto("/#data=not-a-real-payload");

  await expect(page.getByText(/damaged or incomplete/i)).toBeVisible();
});

test("?data=clipboard reads the document from the clipboard", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.evaluate((doc) => navigator.clipboard.writeText(doc), DOC);

  await page.goto("/?data=clipboard");

  await expect(treeRow(page, "deepLink")).toBeVisible();
});

test("clipboard links fall back to a button when the read is refused", async ({
  page,
  context,
}) => {
  // No clipboard-read permission: the unprompted read rejects, exactly as it
  // does in Safari and Firefox, and the link must still be recoverable.
  await context.grantPermissions(["clipboard-write"]);
  await page.goto("/");
  await page.evaluate((doc) => navigator.clipboard.writeText(doc), DOC);
  await page.evaluate(() => {
    // Force the refusal Chromium would only produce without permission.
    navigator.clipboard.readText = () => Promise.reject(new Error("denied"));
  });

  await page.goto("/?data=clipboard");
  const load = page.getByRole("button", {name: "Load from clipboard"});
  await expect(load).toBeVisible();

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await load.click();
  await expect(treeRow(page, "deepLink")).toBeVisible();
});

test("Copy link round-trips the document back into the viewer", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("button", {name: "Load Test JSON"}).click();

  await page.getByRole("button", {name: "Copy link"}).click();
  await expect(page.getByRole("button", {name: "Link copied!"})).toBeVisible();

  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toContain("#data=");

  await page.goto(url);
  // The root auto-expands one level, so assert on a top-level key.
  await expect(treeRow(page, "company")).toBeVisible();
  await expect(treeRow(page, "user")).toBeVisible();
});

test("the share button rides the tab bar, so every view can share", async ({
  page,
  context,
}) => {
  // Guards the move out of the JSON-tab toolbar: sharing used to be reachable
  // only from the editor, so a link could not be copied while reading a tree.
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");

  const share = page.getByRole("button", {name: "Copy link"});
  // Nothing loaded yet — present but inert, never a link to an empty document.
  await expect(share).toBeDisabled();
  // And gone from the toolbar it used to live in.
  await expect(page.getByRole("button", {name: "Format"})).toBeVisible();

  await page.getByRole("button", {name: "Load Test JSON"}).click();
  await expect(share).toBeEnabled();

  for (const tab of ["Viewer", "Visualizer", "JSON"]) {
    await page.getByRole("button", {name: tab, exact: true}).click();
    await expect(share).toBeVisible();
    await expect(share).toBeEnabled();
  }

  // Sharing from a non-editor tab produces the same working link.
  await page.getByRole("button", {name: "Visualizer", exact: true}).click();
  await share.click();
  await expect(page.getByRole("button", {name: "Link copied!"})).toBeVisible();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toContain("#data=");

  await page.goto(url);
  await expect(treeRow(page, "company")).toBeVisible();
});

// The producer half of the contract (public/open.js, served at /open.js). These
// drive the real script in a real page, so the two encodings cannot drift.
test("open.js opens a tab with the document loaded", async ({
  page,
  context,
}) => {
  await page.goto("/");
  // setContent replaces the document, so the script goes in after it.
  await page.setContent(`<button id="go">View JSON</button>`, {
    waitUntil: "load",
  });
  await page.addScriptTag({url: "/open.js"});
  await page.evaluate((doc) => {
    document.getElementById("go")!.addEventListener("click", () => {
      (
        window as unknown as {
          openInJsonViewer: (d: unknown, o: unknown) => Promise<string>;
        }
      ).openInJsonViewer(JSON.parse(doc), {base: window.location.origin + "/"});
    });
  }, DOC);

  const [popup] = await Promise.all([
    context.waitForEvent("page"),
    page.click("#go"),
  ]);

  await expect(
    popup.locator(".json-node", {hasText: "deepLink"})
  ).toBeVisible();
});

test("open.js hands large documents over by clipboard", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.addScriptTag({url: "/open.js"});

  // Random text doesn't compress, so this reliably blows the URL budget.
  const big = await page.evaluate(() => {
    const items = Array.from({length: 4000}, () =>
      Math.random().toString(36).slice(2)
    );
    return JSON.stringify({bigDoc: true, items});
  });

  const result = await page.evaluate(
    (doc) =>
      (
        window as unknown as {
          openInJsonViewer: {
            link: (
              d: unknown,
              o: unknown
            ) => Promise<{
              url: string;
              needsClipboard: boolean;
            }>;
          };
        }
      ).openInJsonViewer.link(JSON.parse(doc), {
        base: window.location.origin + "/",
      }),
    big
  );

  expect(result.needsClipboard).toBe(true);
  expect(result.url).toContain("?data=clipboard");

  // Follow the documented flow: the caller puts the document on the clipboard.
  await page.evaluate((doc) => navigator.clipboard.writeText(doc), big);
  await page.goto(result.url);

  await expect(page.locator(".json-node", {hasText: "bigDoc"})).toBeVisible();
});

test("open.js reports a blocked popup instead of hijacking the host page", async ({
  page,
}) => {
  await page.goto("/");
  await page.setContent("<p id='host'>host app</p>", {waitUntil: "load"});
  await page.addScriptTag({url: "/open.js"});

  const outcome = await page.evaluate(() => {
    window.open = () => null; // what a popup blocker does
    return (
      window as unknown as {
        openInJsonViewer: (d: unknown) => Promise<string>;
      }
    )
      .openInJsonViewer({a: 1})
      .then(() => "navigated")
      .catch((e: Error) => e.message);
  });

  expect(outcome).toContain("Popup blocked");
  // The host page must still be sitting there, untouched.
  await expect(page.locator("#host")).toHaveText("host app");
});
