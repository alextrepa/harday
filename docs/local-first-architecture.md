# Local-First Privacy Boundary

## Current MVP Default

Raw activity drafts are local-only.

This includes browser/activity segments, dismissed private activity, uncommitted review blocks, and local timers created for review. Losing local browser storage may lose drafts; that is an accepted MVP risk.

## What May Sync Later

Only these records are intended to sync to Convex:

- Active timer continuity records, so the same running timer is available after reopening the app.
- Committed timesheet entries, after the user clicks commit.
- Explicit rules, after the user sees the privacy warning and confirms save-as-rule.
- Team/project metadata.

## What Must Not Sync Automatically

- Raw browser activity segments.
- Full URLs.
- Query strings or hashes.
- Dismissed/private/noisy blocks.
- Uncommitted notes.
- Rule proposals the user has not accepted.

## Rule Privacy Copy

Saving a rule must remain deliberate.

The UI should keep warning that rules are less private than local drafts because a rule may reveal an app, domain, client name, organization path, repository path, or task-system naming pattern.

## Removed Capture Features

The browser extension and macOS activity monitor were removed from this repo.

If automatic activity capture is revisited later, it should still preserve the same review-before-sync model and keep raw activity local by default.
