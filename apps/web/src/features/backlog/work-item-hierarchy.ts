import type { LocalWorkItem } from "@/lib/local-store";

export function getWorkItemLookupKeys(workItem: LocalWorkItem) {
  const keys = [`local:${workItem._id}`];

  if (workItem.sourceId) {
    keys.push(`source:${workItem.sourceId}`);
  }

  return keys;
}

export function getWorkItemLookupKey(workItem: LocalWorkItem) {
  return workItem.sourceId ? `source:${workItem.sourceId}` : `local:${workItem._id}`;
}

export function getWorkItemParentKey(workItem: LocalWorkItem) {
  if (workItem.parentWorkItemId) {
    return `local:${workItem.parentWorkItemId}`;
  }

  if (workItem.parentSourceId) {
    return `source:${workItem.parentSourceId}`;
  }

  return null;
}

export function isSubtaskItem(workItem: LocalWorkItem) {
  return Boolean(getWorkItemParentKey(workItem) || (workItem.hierarchyLevel ?? 0) > 0);
}

export function getDirectChildWorkItems(workItem: LocalWorkItem, workItems: LocalWorkItem[]) {
  const parentKeys = new Set(getWorkItemLookupKeys(workItem));

  return workItems
    .filter((candidate) => {
      const parentKey = getWorkItemParentKey(candidate);
      return parentKey ? parentKeys.has(parentKey) : false;
    })
    .sort((left, right) => right.createdAt - left.createdAt);
}
