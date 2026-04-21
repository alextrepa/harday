import { useEffect, useMemo, useState } from "react";
import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocalState, useOutlookIntegration } from "@/lib/local-hooks";
import {
  deleteConnectorConnection,
  getAppApiBaseUrl,
  getAppApiDescription,
  getConnectorsOverview,
  saveConnectorConnection,
  syncConnectorConnection,
} from "@/lib/app-api";
import { connectOutlook, disconnectOutlook } from "@/lib/outlook";
import type {
  ConnectorConnectionSummary,
  ConnectorField,
  ConnectorFieldValue,
  ConnectorFieldValues,
  ConnectorOverviewGroup,
  ConnectorPluginManifest,
  ConnectorsOverview,
} from "@timetracker/shared";

type ConnectorFormState = {
  pluginId: string;
  editingConnectionId: string | null;
  values: ConnectorFieldValues;
};

function formatConnectorTimestamp(timestamp?: number) {
  if (!timestamp) {
    return "Never";
  }

  return new Date(timestamp).toLocaleString();
}

function prettifySummaryKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function buildDefaultValue(field: ConnectorField): ConnectorFieldValue {
  if (field.defaultValue !== undefined) {
    return field.defaultValue;
  }

  switch (field.type) {
    case "checkbox":
      return false;
    case "number":
      return typeof field.min === "number" ? field.min : 0;
    default:
      return "";
  }
}

function buildFormValues(
  plugin: ConnectorPluginManifest,
  editableValues?: ConnectorFieldValues,
): ConnectorFieldValues {
  const values: ConnectorFieldValues = {};

  for (const field of plugin.connectionFields) {
    values[field.id] =
      editableValues?.[field.id] ??
      (field.secret ? "" : buildDefaultValue(field));
  }

  return values;
}

function isFieldEmpty(value: ConnectorFieldValue | undefined) {
  return value === undefined || value === "" || value === null;
}

function canSubmitPluginForm(plugin: ConnectorPluginManifest | undefined, values: ConnectorFieldValues) {
  if (!plugin) {
    return false;
  }

  return plugin.connectionFields.every((field) => {
    if (!field.required) {
      return true;
    }

    if (field.id === "autoSyncIntervalMinutes" && values.autoSync !== true) {
      return true;
    }

    return !isFieldEmpty(values[field.id]);
  });
}

function ConnectorPluginIcon({ plugin }: { plugin: ConnectorPluginManifest }) {
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted/40 text-foreground [&>svg]:h-5 [&>svg]:w-5"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: plugin.iconSvg }}
    />
  );
}

function ConnectorFieldInput({
  field,
  value,
  onChange,
}: {
  field: ConnectorField;
  value: ConnectorFieldValue | undefined;
  onChange: (nextValue: ConnectorFieldValue) => void;
}) {
  if (field.type === "checkbox") {
    return (
      <label className="connector-form-toggle connector-form-field-wide">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>
          <span className="connector-form-toggle-title">{field.label}</span>
          {field.helpText ? (
            <span className="connector-form-toggle-description">{field.helpText}</span>
          ) : null}
        </span>
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <label className="field connector-form-field-wide">
        <span className="field-label">{field.label}</span>
        <select
          className="field-input"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        >
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {field.helpText ? <span className="field-help">{field.helpText}</span> : null}
      </label>
    );
  }

  return (
    <label className={`field ${field.type === "password" || field.helpText ? "connector-form-field-wide" : ""}`}>
      <span className="field-label">{field.label}</span>
      <Input
        type={field.type === "number" ? "number" : field.type === "password" ? "password" : "text"}
        value={
          typeof value === "number"
            ? String(value)
            : typeof value === "boolean"
              ? (value ? "true" : "false")
              : (value ?? "")
        }
        min={field.min}
        max={field.max}
        step={field.step}
        onChange={(event) => {
          if (field.type === "number") {
            const nextValue = Number(event.target.value);
            onChange(Number.isFinite(nextValue) ? nextValue : 0);
            return;
          }

          onChange(event.target.value);
        }}
        placeholder={field.placeholder}
        autoComplete="off"
      />
      {field.helpText ? <span className="field-help">{field.helpText}</span> : null}
    </label>
  );
}

