import { z } from "zod";

export const connectorBacklogSources = ["azure_devops"] as const;
export type ConnectorBacklogSource = (typeof connectorBacklogSources)[number];

export function normalizeConnectorStatusKey(value: string) {
  return value.trim().toLocaleLowerCase();
}

export const azureDevOpsQueryScopes = ["assigned_to_me", "project_open_tasks"] as const;
export type AzureDevOpsQueryScope = (typeof azureDevOpsQueryScopes)[number];

export const connectorImportDepthSchema = z.union([z.literal(0), z.literal(1)]);
export type ConnectorImportDepth = z.infer<typeof connectorImportDepthSchema>;

export const azureDevOpsConnectionInputSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  label: z.string().trim().min(1).max(120),
  tenantLabel: z.string().trim().min(1).max(120),
  organizationUrl: z.string().trim().url(),
  project: z.string().trim().max(120).optional(),
  personalAccessToken: z.string().trim().min(1).max(300),
  queryScope: z.enum(azureDevOpsQueryScopes).default("assigned_to_me"),
  priorityFieldName: z.string().trim().min(1).max(200).optional(),
  autoSync: z.boolean().default(false),
  autoSyncIntervalMinutes: z.number().int().min(1).max(1440).default(15),
});
export type AzureDevOpsConnectionInput = z.infer<typeof azureDevOpsConnectionInputSchema>;

export const azureDevOpsConnectionSummarySchema = z.object({
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(120),
  tenantLabel: z.string().min(1).max(120),
  organizationUrl: z.string().url(),
  project: z.string().max(120).optional(),
  queryScope: z.enum(azureDevOpsQueryScopes),
  priorityFieldName: z.string().min(1).max(200).optional(),
  autoSync: z.boolean(),
  autoSyncIntervalMinutes: z.number().int().min(1).max(1440),
  priorityFieldResolvedName: z.string().min(1).max(200).optional(),
  priorityFieldResolvedReferenceName: z.string().min(1).max(200).optional(),
  priorityFieldType: z.string().min(1).max(80).optional(),
  priorityFieldIsQueryable: z.boolean().optional(),
  connectedAt: z.number().int().positive(),
  lastSyncAt: z.number().int().positive().optional(),
  lastError: z.string().max(1000).optional(),
  pendingImportCount: z.number().int().nonnegative(),
  selectedImportCount: z.number().int().nonnegative(),
});
export type AzureDevOpsConnectionSummary = z.infer<typeof azureDevOpsConnectionSummarySchema>;

export const connectorsOverviewSchema = z.object({
  azureDevOpsConnections: z.array(azureDevOpsConnectionSummarySchema),
  totalPendingImportCount: z.number().int().nonnegative(),
  totalSelectedImportCount: z.number().int().nonnegative(),
});
export type ConnectorsOverview = z.infer<typeof connectorsOverviewSchema>;

export const connectorBacklogStatusInputSchema = z.object({
  source: z.enum(connectorBacklogSources),
  connectionId: z.string().trim().min(1).max(120),
  connectionLabel: z.string().trim().min(1).max(120),
  tenantLabel: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(120),
});
export type ConnectorBacklogStatusInput = z.infer<typeof connectorBacklogStatusInputSchema>;

export const connectorBacklogStatusSchema = connectorBacklogStatusInputSchema.extend({
  key: z.string().trim().min(1).max(160),
  lastSeenAt: z.number().int().positive(),
});
export type ConnectorBacklogStatus = z.infer<typeof connectorBacklogStatusSchema>;

export const connectorBacklogStatusListResponseSchema = z.object({
  items: z.array(connectorBacklogStatusSchema),
});
export type ConnectorBacklogStatusListResponse = z.infer<typeof connectorBacklogStatusListResponseSchema>;

export const connectorBacklogStatusUpsertRequestSchema = z.object({
  items: z.array(connectorBacklogStatusInputSchema).min(1).max(200),
});
export type ConnectorBacklogStatusUpsertRequest = z.infer<typeof connectorBacklogStatusUpsertRequestSchema>;

export const connectorBacklogStatusUpsertResponseSchema = connectorBacklogStatusListResponseSchema;
export type ConnectorBacklogStatusUpsertResponse = z.infer<typeof connectorBacklogStatusUpsertResponseSchema>;

