# UI Tokens

The active design tokens live in `apps/web/src/styles.css`. Prefer those CSS variables and Tailwind theme mappings instead of hard-coded values.

## Fonts

- Body: `Raleway Variable`
- Heading: `Noto Serif Variable`
- Mono: `"SF Mono", "Roboto Mono", monospace`

## Core Colors

Use semantic variables:

- `--background`
- `--foreground`
- `--card`
- `--popover`
- `--primary`
- `--secondary`
- `--muted`
- `--accent`
- `--destructive`
- `--border`
- `--input`
- `--ring`

Use app-level aliases when building product UI:

- `--surface-lowest`
- `--surface-low`
- `--surface`
- `--surface-high`
- `--surface-highest`
- `--text`
- `--text-secondary`
- `--text-tertiary`
- `--success`
- `--danger`
- `--hover-bg`
- `--highlight-bg`
- `--field-bg`
- `--field-border`

## Radius

- Base radius: `--radius: 0.625rem`
- Control radius: `--control-radius: 0.25rem`
- Derived radii: `--radius-sm`, `--radius-md`, `--radius-lg`

Keep dense operational controls tighter than content panels. Do not introduce oversized pill shapes unless an existing component already establishes that shape.

## Shadows

Available shadows:

- `--shadow-sm`
- `--shadow-md`
- `--shadow-lg`
- `--shadow-popup`
- `--shadow-drag`
- `--shadow-card`

Use shadows sparingly. Prefer borders, spacing, and surface changes for app structure.

## Motion

- Duration: `--duration: 150ms`
- Easing: `--ease: cubic-bezier(0.4, 0, 0.2, 1)`

Motion should clarify state changes, not decorate the workspace.

## Controls

- Control font size: `--control-font-size: 13px`
- Control line height: `--control-line-height: 1.45`
- Use stable dimensions for icon buttons, table rows, toolbar controls, timers, and compact counters.

## Dark Mode

Dark mode tokens are defined under `:root.dark`. Use semantic tokens so both themes remain supported.
