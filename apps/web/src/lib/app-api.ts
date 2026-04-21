import {
  connectorBacklogStatusListResponseSchema,
  connectorBacklogStatusUpsertRequestSchema,
  connectorBacklogStatusUpsertResponseSchema,
  azureDevOpsConnectionSaveResponseSchema,
  azureDevOpsConnectionInputSchema,
  azureDevOpsSyncRequestSchema,
  azureDevOpsSyncResultSchema,
  type AzureDevOpsSyncRequest,
  connectorImportCommitResponseSchema,
  connectorImportDismissRequestSchema,
  connectorImportDismissResponseSchema,
  connectorImportListResponseSchema,
  connectorImportSelectionResponseSchema,
  connectorImportSelectionUpdateSchema,
  connectorsOverviewSchema,
  type AzureDevOpsConnectionInput,
  type AzureDevOpsConnectionSaveResponse,
  type AzureDevOpsSyncResult,
  type ConnectorBacklogStatusInput,
  type ConnectorImportCandidate,
  type ConnectorsOverview,
} from "@timetracker/shared";
import { localStore } from "@/lib/local-store";

export type SyncAzureDevOpsConnectionResult = AzureDevOpsSyncResult & {
  backlogImportedCount: number;
  backlogUpdatedCount: number;
};

const DEFAULT_INTERNAL_APP_API_BASE_URL = "http://127.0.0.1:8787";
const APP_API_BASE_URL = (import.meta.env.VITE_APP_API_BASE_URL ?? DEFAULT_INTERNAL_APP_API_BASE_URL).replace(/\/+$/, "");
const APP_API_RETRY_DELAYS_MS = [150, 350] as const;

function appApiUnavailableMessage() {
  return "Internal connector API unavailable. Restart the app.";
}

