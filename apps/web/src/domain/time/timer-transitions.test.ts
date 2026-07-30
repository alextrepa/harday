import { describe, expect, it } from "vitest";
import type {
  LocalAppState,
  LocalProject,
  LocalTimer,
  LocalTimesheetEntry,
} from "@/domain/local-state";
import {
  normalizeTimer,
  restartTimesheetEntry,
  saveTimer,
  startTimer,
  startTimerWithEntry,
  updateTimer,
  type TimerFactories,
} from "@/domain/time/timer-transitions";
import { createTimesheetEntrySubmissionFingerprint } from "@/domain/time/timesheet-entry";

function createFactories(now = 1_000): TimerFactories {
  let nextId = 1;

  return {
    createId: (prefix) => `${prefix}-${nextId++}`,
    now: () => now,
  };
}

function createProject(): LocalProject {
  return {
    _id: "project-1",
    name: "Mercury",
    displayName: "Mercury",
    color: "#123456",
    icon: { kind: "preset", name: "dot" },
    status: "active",
    tasks: [
      {
        _id: "task-1",
        name: "Build",
        status: "active",
        createdAt: 100,
      },
    ],
  };
}

function createEntry(overrides: Partial<LocalTimesheetEntry> = {}) {
  return {
    _id: "entry-1",
    localDate: "2026-07-30",
    projectId: "project-1",
    taskId: "task-1",
    label: "Build",
    note: "Existing work",
    durationMs: 500,
    sourceBlockIds: [],
    committedAt: 600,
    ...overrides,
  } satisfies LocalTimesheetEntry;
}

function createState(
  overrides: Partial<LocalAppState> = {},
): LocalAppState {
  return {
    projects: [createProject()],
    timers: [],
    timesheetEntries: [],
    workItems: [],
    ...overrides,
  } as LocalAppState;
}

describe("timer hydration and editing", () => {
  it("hydrates legacy labels, dates, and accumulated duration", () => {
    const timer = normalizeTimer({
      _id: "timer-1",
      startedAt: Date.UTC(2026, 6, 30, 12),
      label: "Legacy note",
    } as Partial<LocalTimer> & {
      _id: string;
      startedAt: number;
      label: string;
    });

    expect(timer).toMatchObject({
      localDate: "2026-07-30",
      note: "Legacy note",
      accumulatedDurationMs: 0,
    });
  });

  it("starts one timer and allows its editable fields to change", () => {
    const started = startTimer(
      createState(),
      {
        localDate: "2026-07-30",
        projectId: "project-1",
        taskId: "task-1",
      },
      createFactories(),
    );
    const updated = updateTimer(started, "timer-1", {
      note: "Updated note",
      accumulatedDurationMs: 250,
    });

    expect(updated.timers).toEqual([
      expect.objectContaining({
        _id: "timer-1",
        startedAt: 1_000,
        note: "Updated note",
        accumulatedDurationMs: 250,
      }),
    ]);
  });

  it("does not create a paired entry while another timer is active", () => {
    const state = createState({
      timers: [
        {
          _id: "active",
          startedAt: 100,
          localDate: "2026-07-30",
          accumulatedDurationMs: 0,
        },
      ],
    });

    expect(
      startTimerWithEntry(
        state,
        { localDate: "2026-07-30" },
        createFactories(),
      ),
    ).toBe(state);
  });
});

