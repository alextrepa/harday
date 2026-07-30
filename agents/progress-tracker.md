# Progress Tracker

Use this file as a lightweight running checklist for agent work in this repo. Keep it current when a task spans multiple steps or sessions.

## Current Baseline

- [x] Monorepo structure identified.
- [x] Local-first privacy boundary documented.
- [x] Wide-events logging direction documented.
- [x] Root context files created and aligned with the current local-first product direction.
- [x] Repeated app surfaces use `AppPanel`, `MessagePanel`, and `SurfaceCallout`.
- [x] Feature checkboxes use the shared `Checkbox` UI primitive.
- [x] Connector settings plugin field rendering is extracted to a feature-local UI module.
- [x] Web-domain contracts and pure calculations are separated from persistence and feature UI.
- [x] Local state, duration, task budget/import, project icon, and Outlook contracts have canonical domain modules.
- [x] `apps/web/src/lib` no longer depends on feature modules.
- [x] `just test` includes both web and shared workspace tests.
- [x] Project task and workbook import transitions are isolated from browser persistence and have direct domain tests.
- [x] Backlog status hydration, CRUD, and connector mapping transitions are isolated from browser persistence and have direct domain tests.
- [x] Work-item hierarchy, estimates, manual lifecycle, and connector reconciliation have canonical domain modules with direct tests.
- [x] Timesheet entry lifecycle and linked estimate adjustments are isolated from browser persistence and have direct tests.
- [x] Project/task creation, hydration, ordering, edits, and archive transitions are isolated from browser persistence and have direct domain tests.
- [x] Timer hydration, start/edit/cancel/save/restart transitions, elapsed time, and restarted-entry replacement are isolated from browser persistence and have direct domain tests.
- [x] Imported browser and Outlook review preservation, timeline materialization, dismissal, idempotent commits, and rule creation are isolated from browser persistence and have direct domain tests.
- [x] Timesheet import normalization, conflict detection, draft lifecycle, project/task recovery, and commits are isolated from browser persistence and have direct domain tests.
- [x] `local-store.ts` is reduced from 4,215 lines to about 1,100 lines and now coordinates persisted-state compatibility, desktop bootstrap, storage notifications, and domain commands.
- [x] Desktop inline and mobile modal backlog editing share one canonical field, validation, draft, and patch model.
- [x] Backlog, timesheet, project-task, and project-navigation reordering share one tested pointer lifecycle and geometry module.
- [x] Adversarial review regressions cover connector identity and archive provenance, reversible estimate overruns, timer-linked edits, Outlook rescheduling, import validation, one-time desktop recovery, and overlapping drag state.

## Standard Task Flow

- [ ] Understand the requested outcome.
- [ ] Read the relevant existing code and docs.
- [ ] Identify privacy, persistence, and runtime boundaries.
- [ ] Make scoped changes.
- [ ] Run focused verification.
- [ ] Run broader `just` checks when needed.
- [ ] Summarize changed files and verification results.

## Project Health Notes

- Use `just` rather than invoking package scripts directly.
- Preserve local-first behavior unless the user explicitly asks to change it.
- Treat connector writes and imports as side-effect-sensitive.
- Feature code should use local UI primitives instead of direct Base UI imports or raw controls.
- Keep repeated app surfaces behind `apps/web/src/components/app-surface.tsx`.
- Larger page/controller splits remain useful for projects and backlog. Prefer extracting cohesive view/controller Modules over moving JSX into shallow files.
- `local-store.ts` is now the persistence Adapter. Do not move deterministic lifecycle rules back into it; extend the owning domain transition module instead.

## Testing Shell

- [x] Preserved the existing Vitest unit layout and `just test` entry point without adding overlapping smoke coverage.
- [x] Added Playwright-BDD feature discovery and step binding under `apps/web/tests/acceptance/`.
- [x] Added Chromium installation and executable acceptance commands through `just`.
- [x] Added a controlled empty connector fixture so the smoke scenario is local and deterministic.
- [x] Added the manual local-workspace smoke routine under `qa/routines/`.
- [x] Ran the UI context generator; all existing context files were preserved unchanged.
- [x] Moved project context files into `agents/` and documented them in the root `agents.md`.
- [x] Verified `just test`: 29 files and 198 tests passed.
- [x] Verified `just acceptance-test`: 1 Chromium scenario passed.
- [x] Verified `just typecheck`.
- [x] Verified `just build`.
- [ ] Assign an owner and record a manual result in `qa/routines/local-workspace-smoke.md`.
