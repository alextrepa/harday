import type { QueryCtx, MutationCtx } from "convex/server";

type AnyCtx = QueryCtx | MutationCtx;

export async function getIdentityOrThrow(ctx: AnyCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required");
  }
  return identity;
}

export async function getCurrentUserRecord(ctx: AnyCtx) {
  const identity = await getIdentityOrThrow(ctx);
  const existing = await ctx.db
    .query("users")
    .withIndex("by_auth_subject", (q) => q.eq("authSubject", identity.subject))
    .unique();

  if (existing) {
    return existing;
  }

  if ("insert" in ctx.db) {
    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      authSubject: identity.subject,
      email: identity.email ?? "",
      name: identity.name ?? identity.email ?? "Unknown User",
      imageUrl: identity.pictureUrl,
      timezone: "America/Toronto",
      createdAt: now,
      lastActiveAt: now,
    });
    return await ctx.db.get(userId);
  }

  return null;
}

export async function requireMembership(ctx: AnyCtx, teamId: string) {
  const user = await getCurrentUserRecord(ctx);
  if (!user) {
    throw new Error("User record not found");
  }

  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_team_user", (q) => q.eq("teamId", teamId).eq("userId", user._id))
    .unique();

  if (!membership) {
    throw new Error("Membership required");
  }

  return { user, membership };
}
