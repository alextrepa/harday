import {
  aggregateSegmentsToBlocks,
  evaluateBlockAgainstRules,
  normalizeConnectorStatusKey,
  normalizeActivityContext,
  type ActivityBlockRecord,
  type ActivitySegmentRecord,
  type AssignmentSource,
  type BrowserActivityBucket,
  type BucketEvidenceItem,
  type CaptureSettings,
  type ImportedDraftStatus,
  type RuleRecord,
  type TeamSettings,
} from "@timetracker/shared";
import type {
  ConnectorBacklogSource,
  ConnectorImportCandidate,
  ConnectorSyncFieldUpdate,
  ConnectorSyncWorkItemUpdate,
} from "@timetracker/shared";
import {
  formatTaskImportName,
  normalizeTaskImportName,
  type ProjectTaskImportResult,
} from "@/features/projects/project-task-import";
import type { OutlookCalendarEvent, OutlookConnectionSnapshot } from "@/lib/outlook";

declare global {
  interface Window {
    timetrackerDesktop?: {
      bootstrapLocalState?: Partial<LocalAppState> | null;
    };
  }
}

export interface LocalProject {
  _id: string;
  name: string;
  code?: string;
  color: string;
  status: "active" | "archived";
  tasks: LocalProjectTask[];
}

export interface LocalProjectTask {
  _id: string;
  name: string;
  status: "active" | "archived";
  createdAt: number;
  archivedAt?: number;
}

export type LocalWorkItemEstimateFieldKey =
  | "originalEstimateHours"
  | "remainingEstimateHours"
  | "completedEstimateHours";

export interface LocalWorkItemEstimateFieldConflict {
  detectedAt: number;
  localValue?: number;
  remoteValue?: number;
  baselineValue?: number;
}

export interface LocalWorkItemEstimateFieldError {
  detectedAt: number;
  message: string;
}

export interface LocalWorkItemEstimateFieldState {
  baselineValue?: number;
  remoteValue?: number;
  resolution?: "keep_local";
  conflict?: LocalWorkItemEstimateFieldConflict;
  error?: LocalWorkItemEstimateFieldError;
}

export interface LocalWorkItemEstimateSyncState {
  originalEstimateHours?: LocalWorkItemEstimateFieldState;
  remainingEstimateHours?: LocalWorkItemEstimateFieldState;
  completedEstimateHours?: LocalWorkItemEstimateFieldState;
}

export function getWorkItemEstimateFieldState(
  workItem: LocalWorkItem,
  fieldKey: LocalWorkItemEstimateFieldKey,
) {
  return workItem.estimateSync?.[fieldKey];
}

export function hasWorkItemEstimateSyncIssue(workItem: LocalWorkItem) {
  return ([
    "originalEstimateHours",
    "remainingEstimateHours",
    "completedEstimateHours",
  ] as const).some((fieldKey) => {
    const fieldState = getWorkItemEstimateFieldState(workItem, fieldKey);
    return Boolean(fieldState?.conflict || fieldState?.error);
  });
}

export interface LocalProjectDraft {
  name: string;
  code?: string;
  color: string;
  tasks?: LocalProjectTaskDraft[];
}

export interface LocalProjectTaskDraft {
  name: string;
  status?: "active" | "archived";
}

export interface LocalTeam {
  _id: string;
  name: string;
  slug: string;
  settings: TeamSettings;
}

export interface LocalTimer {
  _id: string;
  startedAt: number;
  localDate: string;
  workItemId?: string;
  projectId?: string;
  taskId?: string;
  note?: string;
  accumulatedDurationMs: number;
  entryId?: string;
}

export interface LocalTimerDraft {
  localDate: string;
  workItemId?: string;
  projectId?: string;
  taskId?: string;
  note?: string;
  accumulatedDurationMs?: number;
  entryId?: string;
}

export interface LocalTimesheetEntry {
  _id: string;
  localDate: string;
  workItemId?: string;
  projectId?: string;
  taskId?: string;
  label: string;
  note?: string;
  durationMs: number;
  sourceBlockIds: string[];
  committedAt: number;
  submittedAt?: number;
  submittedFingerprint?: string;
}

export interface LocalTimesheetImportDraft {
  _id: string;
  localDate: string;
  projectName: string;
  taskName: string;
  note?: string;
  durationMs: number;
  potentialConflict: boolean;
  conflictEntryIds: string[];
  importedAt: number;
}

export type BacklogSortMode = "custom" | "priority_asc" | "priority_desc";

export type ThemeMode = "system" | "dark" | "light";

export interface UserPreferences {
  themeMode: ThemeMode;
}

export interface LocalBacklogStatus {
  _id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface LocalBacklogStatusMapping {
  source: ConnectorBacklogSource;
  connectionId: string;
  sourceStatusKey: string;
  backlogStatusId: string;
}

export interface LocalWorkItem {
  _id: string;
  title: string;
  status: "active" | "archived";
  source: "manual" | ConnectorBacklogSource | "outlook";
  sourceId?: string;
  sourceConnectionId?: string;
  sourceConnectionLabel?: string;
  sourceProjectName?: string;
  sourceWorkItemType?: string;
  hierarchyLevel?: 0 | 1;
  parentWorkItemId?: string;
  parentSourceId?: string;
  priority?: number;
  importedPriority?: number;
  backlogStatusId?: string;
  importedBacklogStatusId?: string;
  sourceStatusKey?: string;
  sourceStatusLabel?: string;
  projectId?: string;
  taskId?: string;
  note?: string;
  originalEstimateHours?: number;
  remainingEstimateHours?: number;
  completedEstimateHours?: number;
  estimateSync?: LocalWorkItemEstimateSyncState;
  createdAt: number;
  archivedAt?: number;
}

type PersistedLocalWorkItem = Omit<LocalWorkItem, "status" | "archivedAt"> & {
  status?: LocalWorkItem["status"] | "open" | "done";
  archivedAt?: number;
  completedAt?: number;
};

export interface LocalWorkItemDraft {
  title: string;
  note?: string;
  projectId?: string;
  taskId?: string;
  parentWorkItemId?: string;
  priority?: number;
  backlogStatusId?: string;
  originalEstimateHours?: number;
  remainingEstimateHours?: number;
  completedEstimateHours?: number;
}

export interface ImportedBrowserDraft {
  _id: string;
  bucketKey: string;
  localDate: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  dominantDomain: string;
  dominantPathname: string;
  dominantTitle: string;
  dominantLabel: string;
  dominantSubtitle: string;
  dominantFingerprint: string;
  evidence: BucketEvidenceItem[];
  dismissed: boolean;
  status: ImportedDraftStatus;
  projectId?: string;
  note?: string;
  importedAt: number;
  source: "extension_bridge";
  confidence: number;
  isMixed: boolean;
  assignmentSource: AssignmentSource;
  explanation?: string;
  manuallyEdited: boolean;
}

export interface ExtensionBridgeStatus {
  available: boolean;
  paused: boolean;
  segmentCount?: number;
  lastReadAt?: number;
  lastError?: string;
}

export interface OutlookMeetingDraft {
  _id: string;
  eventId: string;
  localDate: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  subject: string;
  organizer?: string;
  location?: string;
  isOnlineMeeting: boolean;
  webLink?: string;
  dismissed: boolean;
  status: ImportedDraftStatus;
  projectId?: string;
  note?: string;
  importedAt: number;
  source: "outlook_calendar";
  assignmentSource: AssignmentSource;
  explanation: string;
  manuallyEdited: boolean;
}

export interface LocalAppState {
  user: {
    _id: string;
    name: string;
    email: string;
  };
  team?: LocalTeam;
  projects: LocalProject[];
  rules: RuleRecord[];
  segments: ActivitySegmentRecord[];
  dismissedSegmentIds: string[];
  editedBlocks: ActivityBlockRecord[];
  importedBrowserDrafts: ImportedBrowserDraft[];
  outlookMeetingDrafts: OutlookMeetingDraft[];
  timers: LocalTimer[];
  timesheetEntries: LocalTimesheetEntry[];
  timesheetImportDrafts: LocalTimesheetImportDraft[];
  workItems: LocalWorkItem[];
  backlogStatuses: LocalBacklogStatus[];
  backlogStatusMappings: LocalBacklogStatusMapping[];
  backlogSortMode: BacklogSortMode;
  capture: CaptureSettings;
  lastExtensionImportAt?: number;
  extensionBridgeStatus?: ExtensionBridgeStatus;
  outlookIntegration: OutlookConnectionSnapshot;
  userPreferences: UserPreferences;
  updatedAt: number;
}

export interface TimelineMutationResult {
  blocks: ActivityBlockRecord[];
  browserDrafts: ImportedBrowserDraft[];
  outlookMeetings: OutlookMeetingDraft[];
  trackedMs: number;
  committedMs: number;
  extensionBridgeStatus?: ExtensionBridgeStatus;
}

type RuleSeed = Pick<ActivityBlockRecord, "projectId" | "domain" | "pathname">;

const STORAGE_KEY = "timetracker.local-state.v2";

const defaultCapture: CaptureSettings = {
  urlMode: "sanitized_path",
  titleMode: "normalized",
  blockedDomains: [],
  sensitiveDomains: [],
  maxPathSegments: 4,
};

const defaultTeamSettings: TeamSettings = {
  idleThresholdMs: 2 * 60 * 1000,
  mergeGapMs: 90 * 1000,
  microBlockThresholdMs: 3 * 60 * 1000,
  urlCaptureMode: "sanitized_path",
  titleCaptureMode: "normalized",
};

const defaultWorkspaceProjects: LocalProjectDraft[] = [
  { name: "Internal", color: "#1f7667", code: "INT" },
  { name: "Client Work", color: "#ec7a43", code: "CLT" },
];

const defaultUserPreferences: UserPreferences = {
  themeMode: "system",
};

const DEFAULT_BACKLOG_STATUS_COLORS = [
  "#64748b",
  "#2563eb",
  "#059669",
  "#d97706",
  "#dc2626",
  "#7c3aed",
];

let cachedState: LocalAppState | undefined;

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) {
    return [...items];
  }

  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);

  if (!item) {
    return [...items];
  }

  nextItems.splice(toIndex, 0, item);
  return nextItems;
}

function getWorkItemSourceKey(workItem: { source: LocalWorkItem["source"]; sourceId: string }) {
  return `${workItem.source}:${workItem.sourceId}`;
}

function isSubtaskWorkItem(workItem: Pick<LocalWorkItem, "hierarchyLevel" | "parentWorkItemId" | "parentSourceId">) {
  return Boolean(workItem.parentWorkItemId || workItem.parentSourceId || (workItem.hierarchyLevel ?? 0) > 0);
}

function normalizePriorityValue(priority?: number) {
  if (typeof priority !== "number" || !Number.isFinite(priority)) {
    return undefined;
  }

  return Math.max(0, Math.round(priority));
}

function normalizeEstimateValue(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.round(Math.max(0, value) * 10_000) / 10_000;
}

function durationMsToHours(durationMs: number) {
  if (!Number.isFinite(durationMs)) {
    return 0;
  }

  return durationMs / (60 * 60 * 1000);
}

function applyEstimateDelta(
  value: number | undefined,
  delta: number,
  options?: { clampAtZero?: boolean },
) {
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.0000001) {
    return value;
  }

  const nextValue = (value ?? 0) + delta;
  return normalizeEstimateValue(options?.clampAtZero ? Math.max(0, nextValue) : nextValue);
}

function createEstimateFieldState(value: number | undefined): LocalWorkItemEstimateFieldState | undefined {
  const normalizedValue = normalizeEstimateValue(value);
  if (normalizedValue === undefined) {
    return undefined;
  }

  return {
    baselineValue: normalizedValue,
    remoteValue: normalizedValue,
  };
}

function buildImportedEstimateSyncState(workItem: {
  originalEstimateHours?: number;
  remainingEstimateHours?: number;
  completedEstimateHours?: number;
}): LocalWorkItemEstimateSyncState | undefined {
  const originalEstimateHours = createEstimateFieldState(workItem.originalEstimateHours);
  const remainingEstimateHours = createEstimateFieldState(workItem.remainingEstimateHours);
  const completedEstimateHours = createEstimateFieldState(workItem.completedEstimateHours);

  if (!originalEstimateHours && !remainingEstimateHours && !completedEstimateHours) {
    return undefined;
  }

  return {
    originalEstimateHours,
    remainingEstimateHours,
    completedEstimateHours,
  };
}

function normalizeBacklogStatusName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function getDefaultBacklogStatusColor(index: number) {
  return DEFAULT_BACKLOG_STATUS_COLORS[index % DEFAULT_BACKLOG_STATUS_COLORS.length]!;
}

function normalizeBacklogStatusColor(value: string | undefined, fallbackColor: string) {
  const trimmedValue = value?.trim();
  if (trimmedValue && /^#[0-9a-f]{6}$/iu.test(trimmedValue)) {
    return trimmedValue.toLowerCase();
  }

  return fallbackColor;
}

