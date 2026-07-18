import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {readFileSync} from "node:fs";

// Expose package.json version to the app (release-please bumps it on release).
const {version} = JSON.parse(readFileSync("./package.json", "utf-8"));

// Strip console/debugger from the production bundle only; dev keeps them.
export default defineConfig(({mode}) => ({
  plugins: [react()],
  define: {__APP_VERSION__: JSON.stringify(version)},
  esbuild: mode === "production" ? {drop: ["console", "debugger"]} : {},
}));
