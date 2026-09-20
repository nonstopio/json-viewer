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
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
