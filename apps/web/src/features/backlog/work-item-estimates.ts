import { formatDurationHoursInput } from "../timer/hours-input";

type WorkItemEstimateValues = {
  originalEstimateHours?: number;
  remainingEstimateHours?: number;
  completedEstimateHours?: number;
};

type LoggedTimeEstimateUpdate = {
  projectId?: string;
  taskId?: string;
  durationMsDelta: number;
};

function normalizeEstimateValue(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.round(Math.max(0, value) * 10_000) / 10_000;
}

function durationMsToHours(durationMs: number) {
  return Math.max(0, durationMs) / (60 * 60 * 1000);
}

function hoursToDurationMs(hours: number) {
  return Math.max(0, hours) * 60 * 60 * 1000;
}

function formatEstimateHours(hours: number | undefined) {
  return formatDurationHoursInput(hoursToDurationMs(hours ?? 0));
}

function normalizeDisplayEstimateValue(value: number | undefined) {
  return normalizeEstimateValue(value) ?? 0;
}

function hasVisibleEstimateValue(values: WorkItemEstimateValues) {
  return (
    normalizeDisplayEstimateValue(values.originalEstimateHours) > 0 ||
    normalizeDisplayEstimateValue(values.remainingEstimateHours) > 0 ||
    normalizeDisplayEstimateValue(values.completedEstimateHours) > 0
  );
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

export function applyLoggedTimeToEstimateValues(
  values: WorkItemEstimateValues,
  update: LoggedTimeEstimateUpdate,
): WorkItemEstimateValues {
  if (update.durationMsDelta === 0) {
    return values;
  }

  const deltaHours = durationMsToHours(update.durationMsDelta);
  if (deltaHours === 0) {
    return values;
  }

  return {
    remainingEstimateHours: applyEstimateDelta(values.remainingEstimateHours, -deltaHours, { clampAtZero: true }),
    completedEstimateHours: applyEstimateDelta(values.completedEstimateHours, deltaHours, { clampAtZero: true }),
  };
}

export function getWorkItemEstimateSummary(values: WorkItemEstimateValues) {
  if (!hasVisibleEstimateValue(values)) {
    return null;
  }

  return [
    `Original ${formatEstimateHours(values.originalEstimateHours)}`,
    `Remaining ${formatEstimateHours(values.remainingEstimateHours)}`,
    `Completed ${formatEstimateHours(values.completedEstimateHours)}`,
  ].join(" · ");
}

export function getWorkItemEstimateBadgeLabel(values: WorkItemEstimateValues) {
  const remainingEstimateHours = normalizeDisplayEstimateValue(values.remainingEstimateHours);
  const completedEstimateHours = normalizeDisplayEstimateValue(values.completedEstimateHours);

  if (remainingEstimateHours > 0) {
    return `${formatEstimateHours(remainingEstimateHours)} | ${formatEstimateHours(completedEstimateHours)}`;
  }

  return formatEstimateHours(completedEstimateHours);
}
