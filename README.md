# Time Tracker

A privacy-first time-tracking MVP for reviewing local activity drafts, assigning them to projects, and committing cleaned timesheet entries.

The current app is **local-first**: raw activity drafts stay in browser/local extension storage. Convex is scaffolded for future sync, but the web app does not need a Convex deployment to run the MVP flow.

## What Works Today

- Create a local workspace and projects.
- Start/stop a local timer from the review page.
- Generate local sample activity blocks for review.
- Import timed Outlook meetings into the local review queue.
- Assign drafts to projects.
- Add local notes.
- Dismiss private/noisy drafts.
- Commit cleaned blocks into local timesheet entries.
- Save explicit local rules from reviewed blocks.
- View lightweight reports from committed entries.
- Run the Chromium or Firefox extension in local capture mode.
- Read sanitized browser buckets into the review page through a local extension bridge.

## Privacy Model

Raw activity is local-only in the MVP.

Do not treat draft activity as synced timesheet data. A draft is only a suggestion source until you review it and click **Commit time**.

Rules are more sensitive than drafts. Saving a rule can store a reusable signal such as `github.com` plus `/myorg/project`. The app shows a warning before saving a rule; only save rules for patterns you are comfortable reusing and eventually syncing.

The extension currently keeps captured activity in browser extension storage. It does **not** upload raw activity to Convex.
The web app can read that local data only through the installed extension bridge on approved local origins.

## Requirements

- Node.js 22+
- Corepack
- Chromium-based browser or Firefox if you want to load the extension

This repo uses pnpm through Corepack. Use the root scripts rather than calling `pnpm` directly.

## Install

```sh
corepack pnpm install
```

## Start The Web App

```sh
corepack pnpm dev:web
```

Open the Vite URL from the terminal, usually:

```text
http://localhost:5173
```

No `.env` file is required for the current local-first web workflow unless you want Outlook meeting import.

To enable Outlook meeting import, register a Microsoft Entra single-page application and set:

```sh
VITE_MICROSOFT_CLIENT_ID=your-app-client-id
VITE_MICROSOFT_TENANT_ID=common
```

For local development, add these SPA redirect URIs in the app registration:

- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `http://localhost:4173`
- `http://127.0.0.1:4173`

The app uses a browser-only Microsoft sign-in and requests `Calendars.ReadBasic` so it can import timed Outlook meetings into the local review queue.

## Start The Desktop Timer

The first Electron cut is intentionally timer-first. It wraps the existing React app, but disables the activity logger, browser extension bridge, and Outlook import so the desktop build stays focused on local timers and projects.

Run it in development:

```sh
corepack pnpm dev:desktop
```

Build the desktop renderer assets:

```sh
corepack pnpm build:desktop
```

Run the built desktop wrapper:

```sh
corepack pnpm start:desktop
```

Package the desktop app for Windows on a Windows host:

```sh
corepack pnpm make:desktop:win
```

That command is wired to Electron Forge's Squirrel.Windows maker and emits an `x64` Windows installer `.exe`.
Forge documentation recommends creating Windows distributables on Windows rather than from macOS or Linux hosts.

The Electron shell serves the desktop renderer locally and opens it in a locked-down `BrowserWindow`. Desktop mode currently exposes:

- local workspace onboarding
- projects
- manual time entries
- start/stop timer flow

Desktop mode currently hides:

- activity review
- browser extension import
- macOS collector/activity logger UI
- Outlook calendar import

## Basic Web App Flow

1. Open the web app.
2. Click **Start local workspace** if you land on the intro/sign-in page.
3. Create a workspace name and starter projects.
4. Open **Review**.
5. Start a timer with **Local timer**.
6. Stop the timer when you are done; it becomes a private local activity draft.
7. Assign the draft to a project.
8. Optionally edit its label or note.
9. Click **Dismiss private/noise** for activity that should not enter your timesheet.
10. If the browser extension is installed, let the review page import 5-minute browser buckets automatically or click **Refresh from browser**.
11. Review imported browser buckets, especially ones marked **Mixed bucket**.
12. Click **Commit time** for activity you want in your timesheet.
13. Optionally click **Save this as a rule** after assigning a block.
14. Read the rule privacy warning, then either save or cancel.
15. Open **Reports** to see committed time by project/user.

## Local Sample Data

Onboarding adds a couple of sample drafts.

You can also click **Add local sample** on the review page. This is useful for trying assignment, dismiss, commit, and rule behavior without installing the extension.

## Start The Chromium Extension

For Chromium development:

```sh
corepack pnpm dev:extension
```

For a Chromium loadable build:

```sh
corepack pnpm --filter @timetracker/extension build:chromium
```

Then load the Chromium extension:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select `apps/extension/dist`.
5. Open the extension popup.
6. Confirm the popup shows the local collector status and the **Open local web app** action.
7. Browse normally; tab/window/idle transitions create sanitized local draft segments inside extension storage.
8. Open the web app review page on `http://localhost:5173` and the extension bridge will expose imported browser buckets automatically.

## Start The Firefox Extension

Build the Firefox package:

```sh
corepack pnpm build:extension:firefox
```

Then load it temporarily:

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Select `apps/extension/dist-firefox/manifest.json`.
4. Open the extension popup.
5. Confirm the popup shows the local collector status and the **Open local web app** action.
6. Browse normally; tab/window/idle transitions create sanitized local draft segments inside Firefox extension storage.
7. Open the web app review page on `http://localhost:5173` and the extension bridge will expose imported browser buckets automatically.

The bridge currently allows these local app origins:

- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `http://localhost:4173`
- `http://127.0.0.1:4173`

## Convex Status

Convex files exist under `convex/` for the planned sync backend:

- team/project metadata
- Google auth
- extension pairing
- timer/timesheet/rule sync
- reports
- future committed-data ingestion

The local-first MVP intentionally does not require Convex to review local drafts.

If you want to work on the Convex backend later, start it separately:

```sh
corepack pnpm dev:convex
```

Do not re-enable raw activity upload. Sync should be limited to active timer continuity, committed timesheet entries, project/team metadata, and explicitly accepted rules.

## Verification

Run shared unit tests:

```sh
corepack pnpm test
```

Run TypeScript checks:

```sh
corepack pnpm typecheck
```

Run production builds:

```sh
corepack pnpm build
```

The root build creates the web app, the desktop renderer in `apps/web/dist-desktop`, the shared package, the Chromium extension in `apps/extension/dist`, and the Firefox extension in `apps/extension/dist-firefox`.

## Repo Map

```text
apps/web/          local-first React + TanStack Router app
apps/extension/    Chromium + Firefox local capture extension
convex/            scaffolded future sync backend
packages/shared/   shared types, normalization, timeline aggregation, rules
docs/              architecture notes
```

Read `docs/local-first-architecture.md` before changing sync behavior.
