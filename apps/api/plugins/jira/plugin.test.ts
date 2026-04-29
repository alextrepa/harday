import { afterEach, describe, expect, it, vi } from "vitest";
import { validateConnection } from "./plugin.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("jira plugin validateConnection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("preserves task icon display mode in normalized config", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse({
          accountId: "abc123",
        }),
      ),
    );

    await expect(
      validateConnection({
        baseUrl: "https://example.atlassian.net",
        email: "user@example.com",
        apiToken: "secret",
        queryScope: "assigned_to_me",
        taskIconDisplayMode: "never",
      }),
    ).resolves.toMatchObject({
      normalizedConfig: {
        baseUrl: "https://example.atlassian.net",
        email: "user@example.com",
        apiToken: "secret",
        queryScope: "assigned_to_me",
        taskIconDisplayMode: "never",
      },
    });
  });
});
