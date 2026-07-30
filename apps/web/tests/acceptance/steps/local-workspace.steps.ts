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
