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
});
