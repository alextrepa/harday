# Testing Shell Plan

## Existing foundation to preserve

- Vitest is the established unit runner, with deterministic tests colocated with source in each owning workspace package.
- `just test` already exposes the aggregate unit-test command and must remain the unit entry point.
- Context documents already exist under `agents/` and contain developer-authored project guidance; the testing-shell context generator must preserve them.
- No executable Gherkin runner, browser acceptance layout, or manual QA routine exists.

## Missing shell to add

- Keep all unit tests in their current locations; do not add a duplicate smoke unit test.
- Add Playwright-BDD to `apps/web`, the package that owns the shared browser UI.
- Store user-facing behavior in `apps/web/tests/acceptance/features/`.
- Store Playwright bindings and browser mechanics in `apps/web/tests/acceptance/steps/`.
- Generate Playwright tests into the default `apps/web/.features-gen/` directory and ignore generated specifications.
- Exclude `.features-gen/` from Vitest discovery so generated Playwright specifications cannot overlap the unit runner.
- Run one Chromium project against a deterministic Vite server on `127.0.0.1:4173` in test mode so optional connector services are not part of the acceptance path.
- Add `just acceptance-install` so the Playwright-managed Chromium prerequisite can be installed explicitly.
- Add the root `just acceptance-test` command for local and CI execution.
- Add human-readable procedures under `qa/routines/`; do not add a QA command.

## Dependencies

- `@playwright/test` supplies browser lifecycle, assertions, isolation, diagnostics, and the Chromium project.
- `playwright-bdd` compiles `.feature` scenarios into Playwright tests and binds Gherkin steps through `createBdd`.

## Verification

1. Run `just test` to prove the existing unit shell.
2. Run `just acceptance-test` to prove feature discovery, step binding, Vite startup, and Chromium execution.
3. Run `just typecheck`.
4. Run `just build`.
5. Read `qa/routines/local-workspace-smoke.md` as a tester and confirm every action has an observable expected result.
6. Reconcile the README inventory and `agents/progress-tracker.md` with actual results.
