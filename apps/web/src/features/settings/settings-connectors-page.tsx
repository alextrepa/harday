import { useEffect, useMemo, useState } from "react";
import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocalState, useOutlookIntegration } from "@/lib/local-hooks";
import {
  deleteAzureDevOpsConnection,
  getAppApiDescription,
  getAppApiBaseUrl,
  getConnectorsOverview,
  saveAzureDevOpsConnection,
  syncAzureDevOpsConnection,
} from "@/lib/app-api";
import { connectOutlook, disconnectOutlook } from "@/lib/outlook";
import type { AzureDevOpsConnectionInput, ConnectorsOverview } from "@timetracker/shared";

const AZURE_SCOPE_OPTIONS: Array<{
  value: AzureDevOpsConnectionInput["queryScope"];
  label: string;
}> = [
  { value: "assigned_to_me", label: "Assigned to me" },
  { value: "project_open_tasks", label: "Open tasks across organization" },
];

function formatConnectorTimestamp(timestamp?: number) {
  if (!timestamp) {
    return "Never";
  }

  return new Date(timestamp).toLocaleString();
}

function parseAutoSyncIntervalMinutes(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1440) {
    return null;
  }

  return parsed;
}

function createEmptyAzureForm() {
  return {
    editingConnectionId: null as string | null,
    label: "",
    tenantLabel: "",
    organizationUrl: "https://dev.azure.com/",
    personalAccessToken: "",
    queryScope: "assigned_to_me" as AzureDevOpsConnectionInput["queryScope"],
    priorityFieldName: "",
    autoSync: false,
    autoSyncIntervalMinutes: "15",
  };
}

