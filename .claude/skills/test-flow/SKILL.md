---
name: test-flow
description: Test a user flow in a real browser after any code change, using the Playwright MCP. Use after editing anything under src/ to confirm the affected flow still works before considering the change done. Triggers on "test this", "verify the flow", "does it still work", or after any non-trivial src/ edit.
---

# test-flow

Drive the affected flow in a real browser and confirm it behaves as intended. Don't stop at typecheck/build — observe the actual behavior.

## Steps

1. **Start the dev server** if it isn't already running:

   ```bash
   npm run dev
   ```

   It serves on http://localhost:5173/. Start it in the background and confirm the port from the log.

2. **Drive the changed flow** with the Playwright MCP (`mcp__plugin_playwright_playwright__*`):
   - `browser_navigate` to http://localhost:5173/
   - `browser_snapshot` to read the accessibility tree (better than screenshots for asserting state — check `[disabled]`, text content, `[ref]`).
   - `browser_type` / `browser_click` to exercise the flow.
   - Snapshot again to confirm the expected end state.

3. **Assert the actual change.** Name the concrete before/after you expect and verify it in the snapshot — e.g. "buttons show `[disabled]` when input empty; clickable after typing; Format pretty-prints the textarea." A green build is not a pass.

4. **Clean up:** `browser_close`, then stop the dev server (`pkill -f vite`).

## Key flows in this app

The main surface is `src/App.tsx` (toolbar + input) and `src/components/JsonInput.tsx`. Check whichever the change touched:

- **Input → toolbar buttons:** typing/pasting JSON enables Copy / Format / Remove white space (no Parse click needed); they disable again when input is cleared.
- **Format / Remove white space:** rewrites the textarea (pretty-print / minify) from the current input.
- **Parse JSON → Viewer tab:** valid JSON renders the collapsible tree; invalid JSON shows the error with a jump-to-error link.
- **Search:** filters/expands the tree and highlights matches.

## Notes

- If the flow is long or produces many snapshots, run this in a subagent so the browser output stays out of the main context.
- Never trigger `alert`/`confirm`/`prompt` dialogs — they freeze the Playwright session.
- The Playwright MCP is configured project-level in `.mcp.json`, so this works on a fresh clone (approve the server on first startup).