function findMappedBacklogStatusId(
  mappings: LocalBacklogStatusMapping[],
  source: LocalWorkItem["source"],
  connectionId: string | undefined,
  sourceStatusKey: string | undefined,
) {
  if (!connectionId || !sourceStatusKey || source === "manual" || source === "outlook") {
    return undefined;
  }

  return mappings.find(
    (mapping) =>
      mapping.source === source &&
      mapping.connectionId === connectionId &&
      mapping.sourceStatusKey === sourceStatusKey,
  )?.backlogStatusId;
}

function syncImportedBacklogStatus(
  workItem: LocalWorkItem,
  mappings: LocalBacklogStatusMapping[],
): LocalWorkItem {
  const nextImportedBacklogStatusId = findMappedBacklogStatusId(
    mappings,
    workItem.source,
    workItem.sourceConnectionId,
    workItem.sourceStatusKey,
  );
  const followsImportedBacklogStatus = workItem.backlogStatusId === workItem.importedBacklogStatusId;

  return {
    ...workItem,
    backlogStatusId: followsImportedBacklogStatus ? nextImportedBacklogStatusId : workItem.backlogStatusId,
    importedBacklogStatusId: nextImportedBacklogStatusId,
  };
}

function reconcileImportedBacklogStatuses(state: LocalAppState): LocalAppState {
  const validBacklogStatusIds = new Set(state.backlogStatuses.map((status) => status._id));
  const backlogStatusMappings = state.backlogStatusMappings.filter((mapping) =>
    validBacklogStatusIds.has(mapping.backlogStatusId),
  );

  return {
    ...state,
    backlogStatusMappings,
    workItems: state.workItems.map((workItem) =>
      syncImportedBacklogStatus(
        {
          ...workItem,
          backlogStatusId: validBacklogStatusIds.has(workItem.backlogStatusId ?? "")
            ? workItem.backlogStatusId
            : undefined,
          importedBacklogStatusId: validBacklogStatusIds.has(workItem.importedBacklogStatusId ?? "")
            ? workItem.importedBacklogStatusId
            : undefined,
        },
        backlogStatusMappings,
      ),
    ),
  };
}

function hasDirectChildWorkItems(workItems: LocalWorkItem[], target: LocalWorkItem) {
  return workItems.some(
    (candidate) =>
      candidate.parentWorkItemId === target._id ||
      (target.sourceId ? candidate.parentSourceId === target.sourceId : false),
  );
}

function resolveParentWorkItemId(
  workItem: LocalWorkItem,
  workItemsById: Map<string, LocalWorkItem>,
  workItemsBySourceId: Map<string, LocalWorkItem>,
) {
  if (workItem.parentWorkItemId) {
    return workItem.parentWorkItemId;
  }

  if (workItem.parentSourceId) {
    return workItemsBySourceId.get(workItem.parentSourceId)?._id;
  }

  return undefined;
}

function assertValidParentWorkItem(workItems: LocalWorkItem[], workItemId: string, parentWorkItemId: string) {
  const target = workItems.find((workItem) => workItem._id === workItemId);
  if (!target) {
    throw new Error("Work item not found.");
  }

  const parent = workItems.find((workItem) => workItem._id === parentWorkItemId);
  if (!parent) {
    throw new Error("Parent work item not found.");
  }

  if (parent._id === workItemId) {
    throw new Error("A work item cannot be its own parent.");
  }

  if (isSubtaskWorkItem(parent)) {
    throw new Error("Subtasks cannot have subtasks.");
  }

  if (hasDirectChildWorkItems(workItems, target)) {
    throw new Error("Tasks with subtasks cannot be nested.");
  }

  const workItemsById = new Map(workItems.map((workItem) => [workItem._id, workItem]));
  const workItemsBySourceId = new Map(
    workItems
      .filter((workItem): workItem is LocalWorkItem & { sourceId: string } => typeof workItem.sourceId === "string")
      .map((workItem) => [workItem.sourceId, workItem]),
  );

  let currentParent: LocalWorkItem | undefined = parent;

  while (currentParent) {
    if (currentParent._id === workItemId) {
      throw new Error("A task cannot be nested under one of its own descendants.");
    }

    const nextParentId = resolveParentWorkItemId(currentParent, workItemsById, workItemsBySourceId);
    currentParent = nextParentId ? workItemsById.get(nextParentId) : undefined;
  }
}

function createDefaultState(): LocalAppState {
  return ensureLocalWorkspace({
    user: {
      _id: "local_user",
      name: "Local User",
      email: "local-only@timetracker.dev",
    },
    projects: [],
    rules: [],
    segments: [],
    dismissedSegmentIds: [],
    editedBlocks: [],
    importedBrowserDrafts: [],
    outlookMeetingDrafts: [],
    timers: [],
    timesheetEntries: [],
    timesheetImportDrafts: [],
    workItems: [],
    backlogStatuses: [],
    backlogStatusMappings: [],
    backlogSortMode: "custom",
    capture: defaultCapture,
    outlookIntegration: {
      configured: false,
      connected: false,
    },
    userPreferences: defaultUserPreferences,
    updatedAt: Date.now(),
  });
}

function createProjectTask(task: LocalProjectTaskDraft): LocalProjectTask {
  const createdAt = Date.now();
  const status = task.status ?? "active";

  return {
    _id: createId("task"),
    name: task.name,
    status,
    createdAt,
    archivedAt: status === "archived" ? createdAt : undefined,
  };
}

function createProjectRecord(project: LocalProjectDraft): LocalProject {
  return {
    ...project,
    _id: createId("project"),
    status: "active",
    tasks: (project.tasks ?? []).map((task) => createProjectTask(task)),
  };
}

function findImportedProjectByName(projects: LocalProject[], projectName: string) {
  const normalizedProjectName = normalizeTaskImportName(projectName);
  return projects.find((project) => normalizeTaskImportName(project.name) === normalizedProjectName);
}

function findImportedProjectTaskByName(project: LocalProject, taskName: string) {
  const normalizedTaskName = normalizeTaskImportName(taskName);
  return project.tasks.find((task) => normalizeTaskImportName(task.name) === normalizedTaskName);
}

function groupProjectWorkbookRows(
  rows: Array<{
    project: string;
    code: string;
    color: string;
    status: "active" | "archived";
    task: string;
    taskStatus: "active" | "archived" | "";
  }>,
) {
  const grouped = new Map<
    string,
    {
      projectName: string;
      code?: string;
      color?: string;
      status: "active" | "archived";
      tasks: Array<{ name: string; status: "active" | "archived" }>;
    }
  >();

  for (const row of rows) {
    const projectName = formatTaskImportName(row.project);
    const key = normalizeTaskImportName(projectName);
    const existing = grouped.get(key);

    const nextGroup = existing ?? {
      projectName,
      code: undefined,
      color: undefined,
      status: row.status,
      tasks: [],
    };

    nextGroup.projectName = projectName;
    nextGroup.code = formatTaskImportName(row.code) || nextGroup.code;
    nextGroup.color = formatTaskImportName(row.color) || nextGroup.color;
    nextGroup.status = row.status;

    const taskName = formatTaskImportName(row.task);
    if (taskName) {
      const taskKey = normalizeTaskImportName(taskName);
      const existingTaskIndex = nextGroup.tasks.findIndex((task) => normalizeTaskImportName(task.name) === taskKey);
      const nextTask = {
        name: taskName,
        status: row.taskStatus || "active",
      } as const;

      if (existingTaskIndex >= 0) {
        nextGroup.tasks[existingTaskIndex] = nextTask;
      } else {
        nextGroup.tasks.push(nextTask);
      }
    }

    grouped.set(key, nextGroup);
  }

  return Array.from(grouped.values());
}

function normalizeProject(project: LocalProject): LocalProject {
  return {
    ...project,
    tasks: (project.tasks ?? []).map((task) => ({
      ...task,
      status: task.status ?? "active",
      createdAt: task.createdAt ?? Date.now(),
      archivedAt:
        task.archivedAt ?? (task.status === "archived" ? task.createdAt ?? Date.now() : undefined),
    })),
  };
}

function normalizeTimer(timer: Partial<LocalTimer> & { _id: string; startedAt: number }): LocalTimer {
  return {
    _id: timer._id,
    startedAt: timer.startedAt,
    localDate: timer.localDate ?? new Date(timer.startedAt).toISOString().slice(0, 10),
    workItemId: timer.workItemId,
    projectId: timer.projectId,
    taskId: timer.taskId,
    note: timer.note ?? ("label" in timer && typeof timer.label === "string" ? timer.label : undefined),
    accumulatedDurationMs: timer.accumulatedDurationMs ?? 0,
    entryId: timer.entryId,
  };
}

function normalizeTimesheetEntry(entry: LocalTimesheetEntry): LocalTimesheetEntry {
  const submittedAt = typeof entry.submittedAt === "number" && Number.isFinite(entry.submittedAt) ? entry.submittedAt : undefined;
  const normalizedEntry = {
    ...entry,
    taskId: entry.taskId,
    note: entry.note?.trim() || undefined,
    submittedAt,
  };

  return {
    ...normalizedEntry,
    submittedFingerprint: submittedAt
      ? normalizedEntry.submittedFingerprint ?? createTimesheetEntrySubmissionFingerprint(normalizedEntry)
      : undefined,
  };
}

function createTimesheetEntrySubmissionFingerprint(
  entry: Pick<
    LocalTimesheetEntry,
    "localDate" | "workItemId" | "projectId" | "taskId" | "note" | "durationMs" | "sourceBlockIds"
  >,
) {
  return JSON.stringify([
    entry.localDate,
    entry.workItemId ?? "",
    entry.projectId ?? "",
    entry.taskId ?? "",
    entry.note?.trim() ?? "",
    entry.durationMs,
    [...entry.sourceBlockIds].sort(),
  ]);
}

function preserveTimesheetEntrySubmissionState(
  existingEntry: LocalTimesheetEntry | undefined,
  nextEntry: LocalTimesheetEntry,
): LocalTimesheetEntry {
  if (!existingEntry?.submittedAt) {
    return nextEntry;
  }

  const previousFingerprint =
    existingEntry.submittedFingerprint ?? createTimesheetEntrySubmissionFingerprint(existingEntry);
  const nextFingerprint = createTimesheetEntrySubmissionFingerprint(nextEntry);

  if (previousFingerprint !== nextFingerprint) {
    return {
      ...nextEntry,
      submittedAt: undefined,
      submittedFingerprint: undefined,
    };
  }

  return {
    ...nextEntry,
    submittedAt: existingEntry.submittedAt,
    submittedFingerprint: previousFingerprint,
  };
}

function formatImportName(value?: string) {
  return formatTaskImportName(value ?? "");
}

function resolveImportedProject(state: LocalAppState, projectName: string) {
  const normalizedProjectName = normalizeTaskImportName(projectName);
  return state.projects.find((project) => normalizeTaskImportName(project.name) === normalizedProjectName);
}

function resolveImportedTask(project: LocalProject | undefined, taskName: string) {
  const normalizedTaskName = normalizeTaskImportName(taskName);
  return project?.tasks.find((task) => normalizeTaskImportName(task.name) === normalizedTaskName);
}

function hasPotentialImportedTimesheetConflict(
  state: LocalAppState,
  values: {
    localDate: string;
    projectName: string;
    taskName: string;
  },
) {
  const project = resolveImportedProject(state, values.projectName);
  const task = resolveImportedTask(project, values.taskName);

  const conflictEntryIds = state.timesheetEntries
    .filter(
      (entry) =>
        entry.localDate === values.localDate &&
        entry.projectId === project?._id &&
        (entry.taskId ?? "") === (task?._id ?? ""),
    )
    .map((entry) => entry._id);

  return {
    potentialConflict: conflictEntryIds.length > 0,
    conflictEntryIds,
  };
}

function createTimesheetImportDraft(
  state: LocalAppState,
  values: {
    date: string;
    project: string;
    task: string;
    note?: string;
    hours: number;
  },
): LocalTimesheetImportDraft {
  const projectName = formatImportName(values.project);
  const taskName = formatImportName(values.task);
  const localDate = values.date.trim();
  const note = values.note?.trim() || undefined;
  const durationMs = Math.round(values.hours * 60 * 60 * 1000);
  const { potentialConflict, conflictEntryIds } = hasPotentialImportedTimesheetConflict(state, {
    localDate,
    projectName,
    taskName,
  });

  return {
    _id: createId("timesheet_import"),
    localDate,
    projectName,
    taskName,
    note,
    durationMs,
    potentialConflict,
    conflictEntryIds,
    importedAt: Date.now(),
  };
}

