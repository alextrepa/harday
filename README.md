# TimeTracker

TimeTracker is a local-first time-tracking workspace with a web app, an Electron desktop shell, shared domain logic, and an optional local API for connector-driven imports.

## What Exists Today

- local workspace onboarding
- projects and tasks
- start/stop timer flow
- manual time entries and notes
- backlog management
- optional Outlook meeting import
- desktop packaging for local use

## Privacy Boundary

The default product direction is local-first:

- timers, time entries, backlog items, and workspace metadata stay local
- there is no automatic activity capture in the supported workflow
- tracking data should not be uploaded without explicit user intent

Read [docs/local-first-architecture.md](./docs/local-first-architecture.md) before changing sync or capture behavior.

## Requirements

- Node.js 22+
- Corepack
- `just`

This repo is meant to be driven through the root `Justfile`.

## Quick Start

Install dependencies:

```sh
just install
```

Start the web app:

```sh
just start
```

Open:

```text
http://127.0.0.1:5173
```

To use a different port:

```sh
just start --port 4173
```

## Common Commands

List available commands:

```sh
just
```

Start the web app:

```sh
just start
```

Start the desktop app in development:

```sh
just desktop-start
```

Start the local API server:

```sh
just api-start
```

Run tests:

```sh
just test
```

Run type checks:

```sh
just typecheck
```

Build all workspace packages:

```sh
just build
```

Create desktop distributables:

```sh
just make --mac
just make --windows
just make
```

Clean local build output:

```sh
just clean --force
```

Remove dependencies and build output:

```sh
just clean-all --force
```

## Outlook Meeting Import

Outlook import is optional. The local-first timer workflow does not require any environment variables.

To enable Outlook meeting import in the web app, set:

```sh
VITE_MICROSOFT_CLIENT_ID=your-app-client-id
VITE_MICROSOFT_TENANT_ID=common
```

`VITE_MICROSOFT_TENANT_ID` is optional and defaults to `common`.

For local development, add these SPA redirect URIs to the Microsoft Entra app registration:

- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `http://localhost:4173`
- `http://127.0.0.1:4173`

The browser client requests `Calendars.ReadBasic` and imports timed Outlook meetings into the local review flow.

## Runtime Surfaces

### Web app

The main local-first UI lives in `apps/web`.

### Desktop app

The Electron shell lives in `apps/desktop` and wraps the web renderer for desktop timer workflows.

Useful commands:

```sh
just desktop-start
just desktop-build
just desktop-package
just desktop-make
```

### Local API

The optional local API lives in `apps/api` and defaults to `127.0.0.1:8787`. It supports connector configuration, sync, and local import review flows.

## Verification

The main verification path is:

```sh
just test
just typecheck
just build
```

## Repo Map

```text
apps/web/        React + Vite app for the main time-tracking UI
apps/desktop/    Electron shell and packaging scripts
apps/api/        local API for connectors and import flows
packages/shared/ shared schemas, rules, and domain logic
docs/            architecture and logging notes
```

## Related Docs

- [docs/local-first-architecture.md](./docs/local-first-architecture.md)
- [docs/logging-strategy.md](./docs/logging-strategy.md)
