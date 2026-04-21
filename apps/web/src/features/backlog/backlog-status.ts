import type { SearchableSelectOption } from "@/components/ui/searchable-select";
import type { LocalBacklogStatus, LocalWorkItem } from "@/lib/local-store";

export function buildBacklogStatusNameLookup(statuses: LocalBacklogStatus[]) {
  return new Map(statuses.map((status) => [status._id, status.name] as const));
}

export function buildBacklogStatusOptions(statuses: LocalBacklogStatus[]): SearchableSelectOption[] {
  return statuses.map((status) => ({
    value: status._id,
    label: status.name,
    keywords: [status.name],
  }));
}

export function getBacklogStatusName(
  backlogStatusId: string | undefined,
  backlogStatusNameById: Map<string, string>,
) {
  return backlogStatusId ? backlogStatusNameById.get(backlogStatusId) : undefined;
}

export function getImportedBacklogStatusSummary(
  workItem: Pick<LocalWorkItem, "importedBacklogStatusId" | "sourceStatusLabel">,
  backlogStatusNameById: Map<string, string>,
) {
  const importedName = getBacklogStatusName(workItem.importedBacklogStatusId, backlogStatusNameById);
  if (importedName) {
    return importedName;
  }

  const sourceStatusLabel = workItem.sourceStatusLabel?.trim();
  if (sourceStatusLabel) {
    return `${sourceStatusLabel} (unmapped)`;
  }

  return "empty";
}
