import { normalizeActivityContext } from "@timetracker/shared";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { defaultCaptureSettings } from "../lib/defaults";

export const ingestSegments = internalMutation({
  args: {
    userId: v.id("users"),
    teamId: v.id("teams"),
    deviceId: v.id("devices"),
    capturedUrlMode: v.union(v.literal("domain_only"), v.literal("sanitized_path")),
    segments: v.array(
      v.object({
        externalSegmentId: v.string(),
        startedAt: v.number(),
        endedAt: v.number(),
        activeDurationMs: v.number(),
        idleDurationMs: v.number(),
        isIdleSplit: v.boolean(),
        localDate: v.string(),
        context: v.object({
          url: v.string(),
          title: v.string(),
          domain: v.optional(v.string()),
          pathname: v.optional(v.string()),
        }),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user_team", (q) => q.eq("userId", args.userId).eq("teamId", args.teamId))
      .unique();
    const capture = userSettings?.capture ?? defaultCaptureSettings;
    const changedDates = new Set<string>();

    for (const segment of args.segments) {
      const duplicate = await ctx.db
        .query("activitySegments")
        .withIndex("by_device_external_id", (q) =>
          q.eq("deviceId", args.deviceId).eq("externalSegmentId", segment.externalSegmentId),
        )
        .unique();
      if (duplicate) {
        continue;
      }

      const normalized = normalizeActivityContext(segment.context, { capture });
      await ctx.db.insert("activitySegments", {
        userId: args.userId,
        teamId: args.teamId,
        deviceId: args.deviceId,
        externalSegmentId: segment.externalSegmentId,
        source: "browser_extension",
        localDate: segment.localDate,
        domain: normalized.domain,
        pathname: normalized.pathname,
        url: normalized.url,
        title: normalized.title,
        startedAt: segment.startedAt,
        endedAt: segment.endedAt,
        activeDurationMs: segment.activeDurationMs,
        idleDurationMs: segment.idleDurationMs,
        isIdleSplit: segment.isIdleSplit,
        capturedUrlMode: args.capturedUrlMode,
        createdAt: Date.now(),
      });
      changedDates.add(segment.localDate);
    }

    for (const localDate of changedDates) {
      await ctx.scheduler.runAfter(0, internal.internal.timeline.applySegmentsToDay as never, {
        userId: args.userId,
        teamId: args.teamId,
        deviceId: args.deviceId,
        localDate,
      });
    }

    return { ingested: changedDates.size };
  },
});
