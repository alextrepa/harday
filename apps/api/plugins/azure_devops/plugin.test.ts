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

describe("azure_devops plugin validateConnection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("preserves task icon display mode in normalized config", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ value: [] }))
        .mockResolvedValueOnce(jsonResponse({ workItems: [] })),
    );

    await expect(
      validateConnection({
        organizationUrl: "https://dev.azure.com/contoso",
        personalAccessToken: "secret",
        queryScope: "assigned_to_me",
        taskIconDisplayMode: "fallback",
      }),
    ).resolves.toMatchObject({
      normalizedConfig: {
        organizationUrl: "https://dev.azure.com/contoso",
        personalAccessToken: "secret",
        queryScope: "assigned_to_me",
        taskIconDisplayMode: "fallback",
      },
    });
  });
});
