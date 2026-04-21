import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import type {
  ConnectorImportCandidateInput,
  ConnectorPluginManifest,
} from "../../../packages/shared/src/connectors.ts";
import { AppApiStorage } from "./storage.ts";

function buildPlugin(id: string, displayName: string): ConnectorPluginManifest {
  return {
    id,
    displayName,
    description: `${displayName} connector`,
    iconSvg: `<svg viewBox="0 0 16 16" data-plugin="${id}"><path d="M0 0h16v16H0z" /></svg>`,
    entrypoint: "worker.mjs",
    connectionFields: [
      {
        id: "label",
        label: "Connection label",
        type: "text",
        required: true,
        secret: false,
      },
      {
        id: "tenantLabel",
        label: "Workspace",
        type: "text",
        required: true,
        secret: false,
      },
    ],
  };
}

function buildImportCandidate(
  overrides: Partial<ConnectorImportCandidateInput> = {},
): ConnectorImportCandidateInput {
  return {
    source: "azure_devops",
    connectionId: "ado-1",
    connectionLabel: "Main connection",
    tenantLabel: "Contoso",
    sourceId: "https://dev.azure.com/contoso/project/_workitems/edit/123",
    externalId: "123",
    sourceUrl: "https://dev.azure.com/contoso/project/_workitems/edit/123",
    title: "Initial title",
    note: "Initial note",
    projectName: "Project Mercury",
    workItemType: "Task",
    state: "Active",
    assignedTo: "Ada Lovelace",
    depth: 0,
    selectable: true,
    childCount: 0,
    ...overrides,
  };
}

describe("AppApiStorage", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("re-stages an imported connector item after it was previously committed", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "timetracker-storage-"));
    tempDirs.push(tempDir);

    const storage = new AppApiStorage(path.join(tempDir, "app-api-state.json"));

    await expect(storage.stageImportItems([buildImportCandidate()])).resolves.toEqual({
      queuedCount: 1,
      updatedCount: 0,
      skippedCount: 0,
    });

    await expect(storage.commitSelectedImports()).resolves.toHaveLength(1);
    await expect(storage.listStagedImports()).resolves.toMatchObject({
      totalCount: 0,
      selectedCount: 0,
      items: [],
    });

    await expect(
      storage.stageImportItems([
        buildImportCandidate({
          title: "Updated title",
          note: "Updated note",
        }),
      ]),
    ).resolves.toEqual({
      queuedCount: 1,
      updatedCount: 0,
      skippedCount: 0,
    });

    await expect(storage.listStagedImports()).resolves.toMatchObject({
      totalCount: 1,
      selectedCount: 1,
      items: [
        expect.objectContaining({
          title: "Updated title",
          note: "Updated note",
          sourceId: "https://dev.azure.com/contoso/project/_workitems/edit/123",
        }),
      ],
    });
  });

  it("dismisses staged imports and keeps them out of later syncs", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "timetracker-storage-"));
    tempDirs.push(tempDir);

    const storage = new AppApiStorage(path.join(tempDir, "app-api-state.json"));

    await storage.stageImportItems([buildImportCandidate()]);
    const staged = await storage.listStagedImports();

    await expect(storage.dismissImports(staged.items.map((item) => item.id))).resolves.toBe(1);
    await expect(storage.listStagedImports()).resolves.toMatchObject({
      totalCount: 0,
      selectedCount: 0,
      items: [],
    });

    await expect(storage.stageImportItems([buildImportCandidate()])).resolves.toEqual({
      queuedCount: 0,
      updatedCount: 0,
      skippedCount: 1,
    });
  });

  it("ignores legacy seenImportKeys so previously committed connector imports can stage again", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "timetracker-storage-"));
    tempDirs.push(tempDir);

    const statePath = path.join(tempDir, "app-api-state.json");
    await writeFile(
      statePath,
      `${JSON.stringify(
        {
          version: 2,
          connectors: {
            azureDevOpsConnections: [],
          },
          stagedImports: [],
          seenImportKeys: ["azure_devops:ado-1:https://dev.azure.com/contoso/project/_workitems/edit/123"],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const storage = new AppApiStorage(statePath);

    await expect(storage.stageImportItems([buildImportCandidate()])).resolves.toEqual({
      queuedCount: 1,
      updatedCount: 0,
      skippedCount: 0,
    });
  });

  it("stores plugin-shaped connections and groups them by plugin in the overview", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "timetracker-storage-"));
    tempDirs.push(tempDir);

    const storage = new AppApiStorage(path.join(tempDir, "app-api-state.json"));
    const azurePlugin = buildPlugin("azure_devops", "Azure DevOps");
    const jiraPlugin = buildPlugin("jira", "Jira");

    await storage.upsertConnection("azure_devops", {
      label: "Main Azure",
      tenantLabel: "Contoso",
      autoSync: true,
      autoSyncIntervalMinutes: 20,
      config: {
        organizationUrl: "https://dev.azure.com/contoso",
        queryScope: "assigned_to_me",
      },
      configSummary: {
        organizationUrl: "https://dev.azure.com/contoso",
        scope: "Assigned to me",
      },
    });

    await storage.upsertConnection("jira", {
      label: "Main Jira",
      tenantLabel: "Acme",
      autoSync: false,
      autoSyncIntervalMinutes: 15,
      config: {
        baseUrl: "https://acme.atlassian.net",
      },
      configSummary: {
        site: "https://acme.atlassian.net",
        scope: "Assigned to me",
      },
    });

    await expect(storage.getConnectorsOverview([azurePlugin, jiraPlugin])).resolves.toMatchObject({
      plugins: [
        expect.objectContaining({ id: "azure_devops", displayName: "Azure DevOps" }),
        expect.objectContaining({ id: "jira", displayName: "Jira" }),
      ],
      connectionGroups: [
        expect.objectContaining({
          plugin: expect.objectContaining({ id: "azure_devops" }),
          connections: [
            expect.objectContaining({
              label: "Main Azure",
              autoSync: true,
              configSummary: {
                organizationUrl: "https://dev.azure.com/contoso",
                scope: "Assigned to me",
              },
            }),
          ],
        }),
        expect.objectContaining({
          plugin: expect.objectContaining({ id: "jira" }),
          connections: [
            expect.objectContaining({
              label: "Main Jira",
              autoSync: false,
              configSummary: {
                site: "https://acme.atlassian.net",
                scope: "Assigned to me",
              },
            }),
          ],
        }),
      ],
      totalPendingImportCount: 0,
      totalSelectedImportCount: 0,
    });
  });

  it("stores connector backlog statuses discovered by any plugin source", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "timetracker-storage-"));
    tempDirs.push(tempDir);

    const storage = new AppApiStorage(path.join(tempDir, "app-api-state.json"));

    await expect(
      storage.upsertConnectorBacklogStatuses([
        {
          source: "jira",
          connectionId: "jira-1",
          connectionLabel: "Main Jira",
          tenantLabel: "Acme",
          label: "In Progress",
        },
      ]),
    ).resolves.toEqual([
      expect.objectContaining({
        source: "jira",
        connectionId: "jira-1",
        key: "in progress",
        label: "In Progress",
      }),
    ]);

    await expect(storage.listConnectorBacklogStatuses()).resolves.toEqual({
      items: [
        expect.objectContaining({
          source: "jira",
          connectionId: "jira-1",
          key: "in progress",
          label: "In Progress",
        }),
      ],
    });
  });
});
