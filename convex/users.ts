import { query, mutation } from "./_generated/server";
import { getCurrentUserRecord } from "./lib/auth";

export const ensureCurrent = mutation({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUserRecord(ctx);
  },
});

export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) => q.eq("authSubject", identity.subject))
      .unique();

    return {
      identity: {
        subject: identity.subject,
        email: identity.email,
        name: identity.name,
        pictureUrl: identity.pictureUrl,
      },
      user,
    };
  },
});
