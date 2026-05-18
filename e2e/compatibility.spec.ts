import { test, expect } from "@playwright/test";

// Cross-browser / responsive layout compatibility tests.

const ROUTES = [
  { path: "/dashboard", heading: /dashboard/i },
  { path: "/contacts", heading: /contacts/i },
  { path: "/applications", heading: /applications/i },
  { path: "/insights", heading: /insights/i },
  { path: "/settings", heading: /settings|gmail/i },
];

test.describe("Page rendering across viewports", () => {
  for (const { path, heading } of ROUTES) {
    test(`${path} renders on desktop (1280×720)`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(path);
      await expect(page.locator("body")).not.toContainText("Unexpected Application Error", {
        timeout: 10000,
      });
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible({
        timeout: 10000,
      });
    });

    test(`${path} renders on tablet (768×1024)`, async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(path);
      await expect(page.locator("body")).not.toContainText("Unexpected Application Error", {
        timeout: 10000,
      });
    });

    test(`${path} renders on mobile (375×812)`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(path);
      await expect(page.locator("body")).not.toContainText("Unexpected Application Error", {
        timeout: 10000,
      });
    });
  }
});

test.describe("Keyboard accessibility", () => {
  test("Tab key cycles through focusable elements on contacts page", async ({ page }) => {
    await page.goto("/contacts");
    await page.waitForLoadState("networkidle");
    // Tab through 5 interactive elements and verify none throw
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
    }
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
  });

  test("Escape closes Add Contact dialog", async ({ page }) => {
    await page.goto("/contacts");
    await page.waitForLoadState("networkidle");
    const addBtn = page.getByRole("button", { name: /add contact/i });
    await addBtn.waitFor({ state: "visible", timeout: 10000 });
    await addBtn.click();
    // Wait for dialog name field to appear (more reliable than role=dialog)
    await expect(page.getByPlaceholder(/jane smith/i)).toBeVisible({ timeout: 8000 });
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder(/jane smith/i)).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe("Performance baselines", () => {
  test("dashboard LCP is under 5 seconds", async ({ page }) => {
    const start = Date.now();
    await page.goto("/dashboard");
    await page.getByRole("heading", { name: /dashboard/i }).waitFor({ timeout: 10000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  test("contacts page loads under 5 seconds", async ({ page }) => {
    const start = Date.now();
    await page.goto("/contacts");
    await page.getByRole("heading", { name: /contacts/i }).waitFor({ timeout: 10000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });
});
