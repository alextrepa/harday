import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { ConnectorPluginManager } from "./plugin-host.ts";

describe("ConnectorPluginManager", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("loads plugin manifests and invokes plugin modules", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "timetracker-plugin-host-"));
    tempDirs.push(tempDir);

    const pluginDir = path.join(tempDir, "jira");
    await mkdir(pluginDir, { recursive: true });
    await writeFile(
      path.join(tempDir, "jira", "plugin.json"),
      JSON.stringify(
        {
          id: "jira",
          displayName: "Jira",
          description: "Sync Jira issues into backlog.",
          iconSvg: "<svg viewBox='0 0 16 16'><path d='M0 0h16v16H0z' /></svg>",
          entrypoint: "plugin.cjs",
          connectionFields: [
            {
              id: "label",
              label: "Connection label",
              type: "text",
              required: true,
            },
            {
              id: "tenantLabel",
              label: "Workspace",
              type: "text",
              required: true,
            },
            {
              id: "baseUrl",
              label: "Site URL",
              type: "url",
              required: true,
            },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      path.join(pluginDir, "plugin.cjs"),
      [
        "module.exports = {",
        "  async validateConnection(config) {",
        "    return {",
        "      normalizedConfig: config,",
        "      connectionSummary: { site: config.baseUrl, scope: 'Assigned to me' }",
        "    };",
        "  },",
        "  async syncConnection(connection) {",
        "    return {",
        "      items: [",
        "        {",
        "          source: 'jira',",
        "          connectionId: connection.id,",
        "          connectionLabel: connection.label,",
        "          tenantLabel: connection.tenantLabel,",
        "          sourceId: connection.config.baseUrl + '/browse/ENG-123',",
        "          externalId: 'ENG-123',",
        "          sourceUrl: connection.config.baseUrl + '/browse/ENG-123',",
        "          title: 'Fix production issue',",
        "          note: 'Imported from in-process Jira plugin',",
        "          projectName: 'Engineering',",
        "          workItemType: 'Task',",
        "          state: 'In Progress',",
        "          assignedTo: 'Ada Lovelace',",
        "          depth: 0,",
        "          selectable: true,",
        "          childCount: 0",
        "        }",
        "      ]",
        "    };",
        "  }",
        "};",
      ].join("\n"),
      "utf8",
    );

    const manager = new ConnectorPluginManager({
      pluginDirectories: [tempDir],
    });

    await expect(manager.listPlugins()).resolves.toEqual([
      expect.objectContaining({
        id: "jira",
        displayName: "Jira",
        connectionFields: [
          expect.objectContaining({ id: "label", type: "text" }),
          expect.objectContaining({ id: "tenantLabel", type: "text" }),
          expect.objectContaining({ id: "baseUrl", type: "url" }),
        ],
      }),
    ]);

    await expect(
      manager.validateConnection("jira", {
        baseUrl: "https://example.atlassian.net",
      }),
    ).resolves.toEqual({
      normalizedConfig: {
        baseUrl: "https://example.atlassian.net",
      },
      connectionSummary: {
        site: "https://example.atlassian.net",
        scope: "Assigned to me",
      },
    });

    await expect(
      manager.syncConnection("jira", {
        id: "jira_1",
        label: "Product backlog",
        tenantLabel: "Example workspace",
        autoSync: false,
        autoSyncIntervalMinutes: 15,
        connectedAt: Date.now(),
        pluginId: "jira",
        config: {
          baseUrl: "https://example.atlassian.net",
        },
      }),
    ).resolves.toMatchObject({
      items: [
        expect.objectContaining({
          source: "jira",
          externalId: "ENG-123",
          title: "Fix production issue",
        }),
      ],
    });
  });
});