export const azureDevOpsSyncRequestSchema = z.object({
  trigger: z.enum(["manual", "auto"]).default("manual"),
});
export type AzureDevOpsSyncRequest = z.infer<typeof azureDevOpsSyncRequestSchema>;

export const azureDevOpsConnectionSaveResponseSchema = z.object({
  overview: connectorsOverviewSchema,
  connection: azureDevOpsConnectionSummarySchema,
});
export type AzureDevOpsConnectionSaveResponse = z.infer<typeof azureDevOpsConnectionSaveResponseSchema>;

export const connectorImportCandidateInputSchema = z.object({
  source: z.enum(connectorBacklogSources),
  connectionId: z.string().trim().min(1).max(120),
  connectionLabel: z.string().trim().min(1).max(120),
  tenantLabel: z.string().trim().min(1).max(120),
  sourceId: z.string().trim().min(1).max(400),
  externalId: z.string().trim().min(1).max(120),
  sourceUrl: z.string().url().optional(),
  title: z.string().trim().min(1).max(240),
  note: z.string().trim().max(4000).optional(),
  projectName: z.string().trim().max(120).optional(),
  workItemType: z.string().trim().min(1).max(120),
  state: z.string().trim().max(120).optional(),
  assignedTo: z.string().trim().max(240).optional(),
  priority: z.number().int().min(0).max(999).optional(),
  parentSourceId: z.string().trim().min(1).max(400).optional(),
  parentTitle: z.string().trim().max(240).optional(),
  depth: connectorImportDepthSchema,
  selectable: z.boolean().default(true),
  selected: z.boolean().optional(),
  childCount: z.number().int().nonnegative().default(0),
  pushedAt: z.number().int().positive().optional(),
});
export type ConnectorImportCandidateInput = z.infer<typeof connectorImportCandidateInputSchema>;

export const connectorImportCandidateSchema = connectorImportCandidateInputSchema.extend({
  id: z.string().min(1).max(200),
  selected: z.boolean(),
  pushedAt: z.number().int().positive(),
});
export type ConnectorImportCandidate = z.infer<typeof connectorImportCandidateSchema>;

export const connectorImportPushRequestSchema = z.object({
  items: z.array(connectorImportCandidateInputSchema).min(1).max(200),
});
export type ConnectorImportPushRequest = z.infer<typeof connectorImportPushRequestSchema>;

export const connectorImportPushResponseSchema = z.object({
  queuedCount: z.number().int().nonnegative(),
  updatedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
});
export type ConnectorImportPushResponse = z.infer<typeof connectorImportPushResponseSchema>;

export const connectorImportListResponseSchema = z.object({
  items: z.array(connectorImportCandidateSchema),
  totalCount: z.number().int().nonnegative(),
  selectedCount: z.number().int().nonnegative(),
});
export type ConnectorImportListResponse = z.infer<typeof connectorImportListResponseSchema>;

export const connectorImportSelectionUpdateSchema = z.object({
  ids: z.array(z.string().min(1).max(200)).min(1).max(200),
  selected: z.boolean(),
});
export type ConnectorImportSelectionUpdate = z.infer<typeof connectorImportSelectionUpdateSchema>;

export const connectorImportSelectionResponseSchema = z.object({
  updatedCount: z.number().int().nonnegative(),
});
export type ConnectorImportSelectionResponse = z.infer<typeof connectorImportSelectionResponseSchema>;

export const connectorImportDismissRequestSchema = z.object({
  ids: z.array(z.string().min(1).max(200)).min(1).max(200),
});
export type ConnectorImportDismissRequest = z.infer<typeof connectorImportDismissRequestSchema>;

export const connectorImportDismissResponseSchema = z.object({
  dismissedCount: z.number().int().nonnegative(),
});
export type ConnectorImportDismissResponse = z.infer<typeof connectorImportDismissResponseSchema>;

export const connectorImportCommitResponseSchema = z.object({
  items: z.array(connectorImportCandidateSchema),
  committedCount: z.number().int().nonnegative(),
});
export type ConnectorImportCommitResponse = z.infer<typeof connectorImportCommitResponseSchema>;

export const azureDevOpsSyncResultSchema = z.object({
  connection: azureDevOpsConnectionSummarySchema,
  mode: z.enum(["review", "backlog"]),
  items: z.array(connectorImportCandidateSchema),
  stagedCount: z.number().int().nonnegative(),
  updatedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
});
export type AzureDevOpsSyncResult = z.infer<typeof azureDevOpsSyncResultSchema>;