function ensureImportedProjectAndTask(
  state: LocalAppState,
  values: {
    projectName: string;
    taskName: string;
  },
) {
  const projectName = formatImportName(values.projectName);
  const taskName = formatImportName(values.taskName);

  if (!projectName) {
    return {
      projects: state.projects,
      projectId: undefined,
      taskId: undefined,
    };
  }

  const existingProject = resolveImportedProject(state, projectName);

  if (existingProject) {
    const existingTask = taskName ? resolveImportedTask(existingProject, taskName) : undefined;
    if (existingTask || !taskName) {
      return {
        projects: state.projects.map((project) =>
          project._id === existingProject._id && project.status === "archived"
            ? { ...project, status: "active" as const }
            : project,
        ),
        projectId: existingProject._id,
        taskId: existingTask?._id,
      };
    }

    const nextTask = createProjectTask({ name: taskName });
    return {
      projects: state.projects.map((project) =>
        project._id === existingProject._id
          ? {
              ...project,
              status: "active" as const,
              tasks: [...project.tasks, nextTask],
            }
          : project,
      ),
      projectId: existingProject._id,
      taskId: nextTask._id,
    };
  }

  const nextTask = taskName ? createProjectTask({ name: taskName }) : undefined;
  const nextProject = createProjectRecord({
    name: projectName,
    color: "#3d5a80",
    tasks: nextTask ? [{ name: taskName }] : [],
  });

  if (nextTask) {
    nextProject.tasks = [nextTask];
  }

  return {
    projects: [...state.projects, nextProject],
    projectId: nextProject._id,
    taskId: nextTask?._id,
  };
}

function createWorkItem(workItem: LocalWorkItemDraft): LocalWorkItem {
  const isSubtask = Boolean(workItem.parentWorkItemId);

  return {
    _id: createId("work_item"),
    title: workItem.title.trim(),
    status: "active",
    source: "manual",
    sourceId: undefined,
    sourceConnectionId: undefined,
    sourceConnectionLabel: undefined,
    sourceProjectName: undefined,
    sourceWorkItemType: undefined,
    hierarchyLevel: isSubtask ? 1 : 0,
    parentWorkItemId: workItem.parentWorkItemId,
    parentSourceId: undefined,
    priority: isSubtask ? undefined : normalizePriorityValue(workItem.priority),
    importedPriority: undefined,
    backlogStatusId: workItem.backlogStatusId,
    importedBacklogStatusId: undefined,
    sourceStatusKey: undefined,
    sourceStatusLabel: undefined,
    projectId: workItem.projectId,
    taskId: workItem.taskId,
    note: workItem.note?.trim() || undefined,
    originalEstimateHours: normalizeEstimateValue(workItem.originalEstimateHours),
    remainingEstimateHours: normalizeEstimateValue(workItem.remainingEstimateHours),
    completedEstimateHours: normalizeEstimateValue(workItem.completedEstimateHours),
    estimateSync: undefined,
    createdAt: Date.now(),
    archivedAt: undefined,
  };
}

function createConnectorWorkItem(
  workItem: ConnectorImportCandidate,
  mappedBacklogStatusId: string | undefined,
): LocalWorkItem {
  const sourceStatusLabel = workItem.state?.trim() || undefined;
  const sourceStatusKey = sourceStatusLabel ? normalizeConnectorStatusKey(sourceStatusLabel) : undefined;

  return {
    _id: createId("work_item"),
    title: workItem.title.trim(),
    status: "active",
    source: workItem.source,
    sourceId: workItem.sourceId,
    sourceConnectionId: workItem.connectionId,
    sourceConnectionLabel: workItem.connectionLabel,
    sourceProjectName: workItem.projectName,
    sourceWorkItemType: workItem.workItemType,
    hierarchyLevel: workItem.depth,
    parentSourceId: workItem.parentSourceId,
    priority: workItem.depth > 0 ? undefined : normalizePriorityValue(workItem.priority),
    importedPriority: workItem.depth > 0 ? undefined : normalizePriorityValue(workItem.priority),
    backlogStatusId: mappedBacklogStatusId,
    importedBacklogStatusId: mappedBacklogStatusId,
    sourceStatusKey,
    sourceStatusLabel,
    projectId: undefined,
    taskId: undefined,
    note: workItem.note?.trim() || undefined,
    originalEstimateHours: normalizeEstimateValue(workItem.originalEstimateHours),
    remainingEstimateHours: normalizeEstimateValue(workItem.remainingEstimateHours),
    completedEstimateHours: normalizeEstimateValue(workItem.completedEstimateHours),
    estimateSync: buildImportedEstimateSyncState(workItem),
    createdAt: workItem.pushedAt,
    archivedAt: undefined,
  };
}

function mergeConnectorWorkItem(
  existingWorkItem: LocalWorkItem,
  importedWorkItem: ConnectorImportCandidate,
  mappedBacklogStatusId: string | undefined,
): LocalWorkItem {
  const nextImportedState = createConnectorWorkItem(importedWorkItem, mappedBacklogStatusId);
  const followsImportedPriority = existingWorkItem.priority === existingWorkItem.importedPriority;
  const followsImportedBacklogStatus =
    existingWorkItem.backlogStatusId === existingWorkItem.importedBacklogStatusId;
  const followsImportedOriginalEstimate =
    existingWorkItem.originalEstimateHours === existingWorkItem.estimateSync?.originalEstimateHours?.remoteValue;
  const followsImportedRemainingEstimate =
    existingWorkItem.remainingEstimateHours === existingWorkItem.estimateSync?.remainingEstimateHours?.remoteValue;
  const followsImportedCompletedEstimate =
    existingWorkItem.completedEstimateHours === existingWorkItem.estimateSync?.completedEstimateHours?.remoteValue;

  return {
    ...existingWorkItem,
    title: nextImportedState.title,
    note: nextImportedState.note,
    sourceId: nextImportedState.sourceId,
    sourceConnectionId: nextImportedState.sourceConnectionId,
    sourceConnectionLabel: nextImportedState.sourceConnectionLabel,
    sourceProjectName: nextImportedState.sourceProjectName,
    sourceWorkItemType: nextImportedState.sourceWorkItemType,
    priority: followsImportedPriority ? nextImportedState.importedPriority : existingWorkItem.priority,
    importedPriority: nextImportedState.importedPriority,
    backlogStatusId: followsImportedBacklogStatus
      ? nextImportedState.importedBacklogStatusId
      : existingWorkItem.backlogStatusId,
    importedBacklogStatusId: nextImportedState.importedBacklogStatusId,
    sourceStatusKey: nextImportedState.sourceStatusKey,
    sourceStatusLabel: nextImportedState.sourceStatusLabel,
    originalEstimateHours: followsImportedOriginalEstimate
      ? nextImportedState.originalEstimateHours
      : existingWorkItem.originalEstimateHours,
    remainingEstimateHours: followsImportedRemainingEstimate
      ? nextImportedState.remainingEstimateHours
      : existingWorkItem.remainingEstimateHours,
    completedEstimateHours: followsImportedCompletedEstimate
      ? nextImportedState.completedEstimateHours
      : existingWorkItem.completedEstimateHours,
    estimateSync: {
      ...existingWorkItem.estimateSync,
      originalEstimateHours: nextImportedState.estimateSync?.originalEstimateHours
        ? {
            ...existingWorkItem.estimateSync?.originalEstimateHours,
            remoteValue: nextImportedState.estimateSync.originalEstimateHours.remoteValue,
            baselineValue: followsImportedOriginalEstimate
              ? nextImportedState.estimateSync.originalEstimateHours.baselineValue
              : existingWorkItem.estimateSync?.originalEstimateHours?.baselineValue,
          }
        : existingWorkItem.estimateSync?.originalEstimateHours,
      remainingEstimateHours: nextImportedState.estimateSync?.remainingEstimateHours
        ? {
            ...existingWorkItem.estimateSync?.remainingEstimateHours,
            remoteValue: nextImportedState.estimateSync.remainingEstimateHours.remoteValue,
            baselineValue: followsImportedRemainingEstimate
              ? nextImportedState.estimateSync.remainingEstimateHours.baselineValue
              : existingWorkItem.estimateSync?.remainingEstimateHours?.baselineValue,
          }
        : existingWorkItem.estimateSync?.remainingEstimateHours,
      completedEstimateHours: nextImportedState.estimateSync?.completedEstimateHours
        ? {
            ...existingWorkItem.estimateSync?.completedEstimateHours,
            remoteValue: nextImportedState.estimateSync.completedEstimateHours.remoteValue,
            baselineValue: followsImportedCompletedEstimate
              ? nextImportedState.estimateSync.completedEstimateHours.baselineValue
              : existingWorkItem.estimateSync?.completedEstimateHours?.baselineValue,
          }
        : existingWorkItem.estimateSync?.completedEstimateHours,
    },
    status: "active",
    archivedAt: undefined,
  };
}

function normalizeWorkItem(workItem: PersistedLocalWorkItem): LocalWorkItem {
  const parentWorkItemId = workItem.parentWorkItemId;
  const status =
    workItem.status === "done"
      ? "archived"
      : workItem.status === "open" || !workItem.status
        ? "active"
        : workItem.status;
  const isSubtask = isSubtaskWorkItem(workItem);

  return {
    ...workItem,
    title: workItem.title.trim(),
    status,
    source: workItem.source ?? "manual",
    sourceConnectionId: workItem.sourceConnectionId,
    sourceConnectionLabel: workItem.sourceConnectionLabel,
    sourceProjectName: workItem.sourceProjectName,
    sourceWorkItemType: workItem.sourceWorkItemType,
    hierarchyLevel: isSubtask ? 1 : 0,
    parentWorkItemId,
    parentSourceId: workItem.parentSourceId,
    priority: isSubtask ? undefined : normalizePriorityValue(workItem.priority),
    importedPriority: isSubtask ? undefined : normalizePriorityValue(workItem.importedPriority),
    backlogStatusId: workItem.backlogStatusId,
    importedBacklogStatusId: workItem.importedBacklogStatusId,
    sourceStatusKey: workItem.sourceStatusKey,
    sourceStatusLabel: workItem.sourceStatusLabel,
    originalEstimateHours: normalizeEstimateValue(workItem.originalEstimateHours),
    remainingEstimateHours: normalizeEstimateValue(workItem.remainingEstimateHours),
    completedEstimateHours: normalizeEstimateValue(workItem.completedEstimateHours),
    estimateSync: workItem.estimateSync,
    createdAt: workItem.createdAt ?? Date.now(),
    archivedAt:
      workItem.archivedAt ??
      workItem.completedAt ??
      (status === "archived" ? workItem.createdAt ?? Date.now() : undefined),
  };
}

function normalizeState(state: Partial<LocalAppState>): LocalAppState {
  const defaults = createDefaultState();
  const { activityLoggerEnabled: _removedActivityLoggerEnabled, ...persistedState } = state as Partial<LocalAppState> & {
    activityLoggerEnabled?: boolean;
  };
  const rawWorkItems = (persistedState.workItems ?? defaults.workItems) as PersistedLocalWorkItem[];
  const workItems = rawWorkItems.map((workItem) => normalizeWorkItem(workItem));
  const backlogStatuses = (persistedState.backlogStatuses ?? defaults.backlogStatuses)
    .filter((status): status is LocalBacklogStatus => Boolean(status?._id && status.name))
    .map((status, index) => ({
      _id: status._id,
      name: normalizeBacklogStatusName(status.name),
      color: normalizeBacklogStatusColor(status.color, getDefaultBacklogStatusColor(index)),
      createdAt: status.createdAt ?? Date.now(),
    }));
  const backlogStatusMappings = (persistedState.backlogStatusMappings ?? defaults.backlogStatusMappings).filter(
    (mapping): mapping is LocalBacklogStatusMapping =>
      Boolean(mapping?.source && mapping.connectionId && mapping.sourceStatusKey && mapping.backlogStatusId),
  );
  const persistedBacklogSortMode = persistedState.backlogSortMode as BacklogSortMode | "priority" | undefined;
  const backlogSortMode =
    persistedBacklogSortMode === "priority"
      ? "priority_asc"
      : (persistedBacklogSortMode ?? defaults.backlogSortMode);

  return ensureLocalWorkspace(
    reconcileImportedBacklogStatuses({
      ...defaults,
      ...persistedState,
      user: {
        ...defaults.user,
        ...persistedState.user,
      },
      projects: (persistedState.projects ?? defaults.projects).map((project) => normalizeProject(project)),
      rules: persistedState.rules ?? defaults.rules,
      segments: persistedState.segments ?? defaults.segments,
      dismissedSegmentIds: persistedState.dismissedSegmentIds ?? defaults.dismissedSegmentIds,
      editedBlocks: persistedState.editedBlocks ?? defaults.editedBlocks,
      importedBrowserDrafts: persistedState.importedBrowserDrafts ?? defaults.importedBrowserDrafts,
      outlookMeetingDrafts: persistedState.outlookMeetingDrafts ?? defaults.outlookMeetingDrafts,
      timers: (persistedState.timers ?? defaults.timers).map((timer) => normalizeTimer(timer)),
      timesheetEntries: (persistedState.timesheetEntries ?? defaults.timesheetEntries).map((entry) =>
        normalizeTimesheetEntry(entry),
      ),
      timesheetImportDrafts: persistedState.timesheetImportDrafts ?? defaults.timesheetImportDrafts,
      workItems,
      backlogStatuses,
      backlogStatusMappings,
      backlogSortMode,
      capture: {
        ...defaults.capture,
        ...persistedState.capture,
        blockedDomains: persistedState.capture?.blockedDomains ?? defaults.capture.blockedDomains,
        sensitiveDomains: persistedState.capture?.sensitiveDomains ?? defaults.capture.sensitiveDomains,
      },
      outlookIntegration: {
        ...defaults.outlookIntegration,
        ...persistedState.outlookIntegration,
      },
      userPreferences: {
        ...defaults.userPreferences,
        ...persistedState.userPreferences,
      },
    }),
  );
}

