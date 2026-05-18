import { test, expect } from "@playwright/test";

test.describe("Applications page", () => {
  test("loads without error", async ({ page }) => {
    await page.goto("/applications");
    await expect(page.getByRole("heading", { name: /applications/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
  });

  test("has List/Kanban view toggle", async ({ page }) => {
    await page.goto("/applications");
    await page.waitForLoadState("networkidle");
    // Look for view-toggle controls (could be buttons or tabs)
    const kanbanBtn = page
      .getByRole("button", { name: /kanban/i })
      .or(page.getByRole("tab", { name: /kanban/i }));
    const listBtn = page
      .getByRole("button", { name: /list/i })
      .or(page.getByRole("tab", { name: /list/i }));
    // At least one toggle should exist
    const kanbanVisible = await kanbanBtn.isVisible().catch(() => false);
    const listVisible = await listBtn.isVisible().catch(() => false);
    expect(kanbanVisible || listVisible).toBe(true);
  });

  test("Kanban view renders status columns", async ({ page }) => {
    await page.goto("/applications");
    await page.waitForLoadState("networkidle");
    const kanbanBtn = page.getByRole("button", { name: /kanban/i }).first();
    if (await kanbanBtn.isVisible().catch(() => false)) {
      await kanbanBtn.click();
    }
    // Status column names (subset of APPLICATION_STATUSES)
    const statuses = ["Wishlist", "Applied", "Screening", "Interviewing", "Offer"];
    let found = 0;
    for (const status of statuses) {
      if (
        await page
          .getByText(status)
          .isVisible()
          .catch(() => false)
      ) {
        found++;
      }
    }
    expect(found).toBeGreaterThanOrEqual(2); // at least 2 columns visible
  });

  test("Add Application button is visible", async ({ page }) => {
    await page.goto("/applications");
    const addBtn = page.getByRole("button", { name: /add application/i });
    await expect(addBtn).toBeVisible({ timeout: 8000 });
  });

  test("Add Application dialog opens and has role field", async ({ page }) => {
    await page.goto("/applications");
    await page.waitForLoadState("networkidle");
    const addBtn = page.getByRole("button", { name: /add application/i });
    await addBtn.waitFor({ state: "visible", timeout: 10000 });
    await addBtn.click();
    // Wait for dialog to animate open (Radix UI)
    await page.waitForTimeout(300);
    // Look for the role/title placeholder from ApplicationsPage
    await expect(page.getByPlaceholder(/senior engineer/i)).toBeVisible({ timeout: 8000 });
    // Close it
    await page.keyboard.press("Escape");
  });
});
