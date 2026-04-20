import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireMembership } from "./lib/auth";

export const getSummary = query({
  args: {
    teamId: v.id("teams"),
    from: v.string(),
    to: v.string(),
    confirmedOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.teamId);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    const users = await Promise.all(memberships.map((membership) => ctx.db.get(membership.userId)));
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team_status", (q) => q.eq("teamId", args.teamId).eq("status", "active"))
      .collect();

    const blocks = (
      await Promise.all(
        memberships.map((membership) =>
          ctx.db
            .query("activityBlocks")
            .withIndex("by_user_local_date", (q) => q.eq("userId", membership.userId))
            .collect(),
        ),
      )
    )
      .flat()
      .filter((block) => block.localDate >= args.from && block.localDate <= args.to)
      .filter((block) => (args.confirmedOnly ?? true ? block.status === "confirmed" : true));

    const byProject = projects.map((project) => ({
      projectId: project._id,
      projectName: project.name,
      durationMs: blocks
        .filter((block) => block.projectId === project._id)
        .reduce((sum, block) => sum + block.durationMs, 0),
    }));

    const byUser = users
      .filter(Boolean)
      .map((user) => ({
        userId: user!._id,
        userName: user!.name,
        durationMs: blocks
          .filter((block) => block.userId === user!._id)
          .reduce((sum, block) => sum + block.durationMs, 0),
      }));

    return {
      totalDurationMs: blocks.reduce((sum, block) => sum + block.durationMs, 0),
      byProject,
      byUser,
    };
  },
});
