import type { ActivityBlockRecord, FeatureStat, RuleRecord } from "@timetracker/shared";
import { evaluateBlockAgainstRules } from "@timetracker/shared";
import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const evaluateBlock = internalQuery({
  args: {
    userId: v.id("users"),
    teamId: v.id("teams"),
    block: v.object({
      domain: v.string(),
      pathname: v.string(),
      title: v.string(),
      userId: v.id("users"),
      teamId: v.id("teams"),
      localDate: v.string(),
      startedAt: v.number(),
      endedAt: v.number(),
      durationMs: v.number(),
      sourceSegmentIds: v.array(v.string()),
      fingerprint: v.string(),
      display: v.object({ label: v.string(), subtitle: v.string() }),
      status: v.union(v.literal("draft"), v.literal("suggested"), v.literal("edited"), v.literal("confirmed")),
      assignmentSource: v.union(v.literal("none"), v.literal("manual"), v.literal("rule"), v.literal("history"), v.literal("auto")),
      confidence: v.number(),
      explanation: v.optional(v.string()),
      note: v.optional(v.string()),
      isMicroBlock: v.boolean(),
      locked: v.boolean(),
    }),
  },
  handler: async (ctx, args) => {
    const rules = (await ctx.db
      .query("categorizationRules")
      .withIndex("by_user_enabled_priority", (q) =>
        q.eq("userId", args.userId).eq("enabled", true),
      )
      .collect()) as unknown as RuleRecord[];

    const stats = (await ctx.db
      .query("learningFeatureStats")
      .withIndex("by_user_feature", (q) => q.eq("userId", args.userId))
      .collect()) as unknown as FeatureStat[];

    return evaluateBlockAgainstRules(args.block as unknown as ActivityBlockRecord, rules, stats);
  },
});

export const applySuggestionToBlock = internalMutation({
  args: {
    blockId: v.id("activityBlocks"),
    projectId: v.optional(v.id("projects")),
    confidence: v.number(),
    explanation: v.optional(v.string()),
    assignmentSource: v.union(v.literal("none"), v.literal("rule"), v.literal("history"), v.literal("auto")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.blockId, {
      projectId: args.projectId,
      confidence: args.confidence,
      explanation: args.explanation,
      assignmentSource: args.assignmentSource,
      status: args.projectId ? "suggested" : "draft",
      updatedAt: Date.now(),
    });
  },
});
