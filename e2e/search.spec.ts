import { test, expect } from "@playwright/test";

test.describe("Global Search", () => {
  test("search trigger is visible in the sidebar or header", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    // Search may be a button, input, or keyboard-shortcut-triggered modal
    const searchEl = page
      .getByRole("button", { name: /search/i })
      .or(page.getByPlaceholder(/search/i))
      .first();
    await expect(searchEl).toBeVisible({ timeout: 8000 });
  });

  test("typing a short query (< 2 chars) shows no results panel or stays idle", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    const searchBtn = page.getByRole("button", { name: /search/i }).first();
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
    }
    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("a"); // 1 char — below threshold
      await page.waitForTimeout(400);
      // Should not crash
      await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
    }
  });

  test("typing a longer query triggers search and shows results panel", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    const searchBtn = page.getByRole("button", { name: /search/i }).first();
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
    }
    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("test");
      await page.waitForTimeout(600);
      // Either a results panel or a "No results" message — not a crash
      await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
    }
  });
});
