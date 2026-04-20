import { extractFeatureSnapshots } from "@timetracker/shared";
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const recordFeedback = internalMutation({
  args: {
    userId: v.id("users"),
    teamId: v.id("teams"),
    blockId: v.id("activityBlocks"),
    projectId: v.id("projects"),
    action: v.union(
      v.literal("manual_assign"),
      v.literal("accepted_suggestion"),
      v.literal("changed_suggestion"),
    ),
    suggestedProjectId: v.optional(v.id("projects")),
    ruleId: v.optional(v.id("categorizationRules")),
  },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.blockId);
    if (!block) {
      return null;
    }

    const snapshots = extractFeatureSnapshots(block);
    const now = Date.now();

    await ctx.db.insert("assignmentFeedback", {
      userId: args.userId,
      teamId: args.teamId,
      blockId: args.blockId,
      projectId: args.projectId,
      action: args.action,
      suggestedProjectId: args.suggestedProjectId,
      ruleId: args.ruleId,
      featureSnapshot: snapshots,
      createdAt: now,
    });

    for (const snapshot of snapshots) {
      const existing = await ctx.db
        .query("learningFeatureStats")
        .withIndex("by_user_feature_project", (q) =>
          q
            .eq("userId", args.userId)
            .eq("featureType", snapshot.featureType)
            .eq("featureValue", snapshot.featureValue)
            .eq("projectId", args.projectId),
        )
        .unique();

      if (!existing) {
        await ctx.db.insert("learningFeatureStats", {
          userId: args.userId,
          teamId: args.teamId,
          featureType: snapshot.featureType,
          featureValue: snapshot.featureValue,
          projectId: args.projectId,
          matchCount: 1,
          lastMatchedAt: now,
        });
      } else {
        await ctx.db.patch(existing._id, {
          matchCount: existing.matchCount + 1,
          lastMatchedAt: now,
        });
      }
    }

    return snapshots.length;
  },
});

export const generateRuleProposal = internalMutation({
  args: {
    userId: v.id("users"),
    teamId: v.id("teams"),
    projectId: v.id("projects"),
    blockId: v.id("activityBlocks"),
  },
  handler: async (ctx, args) => {
    const feedback = await ctx.db
      .query("assignmentFeedback")
      .withIndex("by_user_project", (q) => q.eq("userId", args.userId).eq("projectId", args.projectId))
      .collect();

    const proposalCandidate = feedback
      .flatMap((item) => item.featureSnapshot)
      .find((snapshot) => snapshot.featureType === "domain+pathnamePrefix");

    if (!proposalCandidate) {
      return null;
    }

    const evidence = feedback.filter((item) =>
      item.featureSnapshot.some(
        (snapshot) =>
          snapshot.featureType === proposalCandidate.featureType &&
          snapshot.featureValue === proposalCandidate.featureValue,
      ),
    );

    if (evidence.length < 3) {
      return null;
    }

    const [domain, pathnamePrefix] = proposalCandidate.featureValue.split("|");
    const existing = await ctx.db
      .query("ruleProposals")
      .withIndex("by_user_status", (q) => q.eq("userId", args.userId).eq("status", "pending"))
      .collect();

    const duplicate = existing.find(
      (item) =>
        item.targetProjectId === args.projectId &&
        item.condition.domain === domain &&
        item.condition.pathnamePrefix === pathnamePrefix,
    );
    if (duplicate) {
      return duplicate._id;
    }

    return await ctx.db.insert("ruleProposals", {
      userId: args.userId,
      teamId: args.teamId,
      targetProjectId: args.projectId,
      condition: {
        domain,
        pathnamePrefix,
      },
      evidenceCount: evidence.length,
      precision: 0.9,
      sampleBlockIds: evidence.slice(0, 5).map((item) => item.blockId),
      status: "pending",
      generatedAt: Date.now(),
    });
  },
});
