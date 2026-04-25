import { syncConnectorConnection } from "@/lib/app-api";
import type { LocalWorkItem } from "@/lib/local-store";

export function syncBacklogWorkItemToSource(workItem: LocalWorkItem) {
  if (workItem.source === "manual" || workItem.source === "outlook" || !workItem.sourceConnectionId) {
    return;
  }

  void syncConnectorConnection(workItem.source, workItem.sourceConnectionId, {
    trigger: "source_write",
  }).catch((error) => {
    console.error("Backlog work item sync failed.", error);
  });
}
