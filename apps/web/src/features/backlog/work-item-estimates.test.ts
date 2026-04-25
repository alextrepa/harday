import { describe, expect, it } from "vitest";
import {
  applyLoggedTimeToEstimateValues,
  getWorkItemEstimateBadgeLabel,
  getWorkItemEstimateSummary,
} from "./work-item-estimates";

describe("applyLoggedTimeToEstimateValues", () => {
  it("increments completed and decrements remaining for mapped work", () => {
    expect(
      applyLoggedTimeToEstimateValues(
        {
          remainingEstimateHours: 2,
          completedEstimateHours: 0,
        },
        {
          projectId: "project-1",
          taskId: "task-1",
          durationMsDelta: 90 * 60 * 1000,
        },
      ),
    ).toEqual({
      remainingEstimateHours: 0.5,
      completedEstimateHours: 1.5,
    });
  });

  it("clamps remaining at zero when logged time overruns the estimate", () => {
    expect(
      applyLoggedTimeToEstimateValues(
        {
          remainingEstimateHours: 1,
          completedEstimateHours: 0.25,
        },
        {
          projectId: "project-1",
          taskId: "task-1",
          durationMsDelta: 2 * 60 * 60 * 1000,
        },
      ),
    ).toEqual({
      remainingEstimateHours: 0,
      completedEstimateHours: 2.25,
    });
  });

  it("updates estimates even when the work item is not mapped", () => {
    expect(
      applyLoggedTimeToEstimateValues(
        {
          remainingEstimateHours: 2,
          completedEstimateHours: 1,
        },
        {
          durationMsDelta: 60 * 60 * 1000,
        },
      ),
    ).toEqual({
      remainingEstimateHours: 1,
      completedEstimateHours: 2,
    });
  });
});

describe("getWorkItemEstimateSummary", () => {
  it("returns a labeled triplet when any estimate value is non-zero", () => {
    expect(
      getWorkItemEstimateSummary({
        originalEstimateHours: 8,
        remainingEstimateHours: 1,
        completedEstimateHours: 1,
      }),
    ).toBe("Original 08:00 · Remaining 01:00 · Completed 01:00");
  });

  it("returns null when all estimate values are empty or zero", () => {
    expect(
      getWorkItemEstimateSummary({
        originalEstimateHours: 0,
        remainingEstimateHours: undefined,
        completedEstimateHours: 0,
      }),
    ).toBeNull();
  });
});

describe("getWorkItemEstimateBadgeLabel", () => {
  it("shows remaining and completed when remaining time exists", () => {
    expect(
      getWorkItemEstimateBadgeLabel({
        remainingEstimateHours: 1,
        completedEstimateHours: 1,
      }),
    ).toBe("01:00 | 01:00");
  });

  it("shows remaining and 00:00 when remaining exists but completed is missing", () => {
    expect(
      getWorkItemEstimateBadgeLabel({
        remainingEstimateHours: 1,
        completedEstimateHours: undefined,
      }),
    ).toBe("01:00 | 00:00");
  });

  it("shows completed only when no remaining time exists", () => {
    expect(
      getWorkItemEstimateBadgeLabel({
        remainingEstimateHours: 0,
        completedEstimateHours: 1.5,
      }),
    ).toBe("01:30");
  });

  it("shows 00:00 when completed is missing and no remaining time exists", () => {
    expect(
      getWorkItemEstimateBadgeLabel({
        originalEstimateHours: 2,
        remainingEstimateHours: 0,
        completedEstimateHours: undefined,
      }),
    ).toBe("00:00");
  });

  it("shows 00:00 when every estimate is zero", () => {
    expect(
      getWorkItemEstimateBadgeLabel({
        originalEstimateHours: 0,
        remainingEstimateHours: 0,
        completedEstimateHours: 0,
      }),
    ).toBe("00:00");
  });
});
