import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUserRecord, requireMembership } from "./lib/auth";

export const list = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, { teamId }) => {
    await requireMembership(ctx, teamId);
    return await ctx.db
      .query("projects")
      .withIndex("by_team_status", (q) => q.eq("teamId", teamId).eq("status", "active"))
      .collect();
  },
});

export const listArchived = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, { teamId }) => {
    await requireMembership(ctx, teamId);
    return await ctx.db
      .query("projects")
      .withIndex("by_team_status", (q) => q.eq("teamId", teamId).eq("status", "archived"))
      .collect();
  },
});

export const create = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.string(),
    code: v.optional(v.string()),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireMembership(ctx, args.teamId);
    return await ctx.db.insert("projects", {
      teamId: args.teamId,
      name: args.name,
      code: args.code,
      color: args.color,
      status: "active",
      createdByUserId: user._id,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    name: v.string(),
    code: v.optional(v.string()),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.teamId);
    await ctx.db.patch(args.projectId, {
      name: args.name,
      code: args.code,
      color: args.color,
    });
  },
});

export const archive = mutation({
  args: {
    projectId: v.id("projects"),
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.teamId);
    await ctx.db.patch(args.projectId, {
      status: "archived",
      archivedAt: Date.now(),
    });
  },
});

export const unarchive = mutation({
  args: {
    projectId: v.id("projects"),
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.teamId);
    await ctx.db.patch(args.projectId, {
      status: "active",
      archivedAt: undefined,
    });
  },
});