export function SettingsConnectorsPage() {
  const state = useLocalState();
  const outlook = useOutlookIntegration();
  const [isUpdatingOutlook, setIsUpdatingOutlook] = useState(false);
  const [connectors, setConnectors] = useState<ConnectorsOverview | null>(null);
  const [connectorError, setConnectorError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isMutatingConnector, setIsMutatingConnector] = useState(false);
  const [formState, setFormState] = useState<ConnectorFormState | null>(null);

  const importedCountsByPlugin = useMemo(
    () =>
      state.workItems.reduce<Record<string, number>>((counts, workItem) => {
        if (workItem.source === "manual" || workItem.source === "outlook") {
          return counts;
        }

        counts[workItem.source] = (counts[workItem.source] ?? 0) + 1;
        return counts;
      }, {}),
    [state.workItems],
  );

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

  const connectorGroups = connectors?.connectionGroups ?? [];
  const pluginsById = useMemo(
    () => new Map((connectors?.plugins ?? []).map((plugin) => [plugin.id, plugin] as const)),
    [connectors?.plugins],
  );
  const activePlugin = formState ? pluginsById.get(formState.pluginId) : undefined;

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

  const handleCreate = (plugin: ConnectorPluginManifest) => {
    setConnectorError(null);
    setStatusMessage(null);
    setFormState({
      pluginId: plugin.id,
      editingConnectionId: null,
      values: buildFormValues(plugin),
    });
  };

  const handleEdit = (plugin: ConnectorPluginManifest, connection: ConnectorConnectionSummary) => {
    setConnectorError(null);
    setStatusMessage(null);
    setFormState({
      pluginId: plugin.id,
      editingConnectionId: connection.id,
      values: buildFormValues(plugin, connection.editableValues),
    });
  };

  const handleCancel = () => {
    setFormState(null);
  };

  const handleSave = async () => {
    if (!formState) {
      return;
    }

    setIsMutatingConnector(true);
    setStatusMessage(null);
    setConnectorError(null);
    try {
      const result = await saveConnectorConnection(
        formState.pluginId,
        formState.values,
        formState.editingConnectionId ?? undefined,
      );
      setConnectors(result.overview);
      setStatusMessage(
        formState.editingConnectionId
          ? `${result.connection.label} connection updated.`
          : `${result.connection.label} connection added.`,
      );
      setFormState(null);
    } catch (error) {
      setConnectorError(error instanceof Error ? error.message : "Unable to save the connector connection.");
    } finally {
      setIsMutatingConnector(false);
    }
  };

  const handleDelete = async (pluginId: string, connectionId: string) => {
    setIsMutatingConnector(true);
    setStatusMessage(null);
    setConnectorError(null);
    try {
      const overview = await deleteConnectorConnection(pluginId, connectionId);
      setConnectors(overview);
      if (formState?.editingConnectionId === connectionId && formState.pluginId === pluginId) {
        setFormState(null);
      }
      setStatusMessage("Connection removed.");
    } catch (error) {
      setConnectorError(error instanceof Error ? error.message : "Unable to delete the connector connection.");
    } finally {
      setIsMutatingConnector(false);
    }
  };

  const handleSync = async (pluginId: string, connectionId: string) => {
    setIsMutatingConnector(true);
    setStatusMessage(null);
    setConnectorError(null);
    try {
      const result = await syncConnectorConnection(pluginId, connectionId);
      await refreshConnectors();
      setStatusMessage(
        result.mode === "backlog"
          ? [result.connection.label, `${result.backlogImportedCount} imported`, `${result.backlogUpdatedCount} updated`]
              .join(" · ")
          : [result.connection.label, `${result.stagedCount} staged`, `${result.updatedCount} refreshed`, `${result.skippedCount} skipped`]
              .join(" · "),
      );
    } catch (error) {
      setConnectorError(error instanceof Error ? error.message : "Unable to sync connector items.");
    } finally {
      setIsMutatingConnector(false);
    }
  };

  return (
    <div className="settings-sections">
      {connectorGroups.map((group) => (
        <section key={group.plugin.id} className="settings-section">
          <div className="flex items-start gap-3">
            <ConnectorPluginIcon plugin={group.plugin} />
            <div className="min-w-0 flex-1">
              <h2 className="settings-section-title">{group.plugin.displayName}</h2>
              <p className="settings-section-desc">
                {group.plugin.description ?? "Configure this connector and sync imported work into backlog."}
              </p>
            </div>
          </div>

          <div className="settings-panel space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{group.connections.length} connection{group.connections.length === 1 ? "" : "s"}</Badge>
              <Badge className="bg-muted">
                {group.connections.reduce((sum, connection) => sum + connection.pendingImportCount, 0)} staged imports
              </Badge>
              <Badge className="bg-muted">
                {group.connections.reduce((sum, connection) => sum + connection.selectedImportCount, 0)} selected for sync
              </Badge>
              <Badge className="bg-muted">
                {importedCountsByPlugin[group.plugin.id] ?? 0} backlog items imported
              </Badge>
            </div>

            <div className="space-y-1 text-sm text-foreground/70">
              <p>Connector API: {getAppApiDescription()}</p>
              {getAppApiDescription() !== getAppApiBaseUrl() ? (
                <p className="text-foreground/50">Endpoint: {getAppApiBaseUrl()}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button size="sm" disabled={isMutatingConnector} onClick={() => handleCreate(group.plugin)}>
                Add a connection
              </Button>
            </div>
          </div>

          {formState?.pluginId === group.plugin.id ? (
            <div className="settings-panel connector-form-panel">
              <div className="connector-form-header">
                <div>
                  <div className="connector-form-kicker">
                    {formState.editingConnectionId ? "Edit connection" : "Add connection"}
                  </div>
                  <div className="connector-form-title">
                    {formState.editingConnectionId
                      ? `Replace ${group.plugin.displayName} settings`
                      : `New ${group.plugin.displayName} source`}
                  </div>
                </div>
              </div>

              <div className="connector-form-grid">
                {group.plugin.connectionFields.map((field) => {
                  if (field.id === "autoSyncIntervalMinutes" && formState.values.autoSync !== true) {
                    return null;
                  }

                  return (
                    <ConnectorFieldInput
                      key={field.id}
                      field={field}
                      value={formState.values[field.id]}
                      onChange={(nextValue) =>
                        setFormState((current) =>
                          current
                            ? {
                                ...current,
                                values: {
                                  ...current.values,
                                  [field.id]: nextValue,
                                },
                              }
                            : current,
                        )
                      }
                    />
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={isMutatingConnector || !canSubmitPluginForm(activePlugin, formState.values)}
                  onClick={() => void handleSave()}
                >
                  {formState.editingConnectionId ? "Update Connection" : "Add Connection"}
                </Button>
                <Button variant="outline" disabled={isMutatingConnector} onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {group.connections.length === 0 ? (
            <div className="message-panel">No {group.plugin.displayName} connections configured yet.</div>
          ) : (
            <div className="connector-groups">
              <section className="connector-tenant-group">
                <div className="connector-card-grid">
                  {group.connections.map((connection) => (
                    <article key={connection.id} className="connector-card">
                      <div className="connector-card-topline">
                        <div>
                          <div className="connector-card-title">{connection.label}</div>
                          <div className="connector-card-subtitle">{connection.tenantLabel}</div>
                        </div>
                        <Badge className={connection.lastError ? "bg-[var(--danger-muted)] text-[var(--danger)]" : "bg-muted"}>
                          {connection.autoSync
                            ? `Auto every ${connection.autoSyncIntervalMinutes} min`
                            : "Stage for review"}
                        </Badge>
                      </div>

                      <div className="connector-card-meta">
                        {Object.entries(connection.configSummary).map(([key, value]) => (
                          <span key={key}>
                            {prettifySummaryKey(key)}: {String(value)}
                          </span>
                        ))}
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
                          disabled={isMutatingConnector}
                          onClick={() => handleEdit(group.plugin, connection)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isMutatingConnector}
                          onClick={() => void handleSync(group.plugin.id, connection.id)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Sync
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={isMutatingConnector}
                          onClick={() => void handleDelete(group.plugin.id, connection.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )}
        </section>
      ))}

      {statusMessage ? <div className="message-panel">{statusMessage}</div> : null}
      {connectorError ? <div className="message-panel message-panel-warning">{connectorError}</div> : null}

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
