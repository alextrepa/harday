import { extensionIngestInputSchema, extensionPairingInputSchema } from "@timetracker/shared";
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { createOpaqueToken, hashSecret } from "./lib/security";

const http = httpRouter();

const pair = httpAction(async (ctx, request) => {
  const body = extensionPairingInputSchema.parse(await request.json());
  const codeHash = await hashSecret(body.code);

  const pairing = await ctx.runQuery(internal.lib.extension.findPairingCode as never, { codeHash });
  if (!pairing) {
    return new Response(JSON.stringify({ error: "Invalid or expired code" }), { status: 401 });
  }

  const token = createOpaqueToken();
  const tokenHash = await hashSecret(token);
  const deviceId = await ctx.runMutation(internal.lib.extension.consumePairingCode as never, {
    pairingCodeId: pairing._id,
    tokenHash,
    deviceLabel: body.deviceLabel,
    extensionVersion: body.extensionVersion,
    platform: body.platform,
  });

  return Response.json({
    token,
    deviceId,
    capture: pairing.capture,
    teamId: pairing.teamId,
    userId: pairing.userId,
  });
});

const ingest = httpAction(async (ctx, request) => {
  const body = extensionIngestInputSchema.parse(await request.json());
  const tokenHash = await hashSecret(body.token);
  const device = await ctx.runQuery(internal.lib.extension.findDeviceByToken as never, { tokenHash });

  if (!device) {
    return new Response(JSON.stringify({ error: "Unauthorized device" }), { status: 401 });
  }

  await ctx.runMutation(internal.internal.extension.ingestSegments as never, {
    userId: device.userId,
    teamId: device.teamId,
    deviceId: device.deviceId,
    capturedUrlMode: device.capture.urlMode,
    segments: body.segments,
  });

  return Response.json({ ok: true });
});

http.route({
  path: "/api/extension/pair",
  method: "POST",
  handler: pair,
});

http.route({
  path: "/api/extension/ingest",
  method: "POST",
  handler: ingest,
});

export default http;
