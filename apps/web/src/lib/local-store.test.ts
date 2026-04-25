import { beforeEach, describe, expect, it, vi } from "vitest";

function installMockWindow() {
  const storage = new Map<string, string>();

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      localStorage: {
        getItem: vi.fn((key: string) => storage.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          storage.set(key, value);
        }),
        removeItem: vi.fn((key: string) => {
          storage.delete(key);
        }),
        clear: vi.fn(() => {
          storage.clear();
        }),
      },
    },
  });
}

function buildImportCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: "connector-1",
    source: "azure_devops" as const,
    connectionId: "ado-1",
    connectionLabel: "Main connection",
    tenantLabel: "Contoso",
    sourceId: "https://dev.azure.com/contoso/project/_workitems/edit/101",
    externalId: "101",
    sourceUrl: "https://dev.azure.com/contoso/project/_workitems/edit/101",
    title: "Imported work item",
    projectName: "Project Mercury",
    workItemType: "Task",
    state: "Active",
    assignedTo: "Ada Lovelace",
    priority: 2,
    originalEstimateHours: 12,
    remainingEstimateHours: 8,
    completedEstimateHours: 4,
    depth: 0 as const,
    selectable: true,
    selected: true,
    childCount: 0,
    pushedAt: 1,
    ...overrides,
  };
}

