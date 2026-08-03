import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  RiArrowLeftLine as ArrowLeft,
  RiCalendarEventLine as Calendar,
  RiDeleteBinLine as Trash2,
  RiPencilLine as Pencil,
  RiRefreshLine as RefreshCw,
  RiUpload2Line as Upload,
} from "@remixicon/react";
import { AppPanel, MessagePanel } from "@/components/app-surface";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { FieldGroup } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  getCachedConnectorsOverview,
  deleteConnectorConnection,
  getAppApiBaseUrl,
  getAppApiDescription,
  getConnectorsOverview,
  installConnectorPlugin,
  saveConnectorConnection,
  setConnectorPluginEnabled,
  syncConnectorConnection,
  uninstallConnectorPlugin,
} from "@/lib/app-api";
import { useLocalState, useOutlookIntegration } from "@/lib/local-hooks";
import { connectOutlook, disconnectOutlook } from "@/lib/outlook";
import { cn } from "@/lib/utils";
import type {
  ConnectorConnectionSummary,
  ConnectorFieldValues,
  ConnectorOverviewGroup,
  ConnectorPluginManifest,
  ConnectorsOverview,
} from "@timetracker/shared";
import {
  areConnectorFormValuesEqual,
  buildConnectorFormValues,
  canSubmitConnectorForm,
  normalizeConnectorFormValuesForSave,
} from "./connector-form-state";
import {
  ConnectorFieldInput,
  ConnectorPluginIcon,
} from "./connector-settings-ui";

const OUTLOOK_PLUGIN_ID = "outlook_calendar";

type ConnectorFormState = {
  pluginId: string;
  editingConnectionId: string | null;
  initialValues: ConnectorFieldValues;
  values: ConnectorFieldValues;
};

function formatConnectorTimestamp(timestamp?: number) {
  return timestamp ? new Date(timestamp).toLocaleString() : "Never";
}

function prettifySummaryKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function OutlookPluginIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/60 text-foreground",
        className,
      )}
      aria-hidden="true"
    >
      <Calendar className="size-5" />
    </span>
  );
}

function PluginCatalogCard({
  pluginId,
  name,
  description,
  icon,
  enabled,
  disabled,
  metadata,
  onEnabledChange,
}: {
  pluginId: string;
  name: string;
  description: string;
  icon: ReactNode;
  enabled: boolean;
  disabled?: boolean;
  metadata: ReactNode;
  onEnabledChange: (enabled: boolean) => void;
}) {
  return (
    <AppPanel className="group min-h-32 flex-row items-start gap-3 p-4 transition-colors hover:bg-[var(--surface-high)]">
      <Link
        to="/settings/plugins/$pluginId"
        params={{ pluginId }}
        className="flex min-w-0 flex-1 items-start gap-3 rounded-[var(--control-radius)] outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        aria-label={`Configure ${name}`}
      >
        {icon}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">
            {name}
          </span>
          <span className="mt-1 line-clamp-2 block text-sm leading-5 text-muted-foreground">
            {description}
          </span>
          <span className="mt-3 flex flex-wrap gap-2">{metadata}</span>
        </span>
      </Link>
      <Switch
        checked={enabled}
        disabled={disabled}
        aria-label={`${enabled ? "Deactivate" : "Activate"} ${name}`}
        onCheckedChange={onEnabledChange}
      />
    </AppPanel>
  );
}

function PluginsHeader({
  canInstall,
  isMutating,
  onInstall,
  children,
}: {
  canInstall: boolean;
  isMutating: boolean;
  onInstall: () => void;
  children: ReactNode;
}) {
  return (
    <Tabs value="connectors" className="contents">
      <section className="settings-section gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Plugins</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Activate the capabilities you use, then open a plugin to configure
              its connections.
            </p>
          </div>
          {canInstall ? (
            <Button
              size="sm"
              disabled={isMutating}
              onClick={onInstall}
            >
              <Upload data-icon="inline-start" />
              Install connector
            </Button>
          ) : null}
        </div>

        <TabsList
          variant="line"
          aria-label="Plugin categories"
          className="border-b border-border/70"
        >
          <TabsTrigger value="connectors">Connectors</TabsTrigger>
        </TabsList>
      </section>
      <TabsContent value="connectors" className="contents">
        {children}
      </TabsContent>
    </Tabs>
  );
}