describe("timer and timesheet entry lifecycle", () => {
  it("creates a paired entry and timer with matching identity", () => {
    const state = startTimerWithEntry(
      createState(),
      {
        localDate: "2026-07-30",
        projectId: "project-1",
        taskId: "task-1",
        durationMs: 400,
      },
      createFactories(),
    );

    expect(state.timesheetEntries[0]).toMatchObject({
      _id: "timesheet-1",
      label: "Build",
      durationMs: 400,
    });
    expect(state.timers[0]).toMatchObject({
      _id: "timer-2",
      entryId: "timesheet-1",
      accumulatedDurationMs: 400,
    });
  });

  it("applies an initial timer duration to linked work-item estimates", () => {
    const state = startTimerWithEntry(
      createState({
        workItems: [
          {
            _id: "work-item-1",
            title: "Build",
            status: "active",
            source: "manual",
            projectId: "project-1",
            taskId: "task-1",
            remainingEstimateHours: 2,
            completedEstimateHours: 0,
            createdAt: 1,
          },
        ],
      }),
      {
        localDate: "2026-07-30",
        projectId: "project-1",
        taskId: "task-1",
        durationMs: 60 * 60 * 1000,
      },
      createFactories(),
    );

    expect(state.workItems[0]).toMatchObject({
      remainingEstimateHours: 1,
      completedEstimateHours: 1,
    });
  });

  it("saves elapsed time as a new entry and removes the timer", () => {
    const state = createState({
      timers: [
        {
          _id: "timer-1",
          startedAt: 700,
          localDate: "2026-07-30",
          projectId: "project-1",
          taskId: "task-1",
          note: "Build",
          accumulatedDurationMs: 200,
        },
      ],
    });

    const saved = saveTimer(state, "timer-1", createFactories());

    expect(saved.timers).toEqual([]);
    expect(saved.timesheetEntries[0]).toMatchObject({
      _id: "timesheet-1",
      label: "Build",
      durationMs: 500,
      committedAt: 1_000,
    });
  });

  it("replaces a restarted entry and clears stale submission state", () => {
    const originalEntry = createEntry({
      submittedAt: 650,
      sourceBlockIds: ["browser:1"],
    });
    originalEntry.submittedFingerprint =
      createTimesheetEntrySubmissionFingerprint(originalEntry);
    const state = createState({
      timesheetEntries: [originalEntry],
      timers: [
        {
          _id: "timer-1",
          startedAt: 900,
          localDate: originalEntry.localDate,
          projectId: originalEntry.projectId,
          taskId: originalEntry.taskId,
          note: originalEntry.note,
          accumulatedDurationMs: originalEntry.durationMs,
          entryId: originalEntry._id,
        },
      ],
    });

    const saved = saveTimer(state, "timer-1", createFactories());

    expect(saved.timesheetEntries).toHaveLength(1);
    expect(saved.timesheetEntries[0]).toMatchObject({
      _id: originalEntry._id,
      durationMs: 600,
      submittedAt: undefined,
      submittedFingerprint: undefined,
      sourceBlockIds: ["browser:1"],
    });
  });

  it("creates a replacement entry when a timer points to a missing entry", () => {
    const state = createState({
      timers: [
        {
          _id: "timer-1",
          startedAt: 900,
          localDate: "2026-07-30",
          accumulatedDurationMs: 100,
          entryId: "missing-entry",
        },
      ],
    });

    const saved = saveTimer(state, "timer-1", createFactories());

    expect(saved.timesheetEntries).toEqual([
      expect.objectContaining({
        _id: "missing-entry",
        durationMs: 200,
      }),
    ]);
  });

  it("does not replace an active timer when restarting an entry", () => {
    const entry = createEntry();
    const restarted = restartTimesheetEntry(
      createState({
        timesheetEntries: [entry],
        timers: [
          {
            _id: "old-timer",
            startedAt: 100,
            localDate: "2026-07-29",
            accumulatedDurationMs: 100,
          },
        ],
      }),
      entry._id,
      createFactories(),
    );

    expect(restarted.timers).toEqual([
      expect.objectContaining({ _id: "old-timer" }),
    ]);
  });

  it("restarts an entry when no timer is active", () => {
    const entry = createEntry();
    const restarted = restartTimesheetEntry(
      createState({ timesheetEntries: [entry] }),
      entry._id,
      createFactories(),
    );

    expect(restarted.timers[0]).toMatchObject({
      entryId: entry._id,
      accumulatedDurationMs: entry.durationMs,
    });
  });

  it("leaves state unchanged when saving or restarting an unknown record", () => {
    const state = createState();
    const factories = createFactories();

    expect(saveTimer(state, "missing", factories)).toBe(state);
    expect(restartTimesheetEntry(state, "missing", factories)).toBe(state);
  });
});
