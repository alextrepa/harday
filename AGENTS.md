# AGENTS.md

## General

- Use the `using-superpowers` skill most of the time.

## Browser Screenshots

When a task needs a real UI screenshot, prefer a Playwright-based flow over describing the UI from code.

1. Start the local app so the browser has a live page to capture.
   Example: `corepack pnpm --filter @timetracker/web dev --host 127.0.0.1 --port 4173`
2. Use the Playwright workflow from the local skill bundle.
   Setup: `export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}" && export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"`
3. Open the page and drive it to the target state.
   Example sequence:
   `"$PWCLI" open http://127.0.0.1:4173/`
   `"$PWCLI" -s=default goto http://127.0.0.1:4173/backlog`
   `"$PWCLI" -s=default snapshot`
   `"$PWCLI" -s=default click e154`
4. Capture the screenshot once the UI is in the right state.
   Example: `"$PWCLI" -s=default screenshot`
5. If the image needs to be inspected in-thread, open the saved local file with the image viewer tool.
   Example artifact path: `.playwright-cli/page-<timestamp>.png`
6. Clean up transient `.playwright-cli` artifacts when they were only used for debugging and the user did not ask to keep them.

Notes:

- `snapshot` is useful before clicks because it gives stable element refs like `e154`.
- For this repo, the screenshot itself was taken through Playwright, then inspected from the saved local PNG.
- If the Playwright MCP browser is busy, fall back to the bundled Playwright CLI workflow above.
