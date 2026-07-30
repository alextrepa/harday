# QA routine: Local workspace smoke

- ID: QA-001
- Owner: TBD
- Last verified: Never

## Purpose

Confirm that a tester can open the local daily time workspace and reach its primary actions without an account or connector credentials.

## Prerequisites

- Node.js 22+, Corepack, and `just` are installed.
- Project dependencies have been installed with `just install`.
- Chromium acceptance-test support has been installed with `just acceptance-install`.
- Port `4173` is available.
- Use an isolated browser profile or clear site data for `http://127.0.0.1:4173`.

## Test data

- No account, connector credentials, projects, or time entries are required.

## Procedure

1. Start the web app with `just start --port 4173`.
   - Expected: The terminal reports that the app is available at `http://127.0.0.1:4173`.
2. Open `http://127.0.0.1:4173/time/today` in a browser.
   - Expected: The daily time workspace loads without asking for account credentials.
3. Find the primary navigation control.
   - Expected: It identifies the current workspace as `Time`.
4. Find the `Submit timesheet` action.
   - Expected: The action is visible and enabled.
5. Open the primary navigation.
   - Expected: `Time`, `Backlog`, `Projects`, and `Settings` are available, with `Time` selected.

## Cleanup

- Stop the development server.
- Clear site data for `http://127.0.0.1:4173` if the isolated profile will be reused.

## Evidence

- Capture one screenshot showing the open primary navigation and the `Submit` action.
- Record any browser console error that blocks the routine.

## Result

- Status: Not run
- Notes:
