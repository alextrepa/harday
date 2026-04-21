import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  connectorBacklogStatusListResponseSchema,
  connectorBacklogStatusUpsertRequestSchema,
  connectorBacklogStatusUpsertResponseSchema,
  connectorConnectionSaveRequestSchema,
  connectorConnectionSaveResponseSchema,
  connectorFieldValuesSchema,
  connectorSyncRequestSchema,
  connectorSyncResultSchema,
  type ConnectorFieldValues,
  type ConnectorImportCandidate,
  type ConnectorImportCandidateInput,
  connectorImportCommitResponseSchema,
  connectorImportDismissRequestSchema,
  connectorImportDismissResponseSchema,
  connectorImportListResponseSchema,
  connectorImportPushRequestSchema,
  connectorImportPushResponseSchema,
  connectorImportSelectionResponseSchema,
  connectorImportSelectionUpdateSchema,
  connectorsOverviewSchema,
} from "../../../packages/shared/src/connectors.ts";
import { ConnectorPluginManager } from "./plugin-host.ts";
import { AppApiStorage } from "./storage.ts";

interface AppApiServerOptions {
  host?: string;
  port?: number;
  statePath?: string;
  pluginDirectories?: string[];
}

const RESERVED_CONNECTION_FIELDS = new Set([
  "label",
  "tenantLabel",
  "autoSync",
  "autoSyncIntervalMinutes",
]);

function materializeAutoSyncCandidates(items: ConnectorImportCandidateInput[]): ConnectorImportCandidate[] {
  const pushedAt = Date.now();

  return items.map((item) => ({
    id: `connector_${randomUUID()}`,
    ...item,
    selected: item.selectable ? item.selected ?? true : false,
    pushedAt: item.pushedAt ?? pushedAt,
  }));
}

function collectAutoSyncItems(items: ConnectorImportCandidateInput[]): ConnectorImportCandidate[] {
  const candidates = materializeAutoSyncCandidates(items);
  const candidatesBySourceKey = new Map(
    candidates.map((item) => [`${item.connectionId}:${item.sourceId}`, item] as const),
  );
  const committedIds = new Set(
    candidates.filter((item) => item.selectable && item.selected).map((item) => item.id),
  );

  for (const item of candidates) {
    if (!committedIds.has(item.id) || item.depth !== 1 || !item.parentSourceId) {
      continue;
    }

    const parent = candidatesBySourceKey.get(`${item.connectionId}:${item.parentSourceId}`);
    if (parent) {
      committedIds.add(parent.id);
    }
  }

  return candidates.filter((item) => committedIds.has(item.id));
}

function collectConnectorStatuses(items: ConnectorImportCandidateInput[]) {
  return items
    .filter((item): item is ConnectorImportCandidateInput & { state: string } => Boolean(item.state?.trim()))
    .map((item) => ({
      source: item.source,
      connectionId: item.connectionId,
      connectionLabel: item.connectionLabel,
      tenantLabel: item.tenantLabel,
      label: item.state.trim(),
    }));
}

function writeJson(response: ServerResponse, statusCode: number, body?: unknown) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  };

  if (body === undefined) {
    response.writeHead(statusCode, headers);
    response.end();
    return;
  }

  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    ...headers,
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  response.end(payload);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const rawBody = Buffer.concat(chunks).toString("utf8").trim();
  if (!rawBody) {
    return undefined;
  }

  return JSON.parse(rawBody);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function matchConnectorRoute(pathname: string) {
  return pathname.match(/^\/api\/connectors\/([^/]+)\/connections(?:\/([^/]+)(?:\/(sync))?)?$/);
}

function parseBooleanValue(value: unknown, fieldId: string) {
  if (typeof value === "boolean") {
    return value;
  }

  throw new Error(`Connector field "${fieldId}" must be a boolean.`);
}

