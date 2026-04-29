import { useEffect, useMemo, useState } from "react";
import {
  RiDeleteBinLine as Trash2,
  RiPencilLine as Pencil,
  RiRefreshLine as RefreshCw,
} from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { useLocalState, useOutlookIntegration } from "@/lib/local-hooks";
import { cn } from "@/lib/utils";
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
  ConnectorPluginManifest,
  ConnectorsOverview,
} from "@timetracker/shared";
import {
  areConnectorFormValuesEqual,
  buildConnectorFormValues,
  canSubmitConnectorForm,
  normalizeConnectorFormValuesForSave,
  SAVED_SECRET_MASK,
} from "./connector-form-state";

type ConnectorFormState = {
  pluginId: string;
  editingConnectionId: string | null;
  initialValues: ConnectorFieldValues;
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

function ConnectorPluginIcon({ plugin }: { plugin: ConnectorPluginManifest }) {
  return (
    <span
      className="inline-flex size-10 items-center justify-center rounded-2xl bg-muted/60 text-foreground [&>svg]:size-5"
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
  const isWideField =
    field.type === "checkbox" ||
    field.type === "password" ||
    Boolean(field.helpText);

  if (field.type === "checkbox") {
    return (
      <Field
        orientation="horizontal"
        className="rounded-3xl border border-border/60 bg-muted/10 p-4 md:col-span-2"
      >
        <input
          type="checkbox"
          id={field.id}
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 size-4 rounded-sm border border-border bg-background accent-foreground"
        />
        <FieldContent>
          <FieldTitle>{field.label}</FieldTitle>
          {field.helpText ? (
            <FieldDescription>{field.helpText}</FieldDescription>
          ) : null}
        </FieldContent>
      </Field>
    );
  }

  if (field.type === "select") {
    return (
      <Field className={cn(isWideField && "md:col-span-2")}>
        <FieldLabel htmlFor={field.id}>{field.label}</FieldLabel>
        <FieldContent>
          <NativeSelect
            id={field.id}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        >
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          </NativeSelect>
          {field.helpText ? (
            <FieldDescription>{field.helpText}</FieldDescription>
          ) : null}
        </FieldContent>
      </Field>
    );
  }

  return (
    <Field className={cn(isWideField && "md:col-span-2")}>
      <FieldLabel htmlFor={field.id}>{field.label}</FieldLabel>
      <FieldContent>
        <Input
          id={field.id}
          type={
            field.type === "number"
              ? "number"
              : field.type === "password"
                ? "password"
                : "text"
          }
          value={
            typeof value === "number"
              ? String(value)
              : typeof value === "boolean"
                ? value
                  ? "true"
                  : "false"
                : (value ?? "")
          }
          min={field.min}
          max={field.max}
          step={field.step}
          onFocus={() => {
            if (
              field.type === "password" &&
              field.secret &&
              value === SAVED_SECRET_MASK
            ) {
              onChange("");
            }
          }}
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
        {field.helpText ? (
          <FieldDescription>{field.helpText}</FieldDescription>
        ) : null}
      </FieldContent>
    </Field>
  );
}

function ConnectorMessageCard({
  label,
  message,
  destructive = false,
}: {
  label: string;
  message: string;
  destructive?: boolean;
}) {
  return (
    <Card
      size="sm"
      className={cn(
        "gap-3",
        destructive && "border border-destructive/30 bg-destructive/5",
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Badge variant={destructive ? "destructive" : "secondary"}>
            {label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
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
  const isFormDirty =
    formState && activePlugin
      ? !areConnectorFormValuesEqual(
          activePlugin,
          formState.values,
          formState.initialValues,
        )
      : false;

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
    const initialValues = buildConnectorFormValues(plugin);
    setConnectorError(null);
    setStatusMessage(null);
    setFormState({
      pluginId: plugin.id,
      editingConnectionId: null,
      initialValues,
      values: initialValues,
    });
  };

  const handleEdit = (plugin: ConnectorPluginManifest, connection: ConnectorConnectionSummary) => {
    const initialValues = buildConnectorFormValues(
      plugin,
      connection.editableValues,
    );
    setConnectorError(null);
    setStatusMessage(null);
    setFormState({
      pluginId: plugin.id,
      editingConnectionId: connection.id,
      initialValues,
      values: initialValues,
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
        normalizeConnectorFormValuesForSave(
          activePlugin!,
          formState.values,
          {
            allowSavedSecrets: Boolean(formState.editingConnectionId),
          },
        ),
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
      const conflictCount = result.workItemUpdates.reduce(
        (sum, workItem) =>
          sum +
          Object.values(workItem.fields).filter((field) => field?.status === "conflict").length,
        0,
      );
      setStatusMessage(
        result.mode === "backlog"
          ? [
              result.connection.label,
              `${result.backlogImportedCount} imported`,
              `${result.backlogUpdatedCount} updated`,
              ...(conflictCount > 0 ? [`${conflictCount} conflict${conflictCount === 1 ? "" : "s"}`] : []),
            ]
              .join(" · ")
          : [
              result.connection.label,
              `${result.stagedCount} staged`,
              `${result.updatedCount} refreshed`,
              `${result.skippedCount} skipped`,
              ...(conflictCount > 0 ? [`${conflictCount} conflict${conflictCount === 1 ? "" : "s"}`] : []),
            ]
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
      {connectorGroups.map((group) => {
        const groupFormState =
          formState?.pluginId === group.plugin.id ? formState : null;

        return (
          <section key={group.plugin.id} className="settings-section">
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <ConnectorPluginIcon plugin={group.plugin} />
                  <div className="min-w-0 flex-1">
                    <CardTitle className="font-sans tracking-normal">
                      {group.plugin.displayName}
                    </CardTitle>
                    <CardDescription>
                      {group.plugin.description ??
                        "Configure this connector and sync imported work into backlog."}
                    </CardDescription>
                  </div>
                </div>
                <CardAction>
                  <Button
                    size="sm"
                    disabled={isMutatingConnector}
                    onClick={() => handleCreate(group.plugin)}
                  >
                    Add a connection
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {group.connections.length} connection
                    {group.connections.length === 1 ? "" : "s"}
                  </Badge>
                  <Badge variant="outline">
                    {group.connections.reduce(
                      (sum, connection) => sum + connection.pendingImportCount,
                      0,
                    )}{" "}
                    staged imports
                  </Badge>
                  <Badge variant="outline">
                    {group.connections.reduce(
                      (sum, connection) =>
                        sum + connection.selectedImportCount,
                      0,
                    )}{" "}
                    selected for sync
                  </Badge>
                  <Badge variant="outline">
                    {importedCountsByPlugin[group.plugin.id] ?? 0} backlog items
                    imported
                  </Badge>
                </div>
                <Separator />
                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                  <p>Connector API: {getAppApiDescription()}</p>
                  {getAppApiDescription() !== getAppApiBaseUrl() ? (
                    <p>Endpoint: {getAppApiBaseUrl()}</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {groupFormState ? (
              <Card>
                <CardHeader>
                  <CardTitle className="font-sans tracking-normal">
                    {groupFormState.editingConnectionId
                      ? `Replace ${group.plugin.displayName} settings`
                      : `New ${group.plugin.displayName} source`}
                  </CardTitle>
                  <CardDescription>
                    {groupFormState.editingConnectionId
                      ? "Update this connection without re-entering unchanged values."
                      : "Add a new connector source and save it locally in the app."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup className="md:grid md:grid-cols-2 md:gap-x-6 md:gap-y-5">
                    {group.plugin.connectionFields.map((field) => {
                      if (
                        field.id === "autoSyncIntervalMinutes" &&
                        groupFormState.values.autoSync !== true
                      ) {
                        return null;
                      }

                      return (
                        <ConnectorFieldInput
                          key={field.id}
                          field={field}
                          value={groupFormState.values[field.id]}
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
                  </FieldGroup>
                </CardContent>
                <CardFooter className="flex flex-wrap justify-end gap-3 border-t border-border/60">
                  <Button
                    variant="outline"
                    disabled={isMutatingConnector}
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                  <Button
                    disabled={
                      isMutatingConnector ||
                      !isFormDirty ||
                      !canSubmitConnectorForm(activePlugin, groupFormState.values, {
                        allowSavedSecrets: Boolean(
                          groupFormState.editingConnectionId,
                        ),
                      })
                    }
                    onClick={() => void handleSave()}
                  >
                    {groupFormState.editingConnectionId
                      ? "Update Connection"
                      : "Add Connection"}
                  </Button>
                </CardFooter>
              </Card>
            ) : null}

            {group.connections.length === 0 ? (
              <Card size="sm">
                <CardContent>
                  <Empty className="border border-dashed border-border/70 bg-muted/10 py-10">
                    <EmptyHeader>
                      <EmptyTitle>No connections yet</EmptyTitle>
                      <EmptyDescription>
                        No {group.plugin.displayName} connections are configured
                        yet.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {group.connections.map((connection) => (
                  <Card key={connection.id} size="sm">
                    <CardHeader>
                      <div>
                        <CardTitle className="font-sans tracking-normal">
                          {connection.label}
                        </CardTitle>
                        <CardDescription>
                          {connection.tenantLabel}
                        </CardDescription>
                      </div>
                      <CardAction>
                        <Badge
                          variant={
                            connection.lastError ? "destructive" : "outline"
                          }
                        >
                          {connection.autoSync
                            ? `Auto every ${connection.autoSyncIntervalMinutes} min`
                            : "Stage for review"}
                        </Badge>
                      </CardAction>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                        {Object.entries(connection.configSummary).map(
                          ([key, value]) => (
                            <span key={key}>
                              {prettifySummaryKey(key)}: {String(value)}
                            </span>
                          ),
                        )}
                        <span>
                          Last sync:{" "}
                          {formatConnectorTimestamp(connection.lastSyncAt)}
                        </span>
                        {!connection.autoSync ? (
                          <span>
                            {connection.pendingImportCount} staged ·{" "}
                            {connection.selectedImportCount} selected
                          </span>
                        ) : null}
                      </div>
                      <p
                        className={cn(
                          "text-sm text-muted-foreground",
                          connection.lastError && "text-destructive",
                        )}
                      >
                        {connection.lastError ??
                          (connection.autoSync
                            ? "Connection ready to sync directly into backlog."
                            : "Connection ready to stage imports.")}
                      </p>
                    </CardContent>
                    <CardFooter className="flex flex-wrap gap-2 border-t border-border/60">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isMutatingConnector}
                        onClick={() => handleEdit(group.plugin, connection)}
                      >
                        <Pencil data-icon="inline-start" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isMutatingConnector}
                        onClick={() =>
                          void handleSync(group.plugin.id, connection.id)
                        }
                      >
                        <RefreshCw data-icon="inline-start" />
                        Sync
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isMutatingConnector}
                        onClick={() =>
                          void handleDelete(group.plugin.id, connection.id)
                        }
                      >
                        <Trash2 data-icon="inline-start" />
                        Remove
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {statusMessage ? (
        <ConnectorMessageCard label="Status" message={statusMessage} />
      ) : null}
      {connectorError ? (
        <ConnectorMessageCard
          label="Error"
          message={connectorError}
          destructive
        />
      ) : null}

      <section className="settings-section">
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="font-sans tracking-normal">
                Outlook Calendar
              </CardTitle>
              <CardDescription>
                Imported meetings stay local in this browser until you
                explicitly commit them to the timesheet.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={
                  outlook.connected
                    ? "secondary"
                    : outlook.configured
                      ? "outline"
                      : "outline"
                }
              >
                {outlook.connected
                  ? "Outlook connected"
                  : outlook.configured
                    ? "Outlook not connected"
                    : "Outlook not configured"}
              </Badge>
              {state.outlookMeetingDrafts.length > 0 ? (
                <Badge variant="outline">
                  {state.outlookMeetingDrafts.length} meetings imported
                </Badge>
              ) : null}
            </div>
            <Separator />
            {outlook.configured ? (
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <p>
                  {outlook.connected
                    ? "Connected to Outlook"
                    : "Outlook not connected yet"}
                </p>
                <p>
                  Account:{" "}
                  {outlook.accountEmail ?? "No active Microsoft account"}
                </p>
                <p>
                  Imported meetings buffered locally:{" "}
                  {state.outlookMeetingDrafts.length}
                </p>
                <p>
                  {outlook.lastError ??
                    (outlook.connected
                      ? "Timed Outlook meetings are pulled into local review drafts until you commit them."
                      : "Sign in with Microsoft to pull meetings from your calendar.")}
                </p>
              </div>
            ) : (
              <Empty className="border border-dashed border-border/70 bg-muted/10 py-10">
                <EmptyHeader>
                  <EmptyTitle>Outlook is not configured</EmptyTitle>
                  <EmptyDescription>
                    Set <code>VITE_MICROSOFT_CLIENT_ID</code> to enable Outlook
                    import. <code>VITE_MICROSOFT_TENANT_ID</code> is optional
                    and defaults to <code>common</code>.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
          {outlook.configured ? (
            <CardFooter className="flex flex-wrap gap-3 border-t border-border/60">
              <Button
                disabled={isUpdatingOutlook || outlook.connected}
                onClick={() => void handleOutlookConnect()}
              >
                Connect Outlook
              </Button>
              <Button
                variant="outline"
                disabled={isUpdatingOutlook || !outlook.connected}
                onClick={() => void handleOutlookDisconnect()}
              >
                Disconnect
              </Button>
            </CardFooter>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
