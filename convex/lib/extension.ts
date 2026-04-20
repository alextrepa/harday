import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { defaultCaptureSettings } from "./defaults";

export const findPairingCode = internalQuery({
  args: { codeHash: v.string() },
  handler: async (ctx, { codeHash }) => {
    const record = await ctx.db
      .query("pairingCodes")
      .withIndex("by_code_hash", (q) => q.eq("codeHash", codeHash))
      .unique();
    if (!record || record.consumedAt || record.expiresAt < Date.now()) {
      return null;
    }

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", record.userId))
      .unique();

    return {
      ...record,
      capture: settings?.capture ?? defaultCaptureSettings,
    };
  },
});

export const consumePairingCode = internalMutation({
  args: {
    pairingCodeId: v.id("pairingCodes"),
    tokenHash: v.string(),
    deviceLabel: v.string(),
    extensionVersion: v.string(),
    platform: v.string(),
  },
  handler: async (ctx, args) => {
    const pairing = await ctx.db.get(args.pairingCodeId);
    if (!pairing || pairing.consumedAt || pairing.expiresAt < Date.now()) {
      throw new Error("Invalid pairing code");
    }
    await ctx.db.patch(pairing._id, { consumedAt: Date.now() });

    return await ctx.db.insert("devices", {
      userId: pairing.userId,
      teamId: pairing.teamId,
      label: args.deviceLabel,
      kind: "chromium_extension",
      platform: args.platform,
      extensionVersion: args.extensionVersion,
      tokenHash: args.tokenHash,
      permissions: ["tabs", "idle", "storage", "alarms", "webNavigation"],
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    });
  },
});

export const findDeviceByToken = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const device = await ctx.db
      .query("devices")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (!device || device.revokedAt) {
      return null;
    }

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", device.userId))
      .unique();

    return {
      deviceId: device._id,
      userId: device.userId,
      teamId: device.teamId,
      capture: settings?.capture ?? defaultCaptureSettings,
    };
  },
});
