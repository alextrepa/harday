import readline from "node:readline";
import {
  connectorFieldValuesSchema,
  connectorPluginSyncResultSchema,
  connectorPluginValidationResultSchema,
  type ConnectorFieldValues,
  type ConnectorPluginSyncResult,
  type ConnectorPluginValidationResult,
} from "../../../packages/shared/src/connectors.ts";
import { z } from "zod";

const pluginInvocationConnectionSchema = z.object({
  id: z.string().min(1).max(120),
  pluginId: z.string().min(1).max(120),
  label: z.string().min(1).max(120),
  tenantLabel: z.string().min(1).max(120),
  autoSync: z.boolean(),
  autoSyncIntervalMinutes: z.number().int().min(1).max(1440),
  connectedAt: z.number().int().positive(),
  lastSyncAt: z.number().int().positive().optional(),
  lastError: z.string().max(1000).optional(),
  config: connectorFieldValuesSchema,
});

type PluginInvocationConnection = z.infer<typeof pluginInvocationConnectionSchema>;

interface PluginWorkerHandlers {
  validateConnection(config: ConnectorFieldValues): Promise<ConnectorPluginValidationResult>;
  syncConnection(connection: PluginInvocationConnection): Promise<ConnectorPluginSyncResult>;
}

export function runPluginWorker(handlers: PluginWorkerHandlers) {
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  rl.on("line", async (line) => {
    if (!line.trim()) {
      return;
    }

    let request: { id?: string; method?: string; params?: Record<string, unknown> };
    try {
      request = JSON.parse(line) as { id?: string; method?: string; params?: Record<string, unknown> };
    } catch {
      process.stdout.write(`${JSON.stringify({ error: "Invalid JSON request." })}\n`);
      return;
    }

    try {
      if (request.method === "validateConnection") {
        const config = connectorFieldValuesSchema.parse(request.params?.config);
        const result = connectorPluginValidationResultSchema.parse(await handlers.validateConnection(config));
        process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`);
        return;
      }

      if (request.method === "syncConnection") {
        const connection = pluginInvocationConnectionSchema.parse(request.params?.connection);
        const result = connectorPluginSyncResultSchema.parse(await handlers.syncConnection(connection));
        process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`);
        return;
      }

      process.stdout.write(`${JSON.stringify({ id: request.id, error: "Unknown plugin method." })}\n`);
    } catch (error) {
      process.stdout.write(
        `${JSON.stringify({
          id: request.id,
          error: error instanceof Error ? error.message : "Unknown plugin error.",
        })}\n`,
      );
    } finally {
      rl.close();
    }
  });
}
