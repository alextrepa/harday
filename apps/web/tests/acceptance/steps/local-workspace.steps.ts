import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";

const { Given, When, Then } = createBdd();

Given("I have no saved TimeTracker workspace", async ({ page }) => {
  await page.route("http://127.0.0.1:8787/api/connectors", async (route) => {
    await route.fulfill({
      json: {
        plugins: [],
        connectionGroups: [],
        totalPendingImportCount: 0,
        totalSelectedImportCount: 0,
      },
      headers: {
        "access-control-allow-origin": "*",
      },
    });
  });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

When("I open today's time workspace", async ({ page }) => {
  await page.goto("/time/today");
});

Then("the Time workspace is visible", async ({ page }) => {
  await expect(
    page.getByRole("button", { name: "Open primary navigation" }),
  ).toContainText("Time");
});

Then("the timesheet can be submitted", async ({ page }) => {
  const submitTimesheet = page.getByRole("button", {
    name: "Submit timesheet",
  });

  await expect(submitTimesheet).toBeVisible();
  await expect(submitTimesheet).toBeEnabled();
});

When("I install a packaged connector from settings", async ({ page }) => {
  const plugin = {
    id: "example",
    version: "1.2.3",
    apiVersion: 1,
    displayName: "Example",
    description: "Example connector used by the acceptance test.",
    iconSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/></svg>',
    entrypoint: "dist/plugin.js",
    connectionFields: [
      {
        id: "url",
        label: "URL",
        type: "url",
        required: true,
        secret: false,
      },
    ],
  };

  const installResponse = {
    plugin,
    replaced: false,
    overview: {
      plugins: [plugin],
      connectionGroups: [{ plugin, enabled: true, connections: [] }],
      totalPendingImportCount: 0,
      totalSelectedImportCount: 0,
    },
  };
  await page.addInitScript((response) => {
    const desktopWindow = window as typeof window & {
      timetrackerDesktop: {
        bootstrapLocalState: null;
        runtime: { developmentBuild: false };
        installConnectorPlugin: () => Promise<typeof response>;
        uninstallConnectorPlugin: () => Promise<{
          pluginId: string;
          overview: {
            plugins: never[];
            connectionGroups: never[];
            totalPendingImportCount: number;
            totalSelectedImportCount: number;
          };
        }>;
      };
    };
    desktopWindow.timetrackerDesktop = {
      bootstrapLocalState: null,
      runtime: { developmentBuild: false },
      installConnectorPlugin: async () => response,
      uninstallConnectorPlugin: async () => ({
        pluginId: response.plugin.id,
        overview: {
          plugins: [],
          connectionGroups: [],
          totalPendingImportCount: 0,
          totalSelectedImportCount: 0,
        },
      }),
    };
  }, installResponse);

  await page.route(
    "http://127.0.0.1:8787/api/connectors/example/activation",
    async (route) => {
      const payload = route.request().postDataJSON() as { enabled: boolean };
      await route.fulfill({
        json: {
          ...installResponse.overview,
          connectionGroups: installResponse.overview.connectionGroups.map(
            (group) => ({ ...group, enabled: payload.enabled }),
          ),
        },
        headers: {
          "access-control-allow-origin": "*",
        },
      });
    },
  );

  await page.goto("/settings/plugins");

  const installButton = page.getByRole("button", {
    name: "Install connector",
  });
  await expect(installButton).toBeVisible();

  await installButton.click();
});

When("I deactivate the connector plugin with the keyboard", async ({ page }) => {
  const deactivateSwitch = page.getByRole("switch", {
    name: "Deactivate Example",
  });
  await deactivateSwitch.focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("switch", { name: "Activate Example" }),
  ).toHaveAttribute("aria-checked", "false");
});

Then("the inactive connector plugin remains configurable", async ({ page }) => {
  await page.getByRole("link", { name: "Configure Example" }).click();
  await expect(page).toHaveURL(/\/settings\/plugins\/example$/);
  await expect(page.getByText("This plugin is inactive.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add a connection" }),
  ).toBeVisible();
});

When("I open the former connectors settings route", async ({ page }) => {
  await page.goto("/settings/connectors");
});

When("I open the plugins catalog", async ({ page }) => {
  await page.goto("/settings/plugins");
});

Then("I arrive at the plugins catalog", async ({ page }) => {
  await expect(page).toHaveURL(/\/settings\/plugins$/);
  await expect(page.getByRole("heading", { name: "Plugins" })).toBeVisible();
});

Then("the empty plugin catalog is explained", async ({ page }) => {
  await expect(page.getByText("No connector plugins installed")).toBeVisible();
});

Then("Outlook Calendar is not offered", async ({ page }) => {
  await expect(page.getByText("Outlook Calendar")).toHaveCount(0);
});

Then("the connector plugin is reported as installed", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Plugins" })).toBeVisible();
  await expect(page.getByText("Example 1.2.3 installed.")).toBeVisible();
  await expect(page.getByText("Version 1.2.3")).toBeVisible();
});

Then("I can open the connector plugin configuration", async ({ page }) => {
  await page.getByRole("link", { name: "Configure Example" }).click();

  await expect(page).toHaveURL(/\/settings\/plugins\/example$/);
  await expect(page.getByRole("heading", { name: "Example" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add a connection" }),
  ).toBeVisible();
});

When("I open the connector plugin configuration", async ({ page }) => {
  await page.getByRole("link", { name: "Configure Example" }).click();
  await expect(page).toHaveURL(/\/settings\/plugins\/example$/);
});

When("I uninstall the connector plugin", async ({ page }) => {
  await page.getByRole("button", { name: "Uninstall", exact: true }).click();
  await page.getByRole("button", { name: "Uninstall plugin" }).click();
});

Then("the connector plugin is reported as uninstalled", async ({ page }) => {
  await expect(page).toHaveURL(/\/settings\/plugins\/example$/);
  await expect(
    page.getByText("Example uninstalled. Imported backlog items were preserved."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Configure Example" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Return to the catalog" }),
  ).toBeVisible();
});

When("I open development plugin settings", async ({ page }) => {
  await page.addInitScript(() => {
    const initialSettings = {
      available: true,
      directories: ["/workspace/connectors/example"],
    };
    const selectedSettings = {
      available: true,
      directories: ["/workspace/connectors/selected"],
    };
    const desktopWindow = window as typeof window & {
      timetrackerDesktop: {
        bootstrapLocalState: null;
        runtime: { developmentBuild: true };
        getDevelopmentPluginSettings: () => Promise<typeof initialSettings>;
        selectDevelopmentPluginDirectory: () => Promise<typeof selectedSettings>;
        clearDevelopmentPluginDirectories: () => Promise<typeof initialSettings>;
      };
    };
    desktopWindow.timetrackerDesktop = {
      bootstrapLocalState: null,
      runtime: { developmentBuild: true },
      getDevelopmentPluginSettings: async () => initialSettings,
      selectDevelopmentPluginDirectory: async () => selectedSettings,
      clearDevelopmentPluginDirectories: async () => initialSettings,
    };
  });
  await page.goto("/settings/debug");
});

Then("I can choose a development plugin directory", async ({ page }) => {
  await expect(
    page.getByRole("heading", { name: "Development plugin directory" }),
  ).toBeVisible();
  await expect(page.getByText("/workspace/connectors/example")).toBeVisible();

  await page.getByRole("button", { name: "Choose directory" }).click();
  await expect(page.getByText("/workspace/connectors/selected")).toBeVisible();
});
