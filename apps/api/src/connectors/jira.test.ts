import { afterEach, describe, expect, it, vi } from "vitest";
import { type JiraConnectionInput, validateJiraConnection } from "./jira.ts";

function buildConnection(overrides: Partial<JiraConnectionInput> = {}): JiraConnectionInput {
  return {
    label: "Main connection",
    tenantLabel: "Contoso",
    baseUrl: "https://example.atlassian.net/",
    email: "user@example.com",
    apiToken: "secret",
    queryScope: "assigned_to_me",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("Jira connector validation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("omits empty optional fields from normalized config", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse({
          accountId: "abc123",
        }),
      ),
    );

    await expect(
      validateJiraConnection(
        buildConnection({
          projectKey: undefined,
        }),
      ),
    ).resolves.toEqual({
      normalizedConfig: {
        baseUrl: "https://example.atlassian.net",
        email: "user@example.com",
        apiToken: "secret",
        queryScope: "assigned_to_me",
      },
      connectionSummary: {
        site: "https://example.atlassian.net",
        projectKey: "All projects",
        scope: "Assigned to me",
      },
    });
  });
});
