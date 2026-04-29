import type { SearchableSelectOption } from "@/components/ui/searchable-select";
import type { LocalProjectTask } from "@/lib/local-store";

export function isProjectTaskBillable(
  task: Pick<LocalProjectTask, "billable">,
): boolean {
  return task.billable ?? true;
}

export function getProjectTaskBillableGroupLabel(
  task: Pick<LocalProjectTask, "billable">,
) {
  return isProjectTaskBillable(task) ? "Billable" : "Non-billable";
}

export function getProjectTaskBillableValueLabel(
  task: Pick<LocalProjectTask, "billable">,
) {
  return isProjectTaskBillable(task) ? "Billable" : "Non-billable";
}

export function buildProjectTaskOptions(
  tasks: LocalProjectTask[],
): SearchableSelectOption[] {
  return tasks
    .filter((task) => task.status === "active")
    .map((task) => {
      const isBillable = isProjectTaskBillable(task);
      return {
        value: task._id,
        label: task.name,
        group: isBillable ? "Billable" : "Non-billable",
        keywords: isBillable
          ? [task.name, "billable"]
          : [task.name, "non-billable", "non billable"],
      };
    });
}
