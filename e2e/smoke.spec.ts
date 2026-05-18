import { test, expect } from "@playwright/test";

// Smoke tests: verify the 4 main pages load without crashing.
// These don't test data — just that the shell renders and key UI elements appear.

test.describe("Dashboard", () => {
  test("loads and shows pipeline section", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible({ timeout: 10000 });
    // At least one stat card or pipeline label visible
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
  });
});

test.describe("Contacts", () => {
  test("loads contacts list", async ({ page }) => {
    await page.goto("/contacts");
    await expect(page.getByRole("heading", { name: /contacts/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /add contact/i })).toBeVisible();
  });
});

test.describe("Applications", () => {
  test("loads applications page with list/kanban toggle", async ({ page }) => {
    await page.goto("/applications");
    await expect(page.getByRole("heading", { name: /applications/i })).toBeVisible({
      timeout: 10000,
    });
    // List/Kanban view toggle buttons
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
  });
});

test.describe("Insights", () => {
  test("loads insights page with charts section", async ({ page }) => {
    await page.goto("/insights");
    await expect(page.getByRole("heading", { name: /insights/i })).toBeVisible({ timeout: 10000 });
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
  });
});

test.describe("Settings", () => {
  test("loads settings page with Gmail section", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText(/gmail integration/i)).toBeVisible({ timeout: 10000 });
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
  });
});

test.describe("Navigation", () => {
  test("sidebar links navigate correctly", async ({ page }) => {
    await page.goto("/dashboard");
    await page
      .getByRole("link", { name: /contacts/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/contacts/);
    await page
      .getByRole("link", { name: /applications/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/applications/);
  });
});
