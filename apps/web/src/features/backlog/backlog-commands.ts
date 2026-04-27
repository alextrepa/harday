import {
  buildWorkItemTimerComment,
} from "@/features/backlog/work-item-timer-comment";
import { localStore, type LocalWorkItem } from "@/lib/local-store";
import { todayIsoDate } from "@/lib/utils";
import { syncBacklogWorkItemToSource } from "./work-item-source-sync";

export type BacklogWorkItemPatch = Partial<
  Omit<LocalWorkItem, "_id" | "createdAt" | "source">
>;

export type BacklogWorkItemDraft = {
  title: string;
  note?: string;
  priority?: string;
  backlogStatusId?: string;
  parentWorkItemId?: string;
  projectId?: string;
  taskId?: string;
  originalEstimateHours?: string;
  remainingEstimateHours?: string;
  completedEstimateHours?: string;
};

export function parseBacklogPriorityInput(value: string) {
  if (value.trim() === "") {
    return undefined;
  }

  const parsedValue = Number(value);
  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    return null;
  }

  return parsedValue;
}

export function parseBacklogEstimateInput(value: string) {
  if (value.trim() === "") {
    return undefined;
  }

  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return null;
  }

  return Math.round(parsedValue * 10_000) / 10_000;
}

export function formatBacklogPriorityInput(priority?: number) {
  return typeof priority === "number" ? String(priority) : "";
}

export function formatBacklogEstimateInput(value?: number) {
  return typeof value === "number" ? String(value) : "";
}

export function buildBacklogTimeEntryNote(
  note: string,
  title: string,
  sourceId?: string,
) {
  const trimmedNote = note.trim();
  return trimmedNote || buildWorkItemTimerComment(title, sourceId);
}

export function buildBacklogWorkItemPatch(
  workItem: LocalWorkItem,
  draft: BacklogWorkItemDraft,
  options?: { preserveTitle?: boolean },
): BacklogWorkItemPatch | null {
  const title = draft.title.trim();
  if (!title && !options?.preserveTitle) {
    return null;
  }

  const priority = parseBacklogPriorityInput(draft.priority ?? "");
  if (!draft.parentWorkItemId && priority === null) {
    return null;
  }

  const originalEstimateHours = parseBacklogEstimateInput(
    draft.originalEstimateHours ?? "",
  );
  const remainingEstimateHours = parseBacklogEstimateInput(
    draft.remainingEstimateHours ?? "",
  );
  const completedEstimateHours = parseBacklogEstimateInput(
    draft.completedEstimateHours ?? "",
  );
  if (
    originalEstimateHours === null ||
    remainingEstimateHours === null ||
    completedEstimateHours === null
  ) {
    return null;
  }

  const parentWorkItemIdProvided = Object.prototype.hasOwnProperty.call(
    draft,
    "parentWorkItemId",
  );
  const patch: BacklogWorkItemPatch = {
    title: title || workItem.title,
    note: draft.note?.trim() || undefined,
    priority:
      draft.parentWorkItemId || priority === null ? undefined : priority,
    backlogStatusId: draft.backlogStatusId || undefined,
    projectId: draft.projectId || undefined,
    taskId: draft.taskId || undefined,
    originalEstimateHours,
    remainingEstimateHours,
    completedEstimateHours,
  };

  if (parentWorkItemIdProvided) {
    patch.parentWorkItemId = draft.parentWorkItemId || undefined;
    patch.parentSourceId = undefined;
  }

  return patch;
}

export const backlogCommands = {
  saveDraft(
    workItem: LocalWorkItem,
    draft: BacklogWorkItemDraft,
    options?: { preserveTitle?: boolean },
  ) {
    const patch = buildBacklogWorkItemPatch(workItem, draft, options);
    if (!patch) {
      return null;
    }

    localStore.updateWorkItem(workItem._id, patch);
    return patch;
  },

  addSubtask(parentWorkItemId: string, draft: BacklogWorkItemDraft) {
    const title = draft.title.trim();
    if (!title) {
      return null;
    }

    return localStore.addSubtask(parentWorkItemId, {
      title,
      note: draft.note?.trim() || undefined,
      backlogStatusId: draft.backlogStatusId || undefined,
      projectId: draft.projectId || undefined,
      taskId: draft.taskId || undefined,
    });
  },

  logTime(
    workItem: LocalWorkItem,
    draft: BacklogWorkItemDraft,
    values: {
      durationMs: number;
      timeEntryNote: string;
      localDate?: string;
    },
  ) {
    if (!Number.isFinite(values.durationMs) || values.durationMs <= 0) {
      return null;
    }

    const patch = this.saveDraft(workItem, draft, { preserveTitle: true });
    const nextTitle = patch?.title ?? workItem.title;

    localStore.saveManualTimeEntry({
      localDate: values.localDate ?? todayIsoDate(),
      workItemId: workItem._id,
      projectId: (patch?.projectId ?? draft.projectId) || undefined,
      taskId: (patch?.taskId ?? draft.taskId) || undefined,
      note: buildBacklogTimeEntryNote(
        values.timeEntryNote,
        nextTitle,
        workItem.sourceId,
      ),
      durationMs: values.durationMs,
    });
    syncBacklogWorkItemToSource(workItem);

    return patch;
  },

  startTimer(
    workItem: LocalWorkItem,
    draft: BacklogWorkItemDraft,
    options?: { localDate?: string },
  ) {
    const patch = this.saveDraft(workItem, draft, { preserveTitle: true });
    const nextTitle = patch?.title ?? workItem.title;

    localStore.startTimer({
      localDate: options?.localDate ?? todayIsoDate(),
      workItemId: workItem._id,
      projectId: (patch?.projectId ?? draft.projectId) || undefined,
      taskId: (patch?.taskId ?? draft.taskId) || undefined,
      note: buildWorkItemTimerComment(nextTitle, workItem.sourceId),
      accumulatedDurationMs: 0,
    });

    return patch;
  },

  archive(workItemId: string) {
    localStore.archiveWorkItem(workItemId);
  },

  restore(workItemId: string) {
    localStore.restoreWorkItem(workItemId);
  },

  delete(workItemId: string) {
    localStore.deleteWorkItem(workItemId);
  },
};
