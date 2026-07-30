# UI Registry

This registry captures reusable visual patterns already present in TimeTracker. Update it after meaningful UI additions.

## App Shell

- Sticky top navigation with compact height and glass-like background.
- Primary navigation uses icon + label entries for Time, Backlog, Projects, and Settings.
- Date and new-entry controls are available from the titlebar area for time workflows.

## Surfaces

- Use semantic surfaces from `styles.css`: `--surface-lowest`, `--surface-low`, `--surface`, `--surface-high`, and `--surface-highest`.
- Borders and muted backgrounds carry most hierarchy.
- Shadows are reserved for popovers, dialogs, drag states, and elevated overlays.
- App settings surfaces use `AppPanel` from `apps/web/src/components/app-surface.tsx`. Keep `settings-panel` class ownership inside that module.
- Status, empty, and warning messages use `MessagePanel` from `apps/web/src/components/app-surface.tsx`. Keep `message-panel` class ownership inside that module.
- Icon/title/body callouts use `SurfaceCallout` from `apps/web/src/components/app-surface.tsx`.

## Controls

- Compact controls use 13px sizing and tight radii.
- Popovers handle secondary choices such as calendar selection and compact creation flows.
- Searchable selects are preferred where project/task lists can grow.
- Toggle groups and tabs are preferred for mutually exclusive local view modes.
- Checkboxes use `Checkbox` from `apps/web/src/components/ui/checkbox.tsx`, backed by Base UI. Use its `indeterminate` prop for mixed selection state instead of mutating DOM refs.
- Connector settings fields are rendered through `apps/web/src/features/settings/connector-settings-ui.tsx`, so plugin-driven field styling stays consistent.
- Reorderable tables and navigation lists use `apps/web/src/lib/table-drag.ts` for consistent mouse/touch thresholds, cancellation, row movement, and drag-preview positioning.
- On mobile, backlog add and filter actions use a compact vertical pair of
  icon-only floating controls at the bottom right. Keep add as the lower primary
  action, open the filter menu upward, preserve safe-area spacing, and reserve
  scroll space so task rows are not obscured. The desktop backlog toolbar remains
  in the table header.

## Icons

- The app uses `@remixicon/react`.
- Common navigation and action icons include timer, backlog/list, folder/project, settings, plus, check, close, play, stop, and chevrons.
- Project icon persistence and normalization live in `apps/web/src/domain/projects/project-icon.ts`; React rendering and uploaded-image preparation live in `apps/web/src/lib/project-icons.tsx`.

## Typography

- Body text uses Raleway Variable.
- Heading moments use Noto Serif Variable where the existing design calls for more editorial weight.
- Dense app panels should keep headings small and direct.

## Empty And Loading States

- Use existing UI primitives for skeletons and empty states.
- Empty states should tell the user what is missing and provide the next action when there is one.
- Loading states should preserve layout dimensions.
