import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMembership } from "./lib/auth";

export const get = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, { teamId }) => {
    const { user } = await requireMembership(ctx, teamId);
    return await ctx.db
      .query("userSettings")
      .withIndex("by_user_team", (q) => q.eq("userId", user._id).eq("teamId", teamId))
      .unique();
  },
});

export const update = mutation({
  args: {
    teamId: v.id("teams"),
    capture: v.object({
      urlMode: v.union(v.literal("domain_only"), v.literal("sanitized_path")),
      titleMode: v.union(v.literal("off"), v.literal("normalized")),
      blockedDomains: v.array(v.string()),
      sensitiveDomains: v.array(v.string()),
      maxPathSegments: v.number(),
    }),
    review: v.object({
      collapseMicroBlocks: v.boolean(),
      defaultReviewMode: v.union(v.literal("all"), v.literal("uncategorized"), v.literal("micro")),
    }),
  },
  handler: async (ctx, args) => {
    const { user } = await requireMembership(ctx, args.teamId);
    const record = await ctx.db
      .query("userSettings")
      .withIndex("by_user_team", (q) =>
        q.eq("userId", user._id).eq("teamId", args.teamId),
      )
      .unique();
    if (!record) {
      throw new Error("User settings not found");
    }
    await ctx.db.patch(record._id, {
      capture: args.capture,
      review: args.review,
      updatedAt: Date.now(),
    });
  },
});
