# Local-First Privacy Boundary

## Current MVP Default

Timers, saved time entries, and workspace metadata are local-only.

## Stored Locally

The current app stores its working state locally:

- Active timer continuity records.
- Saved timesheet entries.
- Team and project metadata.
- Backlog and task metadata.

## What Must Not Sync Automatically

- Automatic activity collection payloads.
- Raw browsing history.
- Full URLs.
- Query strings or hashes.
- Any tracking data the user did not explicitly create or confirm.

## Removed Capture Features

The activity logger and related automatic capture flows are no longer part of the supported product direction.

If automatic activity capture is revisited later, it should remain opt-in, local-first, and separate from the baseline timer workflow.
