# Time Tracker

A local-first time-tracking app for managing projects, running timers, and saving timesheet entries without a backend service.

## What Works Today

- Create a local workspace and projects.
- Start and stop a local timer.
- Add and edit manual time entries.
- Add local notes.
- Manage backlog items and project tasks.
- Package the Electron desktop app for local-first timer tracking.

## Privacy Model

Time entries, timers, project metadata, and user preferences stay local in the current MVP.
The app does not upload tracking data automatically.

## Requirements

- Node.js 22+
- Corepack

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

The Electron app is timer-first and focused on local timers and projects.

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

## Basic App Flow

1. Open the web or desktop app.
2. Start a local workspace if prompted.
3. Create or import projects and tasks.
4. Start a timer or add a manual time entry for the day.
5. Stop the timer when you are done.
6. Edit the saved entry if needed.
7. Review totals on the time page and adjust projects, tasks, or notes.

## Local-Only Status

This repo currently targets a local-only workflow.

Do not introduce automatic activity collection or raw activity upload. Any future persistence changes should preserve the same privacy boundary: explicit user-approved records stay in control of the user.

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

The root build creates the web app, the desktop renderer in `apps/web/dist-desktop`, the shared package, and the remaining extension assets in this repo.

## Repo Map

```text
apps/web/          local-first React + TanStack Router app
apps/extension/    browser extension sources retained in the repo
packages/shared/   shared types, normalization, timeline aggregation, rules
docs/              architecture notes
```

Read `docs/local-first-architecture.md` before changing sync behavior.