function isDefaultInternalAppApi() {
  return APP_API_BASE_URL === DEFAULT_INTERNAL_APP_API_BASE_URL;
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseJsonResponse<T>(
  response: Response,
  schema: { parse: (value: unknown) => T },
): Promise<T> {
  const payload = (await response.json()) as unknown;
  return schema.parse(payload);
}

async function appApiRequest<T>(
  path: string,
  init: RequestInit | undefined,
  schema: { parse: (value: unknown) => T },
): Promise<T> {
  let response: Response | null = null;
  let lastNetworkError: unknown;

  for (let attempt = 0; attempt <= APP_API_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      response = await fetch(`${APP_API_BASE_URL}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...init?.headers,
        },
      });
      lastNetworkError = undefined;
      break;
    } catch (error) {
      lastNetworkError = error;
      if (!isDefaultInternalAppApi() || attempt === APP_API_RETRY_DELAYS_MS.length) {
        throw new Error(
          `${appApiUnavailableMessage()} ${error instanceof Error ? error.message : ""}`.trim(),
        );
      }

      const retryDelayMs = APP_API_RETRY_DELAYS_MS[attempt];
      if (retryDelayMs === undefined) {
        throw new Error(
          `${appApiUnavailableMessage()} ${error instanceof Error ? error.message : ""}`.trim(),
        );
      }

      await delay(retryDelayMs);
    }
  }

  if (lastNetworkError !== undefined || !response) {
    throw new Error(
      `${appApiUnavailableMessage()} ${lastNetworkError instanceof Error ? lastNetworkError.message : ""}`.trim(),
    );
  }

  if (!response.ok) {
    let detail = response.statusText || "Request failed";
    try {
      const payload = (await response.json()) as { error?: string };
      if (typeof payload.error === "string" && payload.error.trim().length > 0) {
        detail = payload.error.trim();
      }
    } catch {
      // Ignore non-JSON error responses.
    }

    throw new Error(detail);
  }

  return parseJsonResponse(response, schema);
}

export function getAppApiBaseUrl() {
  return APP_API_BASE_URL;
}

export function getAppApiDescription() {
  return isDefaultInternalAppApi() ? "Internal app runtime" : APP_API_BASE_URL;
}

export function getConnectorsOverview(): Promise<ConnectorsOverview> {
  return appApiRequest("/api/connectors", undefined, connectorsOverviewSchema);
}

export function getConnectorBacklogStatuses() {
  return appApiRequest(
    "/api/backlog/source-statuses",
    undefined,
    connectorBacklogStatusListResponseSchema,
  );
}

export function upsertConnectorBacklogStatuses(items: ConnectorBacklogStatusInput[]) {
  const payload = connectorBacklogStatusUpsertRequestSchema.parse({ items });
  return appApiRequest(
    "/api/backlog/source-statuses",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    connectorBacklogStatusUpsertResponseSchema,
  );
}

export function saveAzureDevOpsConnection(
  input: AzureDevOpsConnectionInput,
): Promise<AzureDevOpsConnectionSaveResponse> {
  const payload = azureDevOpsConnectionInputSchema.parse(input);
  return appApiRequest(
    "/api/connectors/azure-devops/connections",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    azureDevOpsConnectionSaveResponseSchema,
  );
}

export function deleteAzureDevOpsConnection(connectionId: string): Promise<ConnectorsOverview> {
  return appApiRequest(
    `/api/connectors/azure-devops/connections/${encodeURIComponent(connectionId)}`,
    {
      method: "DELETE",
    },
    connectorsOverviewSchema,
  );
}

export function syncAzureDevOpsConnection(
  connectionId: string,
  input?: AzureDevOpsSyncRequest,
): Promise<SyncAzureDevOpsConnectionResult> {
  const payload = azureDevOpsSyncRequestSchema.parse(input ?? { trigger: "manual" });
  return appApiRequest(
    `/api/connectors/azure-devops/connections/${encodeURIComponent(connectionId)}/sync`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    azureDevOpsSyncResultSchema,
  ).then((result) => {
    const importResult =
      result.mode === "backlog"
        ? localStore.importConnectorWorkItems(result.items, {
            archiveMissingFromConnectionId: payload.trigger === "auto" ? connectionId : undefined,
          })
        : { importedCount: 0, updatedCount: 0 };

    return {
      ...result,
      backlogImportedCount: importResult.importedCount,
      backlogUpdatedCount: importResult.updatedCount,
    };
  });
}

export function listConnectorImportCandidates() {
  return appApiRequest("/api/backlog/imports", undefined, connectorImportListResponseSchema);
}

export function updateConnectorImportSelection(ids: string[], selected: boolean) {
  const payload = connectorImportSelectionUpdateSchema.parse({ ids, selected });
  return appApiRequest(
    "/api/backlog/imports/selection",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    connectorImportSelectionResponseSchema,
  );
}

export function dismissConnectorImportCandidates(ids: string[]) {
  const payload = connectorImportDismissRequestSchema.parse({ ids });
  return appApiRequest(
    "/api/backlog/imports/dismiss",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    connectorImportDismissResponseSchema,
  );
}

export async function commitSelectedConnectorImportsToLocalStore() {
  const committed = await appApiRequest(
    "/api/backlog/imports/commit-selected",
    {
      method: "POST",
      body: JSON.stringify({}),
    },
    connectorImportCommitResponseSchema,
  );

  const importResult = localStore.importConnectorWorkItems(committed.items);
  return {
    ...importResult,
    committedCount: committed.committedCount,
  };
}

export function buildImportHierarchy(items: ConnectorImportCandidate[]) {
  const itemsBySourceId = new Map(items.map((item) => [item.sourceId, item] as const));
  const childrenByParent = new Map<string, ConnectorImportCandidate[]>();

  for (const item of items) {
    if (!item.parentSourceId) {
      continue;
    }

    const siblings = childrenByParent.get(item.parentSourceId) ?? [];
    siblings.push(item);
    childrenByParent.set(item.parentSourceId, siblings);
  }

  for (const siblings of childrenByParent.values()) {
    siblings.sort((left, right) => left.title.localeCompare(right.title));
  }

  const rootItems = items
    .filter((item) => !item.parentSourceId || !itemsBySourceId.has(item.parentSourceId))
    .sort((left, right) => {
      if (left.connectionId !== right.connectionId) {
        return left.connectionId.localeCompare(right.connectionId);
      }

      return left.title.localeCompare(right.title);
    });

  return {
    rootItems,
    childrenByParent,
  };
}
