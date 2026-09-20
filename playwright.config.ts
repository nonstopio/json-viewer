import {defineConfig} from "@playwright/test";

// e2e/load tests run against the Vite dev server (auto-started below).
//
// The suite always starts its own server and never adopts one that is already
// running. Several worktrees of this repo are often open at once, and adopting
// whatever answers on the port means silently testing a different checkout —
// a full green run that proves nothing about the code in front of you. With
// strictPort, a port already in use fails the run immediately instead; set
// E2E_PORT to move this checkout onto a free one.
const port = Number(process.env.E2E_PORT ?? 5173);
const url = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: url,
    // The one-time Share hint is a popover: once it appears it covers the
    // top-right of the page and swallows clicks meant for what is underneath.
    // That is correct for a coachmark and wrong for every test that is not
    // about it, so the default state is "already seen". e2e/share-hint.spec.ts
    // opts back out to exercise it.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: url,
          localStorage: [{name: "json-viewer-share-hint-seen", value: "1"}],
        },
      ],
    },
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
