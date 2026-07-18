import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";

// Strip console/debugger from the production bundle only; dev keeps them.
export default defineConfig(({mode}) => ({
  plugins: [react()],
  esbuild: mode === "production" ? {drop: ["console", "debugger"]} : {},
}));
