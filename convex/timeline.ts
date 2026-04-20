import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireMembership } from "./lib/auth";

async function patchDayConfirmation(ctx: any, userId: any, localDate: string) {
  const blocks = await ctx.db
    .query("activityBlocks")
    .withIndex("by_user_local_date", (q: any) => q.eq("userId", userId).eq("localDate", localDate))
    .collect();
  const confirmedMs = blocks
    .filter((block: any) => block.status === "confirmed")
    .reduce((sum: number, block: any) => sum + block.durationMs, 0);
  const day = await ctx.db
    .query("timelineDays")
    .withIndex("by_user_local_date", (q: any) => q.eq("userId", userId).eq("localDate", localDate))
    .unique();
  if (day) {
    await ctx.db.patch(day._id, { confirmedMs });
  }
}

export const getDay = query({
  args: {
    teamId: v.id("teams"),
    localDate: v.string(),
  },
  handler: async (ctx, { teamId, localDate }) => {
    const { user } = await requireMembership(ctx, teamId);
    const day = await ctx.db
      .query("timelineDays")
      .withIndex("by_user_local_date", (q) => q.eq("userId", user._id).eq("localDate", localDate))
      .unique();
    const blocks = await ctx.db
      .query("activityBlocks")
      .withIndex("by_user_local_date", (q) => q.eq("userId", user._id).eq("localDate", localDate))
      .collect();
    return {
      localDate,
      status: day?.status ?? "open",
      trackedMs: day?.trackedMs ?? 0,
      confirmedMs: day?.confirmedMs ?? 0,
      blocks: blocks.sort((a, b) => a.startedAt - b.startedAt),
    };
  },
});

export const assignBlock = mutation({
  args: {
    teamId: v.id("teams"),
    blockId: v.id("activityBlocks"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const { user } = await requireMembership(ctx, args.teamId);
    const block = await ctx.db.get(args.blockId);
    if (!block) {
      throw new Error("Block not found");
    }

    const action =
      block.projectId && block.projectId !== args.projectId ? "changed_suggestion" : "manual_assign";

    await ctx.db.patch(args.blockId, {
      projectId: args.projectId,
      assignmentSource: "manual",
      status: "edited",
      locked: true,
      updatedAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.internal.learning.recordFeedback as never, {
      userId: user._id,
      teamId: args.teamId,
      blockId: args.blockId,
      projectId: args.projectId,
      action,
      suggestedProjectId: block.projectId,
    });
    await ctx.scheduler.runAfter(0, internal.internal.learning.generateRuleProposal as never, {
      userId: user._id,
      teamId: args.teamId,
      projectId: args.projectId,
      blockId: args.blockId,
    });
    await patchDayConfirmation(ctx, user._id, block.localDate);
  },
});

export const mergeBlocks = mutation({
  args: {
    teamId: v.id("teams"),
    leftBlockId: v.id("activityBlocks"),
    rightBlockId: v.id("activityBlocks"),
  },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.teamId);
    const left = await ctx.db.get(args.leftBlockId);
    const right = await ctx.db.get(args.rightBlockId);
    if (!left || !right) {
      throw new Error("Blocks not found");
    }

    await ctx.db.patch(args.leftBlockId, {
      endedAt: right.endedAt,
      durationMs: right.endedAt - left.startedAt,
      sourceSegmentIds: [...left.sourceSegmentIds, ...right.sourceSegmentIds],
      status: "edited",
      locked: true,
      updatedAt: Date.now(),
    });
    await ctx.db.delete(args.rightBlockId);
  },
});

export const splitBlock = mutation({
  args: {
    teamId: v.id("teams"),
    blockId: v.id("activityBlocks"),
    splitAt: v.number(),
  },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.teamId);
    const block = await ctx.db.get(args.blockId);
    if (!block) {
      throw new Error("Block not found");
    }
    if (args.splitAt <= block.startedAt || args.splitAt >= block.endedAt) {
      throw new Error("Invalid split point");
    }

    await ctx.db.patch(args.blockId, {
      endedAt: args.splitAt,
      durationMs: args.splitAt - block.startedAt,
      status: "edited",
      locked: true,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("activityBlocks", {
      ...block,
      startedAt: args.splitAt,
      durationMs: block.endedAt - args.splitAt,
      status: "edited",
      locked: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const renameBlock = mutation({
  args: {
    teamId: v.id("teams"),
    blockId: v.id("activityBlocks"),
    label: v.string(),
  },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.teamId);
    const block = await ctx.db.get(args.blockId);
    if (!block) {
      throw new Error("Block not found");
    }
    await ctx.db.patch(args.blockId, {
      display: { ...block.display, label: args.label },
      status: "edited",
      locked: true,
      updatedAt: Date.now(),
    });
  },
});

export const updateNote = mutation({
  args: {
    teamId: v.id("teams"),
    blockId: v.id("activityBlocks"),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.teamId);
    await ctx.db.patch(args.blockId, {
      note: args.note,
      status: "edited",
      updatedAt: Date.now(),
    });
  },
});

export const confirmDay = mutation({
  args: {
    teamId: v.id("teams"),
    localDate: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireMembership(ctx, args.teamId);
    const blocks = await ctx.db
      .query("activityBlocks")
      .withIndex("by_user_local_date", (q) => q.eq("userId", user._id).eq("localDate", args.localDate))
      .collect();
    const now = Date.now();

    for (const block of blocks) {
      await ctx.db.patch(block._id, {
        status: "confirmed",
        locked: true,
        confirmedAt: now,
        updatedAt: now,
      });
    }

    const trackedMs = blocks.reduce((sum, block) => sum + block.durationMs, 0);
    const day = await ctx.db
      .query("timelineDays")
      .withIndex("by_user_local_date", (q) => q.eq("userId", user._id).eq("localDate", args.localDate))
      .unique();

    if (day) {
      await ctx.db.patch(day._id, {
        status: "confirmed",
        confirmedAt: now,
        confirmedMs: trackedMs,
        trackedMs,
      });
    }
  },
});
