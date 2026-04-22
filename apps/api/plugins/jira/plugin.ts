import { connectorFieldValuesSchema, type ConnectorFieldValues } from "../../../../packages/shared/src/connectors.ts";
import { syncJiraConnection, type JiraConnectionInput, validateJiraConnection } from "../../src/connectors/jira.ts";

function buildJiraConfig(values: ConnectorFieldValues, connection?: { id: string; label: string; tenantLabel: string }): JiraConnectionInput {
  const parsed = connectorFieldValuesSchema.parse(values);

  if (typeof parsed.baseUrl !== "string" || !parsed.baseUrl.trim()) {
    throw new Error('Jira field "baseUrl" is required.');
  }

  if (typeof parsed.email !== "string" || !parsed.email.trim()) {
    throw new Error('Jira field "email" is required.');
  }

  if (typeof parsed.apiToken !== "string" || !parsed.apiToken.trim()) {
    throw new Error('Jira field "apiToken" is required.');
  }

  if (parsed.queryScope !== "assigned_to_me" && parsed.queryScope !== "project_open_issues") {
    throw new Error('Jira field "queryScope" is invalid.');
  }

  return {
    id: connection?.id,
    label: connection?.label ?? "Jira",
    tenantLabel: connection?.tenantLabel ?? "Default workspace",
    baseUrl: parsed.baseUrl,
    email: parsed.email,
    apiToken: parsed.apiToken,
    projectKey:
      typeof parsed.projectKey === "string" && parsed.projectKey.trim()
        ? parsed.projectKey.trim()
        : undefined,
    queryScope: parsed.queryScope,
    originalEstimateFieldName:
      typeof parsed.originalEstimateFieldName === "string" && parsed.originalEstimateFieldName.trim()
        ? parsed.originalEstimateFieldName.trim()
        : undefined,
    remainingEstimateFieldName:
      typeof parsed.remainingEstimateFieldName === "string" && parsed.remainingEstimateFieldName.trim()
        ? parsed.remainingEstimateFieldName.trim()
        : undefined,
    completedEstimateFieldName:
      typeof parsed.completedEstimateFieldName === "string" && parsed.completedEstimateFieldName.trim()
        ? parsed.completedEstimateFieldName.trim()
        : undefined,
  };
}

export async function validateConnection(config: ConnectorFieldValues) {
  const jiraConfig = buildJiraConfig(config);
  return await validateJiraConnection(jiraConfig);
}

export async function syncConnection(connection: {
  id: string;
  label: string;
  tenantLabel: string;
  config: ConnectorFieldValues;
}, workItems = []) {
  const jiraConfig = buildJiraConfig(connection.config, connection);
  return await syncJiraConnection(jiraConfig, workItems);
}
