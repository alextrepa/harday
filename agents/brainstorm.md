# Workday Plugin Brainstorm

Status: Paused. This is not a current priority, and no implementation has started.

## Intent

Plan TimeTracker's first plugin that is not a connector: the Workday plugin.

The Workday plugin will not authenticate with, connect to, read from, or write to
Workday. It will only determine Workday-specific data shapes and transformations
for:

- project import
- project export
- timesheet submission

This is expected to be a major application change because it establishes the
first general plugin capability outside the existing connector contract.

## Existing Context

- TimeTracker is local-first. Canonical projects, tasks, timesheet entries, and
  submission state remain owned by the application.
- Project import/export currently uses a generic Excel workbook adapter around a
  canonical project/task transfer-row contract. Import merges projects and tasks
  through deterministic web-domain transitions.
- Timesheet import/export has a separate generic Excel workbook shape and a
  staged local review workflow.
- Timesheet submission currently performs no external operation. It marks
  selected local entries as submitted and clears that state if the submitted
  data later changes.
- The Plugins UI is generically named, but the only installable plugin contract
  is connector-specific: `.harday-connector` packaging, connection fields,
  configuration validation, synchronization operations, API-side storage, and
  worker execution.
- A Workday data-shaping plugin should not be forced into the connector contract.
  It introduces a new plugin category and requires a general capability model.

## Proposed Language To Confirm

These definitions were proposed but have not yet been confirmed:

- **Plugin:** An installable, activatable capability package that extends
  defined application workflows. A plugin does not inherently connect to an
  external system.
- **Connector:** One plugin category that owns authentication, transport, remote
  reads and writes, connections, and synchronization. Workday is not in this
  category.
- **Data shape:** The Workday-specific schema, validation, mapping, grouping,
  and formatting applied at a workflow boundary without owning TimeTracker's
  canonical local records.
- **Project import/export:** Workday-specific representations entering or
  leaving the canonical project/task model. The core application continues to
  own merge rules and local persistence.
- **Timesheet submission:** Currently a local submission-state transition. The
  initial understanding is that the Workday plugin will shape selected entries
  into a Workday-compatible representation without authenticating or
  transmitting data to Workday.

## Resume Point

When this becomes a priority again:

1. Confirm or correct the proposed language above.
2. Gather the exact Workday project import, project export, and timesheet
   submission formats and examples.
3. Work through the architectural decisions one at a time, beginning with the
   general plugin capability boundary.
4. Produce an implementation blueprint and wait for explicit confirmation
   before changing application code.

No architectural decisions beyond the stated intent have been finalized.