function parseRequiredStringValue(value: unknown, fieldId: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Connector field "${fieldId}" is required.`);
  }

  return value.trim();
}

function parseAutoSyncIntervalValue(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 1440) {
    return value;
  }

  throw new Error('Connector field "autoSyncIntervalMinutes" must be an integer between 1 and 1440.');
}

function parseConnectionValues(values: ConnectorFieldValues) {
  const parsedValues = connectorFieldValuesSchema.parse(values);
  const label = parseRequiredStringValue(parsedValues.label, "label");
  const tenantLabel = parseRequiredStringValue(parsedValues.tenantLabel, "tenantLabel");
  const autoSync = parseBooleanValue(parsedValues.autoSync ?? false, "autoSync");
  const autoSyncIntervalMinutes = parseAutoSyncIntervalValue(parsedValues.autoSyncIntervalMinutes ?? 15);

  const config = Object.fromEntries(
    Object.entries(parsedValues).filter(([key]) => !RESERVED_CONNECTION_FIELDS.has(key)),
  );

  return {
    label,
    tenantLabel,
    autoSync,
    autoSyncIntervalMinutes,
    config,
  };
}

async function getOverview(storage: AppApiStorage, pluginManager: ConnectorPluginManager) {
  const plugins = await pluginManager.listPlugins();
  return connectorsOverviewSchema.parse(await storage.getConnectorsOverview(plugins));
}

async function findConnectionSummary(
  storage: AppApiStorage,
  pluginManager: ConnectorPluginManager,
  pluginId: string,
  connectionId: string,
) {
  const overview = await getOverview(storage, pluginManager);
  const summary = overview.connectionGroups
    .flatMap((group) => group.connections)
    .find((connection) => connection.pluginId === pluginId && connection.id === connectionId);

  if (!summary) {
    throw new Error(`Connector connection "${connectionId}" not found.`);
  }

  return {
    overview,
    summary,
  };
}

export function createAppApiServer(options: AppApiServerOptions = {}) {
  const host = options.host ?? process.env.TIMETRACKER_APP_API_HOST ?? "127.0.0.1";
  const port = options.port ?? Number(process.env.TIMETRACKER_APP_API_PORT ?? 8787);
  const storage = new AppApiStorage(options.statePath);
  const pluginManager = new ConnectorPluginManager({
    pluginDirectories: options.pluginDirectories,
  });

  return createServer(async (request, response) => {
    if (request.method === "OPTIONS") {
      writeJson(response, 204);
      return;
    }

    const requestUrl = new URL(request.url ?? "/", `http://${host}:${port}`);

    try {
      if (request.method === "GET" && requestUrl.pathname === "/api/health") {
        writeJson(response, 200, { ok: true });
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/api/connectors") {
        writeJson(response, 200, await getOverview(storage, pluginManager));
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/api/connectors/plugins") {
        writeJson(response, 200, await pluginManager.listPlugins());
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/api/backlog/source-statuses") {
        writeJson(
          response,
          200,
          connectorBacklogStatusListResponseSchema.parse(await storage.listConnectorBacklogStatuses()),
        );
        return;
      }

      if (request.method === "POST" && requestUrl.pathname === "/api/backlog/source-statuses") {
        const payload = connectorBacklogStatusUpsertRequestSchema.parse(await readJsonBody(request));
        writeJson(
          response,
          200,
          connectorBacklogStatusUpsertResponseSchema.parse({
            items: await storage.upsertConnectorBacklogStatuses(payload.items),
          }),
        );
        return;
      }

      const connectorRoute = matchConnectorRoute(requestUrl.pathname);
      if (connectorRoute) {
        const [, rawPluginId, rawConnectionId, action] = connectorRoute;
        const pluginId = decodeURIComponent(rawPluginId ?? "");

        if (request.method === "POST" && !rawConnectionId && !action) {
          const payload = connectorConnectionSaveRequestSchema.parse(await readJsonBody(request));
          const parsedValues = parseConnectionValues(payload.values);
          const validation = await pluginManager.validateConnection(pluginId, parsedValues.config);
          const storedConnection = await storage.upsertConnection(pluginId, {
            id: payload.id,
            label: parsedValues.label,
            tenantLabel: parsedValues.tenantLabel,
            autoSync: parsedValues.autoSync,
            autoSyncIntervalMinutes: parsedValues.autoSyncIntervalMinutes,
            config: validation.normalizedConfig,
            configSummary: validation.connectionSummary,
          });
          const { overview, summary } = await findConnectionSummary(
            storage,
            pluginManager,
            pluginId,
            storedConnection.id,
          );

          writeJson(
            response,
            200,
            connectorConnectionSaveResponseSchema.parse({
              overview,
              connection: summary,
            }),
          );
          return;
        }

        const connectionId = decodeURIComponent(rawConnectionId ?? "");
        if (!connectionId) {
          writeJson(response, 404, { error: "Connector connection not found." });
          return;
        }

        if (request.method === "DELETE" && !action) {
          const deleted = await storage.deleteConnection(pluginId, connectionId);
          if (!deleted) {
            writeJson(response, 404, { error: "Connector connection not found." });
            return;
          }

          writeJson(response, 200, await getOverview(storage, pluginManager));
          return;
        }

        if (request.method === "POST" && action === "sync") {
          const connection = await storage.getConnection(pluginId, connectionId);
          if (!connection) {
            writeJson(response, 404, { error: "Connector connection not found." });
            return;
          }

          const payload = connectorSyncRequestSchema.parse(await readJsonBody(request));
          const shouldAutoSyncToBacklog = connection.autoSync && payload.trigger === "auto";

          try {
            const fetched = await pluginManager.syncConnection(pluginId, {
              id: connection.id,
              pluginId: connection.pluginId,
              label: connection.label,
              tenantLabel: connection.tenantLabel,
              autoSync: connection.autoSync,
              autoSyncIntervalMinutes: connection.autoSyncIntervalMinutes,
              connectedAt: connection.connectedAt,
              lastSyncAt: connection.lastSyncAt,
              lastError: connection.lastError,
              config: connection.config,
            });
            const discoveredStatuses = collectConnectorStatuses(fetched.items);
            if (discoveredStatuses.length > 0) {
              await storage.upsertConnectorBacklogStatuses(discoveredStatuses);
            }

            const autoSyncItems = shouldAutoSyncToBacklog ? collectAutoSyncItems(fetched.items) : [];
            const stageResult = shouldAutoSyncToBacklog
              ? {
                  queuedCount: autoSyncItems.length,
                  updatedCount: 0,
                  skippedCount: 0,
                }
              : await storage.stageImportItems(fetched.items);
            await storage.recordConnectionSyncSuccess(pluginId, connectionId, Date.now());
            const { summary } = await findConnectionSummary(storage, pluginManager, pluginId, connectionId);

            writeJson(
              response,
              200,
              connectorSyncResultSchema.parse({
                connection: summary,
                mode: shouldAutoSyncToBacklog ? "backlog" : "review",
                items: autoSyncItems,
                stagedCount: stageResult.queuedCount,
                updatedCount: stageResult.updatedCount,
                skippedCount: stageResult.skippedCount,
              }),
            );
          } catch (error) {
            await storage.recordConnectionError(pluginId, connectionId, errorMessage(error));
            const { summary } = await findConnectionSummary(storage, pluginManager, pluginId, connectionId);
            writeJson(
              response,
              502,
              connectorSyncResultSchema.parse({
                connection: summary,
                mode: shouldAutoSyncToBacklog ? "backlog" : "review",
                items: [],
                stagedCount: 0,
                updatedCount: 0,
                skippedCount: 0,
              }),
            );
          }

          return;
        }
      }

      if (request.method === "POST" && requestUrl.pathname === "/api/backlog/items") {
        const payload = connectorImportPushRequestSchema.parse(await readJsonBody(request));
        writeJson(
          response,
          200,
          connectorImportPushResponseSchema.parse(await storage.stageImportItems(payload.items)),
        );
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/api/backlog/imports") {
        writeJson(
          response,
          200,
          connectorImportListResponseSchema.parse(await storage.listStagedImports()),
        );
        return;
      }

      if (request.method === "POST" && requestUrl.pathname === "/api/backlog/imports/selection") {
        const payload = connectorImportSelectionUpdateSchema.parse(await readJsonBody(request));
        writeJson(
          response,
          200,
          connectorImportSelectionResponseSchema.parse({
            updatedCount: await storage.updateImportSelection(payload.ids, payload.selected),
          }),
        );
        return;
      }

      if (request.method === "POST" && requestUrl.pathname === "/api/backlog/imports/dismiss") {
        const payload = connectorImportDismissRequestSchema.parse(await readJsonBody(request));
        writeJson(
          response,
          200,
          connectorImportDismissResponseSchema.parse({
            dismissedCount: await storage.dismissImports(payload.ids),
          }),
        );
        return;
      }

      if (request.method === "POST" && requestUrl.pathname === "/api/backlog/imports/commit-selected") {
        const items = await storage.commitSelectedImports();
        writeJson(
          response,
          200,
          connectorImportCommitResponseSchema.parse({
            items,
            committedCount: items.length,
          }),
        );
        return;
      }

      writeJson(response, 404, {
        error: `No route for ${request.method ?? "GET"} ${requestUrl.pathname}`,
      });
    } catch (error) {
      writeJson(response, 400, {
        error: errorMessage(error),
      });
    }
  });
}

export async function startAppApiServer(options: AppApiServerOptions = {}): Promise<Server> {
  const host = options.host ?? process.env.TIMETRACKER_APP_API_HOST ?? "127.0.0.1";
  const port = options.port ?? Number(process.env.TIMETRACKER_APP_API_PORT ?? 8787);
  const server = createAppApiServer(options);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      console.log(`TimeTracker app API listening on http://${host}:${port}`);
      resolve();
    });
  });

  return server;
}

export async function stopAppApiServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

const executedDirectly =
  typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).toString();

if (executedDirectly) {
  void startAppApiServer();
}
