import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchAzureDevOpsImportCandidates,
  type AzureDevOpsConnectionInput,
  validateAzureDevOpsConnection,
} from "./azure-devops.ts";

function buildConnection(
  overrides: Partial<AzureDevOpsConnectionInput> = {},
): AzureDevOpsConnectionInput {
  return {
    label: "Main connection",
    tenantLabel: "Contoso",
    organizationUrl: "https://dev.azure.com/contoso",
    personalAccessToken: "secret",
    queryScope: "assigned_to_me",
    autoSync: false,
    autoSyncIntervalMinutes: 15,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("Azure DevOps connector priority field resolution", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("resolves a configured display name to the Azure reference name before syncing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          value: [
            {
              name: "MS Priority",
              referenceName: "Custom.MSPriority",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          workItems: [{ id: 123 }],
        }),
      )
      .mockImplementationOnce(async (_input, init) => {
        const body = JSON.parse(String(init?.body));
        expect(body.fields).toContain("Custom.MSPriority");
        expect(body.fields).not.toContain("MS Priority");

        return jsonResponse({
          value: [
            {
              id: 123,
              fields: {
                "System.Title": "Investigate incident",
                "System.State": "Active",
                "System.TeamProject": "Maintenance and Support",
                "System.WorkItemType": "Task",
                "Custom.MSPriority": "55",
              },
            },
          ],
        });
      })
      .mockResolvedValueOnce(
        jsonResponse({
          value: [
            {
              id: 123,
              relations: [],
            },
          ],
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchAzureDevOpsImportCandidates(
        buildConnection({
          priorityFieldName: "MS Priority",
        }),
      ),
    ).resolves.toMatchObject({
      items: [
        expect.objectContaining({
          title: "Investigate incident",
          priority: 55,
          workItemType: "Task",
        }),
      ],
    });
  });

  it("returns resolved field metadata including WIQL queryability during validation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          value: [
            {
              name: "MS Priority",
              referenceName: "Custom.MSPriority",
              type: "integer",
              isQueryable: false,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          workItems: [],
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      validateAzureDevOpsConnection(
        buildConnection({
          priorityFieldName: "MS Priority",
        }),
      ),
    ).resolves.toEqual({
      priorityField: {
        configuredName: "MS Priority",
        resolvedName: "MS Priority",
        resolvedReferenceName: "Custom.MSPriority",
        type: "integer",
        isQueryable: false,
      },
    });
  });

  it("rejects ambiguous display-name matches during connection validation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          value: [
            {
              name: "MS Priority",
              referenceName: "Custom.TeamA.Priority",
            },
            {
              name: "MS Priority",
              referenceName: "Custom.TeamB.Priority",
            },
          ],
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      validateAzureDevOpsConnection(
        buildConnection({
          priorityFieldName: "MS Priority",
        }),
      ),
    ).rejects.toThrow(
      'Azure DevOps field "MS Priority" matched multiple fields by display name.',
    );
  });
});
