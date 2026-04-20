import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMembership } from "./lib/auth";

export const list = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, { teamId }) => {
    const { user } = await requireMembership(ctx, teamId);
    return await ctx.db
      .query("categorizationRules")
      .withIndex("by_user_status", (q) => q.eq("userId", user._id).eq("status", "active"))
      .collect();
  },
});

export const listProposals = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, { teamId }) => {
    const { user } = await requireMembership(ctx, teamId);
    return await ctx.db
      .query("ruleProposals")
      .withIndex("by_user_status", (q) => q.eq("userId", user._id).eq("status", "pending"))
      .collect();
  },
});

export const createManualRule = mutation({
  args: {
    teamId: v.id("teams"),
    targetProjectId: v.id("projects"),
    priority: v.number(),
    action: v.union(v.literal("suggest"), v.literal("auto_assign")),
    baseConfidence: v.number(),
    condition: v.object({
      domain: v.optional(v.string()),
      pathnamePrefix: v.optional(v.string()),
      titleContains: v.optional(v.string()),
      exactTitle: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const { user } = await requireMembership(ctx, args.teamId);
    return await ctx.db.insert("categorizationRules", {
      userId: user._id,
      teamId: args.teamId,
      enabled: true,
      priority: args.priority,
      source: "manual",
      status: "active",
      action: args.action,
      targetProjectId: args.targetProjectId,
      condition: args.condition,
      baseConfidence: args.baseConfidence,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const updateRule = mutation({
  args: {
    teamId: v.id("teams"),
    ruleId: v.id("categorizationRules"),
    enabled: v.boolean(),
    priority: v.number(),
    action: v.union(v.literal("suggest"), v.literal("auto_assign")),
    baseConfidence: v.number(),
    status: v.union(v.literal("active"), v.literal("pending"), v.literal("rejected")),
    condition: v.object({
      domain: v.optional(v.string()),
      pathnamePrefix: v.optional(v.string()),
      titleContains: v.optional(v.string()),
      exactTitle: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.teamId);
    await ctx.db.patch(args.ruleId, {
      enabled: args.enabled,
      priority: args.priority,
      action: args.action,
      baseConfidence: args.baseConfidence,
      status: args.status,
      condition: args.condition,
      updatedAt: Date.now(),
    });
  },
});

export const acceptProposal = mutation({
  args: { teamId: v.id("teams"), proposalId: v.id("ruleProposals") },
  handler: async (ctx, args) => {
    const { user } = await requireMembership(ctx, args.teamId);
    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal) {
      throw new Error("Proposal not found");
    }
    await ctx.db.patch(args.proposalId, {
      status: "accepted",
      resolvedAt: Date.now(),
    });
    return await ctx.db.insert("categorizationRules", {
      userId: user._id,
      teamId: args.teamId,
      enabled: true,
      priority: 50,
      source: "learned",
      status: "active",
      action: "suggest",
      targetProjectId: proposal.targetProjectId,
      condition: proposal.condition,
      baseConfidence: 0.9,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const rejectProposal = mutation({
  args: { teamId: v.id("teams"), proposalId: v.id("ruleProposals") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.teamId);
    await ctx.db.patch(args.proposalId, {
      status: "rejected",
      resolvedAt: Date.now(),
    });
  },
});
