import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMembership } from "./lib/auth";
import { createNumericCode, hashSecret } from "./lib/security";

export const createPairingCode = mutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, { teamId }) => {
    const { user } = await requireMembership(ctx, teamId);
    const code = createNumericCode(6);
    const codeHash = await hashSecret(code);
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000;

    await ctx.db.insert("pairingCodes", {
      userId: user._id,
      teamId,
      codeHash,
      expiresAt,
      createdAt: now,
    });

    return { code, expiresAt };
  },
});

export const listDevices = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, { teamId }) => {
    const { user } = await requireMembership(ctx, teamId);
    return await ctx.db
      .query("devices")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const revokeDevice = mutation({
  args: { teamId: v.id("teams"), deviceId: v.id("devices") },
  handler: async (ctx, { teamId, deviceId }) => {
    await requireMembership(ctx, teamId);
    await ctx.db.patch(deviceId, { revokedAt: Date.now() });
  },
});