function ensureLocalWorkspace(state: LocalAppState): LocalAppState {
  if (state.team) {
    return state;
  }

  return {
    ...state,
    team: {
      _id: "local_team",
      name: "harday",
      slug: "harday",
      settings: defaultTeamSettings,
    },
    projects: state.projects.length > 0 ? state.projects : defaultWorkspaceProjects.map((project) => createProjectRecord(project)),
  };
}

function hasOnlyDefaultProjects(projects: Partial<LocalProject>[] | undefined) {
  if (!projects || projects.length !== defaultWorkspaceProjects.length) {
    return false;
  }

  return projects.every((project, index) => {
    const defaults = defaultWorkspaceProjects[index];
    return (
      project?.name === defaults?.name &&
      project?.code === defaults?.code &&
      (project.tasks?.length ?? 0) === 0
    );
  });
}

function mergeBootstrapTimesheetEntries(
  currentEntries: LocalTimesheetEntry[] | undefined,
  bootstrapEntries: LocalTimesheetEntry[] | undefined,
) {
  const mergedEntries: LocalTimesheetEntry[] = [];
  const seenEntryIds = new Set<string>();

  for (const entry of [...(currentEntries ?? []), ...(bootstrapEntries ?? [])]) {
    if (!entry?._id || seenEntryIds.has(entry._id)) {
      continue;
    }

    seenEntryIds.add(entry._id);
    mergedEntries.push(entry);
  }

  return mergedEntries;
}

function shouldBootstrapFromDesktopState(
  currentState: Partial<LocalAppState> | undefined,
  bootstrapState: Partial<LocalAppState> | null | undefined,
) {
  if (!bootstrapState) {
    return false;
  }

  const bootstrapTimesheetCount = bootstrapState.timesheetEntries?.length ?? 0;
  const currentTimesheetCount = currentState?.timesheetEntries?.length ?? 0;
  if (currentTimesheetCount === 0 && bootstrapTimesheetCount > 0) {
    return true;
  }

  const currentHasDefaultProjects = hasOnlyDefaultProjects(currentState?.projects);
  const bootstrapHasCustomProjects = !hasOnlyDefaultProjects(bootstrapState.projects);
  return currentHasDefaultProjects && bootstrapHasCustomProjects;
}

function mergeDesktopBootstrapState(
  currentState: Partial<LocalAppState> | undefined,
  bootstrapState: Partial<LocalAppState>,
) {
  const nextState = {
    ...(currentState ?? {}),
  };

  if ((bootstrapState.timesheetEntries?.length ?? 0) > 0) {
    nextState.timesheetEntries = mergeBootstrapTimesheetEntries(
      nextState.timesheetEntries,
      bootstrapState.timesheetEntries,
    );
  }
  if ((nextState.timers?.length ?? 0) === 0 && (bootstrapState.timers?.length ?? 0) > 0) {
    nextState.timers = bootstrapState.timers;
  }
  if (hasOnlyDefaultProjects(nextState.projects) && !hasOnlyDefaultProjects(bootstrapState.projects)) {
    nextState.projects = bootstrapState.projects;
    nextState.team = bootstrapState.team ?? nextState.team;
  }
  if ((nextState.rules?.length ?? 0) === 0 && (bootstrapState.rules?.length ?? 0) > 0) {
    nextState.rules = bootstrapState.rules;
  }
  if ((nextState.segments?.length ?? 0) === 0 && (bootstrapState.segments?.length ?? 0) > 0) {
    nextState.segments = bootstrapState.segments;
  }
  if ((nextState.dismissedSegmentIds?.length ?? 0) === 0 && (bootstrapState.dismissedSegmentIds?.length ?? 0) > 0) {
    nextState.dismissedSegmentIds = bootstrapState.dismissedSegmentIds;
  }
  if ((nextState.editedBlocks?.length ?? 0) === 0 && (bootstrapState.editedBlocks?.length ?? 0) > 0) {
    nextState.editedBlocks = bootstrapState.editedBlocks;
  }
  if ((nextState.importedBrowserDrafts?.length ?? 0) === 0 && (bootstrapState.importedBrowserDrafts?.length ?? 0) > 0) {
    nextState.importedBrowserDrafts = bootstrapState.importedBrowserDrafts;
  }
  if ((nextState.outlookMeetingDrafts?.length ?? 0) === 0 && (bootstrapState.outlookMeetingDrafts?.length ?? 0) > 0) {
    nextState.outlookMeetingDrafts = bootstrapState.outlookMeetingDrafts;
  }

  const nextUpdatedAt =
    typeof nextState.updatedAt === "number" && Number.isFinite(nextState.updatedAt) ? nextState.updatedAt : 0;
  const bootstrapUpdatedAt =
    typeof bootstrapState.updatedAt === "number" && Number.isFinite(bootstrapState.updatedAt)
      ? bootstrapState.updatedAt
      : 0;
  nextState.updatedAt = Math.max(nextUpdatedAt, bootstrapUpdatedAt, Date.now());

  return nextState;
}

function loadState(): LocalAppState {
  const bootstrapState = window.timetrackerDesktop?.bootstrapLocalState;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return normalizeState(bootstrapState ?? createDefaultState());
  }

  const parsedState = JSON.parse(stored) as Partial<LocalAppState>;
  if (shouldBootstrapFromDesktopState(parsedState, bootstrapState)) {
    const mergedState = mergeDesktopBootstrapState(parsedState, bootstrapState!);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedState));
    return normalizeState(mergedState);
  }

  return normalizeState(parsedState);
}

function readState(): LocalAppState {
  cachedState ??= loadState();
  return cachedState;
}

function refreshState(): LocalAppState {
  cachedState = loadState();
  return cachedState;
}

function writeState(state: LocalAppState) {
  const nextState = { ...state, updatedAt: Date.now() };
  cachedState = nextState;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  window.dispatchEvent(new Event("timetracker-local-state"));
}

function updateState(mutator: (state: LocalAppState) => LocalAppState): LocalAppState {
  const next = mutator(readState());
  writeState(next);
  return next;
}

function blockId(block: ActivityBlockRecord): string {
  return block.id ?? block.sourceSegmentIds.join("__");
}

function resolveTaskLabel(state: LocalAppState, projectId?: string, taskId?: string): string {
  const project = state.projects.find((item) => item._id === projectId);
  const task = project?.tasks.find((item) => item._id === taskId);

  return task?.name ?? "";
}

function createTimesheetEntry(
  state: LocalAppState,
  values: {
    localDate: string;
    workItemId?: string;
    projectId?: string;
    taskId?: string;
    note?: string;
    durationMs: number;
    sourceBlockIds: string[];
    entryId?: string;
  },
): LocalTimesheetEntry {
  return {
    _id: values.entryId ?? createId("timesheet"),
    localDate: values.localDate,
    workItemId: values.workItemId,
    projectId: values.projectId,
    taskId: values.taskId,
    label: resolveTaskLabel(state, values.projectId, values.taskId),
    note: values.note,
    durationMs: values.durationMs,
    sourceBlockIds: values.sourceBlockIds,
    committedAt: Date.now(),
    submittedAt: undefined,
    submittedFingerprint: undefined,
  };
}

function applyLoggedTimeToWorkItems(
  workItems: LocalWorkItem[],
  values: {
    workItemId?: string;
    projectId?: string;
    taskId?: string;
    durationMsDelta: number;
  },
) {
  if (values.durationMsDelta === 0) {
    return workItems;
  }

  const deltaHours = durationMsToHours(values.durationMsDelta);
  if (deltaHours === 0) {
    return workItems;
  }

  return workItems.map((workItem) => {
    const matchesWorkItem = Boolean(values.workItemId) && workItem._id === values.workItemId;
    const matchesMappedTask =
      !values.workItemId &&
      Boolean(values.projectId) &&
      Boolean(values.taskId) &&
      workItem.projectId === values.projectId &&
      workItem.taskId === values.taskId;

    if (!matchesWorkItem && !matchesMappedTask) {
      return workItem;
    }

    return {
      ...workItem,
      remainingEstimateHours: applyEstimateDelta(workItem.remainingEstimateHours, -deltaHours, { clampAtZero: true }),
      completedEstimateHours: applyEstimateDelta(workItem.completedEstimateHours, deltaHours, { clampAtZero: true }),
    };
  });
}

function applyConnectorFieldUpdateToWorkItem(
  workItem: LocalWorkItem,
  fieldKey: LocalWorkItemEstimateFieldKey,
  update: ConnectorSyncFieldUpdate,
): LocalWorkItem {
  const nextEstimateSync: LocalWorkItemEstimateSyncState = {
    ...workItem.estimateSync,
  };
  const currentFieldState = nextEstimateSync[fieldKey];
  const nextFieldState: LocalWorkItemEstimateFieldState = {
    ...currentFieldState,
    remoteValue: update.remoteValue ?? currentFieldState?.remoteValue,
  };

  switch (update.status) {
    case "pulled":
      nextFieldState.baselineValue = update.nextBaselineValue ?? update.remoteValue;
      nextFieldState.remoteValue = update.remoteValue;
      nextFieldState.resolution = undefined;
      nextFieldState.conflict = undefined;
      nextFieldState.error = undefined;
      return {
        ...workItem,
        [fieldKey]: update.remoteValue,
        estimateSync: {
          ...nextEstimateSync,
          [fieldKey]: nextFieldState,
        },
      };
    case "pushed":
    case "noop":
      nextFieldState.baselineValue = update.nextBaselineValue ?? nextFieldState.baselineValue;
      nextFieldState.resolution = undefined;
      nextFieldState.conflict = undefined;
      nextFieldState.error = undefined;
      return {
        ...workItem,
        estimateSync: {
          ...nextEstimateSync,
          [fieldKey]: nextFieldState,
        },
      };
    case "conflict":
      nextFieldState.conflict = {
        detectedAt: Date.now(),
        localValue: update.localValue ?? workItem[fieldKey],
        remoteValue: update.remoteValue,
        baselineValue: update.baselineValue ?? currentFieldState?.baselineValue,
      };
      nextFieldState.error = undefined;
      return {
        ...workItem,
        estimateSync: {
          ...nextEstimateSync,
          [fieldKey]: nextFieldState,
        },
      };
    case "error":
      nextFieldState.error = {
        detectedAt: Date.now(),
        message: update.message ?? "Sync failed.",
      };
      return {
        ...workItem,
        estimateSync: {
          ...nextEstimateSync,
          [fieldKey]: nextFieldState,
        },
      };
  }
}

function buildSampleSegment(state: LocalAppState, url: string, title: string): ActivitySegmentRecord {
  const endedAt = Date.now();
  const startedAt = endedAt - 20 * 60 * 1000;
  const normalized = normalizeActivityContext({ url, title }, { capture: state.capture });

  return {
    externalSegmentId: createId("segment"),
    userId: state.user._id,
    teamId: state.team?._id ?? "local_team",
    deviceId: "local_web",
    source: "browser_extension",
    capturedUrlMode: state.capture.urlMode,
    localDate: new Date(startedAt).toISOString().slice(0, 10),
    startedAt,
    endedAt,
    activeDurationMs: endedAt - startedAt,
    idleDurationMs: 0,
    isIdleSplit: false,
    context: { url, title },
    normalized,
    createdAt: Date.now(),
  };
}

function materializeBlocks(state: LocalAppState, localDate: string): ActivityBlockRecord[] {
  const visibleSegments = state.segments.filter(
    (segment) =>
      segment.localDate === localDate &&
      !state.dismissedSegmentIds.includes(segment.externalSegmentId) &&
      !state.editedBlocks.some((block) => block.sourceSegmentIds.includes(segment.externalSegmentId)),
  );

  const draftBlocks = aggregateSegmentsToBlocks(visibleSegments, {
    mergeGapMs: state.team?.settings.mergeGapMs ?? defaultTeamSettings.mergeGapMs,
    microBlockThresholdMs:
      state.team?.settings.microBlockThresholdMs ?? defaultTeamSettings.microBlockThresholdMs,
  }).map((block) => {
    const evaluation = evaluateBlockAgainstRules(block, state.rules, []);
    const suggestion = evaluation.suggestion;
    return {
      ...block,
      id: blockId(block),
      projectId: suggestion?.projectId,
      confidence: suggestion?.confidence ?? 0,
      explanation: suggestion?.explanation,
      assignmentSource: suggestion?.source ?? "none",
      status: suggestion ? "suggested" : "draft",
    } satisfies ActivityBlockRecord;
  });

  return [...state.editedBlocks.filter((block) => block.localDate === localDate), ...draftBlocks]
    .sort((a, b) => a.startedAt - b.startedAt);
}

