import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/backlog/work-item-source-sync", () => ({
  syncBacklogWorkItemToSource: vi.fn(),
}));

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

describe("backlogCommands", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => `uuid-${Math.random().toString(16).slice(2)}`),
    });
    installMockWindow();
  });

  it("saves a work item draft through the backlog command seam", async () => {
    const { backlogCommands } = await import("./backlog-commands");
    const { localStore } = await import("../../lib/local-store");

    localStore.importConnectorWorkItems([buildImportCandidate()]);
    const workItem = localStore.snapshot().workItems[0]!;

    const patch = backlogCommands.saveDraft(workItem, {
      title: "  Updated title  ",
      note: "  Updated note  ",
      priority: "5",
      backlogStatusId: "",
      projectId: "",
      taskId: "",
      originalEstimateHours: "13.25",
      remainingEstimateHours: "7.5",
      completedEstimateHours: "5.75",
    });

    expect(patch).toMatchObject({
      title: "Updated title",
      priority: 5,
      originalEstimateHours: 13.25,
      remainingEstimateHours: 7.5,
      completedEstimateHours: 5.75,
    });
    expect(localStore.snapshot().workItems[0]).toMatchObject({
      title: "Updated title",
      note: "Updated note",
      priority: 5,
      originalEstimateHours: 13.25,
      remainingEstimateHours: 7.5,
      completedEstimateHours: 5.75,
    });
  });

  it("logs backlog time and applies estimate deltas behind one command", async () => {
    const { backlogCommands } = await import("./backlog-commands");
    const { localStore } = await import("../../lib/local-store");

    localStore.importConnectorWorkItems([buildImportCandidate()]);
    const workItem = localStore.snapshot().workItems[0]!;

    backlogCommands.logTime(
      workItem,
      {
        title: workItem.title,
        originalEstimateHours: "12",
        remainingEstimateHours: "8",
        completedEstimateHours: "4",
      },
      {
        localDate: "2026-04-27",
        timeEntryNote: "",
        durationMs: 90 * 60 * 1000,
      },
    );

    expect(localStore.snapshot().timesheetEntries[0]).toMatchObject({
      localDate: "2026-04-27",
      workItemId: workItem._id,
      durationMs: 90 * 60 * 1000,
    });
    expect(localStore.snapshot().workItems[0]).toMatchObject({
      remainingEstimateHours: 6.5,
      completedEstimateHours: 5.5,
    });
  });

  it("does not clear imported parent links when a draft is not editing parenthood", async () => {
    const { backlogCommands } = await import("./backlog-commands");
    const { localStore } = await import("../../lib/local-store");

    localStore.importConnectorWorkItems([
      buildImportCandidate({ sourceId: "parent", externalId: "100" }),
      buildImportCandidate({
        sourceId: "child",
        externalId: "101",
        parentSourceId: "parent",
        depth: 1,
      }),
    ]);
    const child = localStore
      .snapshot()
      .workItems.find((workItem) => workItem.sourceId === "child")!;

    backlogCommands.saveDraft(child, {
      title: "Updated child",
      originalEstimateHours: "12",
      remainingEstimateHours: "8",
      completedEstimateHours: "4",
    });

    expect(
      localStore
        .snapshot()
        .workItems.find((workItem) => workItem.sourceId === "child"),
    ).toMatchObject({
      title: "Updated child",
      parentSourceId: "parent",
      hierarchyLevel: 1,
    });
  });
});
