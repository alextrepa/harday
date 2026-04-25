import React, { useEffect, useMemo, useState } from "react";
import {
  RiAddLine as Plus,
  RiCheckLine as Check,
  RiCloseLine as X,
  RiDeleteBinLine as Trash2,
  RiPlayLine as Play,
} from "@remixicon/react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { formatDurationHoursInput, normalizeHoursInput, parseHoursInput } from "@/features/timer/hours-input";
import type { LocalTimesheetEntry } from "@/lib/local-store";
import { localStore } from "@/lib/local-store";
import { cn } from "@/lib/utils";
import { useLocalProjects, useLocalState } from "@/lib/local-hooks";

const DESKTOP_ENTRY_MEDIA_QUERY = "(min-width: 641px)";

function formatEntryHours(durationMs: number) {
  const totalMinutes = Math.max(0, Math.round(durationMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

interface RunningEntryRow {
  _id: string;
  localDate: string;
  projectId?: string;
  taskId?: string;
  note?: string;
  durationMs: number;
  committedAt: number;
  isRunning: true;
  timerId: string;
  entryId?: string;
}

function isRunningEntry(entry: LocalTimesheetEntry | RunningEntryRow): entry is RunningEntryRow {
  return "isRunning" in entry && entry.isRunning;
}

export function TimerPanel({
  date,
  onOpenEntry,
}: {
  date: string;
  onOpenEntry?: (target: { entryId?: string; timerId?: string }) => void;
}) {
  const state = useLocalState();
  const projects = useLocalProjects();
  const [now, setNow] = useState(() => Date.now());
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState("");
  const [expandedTaskId, setExpandedTaskId] = useState("");
  const [expandedNote, setExpandedNote] = useState("");
  const [expandedDurationHours, setExpandedDurationHours] = useState("");
  const [isCreatingEntry, setIsCreatingEntry] = useState(false);
  const [newProjectId, setNewProjectId] = useState("");
  const [newTaskId, setNewTaskId] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newDurationHours, setNewDurationHours] = useState("");
  const [pendingDeleteEntryId, setPendingDeleteEntryId] = useState<string | null>(null);

  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({
        value: project._id,
        label: project.code ? `[${project.code}] ${project.name}` : project.name,
        keywords: [project.name, project.code ?? ""],
      })),
    [projects],
  );
  const currentTimer = state.timers[0] ?? null;
  const expandedEntry =
    expandedEntryId
      ? state.timesheetEntries.find((entry) => entry._id === expandedEntryId && entry.localDate === date) ?? null
      : null;
  const runningEntry = useMemo<RunningEntryRow | null>(() => {
    if (!currentTimer || currentTimer.localDate !== date) {
      return null;
    }

    return {
      _id: currentTimer.entryId ?? `running-${currentTimer._id}`,
      localDate: currentTimer.localDate,
      projectId: currentTimer.projectId,
      taskId: currentTimer.taskId,
      note: currentTimer.note,
      durationMs: currentTimer.accumulatedDurationMs + Math.max(0, now - currentTimer.startedAt),
      committedAt: currentTimer.startedAt,
      isRunning: true,
      timerId: currentTimer._id,
      entryId: currentTimer.entryId,
    };
  }, [currentTimer, date, now]);
  const expandedAvailableTasks = useMemo(
    () =>
      projects
        .find((project) => project._id === expandedProjectId)
        ?.tasks.filter((task) => task.status === "active") ?? [],
    [expandedProjectId, projects],
  );
  const expandedTaskOptions = useMemo(
    () =>
      expandedAvailableTasks.map((task) => ({
        value: task._id,
        label: task.name,
      })),
    [expandedAvailableTasks],
  );
  const expandedParsedDurationMs = useMemo(() => parseHoursInput(expandedDurationHours), [expandedDurationHours]);
  const expandedOriginalDurationHours = useMemo(
    () => (expandedEntry ? formatDurationHoursInput(expandedEntry.durationMs) : ""),
    [expandedEntry],
  );
  const hasExpandedTimeChanged = Boolean(expandedEntry && expandedDurationHours !== expandedOriginalDurationHours);
  const expandedDurationError = !hasExpandedTimeChanged
    ? null
    : expandedParsedDurationMs === null
      ? "Enter a valid duration"
      : expandedParsedDurationMs <= 0
        ? "Enter a positive duration"
        : null;
  const newAvailableTasks = useMemo(
    () =>
      projects
        .find((project) => project._id === newProjectId)
        ?.tasks.filter((task) => task.status === "active") ?? [],
    [newProjectId, projects],
  );
  const newTaskOptions = useMemo(
    () =>
      newAvailableTasks.map((task) => ({
        value: task._id,
        label: task.name,
      })),
    [newAvailableTasks],
  );
  const newParsedDurationMs = useMemo(() => parseHoursInput(newDurationHours), [newDurationHours]);
  const newDurationError = useMemo(
    () => (newDurationHours.trim() !== "" && newParsedDurationMs === null ? "Enter a valid duration" : null),
    [newDurationHours, newParsedDurationMs],
  );
  const hasNewEntryContent = Boolean(newProjectId || newTaskId || newNote.trim() || newDurationHours.trim());
  const showNewTimeActions = newDurationHours.trim() !== "";

  const recentEntries = useMemo(
    () =>
      state.timesheetEntries
        .filter((entry) => entry.localDate === date)
        .sort((left, right) => right.committedAt - left.committedAt),
    [date, state.timesheetEntries],
  );
  const visibleEntries = useMemo(() => {
    const filteredEntries = runningEntry?.isRunning && currentTimer?.entryId
      ? recentEntries.filter((entry) => entry._id !== currentTimer.entryId)
      : recentEntries;

    return runningEntry ? [runningEntry, ...filteredEntries] : filteredEntries;
  }, [currentTimer?.entryId, recentEntries, runningEntry]);

  useEffect(() => {
    if (!runningEntry) {
      return;
    }

    setNow(Date.now());
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [runningEntry]);

  useEffect(() => {
    if (!expandedEntryId) {
      return;
    }

    if (!expandedEntry) {
      resetExpandedEntry();
    }
  }, [expandedEntry, expandedEntryId]);

  useEffect(() => {
    if (!expandedEntry || !expandedProjectId) {
      return;
    }

    if (expandedAvailableTasks.some((task) => task._id === expandedTaskId)) {
      return;
    }

    setExpandedTaskId("");
  }, [expandedAvailableTasks, expandedEntry, expandedProjectId, expandedTaskId]);

  useEffect(() => {
    if (!isCreatingEntry || !newProjectId) {
      return;
    }

    if (newAvailableTasks.some((task) => task._id === newTaskId)) {
      return;
    }

    setNewTaskId("");
  }, [isCreatingEntry, newAvailableTasks, newProjectId, newTaskId]);

  useEffect(() => {
    if (!pendingDeleteEntryId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPendingDeleteEntryId((current) => (current === pendingDeleteEntryId ? null : current));
    }, 2500);

    return () => window.clearTimeout(timeoutId);
  }, [pendingDeleteEntryId]);

  function resetExpandedEntry() {
    setExpandedEntryId(null);
    setExpandedProjectId("");
    setExpandedTaskId("");
    setExpandedNote("");
    setExpandedDurationHours("");
    setPendingDeleteEntryId(null);
  }

  function resetNewEntry() {
    setIsCreatingEntry(false);
    setNewProjectId("");
    setNewTaskId("");
    setNewNote("");
    setNewDurationHours("");
  }

  function closeNewEntry() {
    if (newDurationHours.trim() !== "" && newParsedDurationMs === null) {
      return;
    }

    if (hasNewEntryContent) {
      localStore.saveManualTimeEntry({
        localDate: date,
        projectId: newProjectId || undefined,
        taskId: newTaskId || undefined,
        note: newNote.trim() || undefined,
        durationMs: newParsedDurationMs ?? 0,
      });
    }

    resetNewEntry();
  }

  function discardNewEntry() {
    resetNewEntry();
  }

  function persistExpandedMetadata(nextValues?: {
    projectId?: string;
    taskId?: string;
    note?: string;
  }) {
    if (!expandedEntry) {
      return;
    }

    const nextProjectId = (nextValues?.projectId ?? expandedProjectId) || undefined;
    const nextTaskId = (nextValues?.taskId ?? expandedTaskId) || undefined;
    const nextNote = (nextValues?.note ?? expandedNote).trim() || undefined;
    const hasMetadataChanges =
      nextProjectId !== expandedEntry.projectId ||
      nextTaskId !== expandedEntry.taskId ||
      nextNote !== expandedEntry.note;

    if (!hasMetadataChanges) {
      return;
    }

    localStore.updateTimesheetEntry(expandedEntry._id, {
      projectId: nextProjectId,
      taskId: nextTaskId,
      note: nextNote,
      durationMs: expandedEntry.durationMs,
    });
  }

  function persistExpandedDuration(nextDurationHours: string) {
    if (!expandedEntry) {
      return;
    }

    const nextDurationMs = parseHoursInput(nextDurationHours);
    if (nextDurationMs === null || nextDurationMs <= 0 || nextDurationMs === expandedEntry.durationMs) {
      return;
    }

    localStore.updateTimesheetEntry(expandedEntry._id, {
      projectId: expandedProjectId || undefined,
      taskId: expandedTaskId || undefined,
      note: expandedNote.trim() || undefined,
      durationMs: nextDurationMs,
    });
  }

  function closeExpandedEntry() {
    if (!expandedEntry) {
      resetExpandedEntry();
      return true;
    }

    if (expandedParsedDurationMs === null) {
      return false;
    }

    const nextProjectId = expandedProjectId || undefined;
    const nextTaskId = expandedTaskId || undefined;
    const nextNote = expandedNote.trim() || undefined;
    const hasChanges =
      nextProjectId !== expandedEntry.projectId ||
      nextTaskId !== expandedEntry.taskId ||
      nextNote !== expandedEntry.note ||
      expandedParsedDurationMs !== expandedEntry.durationMs;

    if (hasChanges) {
      localStore.updateTimesheetEntry(expandedEntry._id, {
        projectId: nextProjectId,
        taskId: nextTaskId,
        note: nextNote,
        durationMs: expandedParsedDurationMs,
      });
    }

    resetExpandedEntry();
    return true;
  }

  function discardExpandedEntry() {
    resetExpandedEntry();
  }

  function handleCreateToggle() {
    if (isCreatingEntry) {
      closeNewEntry();
      return;
    }

    if (expandedEntryId && !closeExpandedEntry()) {
      return;
    }

    if (typeof window !== "undefined" && !window.matchMedia(DESKTOP_ENTRY_MEDIA_QUERY).matches) {
      resetExpandedEntry();
      setPendingDeleteEntryId(null);
      onOpenEntry?.({});
      return;
    }

    setPendingDeleteEntryId(null);
    setIsCreatingEntry(true);
  }

  function handleToggleEntry(entry: LocalTimesheetEntry | RunningEntryRow) {
    setPendingDeleteEntryId(null);

    if (isCreatingEntry) {
      closeNewEntry();
    }

    if (isRunningEntry(entry)) {
      resetExpandedEntry();
      onOpenEntry?.({ entryId: entry.entryId, timerId: entry.timerId });
      return;
    }

    if (typeof window !== "undefined" && !window.matchMedia(DESKTOP_ENTRY_MEDIA_QUERY).matches) {
      resetExpandedEntry();
      onOpenEntry?.({ entryId: entry._id });
      return;
    }

    if (expandedEntryId === entry._id) {
      closeExpandedEntry();
      return;
    }

    if (expandedEntryId && !closeExpandedEntry()) {
      return;
    }

    setExpandedEntryId(entry._id);
    setExpandedProjectId(entry.projectId ?? "");
    setExpandedTaskId(entry.taskId ?? "");
    setExpandedNote(entry.note ?? "");
    setExpandedDurationHours(formatDurationHoursInput(entry.durationMs));
  }

  useEffect(() => {
    if (!isCreatingEntry) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        discardNewEntry();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isCreatingEntry]);

  useEffect(() => {
    if (!expandedEntryId) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        discardExpandedEntry();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [expandedEntryId]);

  function handleExpandedProjectChange(nextProjectId: string) {
    const nextTaskId = nextProjectId === expandedProjectId ? expandedTaskId : "";
    setExpandedProjectId(nextProjectId);
    setExpandedTaskId(nextTaskId);
    persistExpandedMetadata({
      projectId: nextProjectId,
      taskId: nextTaskId,
      note: expandedNote,
    });
  }

  function handleExpandedTaskChange(nextTaskId: string) {
    setExpandedTaskId(nextTaskId);
    persistExpandedMetadata({
      projectId: expandedProjectId,
      taskId: nextTaskId,
      note: expandedNote,
    });
  }

  function handleNewProjectChange(nextProjectId: string) {
    const nextTaskId =
      projects
        .find((project) => project._id === nextProjectId)
        ?.tasks.find((task) => task.status === "active")?._id ?? "";

    setNewProjectId(nextProjectId);
    setNewTaskId(nextTaskId);
  }

  function handleRestartEntry(entryId: string) {
    if (currentTimer) {
      return;
    }

    setPendingDeleteEntryId(null);
    resetExpandedEntry();
    localStore.restartTimesheetEntry(entryId);
  }

  function handleDeleteEntry(entryId: string) {
    if (pendingDeleteEntryId === entryId) {
      localStore.deleteTimesheetEntry(entryId);
      if (expandedEntryId === entryId) {
        resetExpandedEntry();
      } else {
        setPendingDeleteEntryId(null);
      }
      return;
    }

    setPendingDeleteEntryId(entryId);
  }

  return (
    <div className="space-y-3">
      <div className="entries-table-scroll-shell entries-table-scroll-shell-time">
        <table className="entries-table animate-in">
          <thead>
            <tr>
              <th className="entry-project-heading">Project</th>
              <th className="entry-notes-heading hidden lg:table-cell">Notes</th>
              <th className="entry-notes-heading lg:hidden">Entries</th>
              <th className="entry-hours-heading entry-hours-heading-create lg:hidden">
                <div className="flex justify-end">
                  <button
                    type="button"
                    className={cn("entries-header-add entries-header-bubble", isCreatingEntry && "is-open")}
                    aria-label={isCreatingEntry ? "Close new entry" : "Add new entry"}
                    onClick={handleCreateToggle}
                  >
                    <span className="entries-header-add-label">New entry</span>
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </th>
              <th className="entry-hours-heading entry-hours-heading-actions hidden lg:table-cell">
                <button
                  type="button"
                  className={cn("entries-header-add", isCreatingEntry && "is-open")}
                  aria-label={isCreatingEntry ? "Close new entry" : "Add new entry"}
                  onClick={handleCreateToggle}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="entries-table-scroll-region">
              {isCreatingEntry ? (
                <tr className="entry-edit-row" onClick={(event) => event.stopPropagation()}>
                  <td colSpan={3}>
                    <div className="entry-edit-dropdown entry-create-dropdown">
                      <div className="entry-edit-dropdown-grid">
                        <label className="field entry-field-span-2">
                          <span className="field-label">Project</span>
                          <SearchableSelect
                            value={newProjectId}
                            options={projectOptions}
                            onChange={handleNewProjectChange}
                            placeholder="No project"
                            clearLabel="No project"
                            emptyMessage="No matching projects"
                            ariaLabel="Project"
                          />
                        </label>

                        <label className="field entry-field-span-2">
                          <span className="field-label">Task</span>
                          <SearchableSelect
                            value={newTaskId}
                            options={newTaskOptions}
                            onChange={setNewTaskId}
                            placeholder={newProjectId ? "Select task" : "Pick a project first"}
                            clearLabel={newProjectId ? "No task" : undefined}
                            emptyMessage={newProjectId ? "No matching tasks" : "Pick a project first"}
                            ariaLabel="Task"
                            disabled={!newProjectId || newAvailableTasks.length === 0}
                          />
                        </label>

                        <label className="field entry-field-note">
                          <span className="field-label">Note</span>
                          <textarea
                            className="field-input entry-note-input"
                            value={newNote}
                            onChange={(event) => setNewNote(event.target.value)}
                            placeholder="Notes (optional)"
                            rows={2}
                          />
                        </label>

                        <label className="field entry-field-hours">
                          <span className="field-label">Hours</span>
                          <div className="inline-hours-input-shell">
                            <input
                              className="field-input entry-hours-input inline-hours-input"
                              type="text"
                              placeholder="01:30"
                              style={{ fontFamily: "var(--font-mono)" }}
                              value={newDurationHours}
                              onChange={(event) => setNewDurationHours(event.target.value)}
                              onBlur={(event) => setNewDurationHours(normalizeHoursInput(event.target.value))}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  closeNewEntry();
                                }
                              }}
                              aria-label="Hours"
                            />
                            {showNewTimeActions ? (
                              <div className="inline-hours-actions">
                                <button
                                  type="button"
                                  className="inline-hours-action"
                                  aria-label="Save and close new entry"
                                  disabled={Boolean(newDurationError)}
                                  onClick={closeNewEntry}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  className="inline-hours-action"
                                  aria-label="Discard new entry"
                                  onClick={discardNewEntry}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : null}
                          </div>
                          {newDurationError ? <span className="field-error">{newDurationError}</span> : null}
                        </label>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : null}

              {visibleEntries.length === 0 ? (
                <tr className="entry-empty-row">
                  <td colSpan={3}>
                    <div className="entry-table-empty">
                      Saved manual and timer-based entries for this day will appear here.
                    </div>
                  </td>
                </tr>
              ) : null}
              {visibleEntries.map((entry) => {
                const project = projects.find((item) => item._id === entry.projectId);
                const task = project?.tasks.find((item) => item._id === entry.taskId);
                const isRunning = "isRunning" in entry && entry.isRunning;
                const isExpanded = expandedEntry?._id === entry._id;
                const isDeletePending = pendingDeleteEntryId === entry._id;

                return (
                  <React.Fragment key={entry._id}>
                    <tr className={cn(isExpanded && "entry-row-expanded")} onClick={() => handleToggleEntry(entry)}>
                      <td className="entry-project-column">
                        <div className="entry-project-cell">
                          <span
                            className="entry-project-dot"
                            style={{ background: project?.color ?? "#3b82f6" }}
                          />
                          <span className="entry-project-name">
                            {project?.name ?? "No project"}
                          </span>
                        </div>
                      </td>
                      <td className="entry-notes-cell">
                        <div className="entry-notes-content">
                          <div className="entry-project-cell entry-project-cell-mobile">
                            <span
                              className="entry-project-dot"
                              style={{ background: project?.color ?? "#3b82f6" }}
                            />
                            <span className="entry-project-name">
                              {project?.name ?? "No project"}
                            </span>
                          </div>
                          {task?.name && <span className="entry-task-name">{task.name}</span>}
                          {entry.note && <span className="entry-note-text">{entry.note}</span>}
                          {"submittedAt" in entry && entry.submittedAt ? (
                            <span className="entry-submitted-status">submitted</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="entry-hours-cell">
                        <div className="entry-hours-content">
                          {isRunning ? (
                            <span className="stat-pill stat-pill-active entry-running-pill">
                              <span className="status-dot status-dot-pulse" />
                              <span className="stat-pill-value">{formatEntryHours(entry.durationMs)}</span>
                            </span>
                          ) : (
                            <div className={cn("entry-row-actions", isDeletePending && "is-confirming")}>
                              <button
                                type="button"
                                className="entry-row-action entry-row-action-play"
                                aria-label="Restart entry"
                                disabled={Boolean(currentTimer)}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleRestartEntry(entry._id);
                                }}
                              >
                                <Play className="h-3.5 w-3.5" />
                              </button>
                              <span className="entry-row-action-slot">
                                <button
                                  type="button"
                                  className={cn("entry-row-action", "entry-row-action-delete", isDeletePending && "is-confirming")}
                                  aria-label={isDeletePending ? "Confirm delete entry" : "Delete entry"}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleDeleteEntry(entry._id);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  {isDeletePending ? <span>Confirm</span> : null}
                                </button>
                              </span>
                            </div>
                          )}
                          {isRunning ? null : <span className="hours-badge">{formatEntryHours(entry.durationMs)}</span>}
                        </div>
                      </td>
                    </tr>
                    {!isRunning && isExpanded && expandedEntry ? (
                      <tr className="entry-edit-row" onClick={(e) => e.stopPropagation()}>
                        <td colSpan={3}>
                          <div className="entry-edit-dropdown">
                            <div className="entry-edit-dropdown-grid">
                              {/* Project */}
                              <label className="field entry-field-span-2">
                                <span className="field-label">Project</span>
                                <SearchableSelect
                                  value={expandedProjectId}
                                  options={projectOptions}
                                  onChange={handleExpandedProjectChange}
                                  placeholder="No project"
                                  clearLabel="No project"
                                  emptyMessage="No matching projects"
                                  ariaLabel="Project"
                                />
                              </label>

                              {/* Task */}
                              <label className="field entry-field-span-2">
                                <span className="field-label">Task</span>
                                <SearchableSelect
                                  value={expandedTaskId}
                                  options={expandedTaskOptions}
                                  onChange={handleExpandedTaskChange}
                                  placeholder={expandedProjectId ? "Select task" : "Pick a project first"}
                                  clearLabel={expandedProjectId ? "No task" : undefined}
                                  emptyMessage={expandedProjectId ? "No matching tasks" : "Pick a project first"}
                                  ariaLabel="Task"
                                  disabled={!expandedProjectId || expandedAvailableTasks.length === 0}
                                />
                              </label>

                              {/* Note */}
                              <label className="field entry-field-note">
                                <span className="field-label">Note</span>
                                <textarea
                                  className="field-input entry-note-input"
                                  value={expandedNote}
                                  onChange={(event) => setExpandedNote(event.target.value)}
                                  onBlur={(event) => {
                                    const nextNote = event.target.value.trim();
                                    setExpandedNote(nextNote);
                                    persistExpandedMetadata({ note: nextNote });
                                  }}
                                  placeholder="Notes (optional)"
                                  rows={2}
                                />
                              </label>

                              {/* Hours */}
                              <label className="field entry-field-hours">
                                <span className="field-label">Hours</span>
                                <div className="inline-hours-input-shell">
                                  <input
                                    className="field-input entry-hours-input inline-hours-input"
                                    type="text"
                                    placeholder="01:30"
                                    style={{ fontFamily: "var(--font-mono)" }}
                                    value={expandedDurationHours}
                                    onChange={(event) => setExpandedDurationHours(event.target.value)}
                                    onBlur={(event) => {
                                      const normalizedValue = normalizeHoursInput(event.target.value);
                                      setExpandedDurationHours(normalizedValue);
                                      const nextTarget = event.relatedTarget;
                                      if (nextTarget instanceof HTMLElement && nextTarget.closest(".inline-hours-actions")) {
                                        return;
                                      }

                                      persistExpandedDuration(normalizedValue);
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        closeExpandedEntry();
                                      }
                                    }}
                                    aria-label="Hours"
                                  />
                                  {hasExpandedTimeChanged ? (
                                    <div className="inline-hours-actions">
                                      <button
                                        type="button"
                                        className="inline-hours-action"
                                        aria-label="Save and close entry"
                                        disabled={Boolean(expandedDurationError)}
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={closeExpandedEntry}
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        className="inline-hours-action"
                                        aria-label="Cancel entry changes"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={discardExpandedEntry}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                                {expandedDurationError ? <span className="field-error">{expandedDurationError}</span> : null}
                              </label>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