function createBucketRuleSeed(
  state: LocalAppState,
  bucket: BrowserActivityBucket,
): ActivityBlockRecord {
  return {
    id: bucket.bucketKey,
    userId: state.user._id,
    teamId: state.team?._id ?? "local_team",
    localDate: bucket.localDate,
    startedAt: bucket.startedAt,
    endedAt: bucket.endedAt,
    durationMs: bucket.durationMs,
    sourceSegmentIds: bucket.evidence.flatMap((item) => item.sourceSegmentIds),
    fingerprint: bucket.dominant.fingerprint,
    display: {
      label: bucket.dominant.label,
      subtitle: bucket.dominant.subtitle,
    },
    status: "suggested",
    assignmentSource: "none",
    confidence: bucket.confidence,
    isMicroBlock: bucket.durationMs < (state.team?.settings.microBlockThresholdMs ?? defaultTeamSettings.microBlockThresholdMs),
    locked: false,
    domain: bucket.dominant.domain,
    pathname: bucket.dominant.pathname,
    title: bucket.dominant.title,
  };
}

function createImportedDraft(state: LocalAppState, bucket: BrowserActivityBucket): ImportedBrowserDraft {
  const evaluation = evaluateBlockAgainstRules(createBucketRuleSeed(state, bucket), state.rules, []);
  const suggestion = evaluation.suggestion;
  const explanation =
    suggestion?.explanation ??
    (bucket.isMixed
      ? `Mixed browser bucket. Dominant activity covered ${Math.round(bucket.confidence * 100)}% of this 5-minute window.`
      : "Imported browser activity. No saved rule matched yet.");

  return {
    _id: `browser_${bucket.bucketKey}`,
    bucketKey: bucket.bucketKey,
    localDate: bucket.localDate,
    startedAt: bucket.startedAt,
    endedAt: bucket.endedAt,
    durationMs: bucket.durationMs,
    dominantDomain: bucket.dominant.domain,
    dominantPathname: bucket.dominant.pathname,
    dominantTitle: bucket.dominant.title,
    dominantLabel: bucket.dominant.label,
    dominantSubtitle: bucket.dominant.subtitle,
    dominantFingerprint: bucket.dominant.fingerprint,
    evidence: bucket.evidence,
    dismissed: false,
    status: suggestion?.projectId ? "assigned" : "draft",
    projectId: suggestion?.projectId,
    importedAt: bucket.importedAt,
    source: "extension_bridge",
    confidence: suggestion?.confidence ?? bucket.confidence,
    isMixed: bucket.isMixed,
    assignmentSource: suggestion?.source ?? "none",
    explanation,
    manuallyEdited: false,
  };
}

function preserveImportedDraft(
  state: LocalAppState,
  existing: ImportedBrowserDraft | undefined,
  incoming: ImportedBrowserDraft,
): ImportedBrowserDraft {
  if (!existing) {
    return incoming;
  }

  return {
    ...incoming,
    projectId: existing.manuallyEdited ? existing.projectId : incoming.projectId,
    note: existing.note,
    dismissed: existing.dismissed,
    status:
      existing.status === "committed" || existing.status === "dismissed" || existing.manuallyEdited
        ? existing.status
        : incoming.status,
    assignmentSource: existing.manuallyEdited ? existing.assignmentSource : incoming.assignmentSource,
    explanation: existing.manuallyEdited && existing.explanation ? existing.explanation : incoming.explanation,
    manuallyEdited: existing.manuallyEdited,
  };
}

function materializeImportedDrafts(state: LocalAppState, localDate: string): ImportedBrowserDraft[] {
  return state.importedBrowserDrafts
    .filter(
      (draft) =>
        draft.localDate === localDate &&
        draft.status !== "dismissed" &&
        draft.status !== "committed",
    )
    .sort((a, b) => a.startedAt - b.startedAt);
}

function createOutlookMeetingDraft(meeting: OutlookCalendarEvent): OutlookMeetingDraft {
  const detailParts = [meeting.organizer, meeting.location].filter(Boolean);

  return {
    _id: `meeting_${meeting.eventId}`,
    eventId: meeting.eventId,
    localDate: meeting.localDate,
    startedAt: meeting.startedAt,
    endedAt: meeting.endedAt,
    durationMs: meeting.durationMs,
    subject: meeting.subject,
    organizer: meeting.organizer,
    location: meeting.location,
    isOnlineMeeting: meeting.isOnlineMeeting,
    webLink: meeting.webLink,
    dismissed: false,
    status: "draft",
    importedAt: Date.now(),
    source: "outlook_calendar",
    assignmentSource: "none",
    explanation:
      detailParts.length > 0
        ? `Imported from Outlook calendar. ${detailParts.join(" · ")}`
        : "Imported from Outlook calendar.",
    manuallyEdited: false,
  };
}

function preserveOutlookMeetingDraft(
  existing: OutlookMeetingDraft | undefined,
  incoming: OutlookMeetingDraft,
): OutlookMeetingDraft {
  if (!existing) {
    return incoming;
  }

  return {
    ...incoming,
    projectId: existing.projectId,
    note: existing.note,
    dismissed: existing.dismissed,
    status:
      existing.status === "committed" || existing.status === "dismissed" || existing.projectId
        ? existing.status
        : incoming.status,
    assignmentSource: existing.projectId ? existing.assignmentSource : incoming.assignmentSource,
    explanation: existing.explanation || incoming.explanation,
    manuallyEdited: existing.manuallyEdited,
  };
}

function materializeOutlookMeetings(state: LocalAppState, localDate: string): OutlookMeetingDraft[] {
  return state.outlookMeetingDrafts
    .filter(
      (meeting) =>
        meeting.localDate === localDate &&
        meeting.status !== "dismissed" &&
        meeting.status !== "committed",
    )
    .sort((a, b) => a.startedAt - b.startedAt);
}

