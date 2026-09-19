import {defineConfig} from "@playwright/test";

// e2e/load tests run against the Vite dev server (auto-started below).
// The port is overridable because several worktrees of this repo can be open
// at once: with reuseExistingServer, a fixed port silently runs the suite
// against whichever checkout started a server first.
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
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
