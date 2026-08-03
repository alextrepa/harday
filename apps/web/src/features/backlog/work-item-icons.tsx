import { useEffect, useMemo, useState } from "react";
import { RiCheckboxBlankCircleLine as TaskIcon } from "@remixicon/react";
import {
  DEFAULT_CONNECTOR_TASK_ICON_DISPLAY_MODE,
  connectorTaskIconDisplayModes,
  type ConnectorTaskIconDisplayMode,
} from "@timetracker/shared";
import type { LocalProject, LocalWorkItem } from "@/domain/local-state";
import { getConnectorsOverview } from "@/lib/app-api";
import { ProjectIcon } from "@/lib/project-icons";
import { cn } from "@/lib/utils";

type ResolvedWorkItemIcon =
  | { kind: "project"; project: LocalProject }
  | { kind: "connector"; svg: string }
  | { kind: "default" };

type WorkItemIconData = {
  projectsById: Map<string, LocalProject>;
  connectorIconsBySource: Record<string, string>;
  connectorTaskIconModesByConnectionId: Record<
    string,
    ConnectorTaskIconDisplayMode
  >;
};

function normalizeConnectorTaskIconDisplayMode(
  value: unknown,
): ConnectorTaskIconDisplayMode {
  return connectorTaskIconDisplayModes.includes(
    value as ConnectorTaskIconDisplayMode,
  )
    ? (value as ConnectorTaskIconDisplayMode)
    : DEFAULT_CONNECTOR_TASK_ICON_DISPLAY_MODE;
}

export function useWorkItemIconData(
  projects: LocalProject[],
): WorkItemIconData {
  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project._id, project] as const)),
    [projects],
  );
  const [connectorIconsBySource, setConnectorIconsBySource] = useState<
    Record<string, string>
  >({});
  const [connectorTaskIconModesByConnectionId, setConnectorTaskIconModes] =
    useState<Record<string, ConnectorTaskIconDisplayMode>>({});

  useEffect(() => {
    void getConnectorsOverview()
      .then((overview) => {
        setConnectorIconsBySource(
          Object.fromEntries(
            overview.plugins.map((plugin) => [plugin.id, plugin.iconSvg] as const),
          ),
        );
        setConnectorTaskIconModes(
          Object.fromEntries(
            overview.connectionGroups.flatMap((group) =>
              group.connections.map((connection) => [
                connection.id,
                normalizeConnectorTaskIconDisplayMode(
                  connection.editableValues.taskIconDisplayMode,
                ),
              ]),
            ),
          ),
        );
      })
      .catch(() => undefined);
  }, []);

  return {
    projectsById,
    connectorIconsBySource,
    connectorTaskIconModesByConnectionId,
  };
}

export function resolveWorkItemIcon(
  workItem: LocalWorkItem,
  iconData: WorkItemIconData,
): ResolvedWorkItemIcon {
  const project = workItem.projectId
    ? iconData.projectsById.get(workItem.projectId)
    : undefined;
  const hasConnectorSource =
    workItem.source !== "manual" && workItem.source !== "outlook";

  if (!hasConnectorSource) {
    return project ? { kind: "project", project } : { kind: "default" };
  }

  const connectorIcon = iconData.connectorIconsBySource[workItem.source];
  const connectorTaskIconMode = normalizeConnectorTaskIconDisplayMode(
    workItem.sourceConnectionId
      ? iconData.connectorTaskIconModesByConnectionId[workItem.sourceConnectionId]
      : undefined,
  );

  if (connectorTaskIconMode === "always" && connectorIcon) {
    return { kind: "connector", svg: connectorIcon };
  }

  if (project) {
    return { kind: "project", project };
  }

  if (connectorTaskIconMode === "fallback" && connectorIcon) {
    return { kind: "connector", svg: connectorIcon };
  }

  return { kind: "default" };
}

export function WorkItemIcon({
  icon,
  className,
}: {
  icon: ResolvedWorkItemIcon;
  className?: string;
}) {
  if (icon.kind === "connector") {
    const usesCurrentColor = /\bcurrentColor\b/i.test(icon.svg);
    const hasFixedPaint = /\b(?:fill|stroke)\s*=\s*["'](?!currentColor\b|none\b)[^"']+/i.test(
      icon.svg,
    );
    const resolvedSvg =
      usesCurrentColor && hasFixedPaint && typeof document !== "undefined"
        ? icon.svg.replaceAll(
            /currentColor/gi,
            getComputedStyle(document.documentElement).color || "#737373",
          )
        : icon.svg;
    const iconSource = `data:image/svg+xml,${encodeURIComponent(resolvedSvg)}`;
    return (
      <span
        className={cn(
          "backlog-task-source-icon inline-flex size-4 items-center justify-center [&>img]:size-4",
          className,
        )}
        aria-hidden="true"
      >
        {usesCurrentColor && !hasFixedPaint ? (
          <span
            className="size-4 bg-current"
            style={{
              maskImage: `url("${iconSource}")`,
              maskPosition: "center",
              maskRepeat: "no-repeat",
              maskSize: "contain",
              WebkitMaskImage: `url("${iconSource}")`,
              WebkitMaskPosition: "center",
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskSize: "contain",
            }}
          />
        ) : (
          <img src={iconSource} alt="" />
        )}
      </span>
    );
  }

  if (icon.kind === "project") {
    return (
      <ProjectIcon
        icon={icon.project.icon}
        color={icon.project.color}
        className={cn("backlog-task-source-icon", className)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "backlog-task-source-icon backlog-task-default-icon inline-flex items-center justify-center",
        className,
      )}
      style={{ color: "var(--text-tertiary)" }}
    >
      <TaskIcon />
    </span>
  );
}