export const localStore = {
  subscribe(callback: () => void) {
    const notify = () => {
      refreshState();
      callback();
    };

    window.addEventListener("timetracker-local-state", notify);
    window.addEventListener("storage", notify);
    return () => {
      window.removeEventListener("timetracker-local-state", notify);
      window.removeEventListener("storage", notify);
    };
  },
  snapshot: readState,
  createTeam(teamName: string, teamSlug: string, projects: LocalProjectDraft[]) {
    updateState((state) => ({
      ...state,
      team: {
        _id: "local_team",
        name: teamName,
        slug: teamSlug,
        settings: defaultTeamSettings,
      },
      projects: projects.map((project) => createProjectRecord(project)),
    }));
  },
  addProject(project: LocalProjectDraft) {
    const nextProject = createProjectRecord(project);
    updateState((state) => ({
      ...state,
      projects: [...state.projects, nextProject],
    }));
    return nextProject._id;
  },
  updateProject(projectId: string, patch: Partial<Omit<LocalProject, "_id">>) {
    updateState((state) => ({
      ...state,
      projects: state.projects.map((project) => (project._id === projectId ? { ...project, ...patch } : project)),
    }));
  },
  archiveProject(projectId: string) {
    this.updateProject(projectId, { status: "archived" });
  },
  unarchiveProject(projectId: string) {
    this.updateProject(projectId, { status: "active" });
  },
  addProjectTask(projectId: string, name: string) {
    updateState((state) => ({
      ...state,
      projects: state.projects.map((project) =>
        project._id === projectId
          ? {
              ...project,
              tasks: [...project.tasks, createProjectTask({ name })],
            }
          : project,
        ),
    }));
  },
  reorderProjectTask(projectId: string, taskId: string, toIndex: number) {
    updateState((state) => ({
      ...state,
      projects: state.projects.map((project) => {
        if (project._id !== projectId) {
          return project;
        }

        const activeTasks = project.tasks.filter((task) => task.status === "active");
        if (activeTasks.length < 2) {
          return project;
        }

        const archivedTasks = project.tasks.filter((task) => task.status === "archived");
        const sourceIndex = activeTasks.findIndex((task) => task._id === taskId);
        const targetIndex = Math.max(0, Math.min(toIndex, activeTasks.length - 1));

        if (sourceIndex === -1 || sourceIndex === targetIndex) {
          return project;
        }

        return {
          ...project,
          tasks: [...moveItem(activeTasks, sourceIndex, targetIndex), ...archivedTasks],
        };
      }),
    }));
  },
  importProjectTasks(projectId: string, taskNames: string[]): ProjectTaskImportResult {
    let importResult: ProjectTaskImportResult = {
      importedCount: 0,
      duplicateCount: 0,
      blankCount: 0,
      headerCount: 0,
      importedNames: [],
    };
    let projectFound = false;

    updateState((state) => {
      const project = state.projects.find((item) => item._id === projectId);
      if (!project) {
        return state;
      }

      projectFound = true;

      const existingTaskNames = new Set(project.tasks.map((task) => normalizeTaskImportName(task.name)));
      const incomingTaskNames = new Set<string>();
      const nextTasks = [...project.tasks];
      const importedNames: string[] = [];
      let duplicateCount = 0;

      for (const taskName of taskNames) {
        const displayName = formatTaskImportName(taskName);
        const normalizedName = normalizeTaskImportName(displayName);

        if (!normalizedName) {
          continue;
        }

        if (existingTaskNames.has(normalizedName) || incomingTaskNames.has(normalizedName)) {
          duplicateCount += 1;
          continue;
        }

        incomingTaskNames.add(normalizedName);
        existingTaskNames.add(normalizedName);
        importedNames.push(displayName);
        nextTasks.push(createProjectTask({ name: displayName }));
      }

      importResult = {
        importedCount: importedNames.length,
        duplicateCount,
        blankCount: 0,
        headerCount: 0,
        importedNames,
      };

      return {
        ...state,
        projects: state.projects.map((item) => (item._id === projectId ? { ...item, tasks: nextTasks } : item)),
      };
    });

    if (!projectFound) {
      throw new Error("Project not found.");
    }

    return importResult;
  },
  importProjectWorkbookRows(
    rows: Array<{
      project: string;
      code: string;
      color: string;
      status: "active" | "archived";
      task: string;
      taskStatus: "active" | "archived" | "";
    }>,
  ) {
    let importResult = {
      createdProjectCount: 0,
      mergedProjectCount: 0,
      addedTaskCount: 0,
      updatedTaskCount: 0,
    };

    updateState((state) => {
      const groupedRows = groupProjectWorkbookRows(rows);
      const nextProjects = [...state.projects];

      for (const group of groupedRows) {
        const existingProject = findImportedProjectByName(nextProjects, group.projectName);

        if (!existingProject) {
          const nextProject = createProjectRecord({
            name: group.projectName,
            code: group.code,
            color: group.color || "#3d5a80",
            tasks: group.tasks.map((task) => ({
              name: task.name,
              status: task.status,
            })),
          });
          nextProject.status = group.status;
          nextProjects.push(nextProject);
          importResult.createdProjectCount += 1;
          importResult.addedTaskCount += group.tasks.length;
          continue;
        }

        importResult.mergedProjectCount += 1;

        const nextTasks = [...existingProject.tasks];
        for (const importedTask of group.tasks) {
          const existingTask = findImportedProjectTaskByName(existingProject, importedTask.name);
          if (!existingTask) {
            nextTasks.push(
              createProjectTask({
                name: importedTask.name,
                status: importedTask.status,
              }),
            );
            importResult.addedTaskCount += 1;
            continue;
          }

          if (existingTask.status !== importedTask.status) {
            importResult.updatedTaskCount += 1;
          }

          const existingTaskIndex = nextTasks.findIndex((task) => task._id === existingTask._id);
          if (existingTaskIndex >= 0) {
            nextTasks[existingTaskIndex] = {
              ...existingTask,
              status: importedTask.status,
              archivedAt: importedTask.status === "archived" ? existingTask.archivedAt ?? Date.now() : undefined,
            };
          }
        }

        const projectIndex = nextProjects.findIndex((project) => project._id === existingProject._id);
        if (projectIndex >= 0) {
          nextProjects[projectIndex] = {
            ...existingProject,
            name: group.projectName,
            code: group.code || undefined,
            color: group.color || existingProject.color,
            status: group.status,
            tasks: nextTasks,
          };
        }
      }

      return {
        ...state,
        projects: nextProjects,
      };
    });

    return importResult;
  },
  renameProjectTask(projectId: string, taskId: string, name: string) {
    updateState((state) => ({
      ...state,
      projects: state.projects.map((project) =>
        project._id === projectId
          ? {
              ...project,
              tasks: project.tasks.map((task) =>
                task._id === taskId ? { ...task, name } : task,
              ),
            }
          : project,
      ),
    }));
  },
  archiveProjectTask(projectId: string, taskId: string) {
    updateState((state) => ({
      ...state,
      projects: state.projects.map((project) =>
        project._id === projectId
          ? {
              ...project,
              tasks: project.tasks.map((task) =>
                task._id === taskId
                  ? {
                      ...task,
                      status: "archived",
                      archivedAt: task.archivedAt ?? Date.now(),
                    }
                  : task,
              ),
            }
          : project,
      ),
    }));
  },
  unarchiveProjectTask(projectId: string, taskId: string) {
    updateState((state) => ({
      ...state,
      projects: state.projects.map((project) =>
        project._id === projectId
          ? {
              ...project,
              tasks: project.tasks.map((task) =>
                task._id === taskId
                  ? {
                      ...task,
                      status: "active",
                      archivedAt: undefined,
                    }
                  : task,
              ),
            }
          : project,
        ),
    }));
  },
  addBacklogStatus(name: string, color?: string) {
    const normalizedName = normalizeBacklogStatusName(name);
    if (!normalizedName) {
      throw new Error("Status name is required.");
    }

    let backlogStatusId = "";

    updateState((state) => {
      if (
        state.backlogStatuses.some(
          (status) => normalizeBacklogStatusName(status.name).toLocaleLowerCase() === normalizedName.toLocaleLowerCase(),
        )
      ) {
        throw new Error("Status already exists.");
      }

      const nextStatus = {
        _id: createId("backlog_status"),
        name: normalizedName,
        color: normalizeBacklogStatusColor(color, getDefaultBacklogStatusColor(state.backlogStatuses.length)),
        createdAt: Date.now(),
      } satisfies LocalBacklogStatus;
      backlogStatusId = nextStatus._id;

      return {
        ...state,
        backlogStatuses: [...state.backlogStatuses, nextStatus],
      };
    });

    return backlogStatusId;
  },
  updateBacklogStatus(
    statusId: string,
    updates: string | { name: string; color?: string },
  ) {
    const nextName = typeof updates === "string" ? updates : updates.name;
    const nextColor = typeof updates === "string" ? undefined : updates.color;
    const normalizedName = normalizeBacklogStatusName(nextName);
    if (!normalizedName) {
      throw new Error("Status name is required.");
    }

    updateState((state) => {
      const target = state.backlogStatuses.find((status) => status._id === statusId);
      if (!target) {
        throw new Error("Status not found.");
      }

      if (
        state.backlogStatuses.some(
          (status) =>
            status._id !== statusId &&
            normalizeBacklogStatusName(status.name).toLocaleLowerCase() === normalizedName.toLocaleLowerCase(),
        )
      ) {
        throw new Error("Status already exists.");
      }

      const normalizedColor = normalizeBacklogStatusColor(
        nextColor,
        target.color || getDefaultBacklogStatusColor(state.backlogStatuses.findIndex((status) => status._id === statusId)),
      );

      return {
        ...state,
        backlogStatuses: state.backlogStatuses.map((status) =>
          status._id === statusId ? { ...status, name: normalizedName, color: normalizedColor } : status,
        ),
      };
    });
  },
  deleteBacklogStatus(statusId: string) {
    updateState((state) =>
      reconcileImportedBacklogStatuses({
        ...state,
        backlogStatuses: state.backlogStatuses.filter((status) => status._id !== statusId),
        backlogStatusMappings: state.backlogStatusMappings.filter(
          (mapping) => mapping.backlogStatusId !== statusId,
        ),
        workItems: state.workItems.map((workItem) => ({
          ...workItem,
          backlogStatusId: workItem.backlogStatusId === statusId ? undefined : workItem.backlogStatusId,
          importedBacklogStatusId:
            workItem.importedBacklogStatusId === statusId ? undefined : workItem.importedBacklogStatusId,
        })),
      }),
    );
  },
  setBacklogStatusMapping(mapping: {
    source: ConnectorBacklogSource;
    connectionId: string;
    sourceStatusKey: string;
    backlogStatusId?: string;
  }) {
    const sourceStatusKey = normalizeConnectorStatusKey(mapping.sourceStatusKey);
    if (!mapping.connectionId || !sourceStatusKey) {
      throw new Error("Source status mapping is incomplete.");
    }

    updateState((state) => {
      const nextMappings = state.backlogStatusMappings.filter(
        (candidate) =>
          !(
            candidate.source === mapping.source &&
            candidate.connectionId === mapping.connectionId &&
            candidate.sourceStatusKey === sourceStatusKey
          ),
      );

      if (mapping.backlogStatusId) {
        nextMappings.push({
          source: mapping.source,
          connectionId: mapping.connectionId,
          sourceStatusKey,
          backlogStatusId: mapping.backlogStatusId,
        });
      }

      return reconcileImportedBacklogStatuses({
        ...state,
        backlogStatusMappings: nextMappings,
      });
    });
  },
  startTimer(timer: LocalTimerDraft) {
    updateState((state) => ({
      ...state,
      timers: [
        {
          _id: createId("timer"),
          startedAt: Date.now(),
          localDate: timer.localDate,
          workItemId: timer.workItemId,
          projectId: timer.projectId,
          taskId: timer.taskId,
          note: timer.note,
          accumulatedDurationMs: timer.accumulatedDurationMs ?? 0,
          entryId: timer.entryId,
        },
      ],
    }));
  },
  startTimerWithEntry(values: {
    localDate: string;
    workItemId?: string;
    projectId?: string;
    taskId?: string;
    note?: string;
    durationMs?: number;
  }) {
    updateState((state) => {
      if (state.timers.length > 0) {
        return state;
      }

      const nextEntry = createTimesheetEntry(state, {
        localDate: values.localDate,
        workItemId: values.workItemId,
        projectId: values.projectId,
        taskId: values.taskId,
        note: values.note,
        durationMs: values.durationMs ?? 0,
        sourceBlockIds: [],
      });

      return {
        ...state,
        timers: [
          {
            _id: createId("timer"),
            startedAt: Date.now(),
            localDate: values.localDate,
            workItemId: values.workItemId,
            projectId: values.projectId,
            taskId: values.taskId,
            note: values.note,
            accumulatedDurationMs: values.durationMs ?? 0,
            entryId: nextEntry._id,
          },
        ],
        timesheetEntries: [...state.timesheetEntries, nextEntry],
      };
    });
  },
  updateTimer(timerId: string, patch: Partial<Omit<LocalTimer, "_id" | "startedAt">>) {
    updateState((state) => {
      return {
        ...state,
        timers: state.timers.map((timer) => (timer._id === timerId ? { ...timer, ...patch } : timer)),
      };
    });
  },
  cancelTimer(timerId: string) {
    updateState((state) => ({
      ...state,
      timers: state.timers.filter((timer) => timer._id !== timerId),
    }));
  },
  saveManualTimeEntry(values: {
    localDate: string;
    workItemId?: string;
    projectId?: string;
    taskId?: string;
    note?: string;
    durationMs: number;
  }) {
    updateState((state) => ({
        ...state,
        timesheetEntries: [
          ...state.timesheetEntries,
          createTimesheetEntry(state, {
            ...values,
          sourceBlockIds: [],
        }),
      ],
      workItems: applyLoggedTimeToWorkItems(state.workItems, {
        workItemId: values.workItemId,
        projectId: values.projectId,
        taskId: values.taskId,
        durationMsDelta: values.durationMs,
      }),
    }));
  },
  stageTimesheetImportRows(
    rows: Array<{
      date: string;
      project: string;
      task: string;
      note?: string;
      hours: number;
    }>,
  ) {
    updateState((state) => ({
      ...state,
      timesheetImportDrafts: rows.map((row) => createTimesheetImportDraft(state, row)),
    }));
  },
  clearTimesheetImportDrafts() {
    updateState((state) => ({
      ...state,
      timesheetImportDrafts: [],
    }));
  },
  dismissTimesheetImportDraft(draftId: string) {
    updateState((state) => ({
      ...state,
      timesheetImportDrafts: state.timesheetImportDrafts.filter((draft) => draft._id !== draftId),
    }));
  },
  dismissAllTimesheetImportDrafts() {
    this.clearTimesheetImportDrafts();
  },
  commitTimesheetImportDraft(draftId: string) {
    updateState((state) => {
      const draft = state.timesheetImportDrafts.find((item) => item._id === draftId);
      if (!draft) {
        return state;
      }

      const ensured = ensureImportedProjectAndTask(state, {
        projectName: draft.projectName,
        taskName: draft.taskName,
      });

      return {
        ...state,
        projects: ensured.projects,
        timesheetEntries: [
          ...state.timesheetEntries,
          createTimesheetEntry(
            {
              ...state,
              projects: ensured.projects,
            },
            {
              localDate: draft.localDate,
              projectId: ensured.projectId,
              taskId: ensured.taskId,
              note: draft.note,
              durationMs: draft.durationMs,
              sourceBlockIds: [],
            },
          ),
        ],
        workItems: applyLoggedTimeToWorkItems(state.workItems, {
          projectId: ensured.projectId,
          taskId: ensured.taskId,
          durationMsDelta: draft.durationMs,
        }),
        timesheetImportDrafts: state.timesheetImportDrafts.filter((item) => item._id !== draftId),
      };
    });
  },
  commitReadyTimesheetImportDrafts() {
    updateState((state) => {
      const readyDrafts = state.timesheetImportDrafts.filter((draft) => !draft.potentialConflict);
      if (readyDrafts.length === 0) {
        return state;
      }

      let nextState = state;
      for (const draft of readyDrafts) {
        const ensured = ensureImportedProjectAndTask(nextState, {
          projectName: draft.projectName,
          taskName: draft.taskName,
        });

        nextState = {
          ...nextState,
          projects: ensured.projects,
          timesheetEntries: [
            ...nextState.timesheetEntries,
            createTimesheetEntry(
              {
                ...nextState,
                projects: ensured.projects,
              },
              {
                localDate: draft.localDate,
                projectId: ensured.projectId,
                taskId: ensured.taskId,
                note: draft.note,
                durationMs: draft.durationMs,
                sourceBlockIds: [],
              },
            ),
          ],
          workItems: applyLoggedTimeToWorkItems(nextState.workItems, {
            projectId: ensured.projectId,
            taskId: ensured.taskId,
            durationMsDelta: draft.durationMs,
          }),
        };
      }

      return {
        ...nextState,
        timesheetImportDrafts: nextState.timesheetImportDrafts.filter((draft) => draft.potentialConflict),
      };
    });
  },
  addWorkItem(workItem: LocalWorkItemDraft) {
    const title = workItem.title.trim();
    if (!title) {
      throw new Error("Work item title is required.");
    }

    let createdWorkItemId = "";

    updateState((state) => {
      if (workItem.parentWorkItemId) {
        const parent = state.workItems.find((item) => item._id === workItem.parentWorkItemId);
        if (!parent) {
          throw new Error("Parent work item not found.");
        }

        if (parent.parentWorkItemId || parent.parentSourceId || (parent.hierarchyLevel ?? 0) > 0) {
          throw new Error("Subtasks cannot have subtasks.");
        }
      }

      const createdWorkItem = createWorkItem({
        ...workItem,
        title,
        priority: workItem.parentWorkItemId ? undefined : workItem.priority,
        backlogStatusId: workItem.backlogStatusId,
      });
      createdWorkItemId = createdWorkItem._id;
      return {
        ...state,
        workItems: [createdWorkItem, ...state.workItems],
      };
    });

    if (!createdWorkItemId) {
      throw new Error("Work item could not be created.");
    }

    return createdWorkItemId;
  },
  addSubtask(parentWorkItemId: string, workItem: Omit<LocalWorkItemDraft, "parentWorkItemId">) {
    return this.addWorkItem({
      ...workItem,
      parentWorkItemId,
    });
  },
  importConnectorWorkItems(
    workItems: ConnectorImportCandidate[],
    options?: { archiveMissingFromConnectionId?: string },
  ) {
    let importedCount = 0;
    let updatedCount = 0;
    let archivedCount = 0;

    updateState((state) => {
      const existingItemsByKey = new Map<string, LocalWorkItem>(
        state.workItems
          .filter((workItem): workItem is LocalWorkItem & { sourceId: string } => Boolean(workItem.sourceId))
          .map((workItem) => [getWorkItemSourceKey(workItem), workItem] as const),
      );
      const importedKeysForConnection = new Set<string>();

      const importedItems: LocalWorkItem[] = [];
      let nextWorkItems = state.workItems;
      let changedExistingItems = false;
      for (const workItem of workItems) {
        const key = getWorkItemSourceKey(workItem);
        const mappedBacklogStatusId = workItem.state?.trim()
          ? findMappedBacklogStatusId(
              state.backlogStatusMappings,
              workItem.source,
              workItem.connectionId,
              normalizeConnectorStatusKey(workItem.state),
            )
          : undefined;
        const existingWorkItem = existingItemsByKey.get(key);
        if (options?.archiveMissingFromConnectionId === workItem.connectionId) {
          importedKeysForConnection.add(key);
        }
        if (existingWorkItem) {
          const mergedWorkItem = mergeConnectorWorkItem(existingWorkItem, workItem, mappedBacklogStatusId);
          if (mergedWorkItem !== existingWorkItem) {
            if (!changedExistingItems) {
              nextWorkItems = [...state.workItems];
              changedExistingItems = true;
            }

            const existingIndex = nextWorkItems.findIndex((candidate) => candidate._id === existingWorkItem._id);
            if (existingIndex >= 0) {
              nextWorkItems[existingIndex] = mergedWorkItem;
              existingItemsByKey.set(key, mergedWorkItem);
            }
          }

          updatedCount += 1;
          continue;
        }

        const importedItem = createConnectorWorkItem(workItem, mappedBacklogStatusId);

        existingItemsByKey.set(key, importedItem);
        importedItems.push(importedItem);
        importedCount += 1;
      }

      if (options?.archiveMissingFromConnectionId) {
        const archiveConnectionId = options.archiveMissingFromConnectionId;
        const archivedWorkItems = (changedExistingItems ? nextWorkItems : [...state.workItems]).map((workItem) => {
          const sourceId = workItem.sourceId;

          if (
            workItem.source === "manual" ||
            workItem.source === "outlook" ||
            workItem.sourceConnectionId !== archiveConnectionId ||
            !sourceId
          ) {
            return workItem;
          }

          if (
            importedKeysForConnection.has(getWorkItemSourceKey({ source: workItem.source, sourceId })) ||
            workItem.status === "archived"
          ) {
            return workItem;
          }

          archivedCount += 1;
          changedExistingItems = true;
          return {
            ...workItem,
            status: "archived" as const,
            archivedAt: workItem.archivedAt ?? Date.now(),
          };
        });

        nextWorkItems = archivedWorkItems;
      }

      if (importedItems.length === 0 && !changedExistingItems) {
        return state;
      }

      return {
        ...state,
        workItems: [...importedItems, ...nextWorkItems],
      };
    });

    return {
      importedCount,
      updatedCount,
      archivedCount,
    };
  },
  applyConnectorSyncWorkItemUpdates(updates: ConnectorSyncWorkItemUpdate[]) {
    if (updates.length === 0) {
      return;
    }

    updateState((state) => ({
      ...state,
      workItems: state.workItems.map((workItem) => {
        const update = updates.find((item) => item.localWorkItemId === workItem._id);
        if (!update) {
          return workItem;
        }

        let nextWorkItem = workItem;
        if (update.fields.originalEstimateHours) {
          nextWorkItem = applyConnectorFieldUpdateToWorkItem(
            nextWorkItem,
            "originalEstimateHours",
            update.fields.originalEstimateHours,
          );
        }
        if (update.fields.remainingEstimateHours) {
          nextWorkItem = applyConnectorFieldUpdateToWorkItem(
            nextWorkItem,
            "remainingEstimateHours",
            update.fields.remainingEstimateHours,
          );
        }
        if (update.fields.completedEstimateHours) {
          nextWorkItem = applyConnectorFieldUpdateToWorkItem(
            nextWorkItem,
            "completedEstimateHours",
            update.fields.completedEstimateHours,
          );
        }

        return nextWorkItem;
      }),
    }));
  },
  keepLocalEstimateConflict(workItemId: string, fieldKey: LocalWorkItemEstimateFieldKey) {
    updateState((state) => ({
      ...state,
      workItems: state.workItems.map((workItem) => {
        if (workItem._id !== workItemId) {
          return workItem;
        }

        return {
          ...workItem,
          estimateSync: {
            ...workItem.estimateSync,
            [fieldKey]: {
              ...workItem.estimateSync?.[fieldKey],
              resolution: "keep_local" as const,
              error: undefined,
            },
          },
        };
      }),
    }));
  },
  acceptRemoteEstimateValue(workItemId: string, fieldKey: LocalWorkItemEstimateFieldKey) {
    updateState((state) => ({
      ...state,
      workItems: state.workItems.map((workItem) => {
        if (workItem._id !== workItemId) {
          return workItem;
        }

        const fieldState = workItem.estimateSync?.[fieldKey];
        const remoteValue = fieldState?.conflict?.remoteValue ?? fieldState?.remoteValue;
        return {
          ...workItem,
          [fieldKey]: remoteValue,
          estimateSync: {
            ...workItem.estimateSync,
            [fieldKey]: {
              ...fieldState,
              baselineValue: remoteValue,
              remoteValue,
              resolution: undefined,
              conflict: undefined,
              error: undefined,
            },
          },
        };
      }),
    }));
  },
  dismissEstimateIssue(workItemId: string, fieldKey: LocalWorkItemEstimateFieldKey) {
    updateState((state) => ({
      ...state,
      workItems: state.workItems.map((workItem) => {
        if (workItem._id !== workItemId) {
          return workItem;
        }

        const fieldState = workItem.estimateSync?.[fieldKey];
        return {
          ...workItem,
          estimateSync: {
            ...workItem.estimateSync,
            [fieldKey]: {
              ...fieldState,
              baselineValue:
                workItem[fieldKey] === fieldState?.remoteValue ? fieldState?.remoteValue : fieldState?.baselineValue,
              resolution: undefined,
              conflict: undefined,
              error: undefined,
            },
          },
        };
      }),
    }));
  },
  reorderWorkItems(orderedIds: string[]) {
    if (orderedIds.length < 2) {
      return;
    }

    const nextIndexById = new Map(orderedIds.map((id, index) => [id, index]));

    updateState((state) => {
      const selectedItems = state.workItems.filter((workItem) => nextIndexById.has(workItem._id));
      if (selectedItems.length !== orderedIds.length) {
        return state;
      }

      const reorderedItems = [...selectedItems].sort(
        (left, right) => nextIndexById.get(left._id)! - nextIndexById.get(right._id)!,
      );

      let cursor = 0;
      let changed = false;

      const nextWorkItems = state.workItems.map((workItem) => {
        if (!nextIndexById.has(workItem._id)) {
          return workItem;
        }

        const nextWorkItem = reorderedItems[cursor++] ?? workItem;
        if (nextWorkItem._id !== workItem._id) {
          changed = true;
        }

        return nextWorkItem;
      });

      return changed
        ? {
            ...state,
            workItems: nextWorkItems,
          }
        : state;
    });
  },
  setBacklogSortMode(mode: BacklogSortMode) {
    updateState((state) => (state.backlogSortMode === mode ? state : { ...state, backlogSortMode: mode }));
  },
  updateWorkItem(workItemId: string, patch: Partial<Omit<LocalWorkItem, "_id" | "createdAt" | "source">>) {
    updateState((state) => {
      const target = state.workItems.find((workItem) => workItem._id === workItemId);
      if (!target) {
        return state;
      }

      const parentWorkItemIdProvided = Object.prototype.hasOwnProperty.call(patch, "parentWorkItemId");
      const parentSourceIdProvided = Object.prototype.hasOwnProperty.call(patch, "parentSourceId");
      const nextParentWorkItemId = parentWorkItemIdProvided
        ? (typeof patch.parentWorkItemId === "string" ? patch.parentWorkItemId || undefined : patch.parentWorkItemId)
        : target.parentWorkItemId;
      const nextParentSourceId = nextParentWorkItemId
        ? undefined
        : parentWorkItemIdProvided
          ? undefined
          : parentSourceIdProvided
            ? patch.parentSourceId
            : target.parentSourceId;

      if (nextParentWorkItemId) {
        assertValidParentWorkItem(state.workItems, workItemId, nextParentWorkItemId);
      }

      const nextIsSubtask = Boolean(nextParentWorkItemId || nextParentSourceId);
      const priorityProvided = Object.prototype.hasOwnProperty.call(patch, "priority");
      const normalizedPriority = normalizePriorityValue(patch.priority);
      const nextPriority = nextIsSubtask
        ? undefined
        : (priorityProvided ? normalizedPriority : target.priority);

      return {
        ...state,
        workItems: state.workItems.map((workItem) =>
          workItem._id === workItemId
            ? {
                ...workItem,
                ...patch,
                title: typeof patch.title === "string" ? patch.title.trim() : workItem.title,
                note:
                  typeof patch.note === "string"
                    ? patch.note.trim() || undefined
                    : "note" in patch
                      ? patch.note
                      : workItem.note,
                parentWorkItemId: nextParentWorkItemId,
                parentSourceId: nextParentWorkItemId ? undefined : nextParentSourceId,
                hierarchyLevel: nextIsSubtask ? 1 : 0,
                priority: nextPriority,
                originalEstimateHours:
                  "originalEstimateHours" in patch
                    ? normalizeEstimateValue(patch.originalEstimateHours)
                    : workItem.originalEstimateHours,
                remainingEstimateHours:
                  "remainingEstimateHours" in patch
                    ? normalizeEstimateValue(patch.remainingEstimateHours)
                    : workItem.remainingEstimateHours,
                completedEstimateHours:
                  "completedEstimateHours" in patch
                    ? normalizeEstimateValue(patch.completedEstimateHours)
                    : workItem.completedEstimateHours,
              }
            : workItem,
        ),
      };
    });
  },
  setWorkItemStatus(workItemId: string, status: LocalWorkItem["status"]) {
    updateState((state) => ({
      ...state,
      workItems: state.workItems.map((workItem) =>
        workItem._id === workItemId
          ? {
              ...workItem,
              status,
              archivedAt: status === "archived" ? workItem.archivedAt ?? Date.now() : undefined,
            }
          : workItem,
      ),
    }));
  },
  restoreWorkItem(workItemId: string) {
    this.setWorkItemStatus(workItemId, "active");
  },
  archiveWorkItem(workItemId: string) {
    this.setWorkItemStatus(workItemId, "archived");
  },
  deleteWorkItem(workItemId: string) {
    updateState((state) => ({
      ...state,
      workItems: state.workItems.filter(
        (workItem) => workItem._id !== workItemId && workItem.parentWorkItemId !== workItemId,
      ),
    }));
  },
  updateTimesheetEntry(
    entryId: string,
    values: {
      projectId?: string;
      taskId?: string;
      note?: string;
      durationMs: number;
    },
  ) {
    updateState((state) => {
      const entry = state.timesheetEntries.find((item) => item._id === entryId);
      if (!entry) {
        return state;
      }

      const nextEntry = createTimesheetEntry(state, {
        localDate: entry.localDate,
        workItemId: entry.workItemId,
        projectId: values.projectId,
        taskId: values.taskId,
        note: values.note,
        durationMs: values.durationMs,
        sourceBlockIds: entry.sourceBlockIds,
        entryId: entry._id,
      });
      const nextPersistedEntry = preserveTimesheetEntrySubmissionState(
        entry,
        values.taskId
          ? nextEntry
          : {
              ...nextEntry,
              label: entry.label,
            },
      );

      return {
        ...state,
        timesheetEntries: state.timesheetEntries.map((item) =>
          item._id === entryId ? nextPersistedEntry : item,
        ),
        workItems: applyLoggedTimeToWorkItems(
          applyLoggedTimeToWorkItems(state.workItems, {
            workItemId: entry.workItemId,
            projectId: entry.projectId,
            taskId: entry.taskId,
            durationMsDelta: -entry.durationMs,
          }),
          {
            workItemId: entry.workItemId,
            projectId: values.projectId,
            taskId: values.taskId,
            durationMsDelta: values.durationMs,
          },
        ),
      };
    });
  },
  deleteTimesheetEntry(entryId: string) {
    updateState((state) => {
      const entry = state.timesheetEntries.find((item) => item._id === entryId);
      return {
        ...state,
        timesheetEntries: state.timesheetEntries.filter((item) => item._id !== entryId),
        timers: state.timers.map((timer) =>
          timer.entryId === entryId
            ? {
                ...timer,
                entryId: undefined,
              }
            : timer,
        ),
        workItems: entry
          ? applyLoggedTimeToWorkItems(state.workItems, {
              workItemId: entry.workItemId,
              projectId: entry.projectId,
              taskId: entry.taskId,
              durationMsDelta: -entry.durationMs,
            })
          : state.workItems,
      };
    });
  },
  saveTimer(timerId: string) {
    updateState((state) => {
      const timer = state.timers.find((item) => item._id === timerId);
      if (!timer) {
        return state;
      }

      const existingEntry = timer.entryId
        ? state.timesheetEntries.find((entry) => entry._id === timer.entryId)
        : undefined;
      const durationMs = timer.accumulatedDurationMs + Math.max(0, Date.now() - timer.startedAt);
      const nextEntry = createTimesheetEntry(state, {
        localDate: timer.localDate,
        workItemId: timer.workItemId,
        projectId: timer.projectId,
        taskId: timer.taskId,
        note: timer.note,
        durationMs,
        sourceBlockIds: [],
        entryId: timer.entryId,
      });
      const nextPersistedEntry = preserveTimesheetEntrySubmissionState(existingEntry, nextEntry);

      return {
        ...state,
        timers: state.timers.filter((item) => item._id !== timerId),
        timesheetEntries: timer.entryId
          ? state.timesheetEntries.map((entry) => (entry._id === timer.entryId ? nextPersistedEntry : entry))
          : [...state.timesheetEntries, nextPersistedEntry],
        workItems: applyLoggedTimeToWorkItems(
          existingEntry
            ? applyLoggedTimeToWorkItems(state.workItems, {
                workItemId: existingEntry.workItemId,
                projectId: existingEntry.projectId,
                taskId: existingEntry.taskId,
                durationMsDelta: -existingEntry.durationMs,
              })
            : state.workItems,
          {
            workItemId: timer.workItemId,
            projectId: timer.projectId,
            taskId: timer.taskId,
            durationMsDelta: durationMs,
          },
        ),
      };
    });
  },
  markTimesheetEntriesSubmitted(entryIds: string[]) {
    if (entryIds.length === 0) {
      return;
    }

    const selectedIds = new Set(entryIds);

    updateState((state) => {
      let changed = false;
      const submittedAt = Date.now();
      const nextEntries = state.timesheetEntries.map((entry) => {
        if (!selectedIds.has(entry._id)) {
          return entry;
        }

        changed = true;
        return {
          ...entry,
          submittedAt,
          submittedFingerprint: createTimesheetEntrySubmissionFingerprint(entry),
        };
      });

      return changed
        ? {
            ...state,
            timesheetEntries: nextEntries,
          }
        : state;
    });
  },
  restartTimesheetEntry(entryId: string) {
    updateState((state) => {
      const entry = state.timesheetEntries.find((item) => item._id === entryId);
      if (!entry) {
        return state;
      }

      return {
        ...state,
        timers: [
          {
            _id: createId("timer"),
            startedAt: Date.now(),
            localDate: entry.localDate,
            workItemId: entry.workItemId,
            projectId: entry.projectId,
            taskId: entry.taskId,
            note: entry.note,
            accumulatedDurationMs: entry.durationMs,
            entryId: entry._id,
          },
        ],
      };
    });
  },
  addSampleActivity(url: string, title: string) {
    updateState((state) => ({
      ...state,
      segments: [...state.segments, buildSampleSegment(state, url, title)],
    }));
  },
  importBrowserBuckets(buckets: BrowserActivityBucket[]) {
    updateState((state) => {
      const nextDrafts = [...state.importedBrowserDrafts];

      for (const bucket of buckets) {
        const incoming = createImportedDraft(state, bucket);
        const currentIndex = nextDrafts.findIndex((draft) => draft.bucketKey === bucket.bucketKey);
        const current = currentIndex >= 0 ? nextDrafts[currentIndex] : undefined;
        const merged = preserveImportedDraft(state, current, incoming);

        if (currentIndex >= 0) {
          nextDrafts[currentIndex] = merged;
        } else {
          nextDrafts.push(merged);
        }
      }

      return {
        ...state,
        importedBrowserDrafts: nextDrafts,
        lastExtensionImportAt: Date.now(),
      };
    });
  },
  setExtensionBridgeStatus(status: ExtensionBridgeStatus) {
    updateState((state) => ({
      ...state,
      extensionBridgeStatus: status,
    }));
  },
  setOutlookIntegration(snapshot: OutlookConnectionSnapshot) {
    updateState((state) => ({
      ...state,
      outlookIntegration: snapshot,
    }));
  },
  patchOutlookIntegration(patch: Partial<OutlookConnectionSnapshot>) {
    updateState((state) => ({
      ...state,
      outlookIntegration: {
        ...state.outlookIntegration,
        ...patch,
      },
    }));
  },
  importOutlookMeetings(meetings: OutlookCalendarEvent[], localDate: string) {
    updateState((state) => {
      const currentByEventId = new Map(
        state.outlookMeetingDrafts
          .filter((meeting) => meeting.localDate === localDate)
          .map((meeting) => [meeting.eventId, meeting] as const),
      );
      const incomingIds = new Set(meetings.map((meeting) => meeting.eventId));
      const preservedOtherDates = state.outlookMeetingDrafts.filter((meeting) => meeting.localDate !== localDate);
      const preservedTerminalForDate = state.outlookMeetingDrafts.filter(
        (meeting) =>
          meeting.localDate === localDate &&
          !incomingIds.has(meeting.eventId) &&
          (meeting.status === "dismissed" || meeting.status === "committed"),
      );
      const nextForDate = meetings.map((meeting) =>
        preserveOutlookMeetingDraft(currentByEventId.get(meeting.eventId), createOutlookMeetingDraft(meeting)),
      );

      return {
        ...state,
        outlookMeetingDrafts: [...preservedOtherDates, ...preservedTerminalForDate, ...nextForDate].sort(
          (left, right) => left.startedAt - right.startedAt,
        ),
      };
    });
  },
  getTimeline(localDate: string): TimelineMutationResult & { status: "local"; localDate: string } {
    const state = readState();
    const blocks = materializeBlocks(state, localDate);
    const browserDrafts = materializeImportedDrafts(state, localDate);
    const outlookMeetings = materializeOutlookMeetings(state, localDate);
    const committedEntries = state.timesheetEntries.filter((entry) => entry.localDate === localDate);
    return {
      status: "local",
      localDate,
      blocks,
      browserDrafts,
      outlookMeetings,
      trackedMs:
        blocks.reduce((sum, block) => sum + block.durationMs, 0) +
        browserDrafts.reduce((sum, draft) => sum + draft.durationMs, 0) +
        outlookMeetings.reduce((sum, meeting) => sum + meeting.durationMs, 0),
      committedMs: committedEntries.reduce((sum, entry) => sum + entry.durationMs, 0),
      extensionBridgeStatus: state.extensionBridgeStatus,
    };
  },
  upsertEditedBlock(block: ActivityBlockRecord) {
    updateState((state) => ({
      ...state,
      editedBlocks: [
        ...state.editedBlocks.filter((item) => blockId(item) !== blockId(block)),
        { ...block, id: blockId(block), status: "edited", locked: true },
      ],
    }));
  },
  updateImportedBrowserDraft(
    draftId: string,
    patch: Partial<Pick<ImportedBrowserDraft, "projectId" | "note" | "status" | "dismissed" | "assignmentSource" | "explanation">>,
  ) {
    updateState((state) => ({
      ...state,
      importedBrowserDrafts: state.importedBrowserDrafts.map((draft) =>
        draft._id === draftId
          ? {
              ...draft,
              ...patch,
              manuallyEdited: true,
            }
          : draft,
      ),
    }));
  },
  updateOutlookMeetingDraft(
    meetingId: string,
    patch: Partial<Pick<OutlookMeetingDraft, "projectId" | "note" | "status" | "dismissed" | "assignmentSource" | "explanation">>,
  ) {
    updateState((state) => ({
      ...state,
      outlookMeetingDrafts: state.outlookMeetingDrafts.map((meeting) =>
        meeting._id === meetingId
          ? {
              ...meeting,
              ...patch,
              manuallyEdited: true,
            }
          : meeting,
      ),
    }));
  },
  dismissBlock(block: ActivityBlockRecord) {
    updateState((state) => ({
      ...state,
      editedBlocks: state.editedBlocks.filter((item) => blockId(item) !== blockId(block)),
      dismissedSegmentIds: [...new Set([...state.dismissedSegmentIds, ...block.sourceSegmentIds])],
    }));
  },
  dismissImportedBrowserDraft(draftId: string) {
    this.updateImportedBrowserDraft(draftId, {
      dismissed: true,
      status: "dismissed",
      explanation: "Dismissed locally. This browser bucket stays on-device and will not appear in review again.",
    });
  },
  dismissOutlookMeetingDraft(meetingId: string) {
    this.updateOutlookMeetingDraft(meetingId, {
      dismissed: true,
      status: "dismissed",
      explanation: "Dismissed locally. This Outlook meeting will stay out of the review queue.",
    });
  },
  commitBlock(block: ActivityBlockRecord) {
    if (!block.projectId) {
      throw new Error("Assign a project before committing a timesheet entry");
    }
    updateState((state) => ({
      ...state,
      timesheetEntries: [
        ...state.timesheetEntries,
        {
          _id: createId("timesheet"),
          localDate: block.localDate,
          projectId: block.projectId!,
          label: block.display.label,
          note: block.note,
          durationMs: block.durationMs,
          sourceBlockIds: [blockId(block)],
          committedAt: Date.now(),
        },
      ],
      dismissedSegmentIds: [...new Set([...state.dismissedSegmentIds, ...block.sourceSegmentIds])],
      editedBlocks: state.editedBlocks.filter((item) => blockId(item) !== blockId(block)),
    }));
  },
  commitImportedBrowserDraft(draftId: string) {
    updateState((state) => {
      const draft = state.importedBrowserDrafts.find((item) => item._id === draftId);
      if (!draft?.projectId) {
        return state;
      }

      const sourceBlockId = `bucket:${draft.bucketKey}`;
      if (state.timesheetEntries.some((entry) => entry.sourceBlockIds.includes(sourceBlockId))) {
        return {
          ...state,
          importedBrowserDrafts: state.importedBrowserDrafts.map((item) =>
            item._id === draftId ? { ...item, status: "committed", manuallyEdited: true } : item,
          ),
        };
      }

      return {
        ...state,
        timesheetEntries: [
          ...state.timesheetEntries,
          {
            _id: createId("timesheet"),
            localDate: draft.localDate,
            projectId: draft.projectId,
            label: draft.dominantLabel,
            note: draft.note,
            durationMs: draft.durationMs,
            sourceBlockIds: [sourceBlockId],
            committedAt: Date.now(),
          },
        ],
        importedBrowserDrafts: state.importedBrowserDrafts.map((item) =>
          item._id === draftId
            ? {
                ...item,
                status: "committed",
                manuallyEdited: true,
                explanation: "Committed to the local timesheet. The original browser bucket remains local-only.",
              }
            : item,
        ),
      };
    });
  },
  commitOutlookMeetingDraft(meetingId: string) {
    updateState((state) => {
      const meeting = state.outlookMeetingDrafts.find((item) => item._id === meetingId);
      if (!meeting?.projectId) {
        return state;
      }

      const sourceBlockId = `meeting:${meeting.eventId}`;
      if (state.timesheetEntries.some((entry) => entry.sourceBlockIds.includes(sourceBlockId))) {
        return {
          ...state,
          outlookMeetingDrafts: state.outlookMeetingDrafts.map((item) =>
            item._id === meetingId ? { ...item, status: "committed", manuallyEdited: true } : item,
          ),
        };
      }

      return {
        ...state,
        timesheetEntries: [
          ...state.timesheetEntries,
          {
            _id: createId("timesheet"),
            localDate: meeting.localDate,
            projectId: meeting.projectId,
            label: meeting.subject,
            note: meeting.note,
            durationMs: meeting.durationMs,
            sourceBlockIds: [sourceBlockId],
            committedAt: Date.now(),
          },
        ],
        outlookMeetingDrafts: state.outlookMeetingDrafts.map((item) =>
          item._id === meetingId
            ? {
                ...item,
                status: "committed",
                manuallyEdited: true,
                explanation: "Committed to the local timesheet. The source Outlook meeting is not synced anywhere else.",
              }
            : item,
        ),
      };
    });
  },
  saveRuleFromBlock(block: RuleSeed) {
    if (!block.projectId) {
      throw new Error("Assign a project before saving a rule");
    }
    updateState((state) => ({
      ...state,
      rules: [
        ...state.rules,
        {
          id: createId("rule"),
          userId: state.user._id,
          teamId: state.team?._id ?? "local_team",
          enabled: true,
          priority: 50,
          source: "manual",
          status: "active",
          action: "suggest",
          targetProjectId: block.projectId!,
          condition: {
            domain: block.domain,
            pathnamePrefix: block.pathname === "/" ? undefined : block.pathname,
          },
          baseConfidence: 0.9,
        },
      ],
    }));
  },
  saveRuleFromImportedBrowserDraft(draftId: string) {
    const draft = readState().importedBrowserDrafts.find((item) => item._id === draftId);
    if (!draft?.projectId) {
      throw new Error("Assign a project before saving a rule");
    }

    this.saveRuleFromBlock({
      projectId: draft.projectId,
      domain: draft.dominantDomain,
      pathname: draft.dominantPathname,
    });
  },
  setUserPreferences(preferences: Partial<UserPreferences>) {
    updateState((state) => ({
      ...state,
      userPreferences: {
        ...state.userPreferences,
        ...preferences,
      },
    }));
  },
};
