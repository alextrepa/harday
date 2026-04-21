import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArrowLeft, Download, FolderPlus, Pencil, Plus, RotateCcw, Save, X } from "lucide-react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  extractTaskNamesFromWorkbook,
  type ProjectTaskImportResult,
} from "@/features/projects/project-task-import";
import { useCurrentTeam } from "@/lib/session";
import { useLocalState } from "@/lib/local-hooks";
import { localStore, type LocalProject } from "@/lib/local-store";
import { cn } from "@/lib/utils";

type ProjectMetrics = {
  durationMs: number;
  entryCount: number;
};

type TaskMetricsByProject = Map<string, Map<string, ProjectMetrics>>;

type ProjectDraft = {
  name: string;
  code: string;
  color: string;
};

type ProjectModalState =
  | { mode: "create" }
  | { mode: "edit"; projectId: string };

const defaultProjectDraft: ProjectDraft = {
  name: "",
  code: "",
  color: "#1f7667",
};

const TASK_DRAG_MOUSE_DELAY_MS = 180;
const TASK_DRAG_TOUCH_DELAY_MS = 260;
const TASK_DRAG_MOUSE_TOLERANCE_PX = 6;
const TASK_DRAG_TOUCH_TOLERANCE_PX = 12;

type TaskDragState = {
  taskId: string;
  pointerId: number;
  originIndex: number;
  targetIndex: number;
  pointerX: number;
  pointerY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

type PendingTaskPointerSession = {
  pointerId: number;
  timeoutId: number;
  removeListeners: () => void;
};

function formatTrackedDuration(durationMs: number) {
  const totalMinutes = Math.max(0, Math.round(durationMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

function hoursLabel(durationMs: number) {
  return `${new Intl.NumberFormat("en-CA", {
    minimumFractionDigits: durationMs % 3600000 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(durationMs / 3600000)} h`;
}

function taskSummary(project: LocalProject) {
  const active = project.tasks.filter((task) => task.status === "active").length;
  const archived = project.tasks.length - active;

  return { active, archived };
}

function formatImportSummary(result: ProjectTaskImportResult) {
  const skipped: string[] = [];

  if (result.duplicateCount > 0) {
    skipped.push(`${result.duplicateCount} ${result.duplicateCount === 1 ? "duplicate" : "duplicates"}`);
  }

  if (result.blankCount > 0) {
    skipped.push(`${result.blankCount} ${result.blankCount === 1 ? "blank cell" : "blank cells"}`);
  }

  if (result.headerCount > 0) {
    skipped.push(`${result.headerCount} ${result.headerCount === 1 ? "header row" : "header rows"}`);
  }

  const importedLabel = `${result.importedCount} ${result.importedCount === 1 ? "task" : "tasks"}`;
  return skipped.length > 0
    ? `Imported ${importedLabel}. Skipped ${skipped.join(", ")}.`
    : `Imported ${importedLabel}.`;
}

function getTaskDragDelay(pointerType: string) {
  return pointerType === "touch" ? TASK_DRAG_TOUCH_DELAY_MS : TASK_DRAG_MOUSE_DELAY_MS;
}

function getTaskDragTolerance(pointerType: string) {
  return pointerType === "touch" ? TASK_DRAG_TOUCH_TOLERANCE_PX : TASK_DRAG_MOUSE_TOLERANCE_PX;
}

function isTaskDragBlockedTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? Boolean(target.closest("button, input, textarea, select, option, a, [data-no-task-drag='true']"))
    : false;
}

function getTaskDragTargetIndex(
  taskIds: string[],
  sourceTaskId: string,
  pointerY: number,
  rowRefs: Map<string, HTMLTableRowElement>,
) {
  let nextIndex = 0;

  for (const taskId of taskIds) {
    if (taskId === sourceTaskId) {
      continue;
    }

    const row = rowRefs.get(taskId);
    if (!row) {
      continue;
    }

    const rect = row.getBoundingClientRect();
    if (pointerY >= rect.top + rect.height / 2) {
      nextIndex += 1;
    }
  }

  return nextIndex;
}

/* ── Project detail content ───────────────────────────────────────── */

function ProjectFormModal({
  draft,
  mode,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: ProjectDraft;
  mode: ProjectModalState["mode"];
  onChange: React.Dispatch<React.SetStateAction<ProjectDraft>>;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const title = mode === "create" ? "Create project" : "Edit project";
  const submitLabel = mode === "create" ? "Create project" : "Save changes";

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (overlayRef.current === event.target) {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div ref={overlayRef} className="time-entry-modal-overlay">
      <div
        className="time-entry-modal project-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-form-modal-title"
      >
        <div className="time-entry-modal-header">
          <div className="space-y-1">
            <span id="project-form-modal-title" className="time-entry-modal-title">
              {title}
            </span>
            <p className="project-form-modal-copy">
              Add the project label, short code, and sidebar color.
            </p>
          </div>
          <button
            type="button"
            className="time-entry-modal-close"
            aria-label="Close project form"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="project-form-modal-fields">
          <Input
            autoFocus
            placeholder="Project name"
            value={draft.name}
            onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))}
          />
          <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
            <Input
              placeholder="Code"
              value={draft.code}
              onChange={(event) => onChange((current) => ({ ...current, code: event.target.value }))}
            />
            <Input
              aria-label="Project color"
              type="color"
              value={draft.color}
              onChange={(event) => onChange((current) => ({ ...current, color: event.target.value }))}
            />
          </div>
        </div>

        <div className="time-entry-modal-actions project-form-modal-actions">
          <Button className="gap-2" disabled={!draft.name.trim()} onClick={onSubmit}>
            {mode === "create" ? <FolderPlus className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {submitLabel}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProjectDetail({
  project,
  metrics,
  taskMetrics,
  onEditProject,
}: {
  project: LocalProject;
  metrics: ProjectMetrics;
  taskMetrics: Map<string, ProjectMetrics>;
  onEditProject: (project: LocalProject) => void;
}) {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const taskRowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const taskPointerSessionRef = useRef<PendingTaskPointerSession | null>(null);
  const taskDragStateRef = useRef<TaskDragState | null>(null);
  const suppressTaskClickUntilRef = useRef(0);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskDraft, setTaskDraft] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskName, setEditingTaskName] = useState("");
  const [pendingArchiveTaskId, setPendingArchiveTaskId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pressedTaskId, setPressedTaskId] = useState<string | null>(null);
  const [taskDragState, setTaskDragState] = useState<TaskDragState | null>(null);
  const isArchived = project.status === "archived";

  const summary = taskSummary(project);
  const activeTasks = project.tasks.filter((task) => task.status === "active");
  const activeTaskIds = useMemo(() => activeTasks.map((task) => task._id), [activeTasks]);
  const archivedTasks = project.tasks.filter((task) => task.status === "archived");
  const stats = [
    { label: "Tracked", value: hoursLabel(metrics.durationMs) },
    { label: "Entries", value: `${metrics.entryCount}` },
    { label: "Active", value: `${summary.active}` },
    { label: "Archived", value: `${summary.archived}` },
  ];
  const draggedTask = useMemo(
    () => (taskDragState ? activeTasks.find((task) => task._id === taskDragState.taskId) ?? null : null),
    [activeTasks, taskDragState],
  );
  const canReorderTasks = !isArchived && !showTaskForm && !editingTaskId && activeTasks.length > 1;

  useEffect(() => {
    setShowTaskForm(false);
    setTaskDraft("");
    setEditingTaskId(null);
    setPendingArchiveTaskId(null);
    setImportMessage(null);
    setImportError(null);
    if (importInputRef.current) {
      importInputRef.current.value = "";
    }
  }, [project._id, project.status]);

  useEffect(() => {
    if (!pendingArchiveTaskId) return;
    const timeoutId = window.setTimeout(() => {
      setPendingArchiveTaskId((current) => (current === pendingArchiveTaskId ? null : current));
    }, 2500);
    return () => window.clearTimeout(timeoutId);
  }, [pendingArchiveTaskId]);

  useEffect(() => {
    taskDragStateRef.current = taskDragState;
  }, [taskDragState]);

  const clearTaskPointerSession = useCallback(() => {
    const session = taskPointerSessionRef.current;
    if (!session) {
      return;
    }

    window.clearTimeout(session.timeoutId);
    session.removeListeners();
    taskPointerSessionRef.current = null;
  }, []);

  const resetTaskDragVisuals = useCallback(() => {
    document.body.classList.remove("project-task-drag-active");
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
  }, []);

  const finishTaskDrag = useCallback(
    (shouldCommit: boolean) => {
      const currentDrag = taskDragStateRef.current;
      if (!currentDrag) {
        setPressedTaskId(null);
        resetTaskDragVisuals();
        return;
      }

      if (shouldCommit && currentDrag.originIndex !== currentDrag.targetIndex) {
        localStore.reorderProjectTask(project._id, currentDrag.taskId, currentDrag.targetIndex);
      }

      suppressTaskClickUntilRef.current = performance.now() + 250;
      taskDragStateRef.current = null;
      setTaskDragState(null);
      setPressedTaskId(null);
      resetTaskDragVisuals();
    },
    [project._id, resetTaskDragVisuals],
  );

  useEffect(() => {
    return () => {
      clearTaskPointerSession();
      taskDragStateRef.current = null;
      resetTaskDragVisuals();
    };
  }, [clearTaskPointerSession, resetTaskDragVisuals]);

  useEffect(() => {
    clearTaskPointerSession();
    taskDragStateRef.current = null;
    setPressedTaskId(null);
    setTaskDragState(null);
    resetTaskDragVisuals();
  }, [project._id, project.status, clearTaskPointerSession, resetTaskDragVisuals]);

  const handleTaskImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isArchived) {
      event.target.value = "";
      return;
    }

    const file = event.target.files?.[0];
    setImportMessage(null);
    setImportError(null);

    if (!file) return;

    setIsImporting(true);
    try {
      const workbook = extractTaskNamesFromWorkbook(await file.arrayBuffer());
      if (workbook.taskNames.length === 0) {
        throw new Error("No usable task names were found in column C of the first worksheet.");
      }
      const importResult = localStore.importProjectTasks(project._id, workbook.taskNames);
      setImportMessage(
        formatImportSummary({
          ...importResult,
          blankCount: workbook.blankCount,
          headerCount: workbook.headerCount,
        }),
      );
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Unable to import tasks from this Excel file.");
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  };

  function handleArchiveTask(taskId: string) {
    if (isArchived) return;
    if (pendingArchiveTaskId === taskId) {
      localStore.archiveProjectTask(project._id, taskId);
      setPendingArchiveTaskId(null);
      return;
    }
    setPendingArchiveTaskId(taskId);
  }

  function handleTaskClick(taskId: string, taskName: string) {
    if (isArchived) return;
    if (performance.now() < suppressTaskClickUntilRef.current) return;
    if (editingTaskId === taskId) return;
    setPendingArchiveTaskId(null);
    setEditingTaskId(taskId);
    setEditingTaskName(taskName);
  }

  function commitTaskRename() {
    if (!editingTaskId) return;
    const trimmed = editingTaskName.trim();
    if (trimmed && trimmed !== project.tasks.find((t) => t._id === editingTaskId)?.name) {
      localStore.renameProjectTask(project._id, editingTaskId, trimmed);
    }
    setEditingTaskId(null);
    setEditingTaskName("");
  }

  function handleTaskPointerDown(taskId: string, event: React.PointerEvent<HTMLTableRowElement>) {
    if (!canReorderTasks || event.button !== 0 || isTaskDragBlockedTarget(event.target)) {
      return;
    }

    const sourceIndex = activeTaskIds.indexOf(taskId);
    if (sourceIndex === -1) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    clearTaskPointerSession();
    setPressedTaskId(taskId);

    const { clientX, clientY, pointerId, pointerType } = event;
    const delay = getTaskDragDelay(pointerType);
    const tolerance = getTaskDragTolerance(pointerType);

    const startDrag = () => {
      const row = taskRowRefs.current.get(taskId);
      if (!row) {
        setPressedTaskId(null);
        return;
      }

      const rect = row.getBoundingClientRect();
      document.body.classList.add("project-task-drag-active");
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
      suppressTaskClickUntilRef.current = performance.now() + 250;
      setPressedTaskId(null);
      setPendingArchiveTaskId(null);
      setTaskDragState({
        taskId,
        pointerId,
        originIndex: sourceIndex,
        targetIndex: sourceIndex,
        pointerX: clientX,
        pointerY: clientY,
        offsetX: clientX - rect.left,
        offsetY: clientY - rect.top,
        width: rect.width,
        height: rect.height,
      });
    };

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) {
        return;
      }

      const currentDrag = taskDragStateRef.current;
      if (currentDrag?.pointerId === pointerId) {
        pointerEvent.preventDefault();
        setTaskDragState((current) =>
          current
            ? {
                ...current,
                pointerX: pointerEvent.clientX,
                pointerY: pointerEvent.clientY,
                targetIndex: getTaskDragTargetIndex(
                  activeTaskIds,
                  current.taskId,
                  pointerEvent.clientY,
                  taskRowRefs.current,
                ),
              }
            : current,
        );
        return;
      }

      if (Math.hypot(pointerEvent.clientX - clientX, pointerEvent.clientY - clientY) > tolerance) {
        clearTaskPointerSession();
        setPressedTaskId(null);
      }
    };

    const handlePointerEnd = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) {
        return;
      }

      const wasDragging = taskDragStateRef.current?.pointerId === pointerId;
      clearTaskPointerSession();

      if (wasDragging) {
        pointerEvent.preventDefault();
        finishTaskDrag(pointerEvent.type !== "pointercancel");
        return;
      }

      setPressedTaskId(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    taskPointerSessionRef.current = {
      pointerId,
      timeoutId: window.setTimeout(startDrag, delay),
      removeListeners: () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerEnd);
        window.removeEventListener("pointercancel", handlePointerEnd);
      },
    };
  }

  return (
    <div className="space-y-6">
      {/* Project header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span
              className="h-3 w-3 rounded-full border border-black/10"
              style={{ backgroundColor: project.color }}
            />
            <h2 className="text-[15px] font-semibold">{project.name}</h2>
            {project.code ? <Badge>{project.code}</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isArchived ? (
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              aria-label="Edit project"
              title="Edit project"
              onClick={() => onEditProject(project)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            aria-label={isArchived ? "Restore project" : "Archive project"}
            title={isArchived ? "Restore project" : "Archive project"}
            onClick={() =>
              isArchived
                ? localStore.unarchiveProject(project._id)
                : localStore.archiveProject(project._id)
            }
          >
            {isArchived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Stat pills */}
      <div className="flex flex-wrap gap-2">
        {stats.map((stat) => (
          <Badge key={stat.label} className="rounded-md px-3 py-1.5 text-xs text-foreground">
            <span className="font-mono text-[13px] font-semibold text-foreground">{stat.value}</span>
            <span className="text-foreground/55">{stat.label}</span>
          </Badge>
        ))}
      </div>

      {isArchived ? (
        <div className="message-panel border border-[var(--border)] bg-muted/60 text-foreground">
          This project is archived. You can consult it here, but project and task changes are disabled until
          you restore it.
        </div>
      ) : null}

      {/* Import messages */}
      {importMessage ? (
        <div className="message-panel border border-[var(--success-muted)] bg-[var(--success-muted)] text-foreground">
          {importMessage}
        </div>
      ) : null}
      {importError ? (
        <div className="message-panel message-panel-warning border border-[var(--danger-muted)] text-foreground">
          {importError}
        </div>
      ) : null}

      {/* Active tasks table */}
      <table className={cn("entries-table project-tasks-table animate-in", taskDragState && "is-task-dragging")}>
        <thead>
          <tr>
            <th>Task</th>
            <th className="entry-hours-heading entry-hours-heading-actions">
              {!isArchived ? (
                <div className="flex items-center justify-end gap-1">
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".xlsx,.xls,.xlsm"
                    className="hidden"
                    onChange={(event) => { void handleTaskImport(event); }}
                  />
                  <button
                    type="button"
                    className="entries-header-add"
                    aria-label={isImporting ? "Importing tasks" : "Import tasks from Excel"}
                    title={isImporting ? "Importing tasks" : "Import tasks from Excel"}
                    disabled={isImporting}
                    onClick={() => importInputRef.current?.click()}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className={cn("entries-header-add entries-header-bubble", showTaskForm && "is-open")}
                    aria-label={showTaskForm ? "Cancel new task" : "Add task"}
                    onClick={() => {
                      setShowTaskForm((c) => !c);
                      setTaskDraft("");
                    }}
                  >
                    <span className="entries-header-add-label">New task</span>
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
            </th>
          </tr>
        </thead>
        <tbody>
          {showTaskForm ? (
            <tr className="entry-edit-row" onClick={(e) => e.stopPropagation()}>
              <td colSpan={2}>
                <div className="entry-edit-dropdown entry-create-dropdown">
                  <div className="entry-edit-dropdown-grid">
                    <label className="field entry-field-span-2">
                      <span className="field-label">Task name</span>
                      <input
                        autoFocus
                        className="field-input"
                        value={taskDraft}
                        onChange={(e) => setTaskDraft(e.target.value)}
                        placeholder="New task name"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && taskDraft.trim()) {
                            e.preventDefault();
                            localStore.addProjectTask(project._id, taskDraft.trim());
                            setTaskDraft("");
                            setShowTaskForm(false);
                          }
                          if (e.key === "Escape") {
                            setShowTaskForm(false);
                            setTaskDraft("");
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </td>
            </tr>
          ) : null}

          {activeTasks.length === 0 && !showTaskForm ? (
            <tr className="entry-empty-row">
              <td colSpan={2}>
                <div className="entry-table-empty">
                  {isArchived
                    ? "No active tasks in this archived project."
                    : "No active tasks yet. Add one with the + button above."}
                </div>
              </td>
            </tr>
          ) : null}

          {activeTasks.map((task, index) => {
            const isEditing = editingTaskId === task._id;
            const isArchivePending = pendingArchiveTaskId === task._id;
            const trackedMetrics = taskMetrics.get(task._id) ?? { durationMs: 0, entryCount: 0 };
            const isDraggedTask = taskDragState?.taskId === task._id;
            const rowShift = taskDragState
              ? taskDragState.originIndex < taskDragState.targetIndex
                ? index > taskDragState.originIndex && index <= taskDragState.targetIndex
                  ? -taskDragState.height
                  : 0
                : taskDragState.originIndex > taskDragState.targetIndex
                  ? index >= taskDragState.targetIndex && index < taskDragState.originIndex
                    ? taskDragState.height
                    : 0
                  : 0
              : 0;

            return isEditing ? (
              <tr key={task._id} className="entry-edit-row" onClick={(e) => e.stopPropagation()}>
                <td colSpan={2}>
                  <div className="entry-edit-dropdown">
                    <div className="entry-edit-dropdown-grid">
                      <label className="field entry-field-span-2">
                        <span className="field-label">Task name</span>
                        <input
                          autoFocus
                          className="field-input"
                          value={editingTaskName}
                          onChange={(e) => setEditingTaskName(e.target.value)}
                          onBlur={commitTaskRename}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitTaskRename();
                            }
                            if (e.key === "Escape") {
                              setEditingTaskId(null);
                              setEditingTaskName("");
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              <tr
                key={task._id}
                ref={(node) => {
                  if (node) {
                    taskRowRefs.current.set(task._id, node);
                    return;
                  }

                  taskRowRefs.current.delete(task._id);
                }}
                className={cn(
                  "project-task-row",
                  canReorderTasks && "is-reorderable",
                  pressedTaskId === task._id && "is-pressing",
                  rowShift !== 0 && "is-shifting",
                  isDraggedTask && "is-drag-source",
                )}
                style={rowShift !== 0 ? { transform: `translate3d(0, ${rowShift}px, 0)` } : undefined}
                aria-grabbed={isDraggedTask}
                onClick={() => handleTaskClick(task._id, task.name)}
                onPointerDown={(event) => handleTaskPointerDown(task._id, event)}
              >
                <td>
                  <div className="project-task-name-cell">
                    <span className="project-task-name">{task.name}</span>
                  </div>
                </td>
                <td className="entry-hours-cell">
                  <div className="entry-hours-content">
                    {!isArchived ? (
                      <div className={cn("entry-row-actions", isArchivePending && "is-confirming")}>
                        <span className="entry-row-action-slot">
                          <button
                            type="button"
                            className={cn(
                              "entry-row-action",
                              "entry-row-action-delete",
                              isArchivePending && "is-confirming",
                            )}
                            aria-label={isArchivePending ? "Confirm archive" : "Archive task"}
                            data-no-task-drag="true"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArchiveTask(task._id);
                            }}
                          >
                            <Archive className="h-3.5 w-3.5" />
                            {isArchivePending ? <span>Confirm</span> : null}
                          </button>
                        </span>
                      </div>
                    ) : null}
                    <span className="hours-badge">
                      {formatTrackedDuration(trackedMetrics.durationMs)}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {draggedTask && taskDragState ? (
        <div
          className="project-task-drag-preview"
          style={{
            width: taskDragState.width,
            minHeight: taskDragState.height,
            transform: `translate3d(${Math.round(taskDragState.pointerX - taskDragState.offsetX)}px, ${Math.round(taskDragState.pointerY - taskDragState.offsetY)}px, 0)`,
          }}
        >
          <div className="project-task-name-cell">
            <span className="project-task-name">{draggedTask.name}</span>
          </div>
          <span className="hours-badge">
            {formatTrackedDuration((taskMetrics.get(draggedTask._id) ?? { durationMs: 0 }).durationMs)}
          </span>
        </div>
      ) : null}

      {/* Archived tasks */}
      {archivedTasks.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">
            Archived ({archivedTasks.length})
          </p>
          <div className="space-y-1">
            {archivedTasks.map((task) => {
              const trackedMetrics = taskMetrics.get(task._id) ?? { durationMs: 0, entryCount: 0 };

              return (
                <div
                  key={task._id}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-[13px] text-foreground/50"
                >
                  <span>{task.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-foreground/45">
                      {formatTrackedDuration(trackedMetrics.durationMs)}
                    </span>
                    <Badge className="bg-muted text-foreground/50">Archived</Badge>
                    {!isArchived ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-7 gap-1 px-2 text-[11px]"
                        onClick={() => localStore.unarchiveProjectTask(project._id, task._id)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restore
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ── Projects page ────────────────────────────────────────────────── */

export function ProjectsPage() {
  const teamState = useCurrentTeam();
  const state = useLocalState();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [projectModalState, setProjectModalState] = useState<ProjectModalState | null>(null);
  const [projectDraft, setProjectDraft] = useState(defaultProjectDraft);
  const [query, setQuery] = useState("");
  const allProjects = state.projects;

  const activeProjects = useMemo(
    () => state.projects.filter((project) => project.status === "active"),
    [state.projects],
  );
  const archivedProjects = useMemo(
    () => state.projects.filter((project) => project.status === "archived"),
    [state.projects],
  );

  const projectMatchesQuery = (project: LocalProject, normalizedQuery: string) =>
    [project.name, project.code ?? ""].some((value) => value.toLowerCase().includes(normalizedQuery));

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return activeProjects;
    return activeProjects.filter((project) => projectMatchesQuery(project, normalizedQuery));
  }, [activeProjects, query]);

  const filteredArchivedProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return archivedProjects;
    return archivedProjects.filter((project) => projectMatchesQuery(project, normalizedQuery));
  }, [archivedProjects, query]);

  const metricsByProject = useMemo(() => {
    const metrics = new Map<string, ProjectMetrics>();
    for (const project of state.projects) {
      metrics.set(project._id, { durationMs: 0, entryCount: 0 });
    }
    for (const entry of state.timesheetEntries) {
      if (!entry.projectId) continue;
      const existing = metrics.get(entry.projectId);
      if (!existing) continue;
      existing.durationMs += entry.durationMs;
      existing.entryCount += 1;
    }
    return metrics;
  }, [state.projects, state.timesheetEntries]);

  const taskMetricsByProject = useMemo(() => {
    const metrics: TaskMetricsByProject = new Map();

    for (const project of state.projects) {
      metrics.set(
        project._id,
        new Map(project.tasks.map((task) => [task._id, { durationMs: 0, entryCount: 0 }])),
      );
    }

    for (const entry of state.timesheetEntries) {
      if (!entry.projectId || !entry.taskId) continue;
      const projectMetrics = metrics.get(entry.projectId);
      const taskMetrics = projectMetrics?.get(entry.taskId);
      if (!taskMetrics) continue;
      taskMetrics.durationMs += entry.durationMs;
      taskMetrics.entryCount += 1;
    }

    return metrics;
  }, [state.projects, state.timesheetEntries]);

  // Derive selected project from URL
  const selectedProjectId = pathname.startsWith("/settings/projects/")
    ? decodeURIComponent(pathname.slice("/settings/projects/".length))
    : null;

  const selectedProject = selectedProjectId
    ? allProjects.find((project) => project._id === selectedProjectId) ?? null
    : null;

  // Auto-select the first available project if the current URL does not resolve.
  useEffect(() => {
    if (!pathname.startsWith("/settings/projects")) return;
    const firstProject = activeProjects[0] ?? archivedProjects[0];
    if (!firstProject || selectedProject) return;
    void navigate({
      to: "/settings/projects/$projectId",
      params: { projectId: firstProject._id },
      replace: true,
    });
  }, [activeProjects, archivedProjects, navigate, pathname, selectedProject]);

  if (!teamState?.team) return null;

  const closeProjectModal = () => {
    setProjectDraft(defaultProjectDraft);
    setProjectModalState(null);
  };

  const openCreateProjectModal = () => {
    setProjectDraft(defaultProjectDraft);
    setProjectModalState({ mode: "create" });
  };

  const openEditProjectModal = (project: LocalProject) => {
    setProjectDraft({
      name: project.name,
      code: project.code ?? "",
      color: project.color,
    });
    setProjectModalState({ mode: "edit", projectId: project._id });
  };

  const handleProjectSubmit = () => {
    if (!projectModalState || !projectDraft.name.trim()) {
      return;
    }

    if (projectModalState.mode === "create") {
      const nextId = localStore.addProject({
        name: projectDraft.name.trim(),
        code: projectDraft.code.trim() || undefined,
        color: projectDraft.color,
      });
      closeProjectModal();
      void navigate({
        to: "/settings/projects/$projectId",
        params: { projectId: nextId },
      });
      return;
    }

    localStore.updateProject(projectModalState.projectId, {
      name: projectDraft.name.trim(),
      code: projectDraft.code.trim() || undefined,
      color: projectDraft.color,
    });
    closeProjectModal();
  };

  return (
    <div className="settings-layout">
      <nav className="settings-sidebar" aria-label="Projects">
        <div className="settings-sidebar-body">
          <div className="settings-sidebar-header">
            <input
              className="settings-sidebar-search"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="button"
              className={cn("entries-header-add", projectModalState?.mode === "create" && "is-open")}
              aria-label="New project"
              title="New project"
              onClick={() => {
                if (projectModalState?.mode === "create") {
                  closeProjectModal();
                  return;
                }
                openCreateProjectModal();
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="settings-sidebar-scroll">
            {filteredProjects.map((project) => {
              const isActive = project._id === selectedProjectId;
              return (
                <Link
                  key={project._id}
                  to="/settings/projects/$projectId"
                  params={{ projectId: project._id }}
                  className={cn(
                    "settings-sidebar-item",
                    isActive && "settings-sidebar-item-active",
                  )}
                  title={project.name}
                >
                  <span
                    className="settings-sidebar-dot"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="settings-sidebar-label">{project.name}</span>
                  {project.code ? (
                    <span className="settings-sidebar-code">{project.code}</span>
                  ) : null}
                </Link>
              );
            })}

            {filteredArchivedProjects.length > 0 ? (
              <div className="mt-4 space-y-1 border-t border-[var(--border)] pt-4">
                <p className="settings-sidebar-label px-2 text-[11px] uppercase tracking-[0.18em] text-foreground/40">
                  Archived
                </p>
                {filteredArchivedProjects.map((project) => {
                  const isActive = project._id === selectedProjectId;

                  return (
                    <div
                      key={project._id}
                      className={cn(
                        "settings-sidebar-item",
                        "settings-sidebar-archived-item",
                        isActive && "settings-sidebar-item-active",
                      )}
                    >
                      <Link
                        to="/settings/projects/$projectId"
                        params={{ projectId: project._id }}
                        className="contents"
                        title={project.name}
                      >
                        <span
                          className="settings-sidebar-dot opacity-50"
                          style={{ backgroundColor: project.color }}
                        />
                        <span className="settings-sidebar-label text-foreground/50">{project.name}</span>
                        {project.code ? (
                          <span className="settings-sidebar-code text-foreground/35">{project.code}</span>
                        ) : null}
                      </Link>
                      <button
                        type="button"
                        className="settings-sidebar-restore"
                        title="Restore project"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          localStore.unarchiveProject(project._id);
                        }}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        <Link to="/settings" className="settings-sidebar-back" title="Back to settings">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="settings-sidebar-back-label">Back</span>
        </Link>
      </nav>

      <div className="settings-content">
        {selectedProject ? (
          <ProjectDetail
            project={selectedProject}
            metrics={metricsByProject.get(selectedProject._id) ?? { durationMs: 0, entryCount: 0 }}
            taskMetrics={taskMetricsByProject.get(selectedProject._id) ?? new Map()}
            onEditProject={openEditProjectModal}
          />
        ) : (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="max-w-md text-center">
              <h2 className="text-[15px] font-semibold">
                {allProjects.length > 0 ? "No project selected" : "No projects yet"}
              </h2>
              <p className="mt-2 text-sm text-foreground/65">
                {allProjects.length > 0
                  ? "Select a project from the sidebar to consult it."
                  : "Create your first project with the + button in the sidebar."}
              </p>
            </div>
          </div>
        )}
      </div>

      {projectModalState ? (
        <ProjectFormModal
          draft={projectDraft}
          mode={projectModalState.mode}
          onChange={setProjectDraft}
          onClose={closeProjectModal}
          onSubmit={handleProjectSubmit}
        />
      ) : null}
    </div>
  );
}
