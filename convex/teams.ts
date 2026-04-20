import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUserRecord, requireMembership } from "./lib/auth";
import { defaultCaptureSettings, defaultReviewSettings, defaultTeamSettings } from "./lib/defaults";

export const current = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserRecord(ctx);
    if (!user?.defaultTeamId) {
      return null;
    }

    const team = await ctx.db.get(user.defaultTeamId);
    if (!team) {
      return null;
    }

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_team_user", (q) => q.eq("teamId", team._id).eq("userId", user._id))
      .unique();

    return { team, membership };
  },
});

export const createInitialTeam = mutation({
  args: {
    teamName: v.string(),
    teamSlug: v.string(),
    projects: v.array(
      v.object({
        name: v.string(),
        color: v.string(),
        code: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserRecord(ctx);
    if (!user) {
      throw new Error("User required");
    }

    const existing = await ctx.db
      .query("teams")
      .withIndex("by_slug", (q) => q.eq("slug", args.teamSlug))
      .unique();
    if (existing) {
      throw new Error("Team slug already in use");
    }

    const now = Date.now();
    const teamId = await ctx.db.insert("teams", {
      name: args.teamName,
      slug: args.teamSlug,
      createdByUserId: user._id,
      settings: defaultTeamSettings,
      createdAt: now,
    });

    await ctx.db.insert("memberships", {
      teamId,
      userId: user._id,
      role: "owner",
      status: "active",
      joinedAt: now,
    });

    await ctx.db.insert("userSettings", {
      userId: user._id,
      teamId,
      capture: defaultCaptureSettings,
      review: defaultReviewSettings,
      updatedAt: now,
    });

    for (const project of args.projects) {
      await ctx.db.insert("projects", {
        teamId,
        name: project.name,
        code: project.code,
        color: project.color,
        status: "active",
        createdByUserId: user._id,
        createdAt: now,
      });
    }

    await ctx.db.patch(user._id, {
      defaultTeamId: teamId,
      lastActiveAt: now,
    });

    return { teamId };
  },
});

export const acceptInvite = mutation({
  args: { token: v.string() },
  handler: async () => {
    throw new Error("Invite acceptance is not implemented in the first pass");
  },
});
