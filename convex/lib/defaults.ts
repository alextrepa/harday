import type { CaptureSettings, ReviewSettings, TeamSettings } from "@timetracker/shared";

export const defaultTeamSettings: TeamSettings = {
  idleThresholdMs: 2 * 60 * 1000,
  mergeGapMs: 90 * 1000,
  microBlockThresholdMs: 3 * 60 * 1000,
  urlCaptureMode: "sanitized_path",
  titleCaptureMode: "normalized",
};

export const defaultCaptureSettings: CaptureSettings = {
  urlMode: "sanitized_path",
  titleMode: "normalized",
  blockedDomains: [],
  sensitiveDomains: [],
  maxPathSegments: 4,
};

export const defaultReviewSettings: ReviewSettings = {
  collapseMicroBlocks: true,
  defaultReviewMode: "all",
};
