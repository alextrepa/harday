import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { access, readdir, readFile } from "node:fs/promises";
import {
  connectorSyncWorkItemSchema,
  connectorFieldValuesSchema,
  connectorPluginManifestSchema,
  connectorPluginSyncResultSchema,
  connectorPluginValidationResultSchema,
  type ConnectorFieldValues,
  type ConnectorPluginManifest,
  type ConnectorPluginSyncResult,
  type ConnectorSyncWorkItem,
  type ConnectorPluginValidationResult,
} from "../../../packages/shared/src/connectors.ts";
import { z } from "zod";

interface PluginHostOptions {
  pluginDirectories?: string[];
  requestTimeoutMs?: number;
}

interface ResolvedPlugin {
  manifest: ConnectorPluginManifest;
  directory: string;
  entrypointPath: string;
  modulePromise?: Promise<ConnectorPluginModule>;
}

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

interface ConnectorPluginModule {
  validateConnection(config: ConnectorFieldValues): Promise<unknown>;
  syncConnection(connection: PluginInvocationConnection, workItems: ConnectorSyncWorkItem[]): Promise<unknown>;
}

const requireFromHere = createRequire(import.meta.url);

function defaultPluginDirectory() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../plugins");
}

function comparePlugins(left: ConnectorPluginManifest, right: ConnectorPluginManifest) {
  return left.displayName.localeCompare(right.displayName) || left.id.localeCompare(right.id);
}

export class ConnectorPluginManager {
  private readonly pluginDirectories: string[];
  private readonly requestTimeoutMs: number;
  private pluginsPromise?: Promise<Map<string, ResolvedPlugin>>;

  constructor(options: PluginHostOptions = {}) {
    this.pluginDirectories = options.pluginDirectories?.length
      ? options.pluginDirectories
      : [defaultPluginDirectory()];
    this.requestTimeoutMs = options.requestTimeoutMs ?? 30_000;
  }

  async listPlugins(): Promise<ConnectorPluginManifest[]> {
    const plugins = await this.loadPlugins();
    return Array.from(plugins.values())
      .map((plugin) => plugin.manifest)
      .sort(comparePlugins);
  }

  async validateConnection(
    pluginId: string,
    config: ConnectorFieldValues,
  ): Promise<ConnectorPluginValidationResult> {
    return this.invokePlugin(pluginId, "validateConnection", { config }, connectorPluginValidationResultSchema);
  }

  async syncConnection(
    pluginId: string,
    connection: PluginInvocationConnection,
    workItems: ConnectorSyncWorkItem[] = [],
  ): Promise<ConnectorPluginSyncResult> {
    const payload = {
      connection: pluginInvocationConnectionSchema.parse(connection),
      workItems: workItems.map((workItem) => connectorSyncWorkItemSchema.parse(workItem)),
    };

    return this.invokePlugin(pluginId, "syncConnection", payload, connectorPluginSyncResultSchema);
  }

  async invokePlugin<T>(
    pluginId: string,
    method: "validateConnection" | "syncConnection",
    params: Record<string, unknown>,
    schema: { parse: (value: unknown) => T },
  ): Promise<T> {
    const plugin = await this.getPlugin(pluginId);
    const pluginModule = await this.loadPluginModule(plugin);
    const operation =
      method === "validateConnection"
        ? pluginModule.validateConnection(connectorFieldValuesSchema.parse(params.config))
        : pluginModule.syncConnection(
            pluginInvocationConnectionSchema.parse(params.connection),
            Array.isArray(params.workItems)
              ? params.workItems.map((workItem) => connectorSyncWorkItemSchema.parse(workItem))
              : [],
          );

    const result = await this.withTimeout(operation, `Connector plugin "${pluginId}" timed out while handling ${method}.`);
    return schema.parse(result);
  }

  private async getPlugin(pluginId: string): Promise<ResolvedPlugin> {
    const plugins = await this.loadPlugins();
    const plugin = plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Connector plugin "${pluginId}" is not installed.`);
    }

    return plugin;
  }

  private async loadPluginModule(plugin: ResolvedPlugin): Promise<ConnectorPluginModule> {
    if (!plugin.modulePromise) {
      const moduleLoader =
        plugin.entrypointPath.endsWith(".cjs") || plugin.entrypointPath.endsWith(".cts")
          ? Promise.resolve(requireFromHere(plugin.entrypointPath))
          : import(/* @vite-ignore */ pathToFileURL(plugin.entrypointPath).toString());

      plugin.modulePromise = moduleLoader.then((module) => {
        if (
          typeof (module as Partial<ConnectorPluginModule>).validateConnection !== "function" ||
          typeof (module as Partial<ConnectorPluginModule>).syncConnection !== "function"
        ) {
          throw new Error(`Connector plugin "${plugin.manifest.id}" does not export validateConnection and syncConnection.`);
        }

        return module as ConnectorPluginModule;
      });
    }

    return await plugin.modulePromise;
  }

  private async withTimeout<T>(operation: Promise<T>, message: string): Promise<T> {
    return await new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error(message)), this.requestTimeoutMs);

      operation.then(
        (result) => {
          clearTimeout(timeoutId);
          resolve(result);
        },
        (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
      );
    });
  }

  private async loadPlugins(): Promise<Map<string, ResolvedPlugin>> {
    if (!this.pluginsPromise) {
      this.pluginsPromise = this.discoverPlugins();
    }

    return await this.pluginsPromise;
  }

  private async discoverPlugins(): Promise<Map<string, ResolvedPlugin>> {
    const plugins = new Map<string, ResolvedPlugin>();

    for (const pluginRoot of this.pluginDirectories) {
      let entries: string[] = [];
      try {
        entries = await readdir(pluginRoot);
      } catch {
        continue;
      }

      for (const entry of entries) {
        const pluginDirectory = path.join(pluginRoot, entry);
        const manifestPath = path.join(pluginDirectory, "plugin.json");

        try {
          await access(manifestPath);
        } catch {
          continue;
        }

        const rawManifest = await readFile(manifestPath, "utf8");
        const manifest = connectorPluginManifestSchema.parse(JSON.parse(rawManifest));
        plugins.set(manifest.id, {
          manifest,
          directory: pluginDirectory,
          entrypointPath: path.join(pluginDirectory, manifest.entrypoint),
        });
      }
    }

    return plugins;
  }
}

export type ConnectorPluginConnection = PluginInvocationConnection;