function PluginDetailHeader({
  name,
  description,
  icon,
  enabled,
  disabled,
  badges,
  onEnabledChange,
}: {
  name: string;
  description: string;
  icon: ReactNode;
  enabled: boolean;
  disabled?: boolean;
  badges: ReactNode;
  onEnabledChange: (enabled: boolean) => void;
}) {
  return (
    <>
      <Link
        to="/settings/plugins"
        className="inline-flex w-fit items-center gap-1.5 rounded-[var(--control-radius)] text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <ArrowLeft className="size-4" />
        All plugins
      </Link>
      <AppPanel as="section" className="gap-5 p-5">
        <div className="flex items-start gap-4">
          {icon}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-foreground">{name}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">
              {description}
            </p>
          </div>
          <Switch
            checked={enabled}
            disabled={disabled}
            aria-label={`${enabled ? "Deactivate" : "Activate"} ${name}`}
            onCheckedChange={onEnabledChange}
          />
        </div>
        <div className="flex flex-wrap gap-2">{badges}</div>
      </AppPanel>
    </>
  );
}

export function SettingsPluginsPage({ pluginId }: { pluginId?: string }) {
  const state = useLocalState();
  const outlook = useOutlookIntegration();
  const isDevelopmentBuild =
    window.timetrackerDesktop?.runtime?.developmentBuild === true;
  const canInstallConnectorPlugins = Boolean(
    window.timetrackerDesktop?.installConnectorPlugin,
  ) && !isDevelopmentBuild;
  const canUninstallConnectorPlugins = Boolean(
    window.timetrackerDesktop?.uninstallConnectorPlugin,
  ) && !isDevelopmentBuild;
  const [isUpdatingOutlook, setIsUpdatingOutlook] = useState(false);
  const [connectors, setConnectors] = useState<ConnectorsOverview | null>(
    getCachedConnectorsOverview,
  );
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
      setConnectorError(
        error instanceof Error
          ? error.message
          : "Unable to reach the app API.",
      );
    }
  };

  useEffect(() => {
    if (!getCachedConnectorsOverview()) {
      void refreshConnectors();
    }
  }, []);

  const connectorGroups = connectors?.connectionGroups ?? [];
  const pluginsById = useMemo(
    () =>
      new Map(
        (connectors?.plugins ?? []).map(
          (plugin) => [plugin.id, plugin] as const,
        ),
      ),
    [connectors?.plugins],
  );
  const activePlugin = formState
    ? connectorGroups.find((group) => group.plugin.id === formState.pluginId)
        ?.plugin ?? pluginsById.get(formState.pluginId)
    : undefined;
  const isFormDirty =
    formState && activePlugin
      ? !areConnectorFormValuesEqual(
          activePlugin,
          formState.values,
          formState.initialValues,
        )
      : false;

  const handleOutlookActivation = async (enabled: boolean) => {
    setIsUpdatingOutlook(true);
    setStatusMessage(null);
    setConnectorError(null);
    try {
      if (enabled) {
        await connectOutlook();
        setStatusMessage("Outlook Calendar activated.");
      } else {
        await disconnectOutlook();
        setStatusMessage("Outlook Calendar deactivated.");
      }
    } catch (error) {
      setConnectorError(
        error instanceof Error
          ? error.message
          : "Unable to update Outlook Calendar.",
      );
    } finally {
      setIsUpdatingOutlook(false);
    }
  };

  const handlePluginActivation = async (
    group: ConnectorOverviewGroup,
    enabled: boolean,
  ) => {
    setIsMutatingConnector(true);
    setStatusMessage(null);
    setConnectorError(null);
    try {
      const overview = await setConnectorPluginEnabled(
        group.plugin.id,
        enabled,
      );
      setConnectors(overview);
      setStatusMessage(
        `${group.plugin.displayName} ${enabled ? "activated" : "deactivated"}.`,
      );
    } catch (error) {
      setConnectorError(
        error instanceof Error
          ? error.message
          : "Unable to update the connector plugin.",
      );
    } finally {
      setIsMutatingConnector(false);
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

  const handleEdit = (
    plugin: ConnectorPluginManifest,
    connection: ConnectorConnectionSummary,
  ) => {
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

  const handleSave = async () => {
    if (!formState || !activePlugin) {
      return;
    }

    setIsMutatingConnector(true);
    setStatusMessage(null);
    setConnectorError(null);
    try {
      const result = await saveConnectorConnection(
        formState.pluginId,
        normalizeConnectorFormValuesForSave(activePlugin, formState.values, {
          allowSavedSecrets: Boolean(formState.editingConnectionId),
        }),
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
      setConnectorError(
        error instanceof Error
          ? error.message
          : "Unable to save the connector connection.",
      );
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
      if (
        formState?.editingConnectionId === connectionId &&
        formState.pluginId === pluginId
      ) {
        setFormState(null);
      }
      setStatusMessage("Connection removed.");
    } catch (error) {
      setConnectorError(
        error instanceof Error
          ? error.message
          : "Unable to delete the connector connection.",
      );
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
          Object.values(workItem.fields).filter(
            (field) => field?.status === "conflict",
          ).length,
        0,
      );
      setStatusMessage(
        result.mode === "backlog"
          ? [
              result.connection.label,
              `${result.backlogImportedCount} imported`,
              `${result.backlogUpdatedCount} updated`,
              ...(conflictCount > 0
                ? [
                    `${conflictCount} conflict${conflictCount === 1 ? "" : "s"}`,
                  ]
                : []),
            ].join(" · ")
          : [
              result.connection.label,
              `${result.stagedCount} staged`,
              `${result.updatedCount} refreshed`,
              `${result.skippedCount} skipped`,
              ...(conflictCount > 0
                ? [
                    `${conflictCount} conflict${conflictCount === 1 ? "" : "s"}`,
                  ]
                : []),
            ].join(" · "),
      );
    } catch (error) {
      setConnectorError(
        error instanceof Error
          ? error.message
          : "Unable to sync connector items.",
      );
    } finally {
      setIsMutatingConnector(false);
    }
  };

  const handleInstallPlugin = async () => {
    setIsMutatingConnector(true);
    setStatusMessage(null);
    setConnectorError(null);
    try {
      const result = await installConnectorPlugin();
      if (!result) {
        return;
      }
      setConnectors(result.overview);
      setStatusMessage(
        result.replaced
          ? `${result.plugin.displayName} ${result.plugin.version} replaced the installed plugin.`
          : `${result.plugin.displayName} ${result.plugin.version} installed.`,
      );
    } catch (error) {
      setConnectorError(
        error instanceof Error
          ? error.message
          : "Unable to install the connector plugin.",
      );
    } finally {
      setIsMutatingConnector(false);
    }
  };

  const handleUninstallPlugin = async (group: ConnectorOverviewGroup) => {
    setIsMutatingConnector(true);
    setStatusMessage(null);
    setConnectorError(null);
    try {
      const result = await uninstallConnectorPlugin(group.plugin.id);
      setConnectors(result.overview);
      setFormState(null);
      setStatusMessage(
        `${group.plugin.displayName} uninstalled. Imported backlog items were preserved.`,
      );
    } catch (error) {
      setConnectorError(
        error instanceof Error
          ? error.message
          : "Unable to uninstall the connector plugin.",
      );
    } finally {
      setIsMutatingConnector(false);
    }
  };

  const renderMessages = () => (
    <>
      {statusMessage ? <MessagePanel>{statusMessage}</MessagePanel> : null}
      {connectorError ? (
        <MessagePanel tone="warning">{connectorError}</MessagePanel>
      ) : null}
    </>
  );

  const renderOutlookDetail = () => (
    <>
      <PluginDetailHeader
        name="Outlook Calendar"
        description="Import meetings into local review drafts, then explicitly commit the time you want to keep."
        icon={<OutlookPluginIcon className="size-14" />}
        enabled={outlook.connected}
        disabled={isUpdatingOutlook || !outlook.configured}
        onEnabledChange={(enabled) => void handleOutlookActivation(enabled)}
        badges={
          <>
            <Badge variant={outlook.connected ? "secondary" : "outline"}>
              {outlook.connected ? "Active" : "Inactive"}
            </Badge>
            <Badge variant="outline">Built in</Badge>
            <Badge variant="outline">
              {state.outlookMeetingDrafts.length} meetings imported
            </Badge>
          </>
        }
      />
      {renderMessages()}
      <section className="settings-section">
        <h3 className="settings-section-title">Configuration</h3>
        <p className="settings-section-desc">
          Outlook authentication opens in your browser. Imported meetings stay
          local until you commit them to the timesheet.
        </p>
        <AppPanel className="gap-5">
          {outlook.configured ? (
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <p>
                Status: {outlook.connected ? "Connected" : "Not connected"}
              </p>
              <p>
                Account: {outlook.accountEmail ?? "No active Microsoft account"}
              </p>
              <p>
                Imported meetings buffered locally:{" "}
                {state.outlookMeetingDrafts.length}
              </p>
              <p>
                {outlook.lastError ??
                  (outlook.connected
                    ? "Timed Outlook meetings are ready for local review."
                    : "Activate the plugin to sign in with Microsoft and pull meetings.")}
              </p>
            </div>
          ) : (
            <Empty className="border border-dashed border-border/70 bg-muted/10 py-10">
              <EmptyHeader>
                <EmptyTitle>Outlook is not configured</EmptyTitle>
                <EmptyDescription>
                  Set <code>VITE_MICROSOFT_CLIENT_ID</code> to enable Outlook
                  import. <code>VITE_MICROSOFT_TENANT_ID</code> is optional and
                  defaults to <code>common</code>.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {outlook.configured ? (
            <>
              <Separator />
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={isUpdatingOutlook || outlook.connected}
                  onClick={() => void handleOutlookActivation(true)}
                >
                  Connect Outlook
                </Button>
                <Button
                  variant="outline"
                  disabled={isUpdatingOutlook || !outlook.connected}
                  onClick={() => void handleOutlookActivation(false)}
                >
                  Disconnect
                </Button>
              </div>
            </>
          ) : null}
        </AppPanel>
      </section>
    </>
  );

  const renderConnectorDetail = (group: ConnectorOverviewGroup) => {
    const groupFormState =
      formState?.pluginId === group.plugin.id ? formState : null;

    return (
      <>
        <PluginDetailHeader
          name={group.plugin.displayName}
          description={
            group.plugin.description ??
            "Configure this connector and sync imported work into backlog."
          }
          icon={
            <ConnectorPluginIcon
              plugin={group.plugin}
              className="size-14"
              imageClassName="size-7"
            />
          }
          enabled={group.enabled}
          disabled={isMutatingConnector || group.plugin.entrypoint.length === 0}
          onEnabledChange={(enabled) =>
            void handlePluginActivation(group, enabled)
          }
          badges={
            <>
              <Badge variant={group.enabled ? "secondary" : "outline"}>
                {group.enabled ? "Active" : "Inactive"}
              </Badge>
              <Badge variant="outline">Version {group.plugin.version}</Badge>
              <Badge variant="outline">
                {group.connections.length} connection
                {group.connections.length === 1 ? "" : "s"}
              </Badge>
              <Badge variant="outline">
                {importedCountsByPlugin[group.plugin.id] ?? 0} backlog items
              </Badge>
            </>
          }
        />
        {renderMessages()}

        {!group.enabled ? (
          <MessagePanel>
            This plugin is inactive. Its saved connections and imported data are
            preserved, but sync is paused until you reactivate it.
          </MessagePanel>
        ) : null}

        <section className="settings-section">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="settings-section-title">Configuration</h3>
              <p className="settings-section-desc mt-1">
                Manage the local connections used by this plugin.
              </p>
            </div>
            <Button
              size="sm"
              disabled={isMutatingConnector}
              onClick={() => handleCreate(group.plugin)}
            >
              Add a connection
            </Button>
          </div>

          {groupFormState ? (
            <AppPanel className="gap-5 p-5">
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  {groupFormState.editingConnectionId
                    ? `Edit ${group.plugin.displayName} connection`
                    : `New ${group.plugin.displayName} connection`}
                </h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  {groupFormState.editingConnectionId
                    ? "Update this connection without re-entering unchanged secrets."
                    : "The connection is validated by the plugin and stored locally."}
                </p>
              </div>
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
              <Separator />
              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  variant="outline"
                  disabled={isMutatingConnector}
                  onClick={() => setFormState(null)}
                >
                  Cancel
                </Button>
                <Button
                  disabled={
                    isMutatingConnector ||
                    !isFormDirty ||
                    !canSubmitConnectorForm(
                      activePlugin,
                      groupFormState.values,
                      {
                        allowSavedSecrets: Boolean(
                          groupFormState.editingConnectionId,
                        ),
                      },
                    )
                  }
                  onClick={() => void handleSave()}
                >
                  {groupFormState.editingConnectionId
                    ? "Update connection"
                    : "Add connection"}
                </Button>
              </div>
            </AppPanel>
          ) : null}

          {group.connections.length === 0 ? (
            <AppPanel>
              <Empty className="border border-dashed border-border/70 bg-muted/10 py-10">
                <EmptyHeader>
                  <EmptyTitle>No connections yet</EmptyTitle>
                  <EmptyDescription>
                    Add a {group.plugin.displayName} connection to configure its
                    source and sync behavior.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </AppPanel>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {group.connections.map((connection) => (
                <Card
                  key={connection.id}
                  size="sm"
                  className="rounded-lg shadow-none ring-1 ring-border/70"
                >
                  <CardHeader className="rounded-t-lg">
                    <div>
                      <CardTitle className="font-sans tracking-normal">
                        {connection.label}
                      </CardTitle>
                      <CardDescription>{connection.tenantLabel}</CardDescription>
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
                        Last sync: {formatConnectorTimestamp(connection.lastSyncAt)}
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
                        (group.enabled
                          ? connection.autoSync
                            ? "Connection ready to sync directly into backlog."
                            : "Connection ready to stage imports."
                          : "Plugin inactive; this connection will not sync.")}
                    </p>
                  </CardContent>
                  <CardFooter className="rounded-b-lg border-t border-border/60">
                    <div className="flex flex-wrap gap-2">
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
                        disabled={isMutatingConnector || !group.enabled}
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
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </section>

        {canUninstallConnectorPlugins ? (
          <section className="settings-section">
            <h3 className="settings-section-title">Uninstall plugin</h3>
            <p className="settings-section-desc">
              Remove the plugin package and its saved connections from this
              device. Imported backlog items will remain available.
            </p>
            <AppPanel className="flex-row items-center justify-between gap-4 border-destructive/30">
              <p className="text-sm text-muted-foreground">
                Deactivate the plugin instead if you want to keep its
                configuration for later.
              </p>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      variant="destructive"
                      disabled={isMutatingConnector}
                    />
                  }
                >
                  <Trash2 data-icon="inline-start" />
                  Uninstall
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Uninstall {group.plugin.displayName}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes the plugin package, saved connections,
                      credentials, staged imports, and connector statuses.
                      Already imported backlog items are preserved.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      disabled={isMutatingConnector}
                      onClick={() => void handleUninstallPlugin(group)}
                    >
                      Uninstall plugin
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </AppPanel>
          </section>
        ) : null}
      </>
    );
  };

  const selectedConnectorGroup = pluginId
    ? connectorGroups.find((group) => group.plugin.id === pluginId)
    : undefined;

  return (
    <div className="settings-sections gap-6">
      <PluginsHeader
        canInstall={canInstallConnectorPlugins}
        isMutating={isMutatingConnector}
        onInstall={() => void handleInstallPlugin()}
      >

      {pluginId === OUTLOOK_PLUGIN_ID ? (
        renderOutlookDetail()
      ) : selectedConnectorGroup ? (
        renderConnectorDetail(selectedConnectorGroup)
      ) : pluginId && connectors ? (
        <>
          {renderMessages()}
          <MessagePanel tone={statusMessage ? "default" : "warning"}>
            That plugin is not installed.{" "}
            <Link
              to="/settings/plugins"
              className="font-medium underline underline-offset-4"
            >
              Return to the catalog
            </Link>
            .
          </MessagePanel>
        </>
      ) : pluginId ? (
        <>
          {renderMessages()}
          {!connectorError ? <MessagePanel>Loading plugin…</MessagePanel> : null}
          {connectorError ? (
            <Button variant="outline" onClick={() => void refreshConnectors()}>
              Retry loading plugins
            </Button>
          ) : null}
        </>
      ) : (
        <>
          {renderMessages()}
          <section className="settings-section">
            <div className="grid gap-3 md:grid-cols-2">
              {connectorGroups.map((group) => (
                <PluginCatalogCard
                  key={group.plugin.id}
                  pluginId={group.plugin.id}
                  name={group.plugin.displayName}
                  description={
                    group.plugin.description ??
                    "Configure this connector and sync imported work into backlog."
                  }
                  icon={<ConnectorPluginIcon plugin={group.plugin} />}
                  enabled={group.enabled}
                  disabled={
                    isMutatingConnector || group.plugin.entrypoint.length === 0
                  }
                  onEnabledChange={(enabled) =>
                    void handlePluginActivation(group, enabled)
                  }
                  metadata={
                    <>
                      <Badge variant="outline">
                        Version {group.plugin.version}
                      </Badge>
                      <Badge variant="outline">
                        {group.connections.length} connection
                        {group.connections.length === 1 ? "" : "s"}
                      </Badge>
                    </>
                  }
                />
              ))}
              <PluginCatalogCard
                pluginId={OUTLOOK_PLUGIN_ID}
                name="Outlook Calendar"
                description="Import calendar meetings into local review drafts before committing time."
                icon={<OutlookPluginIcon />}
                enabled={outlook.connected}
                disabled={isUpdatingOutlook || !outlook.configured}
                onEnabledChange={(enabled) =>
                  void handleOutlookActivation(enabled)
                }
                metadata={
                  <>
                    <Badge variant="outline">Built in</Badge>
                    <Badge variant="outline">
                      {state.outlookMeetingDrafts.length} meetings
                    </Badge>
                  </>
                }
              />
            </div>
            {connectors === null && !connectorError ? (
              <MessagePanel>Loading connector plugins…</MessagePanel>
            ) : null}
          </section>

          <p className="text-xs text-muted-foreground">
            Connector runtime: {getAppApiDescription()}
            {getAppApiDescription() !== getAppApiBaseUrl()
              ? ` · ${getAppApiBaseUrl()}`
              : ""}
            {!canInstallConnectorPlugins
              ? " · Packaged installation is available in the desktop app."
              : ""}
          </p>
        </>
      )}
      </PluginsHeader>
    </div>
  );
}