describe("localStore backlog status sync", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => `uuid-${Math.random().toString(16).slice(2)}`),
    });
    installMockWindow();
  });

  it("keeps a local backlog status override when the synced mapping changes", async () => {
    const { localStore } = await import("./local-store");

    const todoStatusId = localStore.addBacklogStatus("To do");
    const doingStatusId = localStore.addBacklogStatus("Doing");
    const blockedStatusId = localStore.addBacklogStatus("Blocked");

    localStore.setBacklogStatusMapping({
      source: "azure_devops",
      connectionId: "ado-1",
      sourceStatusKey: "active",
      backlogStatusId: todoStatusId,
    });

    localStore.importConnectorWorkItems([buildImportCandidate()]);
    const importedItem = localStore.snapshot().workItems[0];
    expect(importedItem).toMatchObject({
      backlogStatusId: todoStatusId,
      importedBacklogStatusId: todoStatusId,
      sourceStatusLabel: "Active",
    });

    localStore.updateWorkItem(importedItem!._id, {
      backlogStatusId: doingStatusId,
    });

    localStore.setBacklogStatusMapping({
      source: "azure_devops",
      connectionId: "ado-1",
      sourceStatusKey: "active",
      backlogStatusId: blockedStatusId,
    });

    expect(localStore.snapshot().workItems[0]).toMatchObject({
      backlogStatusId: doingStatusId,
      importedBacklogStatusId: blockedStatusId,
    });
  });

  it("stores backlog status colors and lets them be updated", async () => {
    const { localStore } = await import("./local-store");

    const backlogStatusId = localStore.addBacklogStatus("To do", "#123456");
    expect(localStore.snapshot().backlogStatuses).toContainEqual(
      expect.objectContaining({
        _id: backlogStatusId,
        name: "To do",
        color: "#123456",
      }),
    );

    localStore.updateBacklogStatus(backlogStatusId, {
      name: "Doing",
      color: "#654321",
    });

    expect(localStore.snapshot().backlogStatuses).toContainEqual(
      expect.objectContaining({
        _id: backlogStatusId,
        name: "Doing",
        color: "#654321",
      }),
    );
  });

  it("hydrates a fallback color for legacy backlog statuses without one", async () => {
    window.localStorage.setItem(
      "timetracker.local-state.v2",
      JSON.stringify({
        user: {
          _id: "local_user",
          name: "Local User",
          email: "local-only@timetracker.dev",
        },
        projects: [],
        rules: [],
        segments: [],
        dismissedSegmentIds: [],
        editedBlocks: [],
        importedBrowserDrafts: [],
        outlookMeetingDrafts: [],
        timers: [],
        timesheetEntries: [],
        timesheetImportDrafts: [],
        workItems: [],
        backlogStatuses: [
          {
            _id: "status-1",
            name: "Legacy",
            createdAt: 1,
          },
        ],
        backlogStatusMappings: [],
        backlogSortMode: "custom",
        capture: {
          urlMode: "sanitized_path",
          titleMode: "normalized",
          blockedDomains: [],
          sensitiveDomains: [],
          maxPathSegments: 4,
        },
        outlookIntegration: {
          configured: false,
          connected: false,
        },
        userPreferences: {
          themeMode: "system",
        },
        updatedAt: 1,
      }),
    );

    const { localStore } = await import("./local-store");

    expect(localStore.snapshot().backlogStatuses).toContainEqual(
      expect.objectContaining({
        _id: "status-1",
        name: "Legacy",
        color: expect.stringMatching(/^#[0-9a-f]{6}$/i),
      }),
    );
  });

  it("archives imported work items that disappear during auto-sync reconciliation", async () => {
    const { localStore } = await import("./local-store");

    localStore.importConnectorWorkItems([buildImportCandidate()]);
    const importedItem = localStore.snapshot().workItems[0];
    expect(importedItem?.status).toBe("active");

    const result = localStore.importConnectorWorkItems([], {
      archiveMissingFromConnectionId: "ado-1",
    });

    expect(result.archivedCount).toBe(1);
    expect(localStore.snapshot().workItems[0]).toMatchObject({
      _id: importedItem!._id,
      status: "archived",
    });
  });

  it("initializes imported estimate fields from connector candidates", async () => {
    const { localStore } = await import("./local-store");

    localStore.importConnectorWorkItems([buildImportCandidate()]);

    expect(localStore.snapshot().workItems[0]).toMatchObject({
      originalEstimateHours: 12,
      remainingEstimateHours: 8,
      completedEstimateHours: 4,
    });
  });

  it("increments completed and decrements remaining when manual time is saved for a mapped task", async () => {
    const { localStore } = await import("./local-store");

    const projectId = localStore.snapshot().projects[0]!._id;
    localStore.addProjectTask(projectId, "Imported task");
    const taskId = localStore.snapshot().projects[0]!.tasks.at(-1)!._id;
    localStore.importConnectorWorkItems([buildImportCandidate()]);
    const workItem = localStore.snapshot().workItems[0]!;
    localStore.updateWorkItem(workItem._id, {
      projectId,
      taskId,
    });

    localStore.saveManualTimeEntry({
      localDate: "2026-04-21",
      projectId,
      taskId,
      durationMs: 2 * 60 * 60 * 1000,
    });

    expect(localStore.snapshot().workItems[0]).toMatchObject({
      remainingEstimateHours: 6,
      completedEstimateHours: 6,
    });
  });

  it("clamps remaining at zero when logged time exceeds the estimate", async () => {
    const { localStore } = await import("./local-store");

    const projectId = localStore.snapshot().projects[0]!._id;
    localStore.addProjectTask(projectId, "Overrun task");
    const taskId = localStore.snapshot().projects[0]!.tasks.at(-1)!._id;
    localStore.importConnectorWorkItems([
      buildImportCandidate({
        remainingEstimateHours: 1,
        completedEstimateHours: 0,
      }),
    ]);
    const workItem = localStore.snapshot().workItems[0]!;
    localStore.updateWorkItem(workItem._id, {
      projectId,
      taskId,
    });

    localStore.saveManualTimeEntry({
      localDate: "2026-04-21",
      projectId,
      taskId,
      durationMs: 2 * 60 * 60 * 1000,
    });

    expect(localStore.snapshot().workItems[0]).toMatchObject({
      remainingEstimateHours: 0,
      completedEstimateHours: 2,
    });
  });

  it("updates estimates for a backlog work item even when no project or task is mapped", async () => {
    const { localStore } = await import("./local-store");

    localStore.importConnectorWorkItems([buildImportCandidate()]);
    const workItem = localStore.snapshot().workItems[0]!;

    localStore.saveManualTimeEntry({
      localDate: "2026-04-21",
      workItemId: workItem._id,
      durationMs: 90 * 60 * 1000,
    });

    expect(localStore.snapshot().workItems[0]).toMatchObject({
      remainingEstimateHours: 6.5,
      completedEstimateHours: 5.5,
    });
  });

  it("reverses unmapped backlog estimate deltas when the linked time entry is deleted", async () => {
    const { localStore } = await import("./local-store");

    localStore.importConnectorWorkItems([buildImportCandidate()]);
    const workItem = localStore.snapshot().workItems[0]!;

    localStore.saveManualTimeEntry({
      localDate: "2026-04-21",
      workItemId: workItem._id,
      durationMs: 90 * 60 * 1000,
    });

    const entryId = localStore.snapshot().timesheetEntries[0]!._id;
    localStore.deleteTimesheetEntry(entryId);

    expect(localStore.snapshot().workItems[0]).toMatchObject({
      remainingEstimateHours: 8,
      completedEstimateHours: 4,
    });
  });

  it("hydrates committed entries from desktop bootstrap state when the current profile was reset", async () => {
    const bootstrapState = {
      projects: [
        {
          _id: "project_custom",
          name: "Recovered project",
          color: "#123456",
          status: "active" as const,
          tasks: [],
        },
      ],
      timesheetEntries: [
        {
          _id: "timesheet_recovered",
          localDate: "2026-04-15",
          label: "Recovered entry",
          durationMs: 60 * 60 * 1000,
          sourceBlockIds: [],
          committedAt: 123,
        },
      ],
      updatedAt: 999,
    };

    const storage = new Map<string, string>();
    storage.set(
      "timetracker.local-state.v2",
      JSON.stringify({
        user: {
          _id: "local_user",
          name: "Local User",
          email: "local-only@timetracker.dev",
        },
        projects: [
          {
            _id: "project_default_1",
            name: "Internal",
            color: "#1f7667",
            code: "INT",
            status: "active",
            tasks: [],
          },
          {
            _id: "project_default_2",
            name: "Client Work",
            color: "#ec7a43",
            code: "CLT",
            status: "active",
            tasks: [],
          },
        ],
        rules: [],
        segments: [],
        dismissedSegmentIds: [],
        editedBlocks: [],
        importedBrowserDrafts: [],
        outlookMeetingDrafts: [],
        timers: [],
        timesheetEntries: [],
        workItems: [],
        backlogStatuses: [],
        backlogStatusMappings: [],
        backlogSortMode: "custom",
        capture: {
          urlMode: "sanitized_path",
          titleMode: "normalized",
          blockedDomains: [],
          sensitiveDomains: [],
          maxPathSegments: 4,
        },
        outlookIntegration: {
          configured: false,
          connected: false,
        },
        userPreferences: {
          themeMode: "system",
        },
        updatedAt: 100,
      }),
    );
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        timetrackerDesktop: {
          bootstrapLocalState: bootstrapState,
        },
        localStorage: {
          getItem: vi.fn((key: string) => storage.get(key) ?? null),
          setItem: vi.fn((key: string, value: string) => {
            storage.set(key, value);
          }),
          removeItem: vi.fn((key: string) => {
            storage.delete(key);
          }),
          clear: vi.fn(() => {
            storage.clear();
          }),
        },
      },
    });

    const { localStore } = await import("./local-store");

    expect(localStore.snapshot().timesheetEntries).toHaveLength(1);
    expect(localStore.snapshot().timesheetEntries[0]).toMatchObject({
      _id: "timesheet_recovered",
      localDate: "2026-04-15",
    });
    expect(localStore.snapshot().projects[0]).toMatchObject({
      _id: "project_custom",
      name: "Recovered project",
    });
  });

  it("merges recovered entries into a partially restored profile", async () => {
    const bootstrapState = {
      projects: [
        {
          _id: "project_custom",
          name: "Recovered project",
          color: "#123456",
          status: "active" as const,
          tasks: [],
        },
      ],
      timesheetEntries: [
        {
          _id: "timesheet_bootstrap",
          localDate: "2026-04-15",
          label: "Recovered entry",
          durationMs: 60 * 60 * 1000,
          sourceBlockIds: [],
          committedAt: 123,
        },
      ],
      updatedAt: 999,
    };

    const storage = new Map<string, string>();
    storage.set(
      "timetracker.local-state.v2",
      JSON.stringify({
        user: {
          _id: "local_user",
          name: "Local User",
          email: "local-only@timetracker.dev",
        },
        projects: [
          {
            _id: "project_default_1",
            name: "Internal",
            color: "#1f7667",
            code: "INT",
            status: "active",
            tasks: [],
          },
          {
            _id: "project_default_2",
            name: "Client Work",
            color: "#ec7a43",
            code: "CLT",
            status: "active",
            tasks: [],
          },
        ],
        rules: [],
        segments: [],
        dismissedSegmentIds: [],
        editedBlocks: [],
        importedBrowserDrafts: [],
        outlookMeetingDrafts: [],
        timers: [],
        timesheetEntries: [
          {
            _id: "timesheet_current",
            localDate: "2026-04-11",
            label: "",
            durationMs: 30 * 60 * 1000,
            sourceBlockIds: [],
            committedAt: 100,
          },
        ],
        workItems: [],
        backlogStatuses: [],
        backlogStatusMappings: [],
        backlogSortMode: "custom",
        capture: {
          urlMode: "sanitized_path",
          titleMode: "normalized",
          blockedDomains: [],
          sensitiveDomains: [],
          maxPathSegments: 4,
        },
        outlookIntegration: {
          configured: false,
          connected: false,
        },
        userPreferences: {
          themeMode: "system",
        },
        updatedAt: 100,
      }),
    );
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        timetrackerDesktop: {
          bootstrapLocalState: bootstrapState,
        },
        localStorage: {
          getItem: vi.fn((key: string) => storage.get(key) ?? null),
          setItem: vi.fn((key: string, value: string) => {
            storage.set(key, value);
          }),
          removeItem: vi.fn((key: string) => {
            storage.delete(key);
          }),
          clear: vi.fn(() => {
            storage.clear();
          }),
        },
      },
    });

    const { localStore } = await import("./local-store");

    expect(localStore.snapshot().timesheetEntries.map((entry) => entry._id)).toEqual([
      "timesheet_current",
      "timesheet_bootstrap",
    ]);
    expect(localStore.snapshot().projects[0]).toMatchObject({
      _id: "project_custom",
      name: "Recovered project",
    });
  });

  it("stages workbook imports for review and commits ready rows on demand", async () => {
    const { localStore } = await import("./local-store");

    localStore.stageTimesheetImportRows([
      {
        date: "2026-04-21",
        project: "Project Mercury",
        task: "Feature Work",
        note: "Imported row",
        hours: 1.5,
      },
    ]);

    expect(localStore.snapshot().timesheetImportDrafts).toHaveLength(1);
    expect(localStore.snapshot().timesheetEntries).toHaveLength(0);

    const draftId = localStore.snapshot().timesheetImportDrafts[0]!._id;
    localStore.commitTimesheetImportDraft(draftId);

    expect(localStore.snapshot().timesheetImportDrafts).toHaveLength(0);
    expect(localStore.snapshot().timesheetEntries).toHaveLength(1);
    expect(localStore.snapshot().projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Project Mercury",
          tasks: expect.arrayContaining([expect.objectContaining({ name: "Feature Work" })]),
        }),
      ]),
    );
  });

  it("imports workbook rows without a project or task without creating an empty project", async () => {
    const { localStore } = await import("./local-store");
    const initialProjectCount = localStore.snapshot().projects.length;

    localStore.stageTimesheetImportRows([
      {
        date: "2026-04-21",
        project: "",
        task: "",
        note: "Imported unassigned row",
        hours: 1.5,
      },
    ]);

    const draftId = localStore.snapshot().timesheetImportDrafts[0]!._id;
    localStore.commitTimesheetImportDraft(draftId);

    expect(localStore.snapshot().timesheetImportDrafts).toHaveLength(0);
    expect(localStore.snapshot().projects).toHaveLength(initialProjectCount);
    expect(localStore.snapshot().projects.map((project) => project.name)).not.toContain("");
    expect(localStore.snapshot().timesheetEntries).toEqual([
      expect.objectContaining({
        localDate: "2026-04-21",
        projectId: undefined,
        taskId: undefined,
        note: "Imported unassigned row",
        durationMs: 90 * 60 * 1000,
      }),
    ]);
  });

  it("flags potential conflicts for staged workbook imports", async () => {
    const { localStore } = await import("./local-store");

    const projectId = localStore.addProject({
      name: "Project Mercury",
      color: "#123456",
      tasks: [{ name: "Feature Work" }],
    });
    const taskId = localStore.snapshot().projects.find((project) => project._id === projectId)?.tasks[0]?._id;

    localStore.saveManualTimeEntry({
      localDate: "2026-04-21",
      projectId,
      taskId,
      durationMs: 60 * 60 * 1000,
    });

    localStore.stageTimesheetImportRows([
      {
        date: "2026-04-21",
        project: "Project Mercury",
        task: "Feature Work",
        note: "Imported row",
        hours: 1.5,
      },
    ]);

    expect(localStore.snapshot().timesheetImportDrafts[0]).toMatchObject({
      potentialConflict: true,
    });
  });

  it("dismisses staged workbook imports without changing committed entries", async () => {
    const { localStore } = await import("./local-store");

    localStore.stageTimesheetImportRows([
      {
        date: "2026-04-21",
        project: "Project Mercury",
        task: "Feature Work",
        note: "Imported row",
        hours: 1.5,
      },
    ]);

    const draftId = localStore.snapshot().timesheetImportDrafts[0]!._id;
    localStore.dismissTimesheetImportDraft(draftId);

    expect(localStore.snapshot().timesheetImportDrafts).toHaveLength(0);
    expect(localStore.snapshot().timesheetEntries).toHaveLength(0);
  });

  it("merges imported project workbook rows by project name and adds missing tasks", async () => {
    const { localStore } = await import("./local-store");

    const projectId = localStore.addProject({
      name: "Project Mercury",
      code: "OLD",
      color: "#123456",
      tasks: [{ name: "Feature Work" }],
    });
    const existingTaskId = localStore.snapshot().projects.find((project) => project._id === projectId)?.tasks[0]?._id;
    expect(existingTaskId).toBeTruthy();

    const result = localStore.importProjectWorkbookRows([
      {
        project: "Project Mercury",
        code: "MER",
        color: "#654321",
        status: "active",
        task: "Feature Work",
        taskStatus: "archived",
      },
      {
        project: "Project Mercury",
        code: "MER",
        color: "#654321",
        status: "active",
        task: "Planning",
        taskStatus: "active",
      },
      {
        project: "Project Apollo",
        code: "APL",
        color: "#111111",
        status: "archived",
        task: "",
        taskStatus: "",
      },
    ]);

    expect(result).toEqual({
      createdProjectCount: 1,
      mergedProjectCount: 1,
      addedTaskCount: 1,
      updatedTaskCount: 1,
    });

    const mercury = localStore.snapshot().projects.find((project) => project.name === "Project Mercury");
    const apollo = localStore.snapshot().projects.find((project) => project.name === "Project Apollo");

    expect(mercury).toMatchObject({
      code: "MER",
      color: "#654321",
      status: "active",
    });
    expect(mercury?.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: existingTaskId,
          name: "Feature Work",
          status: "archived",
        }),
        expect.objectContaining({
          name: "Planning",
          status: "active",
        }),
      ]),
    );

    expect(apollo).toMatchObject({
      code: "APL",
      color: "#111111",
      status: "archived",
      tasks: [],
    });
  });

  it("marks selected timesheet entries as submitted", async () => {
    const { localStore } = await import("./local-store");

    const projectId = localStore.snapshot().projects[0]!._id;
    localStore.addProjectTask(projectId, "Submitted work");
    const taskId = localStore.snapshot().projects[0]!.tasks.at(-1)!._id;

    localStore.saveManualTimeEntry({
      localDate: "2026-04-21",
      projectId,
      taskId,
      note: "Weekly sync",
      durationMs: 60 * 60 * 1000,
    });

    const entryId = localStore.snapshot().timesheetEntries[0]!._id;
    localStore.markTimesheetEntriesSubmitted([entryId]);

    expect(localStore.snapshot().timesheetEntries[0]).toMatchObject({
      _id: entryId,
      submittedAt: expect.any(Number),
      submittedFingerprint: expect.any(String),
    });
  });

  it("keeps submitted state when a timesheet entry is saved without changes", async () => {
    const { localStore } = await import("./local-store");

    const projectId = localStore.snapshot().projects[0]!._id;
    localStore.addProjectTask(projectId, "Stable work");
    const taskId = localStore.snapshot().projects[0]!.tasks.at(-1)!._id;

    localStore.saveManualTimeEntry({
      localDate: "2026-04-21",
      projectId,
      taskId,
      note: "Keep submitted",
      durationMs: 90 * 60 * 1000,
    });

    const entry = localStore.snapshot().timesheetEntries[0]!;
    localStore.markTimesheetEntriesSubmitted([entry._id]);

    const submittedEntry = localStore.snapshot().timesheetEntries[0]!;
    localStore.updateTimesheetEntry(entry._id, {
      projectId,
      taskId,
      note: "Keep submitted",
      durationMs: 90 * 60 * 1000,
    });

    expect(localStore.snapshot().timesheetEntries[0]).toMatchObject({
      _id: entry._id,
      submittedAt: submittedEntry.submittedAt,
      submittedFingerprint: submittedEntry.submittedFingerprint,
    });
  });

  it("clears submitted state when a saved timesheet entry changes", async () => {
    const { localStore } = await import("./local-store");

    const projectId = localStore.snapshot().projects[0]!._id;
    localStore.addProjectTask(projectId, "Changed work");
    const taskId = localStore.snapshot().projects[0]!.tasks.at(-1)!._id;

    localStore.saveManualTimeEntry({
      localDate: "2026-04-21",
      projectId,
      taskId,
      note: "Before change",
      durationMs: 2 * 60 * 60 * 1000,
    });

    const entryId = localStore.snapshot().timesheetEntries[0]!._id;
    localStore.markTimesheetEntriesSubmitted([entryId]);
    localStore.updateTimesheetEntry(entryId, {
      projectId,
      taskId,
      note: "After change",
      durationMs: 2 * 60 * 60 * 1000,
    });

    expect(localStore.snapshot().timesheetEntries[0]).toMatchObject({
      _id: entryId,
      submittedAt: undefined,
      submittedFingerprint: undefined,
    });
  });
});
