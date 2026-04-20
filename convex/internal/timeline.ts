import type { ActivitySegmentRecord } from "@timetracker/shared";
import {
  aggregateSegmentsToBlocks,
  evaluateBlockAgainstRules,
  normalizeActivityContext,
} from "@timetracker/shared";
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { defaultCaptureSettings, defaultTeamSettings } from "../lib/defaults";

export const applySegmentsToDay = internalMutation({
  args: {
    userId: v.id("users"),
    teamId: v.id("teams"),
    deviceId: v.id("devices"),
    localDate: v.string(),
  },
  handler: async (ctx, args) => {
    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user_team", (q) => q.eq("userId", args.userId).eq("teamId", args.teamId))
      .unique();
    const team = await ctx.db.get(args.teamId);
    const capture = userSettings?.capture ?? defaultCaptureSettings;
    const aggregationSettings = {
      mergeGapMs: team?.settings.mergeGapMs ?? defaultTeamSettings.mergeGapMs,
      microBlockThresholdMs:
        team?.settings.microBlockThresholdMs ?? defaultTeamSettings.microBlockThresholdMs,
    };

    const segments = await ctx.db
      .query("activitySegments")
      .withIndex("by_user_local_date", (q) => q.eq("userId", args.userId).eq("localDate", args.localDate))
      .collect();

    const lockedBlocks = (await ctx.db
      .query("activityBlocks")
      .withIndex("by_user_local_date", (q) => q.eq("userId", args.userId).eq("localDate", args.localDate))
      .collect())
      .filter((block) => block.locked);

    const rebuildFrom = lockedBlocks.reduce((max, block) => Math.max(max, block.endedAt), 0);

    const rebuildSegments = segments.filter((segment) => segment.startedAt >= rebuildFrom);
    const normalizedSegments = rebuildSegments.map((segment) => {
      const normalized = normalizeActivityContext(
        { url: `https://${segment.url}`, title: segment.title, domain: segment.domain, pathname: segment.pathname },
        { capture },
      );

      return {
        ...segment,
        normalized,
      };
    }) as ActivitySegmentRecord[];

    const rebuiltBlocks = aggregateSegmentsToBlocks(normalizedSegments, aggregationSettings);
    const rules = await ctx.db
      .query("categorizationRules")
      .withIndex("by_user_enabled_priority", (q) =>
        q.eq("userId", args.userId).eq("enabled", true),
      )
      .collect();
    const stats = await ctx.db
      .query("learningFeatureStats")
      .withIndex("by_user_feature", (q) => q.eq("userId", args.userId))
      .collect();
    const existingBlocks = await ctx.db
      .query("activityBlocks")
      .withIndex("by_user_local_date", (q) => q.eq("userId", args.userId).eq("localDate", args.localDate))
      .collect();

    for (const block of existingBlocks) {
      if (!block.locked) {
        await ctx.db.delete(block._id);
      }
    }

    for (const block of rebuiltBlocks) {
      const evaluation = evaluateBlockAgainstRules(block, rules as never, stats as never);
      await ctx.db.insert("activityBlocks", {
        ...block,
        projectId: evaluation.suggestion?.projectId as never,
        assignmentSource: evaluation.suggestion?.source ?? "none",
        confidence: evaluation.suggestion?.confidence ?? 0,
        explanation: evaluation.suggestion?.explanation,
        status: evaluation.suggestion ? "suggested" : "draft",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    const trackedMs = segments.reduce((sum, item) => sum + item.activeDurationMs, 0);
    const day = await ctx.db
      .query("timelineDays")
      .withIndex("by_user_local_date", (q) => q.eq("userId", args.userId).eq("localDate", args.localDate))
      .unique();

    if (!day) {
      await ctx.db.insert("timelineDays", {
        userId: args.userId,
        teamId: args.teamId,
        localDate: args.localDate,
        status: "open",
        trackedMs,
        confirmedMs: 0,
        lastAggregatedAt: Date.now(),
      });
      return;
    }

    await ctx.db.patch(day._id, {
      status: day.status === "confirmed" ? "reopened" : day.status,
      trackedMs,
      lastAggregatedAt: Date.now(),
    });
  },
});
