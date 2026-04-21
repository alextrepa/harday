import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  buildBacklogStatusOptions,
  getBacklogStatusName,
} from "@/features/backlog/backlog-status";
import { getConnectorBacklogStatuses } from "@/lib/app-api";
import { useLocalState } from "@/lib/local-hooks";
import { localStore } from "@/lib/local-store";

export function SettingsBacklogPage() {
  const state = useLocalState();
  const [sourceStatuses, setSourceStatuses] = useState<
    Awaited<ReturnType<typeof getConnectorBacklogStatuses>>["items"]
  >([]);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [newStatusName, setNewStatusName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const backlogStatusOptions = useMemo(
    () => buildBacklogStatusOptions(state.backlogStatuses),
    [state.backlogStatuses],
  );
  const backlogStatusNameById = useMemo(
    () => new Map(state.backlogStatuses.map((status) => [status._id, status.name] as const)),
    [state.backlogStatuses],
  );
  const mappingByKey = useMemo(
    () =>
      new Map(
        state.backlogStatusMappings.map((mapping) => [
          `${mapping.source}:${mapping.connectionId}:${mapping.sourceStatusKey}`,
          mapping.backlogStatusId,
        ]),
      ),
    [state.backlogStatusMappings],
  );

  const groupedSourceStatuses = useMemo(() => {
    const groups = new Map<
      string,
      {
        tenantLabel: string;
        connectionId: string;
        connectionLabel: string;
        statuses: typeof sourceStatuses;
      }
    >();

    for (const status of sourceStatuses) {
      const groupKey = `${status.tenantLabel}::${status.connectionId}`;
      const existing = groups.get(groupKey);
      if (existing) {
        existing.statuses.push(status);
        continue;
      }

      groups.set(groupKey, {
        tenantLabel: status.tenantLabel,
        connectionId: status.connectionId,
        connectionLabel: status.connectionLabel,
        statuses: [status],
      });
    }

    return Array.from(groups.values()).sort(
      (left, right) =>
        left.tenantLabel.localeCompare(right.tenantLabel) ||
        left.connectionLabel.localeCompare(right.connectionLabel),
    );
  }, [sourceStatuses]);

  useEffect(() => {
    setStatusDrafts((current) => {
      const nextDrafts = { ...current };
      for (const status of state.backlogStatuses) {
        if (!(status._id in nextDrafts)) {
          nextDrafts[status._id] = status.name;
        }
      }

      for (const key of Object.keys(nextDrafts)) {
        if (!state.backlogStatuses.some((status) => status._id === key)) {
          delete nextDrafts[key];
        }
      }

      return nextDrafts;
    });
  }, [state.backlogStatuses]);

  useEffect(() => {
    void refreshSourceStatuses();
  }, []);

  async function refreshSourceStatuses() {
    setIsRefreshing(true);
    try {
      const result = await getConnectorBacklogStatuses();
      setSourceStatuses(result.items);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load synced statuses.");
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleAddStatus() {
    try {
      localStore.addBacklogStatus(newStatusName);
      setNewStatusName("");
      setError(null);
      setMessage("Backlog status added.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to add backlog status.");
    }
  }

  function handleSaveStatus(statusId: string) {
    try {
      localStore.updateBacklogStatus(statusId, statusDrafts[statusId] ?? "");
      setError(null);
      setMessage("Backlog status updated.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update backlog status.");
    }
  }

  function handleDeleteStatus(statusId: string) {
    localStore.deleteBacklogStatus(statusId);
    setError(null);
    setMessage("Backlog status removed.");
  }

  function handleMappingChange(
    source: typeof sourceStatuses[number],
    backlogStatusId: string,
  ) {
    try {
      localStore.setBacklogStatusMapping({
        source: source.source,
        connectionId: source.connectionId,
        sourceStatusKey: source.key,
        backlogStatusId: backlogStatusId || undefined,
      });
      setError(null);
      setMessage(
        backlogStatusId
          ? `Mapped ${source.label} to ${getBacklogStatusName(backlogStatusId, backlogStatusNameById)}.`
          : `Cleared the mapping for ${source.label}.`,
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update status mapping.");
    }
  }

  return (
    <div className="settings-sections">
      <section className="settings-section">
        <h2 className="settings-section-title">Backlog Statuses</h2>
        <p className="settings-section-desc">
          Create the statuses the app should use in backlog, then map synced connector statuses onto them.
        </p>

        <div className="settings-panel space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{state.backlogStatuses.length} app statuses</Badge>
            <Badge className="bg-muted">{sourceStatuses.length} synced source statuses</Badge>
            <Badge className="bg-muted">{state.backlogStatusMappings.length} mappings</Badge>
          </div>

          <div className="backlog-settings-status-create">
            <Input
              value={newStatusName}
              onChange={(event) => setNewStatusName(event.target.value)}
              placeholder="Add an app status"
              autoComplete="off"
            />
            <Button onClick={handleAddStatus} disabled={newStatusName.trim().length === 0}>
              Add status
            </Button>
          </div>

          {state.backlogStatuses.length === 0 ? (
            <div className="message-panel">
              Create at least one app status before mapping synced connector statuses.
            </div>
          ) : (
            <div className="backlog-settings-status-list">
              {state.backlogStatuses.map((status) => (
                <div key={status._id} className="backlog-settings-status-row">
                  <Input
                    value={statusDrafts[status._id] ?? status.name}
                    onChange={(event) =>
                      setStatusDrafts((current) => ({
                        ...current,
                        [status._id]: event.target.value,
                      }))
                    }
                    autoComplete="off"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => handleSaveStatus(status._id)}
                    disabled={(statusDrafts[status._id] ?? status.name).trim().length === 0}
                  >
                    <Save className="h-3.5 w-3.5" />
                    Save
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => handleDeleteStatus(status._id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Synced Status Mapping</h2>
        <p className="settings-section-desc">
          Connector sync registers raw statuses first. Mapping them here controls which backlog status imported items display.
        </p>

        <div className="settings-panel space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" className="gap-1.5" disabled={isRefreshing} onClick={() => void refreshSourceStatuses()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh synced statuses
            </Button>
          </div>

          {groupedSourceStatuses.length === 0 ? (
            <div className="message-panel">
              No synced connector statuses yet. Run a connector sync first.
            </div>
          ) : (
            <div className="backlog-settings-source-groups">
              {groupedSourceStatuses.map((group) => (
                <section key={group.connectionId} className="backlog-settings-source-group">
                  <div className="backlog-settings-source-header">
                    <div className="backlog-settings-source-kicker">{group.tenantLabel}</div>
                    <div className="backlog-settings-source-title">{group.connectionLabel}</div>
                  </div>

                  <div className="backlog-settings-source-list">
                    {group.statuses.map((status) => {
                      const mappingKey = `${status.source}:${status.connectionId}:${status.key}`;
                      const mappedBacklogStatusId = mappingByKey.get(mappingKey) ?? "";

                      return (
                        <div key={mappingKey} className="backlog-settings-source-row">
                          <div>
                            <div className="backlog-settings-source-label">{status.label}</div>
                            <div className="backlog-settings-source-meta">
                              Last seen {new Date(status.lastSeenAt).toLocaleString()}
                            </div>
                          </div>

                          <SearchableSelect
                            value={mappedBacklogStatusId}
                            options={backlogStatusOptions}
                            onChange={(nextValue) => handleMappingChange(status, nextValue)}
                            placeholder={state.backlogStatuses.length > 0 ? "No mapping" : "Create app statuses first"}
                            clearLabel={state.backlogStatuses.length > 0 ? "No mapping" : undefined}
                            emptyMessage={
                              state.backlogStatuses.length > 0
                                ? "No matching app statuses"
                                : "Create app statuses first"
                            }
                            ariaLabel={`Map ${status.label} to an app backlog status`}
                            disabled={state.backlogStatuses.length === 0}
                            className="backlog-settings-source-select"
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {message ? <div className="message-panel">{message}</div> : null}
        {error ? <div className="message-panel message-panel-warning">{error}</div> : null}
      </section>
    </div>
  );
}
