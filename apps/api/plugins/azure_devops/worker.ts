import { connectorFieldValuesSchema, type ConnectorFieldValues } from "../../../../packages/shared/src/connectors.ts";
import { runPluginWorker } from "../../src/plugin-worker.ts";
import {
  fetchAzureDevOpsImportCandidates,
  type AzureDevOpsConnectionInput,
  validateAzureDevOpsConnection,
} from "../../src/connectors/azure-devops.ts";

function buildAzureConfig(values: ConnectorFieldValues, connection?: { id: string; label: string; tenantLabel: string }): AzureDevOpsConnectionInput {
  const parsed = connectorFieldValuesSchema.parse(values);

  if (typeof parsed.organizationUrl !== "string" || !parsed.organizationUrl.trim()) {
    throw new Error('Azure DevOps field "organizationUrl" is required.');
  }

  if (typeof parsed.personalAccessToken !== "string" || !parsed.personalAccessToken.trim()) {
    throw new Error('Azure DevOps field "personalAccessToken" is required.');
  }

  if (parsed.queryScope !== "assigned_to_me" && parsed.queryScope !== "project_open_tasks") {
    throw new Error('Azure DevOps field "queryScope" is invalid.');
  }

  return {
    id: connection?.id,
    label: connection?.label ?? "Azure DevOps",
    tenantLabel: connection?.tenantLabel ?? "Default tenant",
    organizationUrl: parsed.organizationUrl,
    personalAccessToken: parsed.personalAccessToken,
    queryScope: parsed.queryScope,
    priorityFieldName:
      typeof parsed.priorityFieldName === "string" && parsed.priorityFieldName.trim()
        ? parsed.priorityFieldName.trim()
        : undefined,
  };
}

runPluginWorker({
  async validateConnection(config) {
    const azureConfig = buildAzureConfig(config);
    const validation = await validateAzureDevOpsConnection(azureConfig);

    const normalizedConfig: ConnectorFieldValues = {
      organizationUrl: azureConfig.organizationUrl.replace(/\/+$/, ""),
      personalAccessToken: azureConfig.personalAccessToken,
      queryScope: azureConfig.queryScope,
    };

    if (azureConfig.priorityFieldName) {
      normalizedConfig.priorityFieldName = azureConfig.priorityFieldName;
    }

    const connectionSummary: Record<string, string | boolean> = {
      organizationUrl: azureConfig.organizationUrl.replace(/\/+$/, ""),
      scope: azureConfig.queryScope === "assigned_to_me" ? "Assigned to me" : "Open tasks across organization",
    };

    if (validation.priorityField?.configuredName) {
      connectionSummary.priorityFieldName = validation.priorityField.configuredName;
    }
    if (validation.priorityField?.resolvedReferenceName) {
      connectionSummary.priorityFieldResolvedReferenceName = validation.priorityField.resolvedReferenceName;
    }
    if (validation.priorityField?.type) {
      connectionSummary.priorityFieldType = validation.priorityField.type;
    }
    if (typeof validation.priorityField?.isQueryable === "boolean") {
      connectionSummary.priorityFieldIsQueryable = validation.priorityField.isQueryable;
    }

    return {
      normalizedConfig,
      connectionSummary,
    };
  },
  async syncConnection(connection) {
    const azureConfig = buildAzureConfig(connection.config, connection);
    return await fetchAzureDevOpsImportCandidates(azureConfig);
  },
});