export function SettingsConnectorsPage() {
  const state = useLocalState();
  const outlook = useOutlookIntegration();
  const [isUpdatingOutlook, setIsUpdatingOutlook] = useState(false);
  const [connectors, setConnectors] = useState<ConnectorsOverview | null>(null);
  const [connectorError, setConnectorError] = useState<string | null>(null);
  const [azureStatusMessage, setAzureStatusMessage] = useState<string | null>(null);
  const [isUpdatingAzure, setIsUpdatingAzure] = useState(false);
  const [isAzureFormOpen, setIsAzureFormOpen] = useState(false);
  const [azureForm, setAzureForm] = useState(createEmptyAzureForm);
  const parsedAutoSyncIntervalMinutes = parseAutoSyncIntervalMinutes(azureForm.autoSyncIntervalMinutes);

  const azureImportedCount = useMemo(
    () => state.workItems.filter((workItem) => workItem.source === "azure_devops").length,
    [state.workItems],
  );

  const azureConnectionsByTenant = useMemo(() => {
    const groups = new Map<
      string,
      NonNullable<ConnectorsOverview["azureDevOpsConnections"]>
    >();

    for (const connection of connectors?.azureDevOpsConnections ?? []) {
      const existing = groups.get(connection.tenantLabel);
      if (existing) {
        existing.push(connection);
        continue;
      }

      groups.set(connection.tenantLabel, [connection]);
    }

    return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right));
  }, [connectors?.azureDevOpsConnections]);

  const refreshConnectors = async () => {
    try {
      const overview = await getConnectorsOverview();
      setConnectors(overview);
      setConnectorError(null);
    } catch (error) {
      setConnectorError(error instanceof Error ? error.message : "Unable to reach the app API.");
    }
  };

  useEffect(() => {
    void refreshConnectors();
  }, []);

  const handleOutlookConnect = async () => {
    setIsUpdatingOutlook(true);
    try {
      await connectOutlook();
    } finally {
      setIsUpdatingOutlook(false);
    }
  };

  const handleOutlookDisconnect = async () => {
    setIsUpdatingOutlook(true);
    try {
      await disconnectOutlook();
    } finally {
      setIsUpdatingOutlook(false);
    }
  };

  const handleAzureSave = async () => {
    setIsUpdatingAzure(true);
    setAzureStatusMessage(null);
    setConnectorError(null);
    try {
      const result = await saveAzureDevOpsConnection({
        id: azureForm.editingConnectionId ?? undefined,
        label: azureForm.label,
        tenantLabel: azureForm.tenantLabel,
        organizationUrl: azureForm.organizationUrl,
        personalAccessToken: azureForm.personalAccessToken,
        queryScope: azureForm.queryScope,
        priorityFieldName: azureForm.priorityFieldName.trim() || undefined,
        autoSync: azureForm.autoSync,
        autoSyncIntervalMinutes: parsedAutoSyncIntervalMinutes ?? 15,
      });
      setConnectors(result.overview);
      const prioritySummary = result.connection.priorityFieldName
        ? [
            result.connection.priorityFieldResolvedReferenceName
              ? `resolved to ${result.connection.priorityFieldResolvedReferenceName}`
              : undefined,
            typeof result.connection.priorityFieldIsQueryable === "boolean"
              ? `WIQL queryable: ${result.connection.priorityFieldIsQueryable ? "yes" : "no"}`
              : undefined,
          ]
            .filter(Boolean)
            .join(" · ")
        : "";
      setAzureStatusMessage(
        [
          azureForm.editingConnectionId
            ? "Azure DevOps connection updated."
            : "Azure DevOps connection added.",
          azureForm.autoSync ? "Auto sync to backlog enabled." : "Review queue sync enabled.",
          prioritySummary,
        ]
          .filter(Boolean)
          .join(" "),
      );
      setAzureForm(createEmptyAzureForm());
      setIsAzureFormOpen(false);
    } catch (error) {
      setConnectorError(error instanceof Error ? error.message : "Unable to save the Azure DevOps connection.");
    } finally {
      setIsUpdatingAzure(false);
    }
  };

  const handleAzureDelete = async (connectionId: string) => {
    setIsUpdatingAzure(true);
    setAzureStatusMessage(null);
    setConnectorError(null);
    try {
      const overview = await deleteAzureDevOpsConnection(connectionId);
      setConnectors(overview);
      if (azureForm.editingConnectionId === connectionId) {
        setAzureForm(createEmptyAzureForm());
        setIsAzureFormOpen(false);
      }
      setAzureStatusMessage("Azure DevOps connection removed.");
    } catch (error) {
      setConnectorError(error instanceof Error ? error.message : "Unable to delete the Azure DevOps connection.");
    } finally {
      setIsUpdatingAzure(false);
    }
  };

  const handleAzureSync = async (connectionId: string) => {
    setIsUpdatingAzure(true);
    setAzureStatusMessage(null);
    setConnectorError(null);
    try {
      const result = await syncAzureDevOpsConnection(connectionId);
      await refreshConnectors();
      setAzureStatusMessage(
        result.mode === "backlog"
          ? [
              result.connection.label,
              `${result.backlogImportedCount} imported`,
              `${result.backlogUpdatedCount} updated`,
            ].join(" · ")
          : [
              result.connection.label,
              `${result.stagedCount} staged`,
              `${result.updatedCount} refreshed`,
              `${result.skippedCount} skipped`,
            ].join(" · "),
      );
    } catch (error) {
      setConnectorError(error instanceof Error ? error.message : "Unable to sync Azure DevOps tasks.");
    } finally {
      setIsUpdatingAzure(false);
    }
  };

  const handleAzureCreate = () => {
    setConnectorError(null);
    setAzureStatusMessage(null);
    setAzureForm(createEmptyAzureForm());
    setIsAzureFormOpen(true);
  };

  const handleAzureEdit = (connection: ConnectorsOverview["azureDevOpsConnections"][number]) => {
    setConnectorError(null);
    setAzureStatusMessage(null);
      setAzureForm({
        editingConnectionId: connection.id,
        label: connection.label,
      tenantLabel: connection.tenantLabel,
      organizationUrl: connection.organizationUrl,
      personalAccessToken: "",
        queryScope: connection.queryScope,
        priorityFieldName: connection.priorityFieldName ?? "",
        autoSync: connection.autoSync,
        autoSyncIntervalMinutes: String(connection.autoSyncIntervalMinutes),
      });
    setIsAzureFormOpen(true);
  };

  const handleAzureCancel = () => {
    setAzureForm(createEmptyAzureForm());
    setIsAzureFormOpen(false);
  };

  return (
    <div className="settings-sections">
      <section className="settings-section">
        <h2 className="settings-section-title">Azure DevOps</h2>
        <p className="settings-section-desc">
          Configure as many tenant and organization combinations as you need. Each connection keeps its own PAT, pulls work items across every accessible project in that organization, stages imports independently, and feeds the app only through the local app API.
        </p>

        <div className="settings-panel space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{connectors?.azureDevOpsConnections.length ?? 0} Azure DevOps connections</Badge>
            <Badge className="bg-muted">{connectors?.totalPendingImportCount ?? 0} staged imports</Badge>
            <Badge className="bg-muted">{connectors?.totalSelectedImportCount ?? 0} selected for sync</Badge>
            <Badge className="bg-muted">{azureImportedCount} backlog items imported</Badge>
          </div>

          <div className="space-y-1 text-sm text-foreground/70">
            <p>Connector API: {getAppApiDescription()}</p>
            {getAppApiDescription() !== getAppApiBaseUrl() ? (
              <p className="text-foreground/50">Endpoint: {getAppApiBaseUrl()}</p>
            ) : null}
            <p>Use one connection per tenant + organization + PAT combination.</p>
            <p>Connections can either stage imports for review or auto sync them straight to backlog on a configurable interval.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button size="sm" disabled={isUpdatingAzure} onClick={handleAzureCreate}>
              Add a connection
            </Button>
          </div>
        </div>

        {isAzureFormOpen ? (
          <div className="settings-panel connector-form-panel">
            <div className="connector-form-header">
              <div>
                <div className="connector-form-kicker">
                  {azureForm.editingConnectionId ? "Edit connection" : "Add connection"}
                </div>
                <div className="connector-form-title">
                  {azureForm.editingConnectionId ? "Replace Azure DevOps settings" : "New Azure DevOps source"}
                </div>
              </div>
            </div>

            <div className="connector-form-grid">
              <label className="field">
                <span className="field-label">Tenant</span>
                <Input
                  value={azureForm.tenantLabel}
                  onChange={(event) =>
                    setAzureForm((current) => ({ ...current, tenantLabel: event.target.value }))
                  }
                  placeholder="Contoso Entra"
                  autoComplete="off"
                />
              </label>

              <label className="field">
                <span className="field-label">Connection label</span>
                <Input
                  value={azureForm.label}
                  onChange={(event) =>
                    setAzureForm((current) => ({ ...current, label: event.target.value }))
                  }
                  placeholder="Contoso Web Platform"
                  autoComplete="off"
                />
              </label>

              <label className="field">
                <span className="field-label">Organization URL</span>
                <Input
                  value={azureForm.organizationUrl}
                  onChange={(event) =>
                    setAzureForm((current) => ({ ...current, organizationUrl: event.target.value }))
                  }
                  placeholder="https://dev.azure.com/your-org"
                  autoComplete="off"
                />
              </label>

              <label className="field connector-form-field-wide">
                <span className="field-label">Personal Access Token</span>
                <Input
                  type="password"
                  value={azureForm.personalAccessToken}
                  onChange={(event) =>
                    setAzureForm((current) => ({
                      ...current,
                      personalAccessToken: event.target.value,
                    }))
                  }
                  placeholder={
                    azureForm.editingConnectionId
                      ? "Paste a replacement PAT to update this connection"
                      : "Paste a PAT with work item read access"
                  }
                  autoComplete="off"
                />
              </label>

              <label className="field connector-form-field-wide">
                <span className="field-label">Import scope</span>
                <select
                  className="field-input"
                  value={azureForm.queryScope}
                  onChange={(event) =>
                    setAzureForm((current) => ({
                      ...current,
                      queryScope: event.target.value as AzureDevOpsConnectionInput["queryScope"],
                    }))
                  }
                >
                  {AZURE_SCOPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field connector-form-field-wide">
                <span className="field-label">Priority field</span>
                <Input
                  value={azureForm.priorityFieldName}
                  onChange={(event) =>
                    setAzureForm((current) => ({
                      ...current,
                      priorityFieldName: event.target.value,
                    }))
                  }
                  placeholder="MS Priority or Microsoft.VSTS.Common.Priority"
                  autoComplete="off"
                />
              </label>

              <label className="connector-form-toggle connector-form-field-wide">
                <input
                  type="checkbox"
                  checked={azureForm.autoSync}
                  onChange={(event) =>
                    setAzureForm((current) => ({
                      ...current,
                      autoSync: event.target.checked,
                    }))
                  }
                />
                <span>
                  <span className="connector-form-toggle-title">Auto sync to backlog</span>
                  <span className="connector-form-toggle-description">
                    Skip the review queue and import synced Azure DevOps tasks directly into backlog.
                  </span>
                </span>
              </label>

              {azureForm.autoSync ? (
                <label className="field connector-form-field-wide">
                  <span className="field-label">Auto sync interval (minutes)</span>
                  <Input
                    type="number"
                    min={1}
                    max={1440}
                    step={1}
                    value={azureForm.autoSyncIntervalMinutes}
                    onChange={(event) =>
                      setAzureForm((current) => ({
                        ...current,
                        autoSyncIntervalMinutes: event.target.value,
                      }))
                    }
                    placeholder="15"
                    autoComplete="off"
                  />
                  <span className="field-help">
                    Run automatic sync every 1 to 1440 minutes while the app is open.
                  </span>
                </label>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                disabled={
                  isUpdatingAzure ||
                  azureForm.tenantLabel.trim().length === 0 ||
                  azureForm.label.trim().length === 0 ||
                  azureForm.organizationUrl.trim().length === 0 ||
                  azureForm.personalAccessToken.trim().length === 0 ||
                  (azureForm.autoSync && parsedAutoSyncIntervalMinutes === null)
                }
                onClick={() => void handleAzureSave()}
              >
                {azureForm.editingConnectionId ? "Update Connection" : "Add Connection"}
              </Button>
              <Button variant="outline" disabled={isUpdatingAzure} onClick={handleAzureCancel}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {azureConnectionsByTenant.length === 0 ? (
          <div className="message-panel">No Azure DevOps connections configured yet.</div>
        ) : (
          <div className="connector-groups">
            {azureConnectionsByTenant.map(([tenantLabel, tenantConnections]) => (
              <section key={tenantLabel} className="connector-tenant-group">
                <div className="connector-tenant-header">
                  <div className="connector-tenant-kicker">Tenant</div>
                  <h3 className="connector-tenant-title">{tenantLabel}</h3>
                </div>

                <div className="connector-card-grid">
                  {tenantConnections.map((connection) => (
                    <article key={connection.id} className="connector-card">
                      <div className="connector-card-topline">
                        <div>
                          <div className="connector-card-title">{connection.label}</div>
                          <div className="connector-card-subtitle">{connection.organizationUrl}</div>
                        </div>
                        <Badge className={connection.lastError ? "bg-[var(--danger-muted)] text-[var(--danger)]" : "bg-muted"}>
                          All projects
                        </Badge>
                      </div>

                      <div className="connector-card-meta">
                        <span>
                          Scope:{" "}
                          {connection.queryScope === "assigned_to_me"
                            ? "Assigned to me across organization"
                            : "Open tasks across organization"}
                        </span>
                        <span>
                          Sync mode:{" "}
                          {connection.autoSync
                            ? `Auto to backlog every ${connection.autoSyncIntervalMinutes} min`
                            : "Stage for review"}
                        </span>
                        {connection.priorityFieldName ? (
                          <span>Priority field: {connection.priorityFieldName}</span>
                        ) : null}
                        {connection.priorityFieldResolvedReferenceName ? (
                          <span>Resolved as: {connection.priorityFieldResolvedReferenceName}</span>
                        ) : null}
                        {connection.priorityFieldType ? (
                          <span>Field type: {connection.priorityFieldType}</span>
                        ) : null}
                        {typeof connection.priorityFieldIsQueryable === "boolean" ? (
                          <span>WIQL queryable: {connection.priorityFieldIsQueryable ? "Yes" : "No"}</span>
                        ) : null}
                        {connection.project ? <span>Migrated from project-scoped config: {connection.project}</span> : null}
                        <span>Last sync: {formatConnectorTimestamp(connection.lastSyncAt)}</span>
                        {!connection.autoSync ? (
                          <span>{connection.pendingImportCount} staged · {connection.selectedImportCount} selected</span>
                        ) : null}
                      </div>

                      <div className="connector-card-message">
                        {connection.lastError ??
                          (connection.autoSync
                            ? "Connection ready to sync directly into backlog."
                            : "Connection ready to stage imports.")}
                      </div>

                      <div className="connector-card-actions">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isUpdatingAzure}
                          onClick={() => handleAzureEdit(connection)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isUpdatingAzure}
                          onClick={() => void handleAzureSync(connection.id)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Sync
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={isUpdatingAzure}
                          onClick={() => void handleAzureDelete(connection.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {azureStatusMessage ? <div className="message-panel">{azureStatusMessage}</div> : null}
        {connectorError ? <div className="message-panel message-panel-warning">{connectorError}</div> : null}
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Outlook Calendar</h2>
        <p className="settings-section-desc">
          Imported meetings stay local in this browser until you explicitly commit them to the timesheet.
        </p>

        <div className="settings-panel">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={outlook.connected ? "" : "bg-muted text-foreground/70"}>
              {outlook.connected
                ? "Outlook connected"
                : outlook.configured
                  ? "Outlook not connected"
                  : "Outlook not configured"}
            </Badge>
            {state.outlookMeetingDrafts.length > 0 ? (
              <Badge className="bg-muted">{state.outlookMeetingDrafts.length} meetings imported</Badge>
            ) : null}
          </div>
          {outlook.configured ? (
            <p className="text-foreground/65">
              {outlook.connected
                ? outlook.lastError ?? "Timed Outlook meetings are pulled into local review drafts until you commit them."
                : "Connect Outlook to import meetings from your calendar into the daily review queue."}
            </p>
          ) : null}
        </div>

        {outlook.configured ? (
          <div className="space-y-3 text-sm text-foreground/70">
            <p>{outlook.connected ? "Connected to Outlook" : "Outlook not connected yet"}</p>
            <p>Account: {outlook.accountEmail ?? "No active Microsoft account"}</p>
            <p>Imported meetings buffered locally: {state.outlookMeetingDrafts.length}</p>
            <p>{outlook.lastError ?? "Sign in with Microsoft to pull meetings from your calendar."}</p>
            <div className="flex flex-wrap gap-3">
              <Button disabled={isUpdatingOutlook || outlook.connected} onClick={() => void handleOutlookConnect()}>
                Connect Outlook
              </Button>
              <Button
                variant="outline"
                disabled={isUpdatingOutlook || !outlook.connected}
                onClick={() => void handleOutlookDisconnect()}
              >
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="message-panel">
            Set <code>VITE_MICROSOFT_CLIENT_ID</code> to enable Outlook import. <code>VITE_MICROSOFT_TENANT_ID</code> is optional and defaults to <code>common</code>.
          </div>
        )}
      </section>
    </div>
  );
}
