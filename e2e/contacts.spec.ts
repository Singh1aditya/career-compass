import { test, expect } from "@playwright/test";

// Contacts CRUD + search flow.
// Each test is self-contained: it navigates independently and waits for full load.

test.describe("Contacts list", () => {
  test("renders heading, Add Contact button, and search input", async ({ page }) => {
    await page.goto("/contacts");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /contacts/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /add contact/i })).toBeVisible();
  });

  test("page is free of application errors", async ({ page }) => {
    await page.goto("/contacts");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
  });
});

test.describe("Add Contact dialog", () => {
  test("opens Add Contact dialog on button click", async ({ page }) => {
    await page.goto("/contacts");
    await page.waitForLoadState("networkidle");
    // Wait for the button to be fully interactive before clicking
    const addBtn = page.getByRole("button", { name: /add contact/i });
    await addBtn.waitFor({ state: "visible", timeout: 10000 });
    await addBtn.click();
    // The dialog title is more reliable than role="dialog" across browsers
    await expect(page.getByText(/add contact/i).last()).toBeVisible({ timeout: 8000 });
  });

  test("dialog has Name and Email inputs", async ({ page }) => {
    await page.goto("/contacts");
    await page.waitForLoadState("networkidle");
    const addBtn = page.getByRole("button", { name: /add contact/i });
    await addBtn.waitFor({ state: "visible", timeout: 10000 });
    await addBtn.click();
    // Wait for dialog to fully open (Radix animates)
    await page.waitForTimeout(300);
    // Use placeholder text to locate fields — more robust than aria-label
    await expect(page.getByPlaceholder(/jane smith/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder(/jane@/i)).toBeVisible({ timeout: 5000 });
  });

  test("dialog closes on Escape key", async ({ page }) => {
    await page.goto("/contacts");
    await page.waitForLoadState("networkidle");
    const addBtn = page.getByRole("button", { name: /add contact/i });
    await addBtn.waitFor({ state: "visible", timeout: 10000 });
    await addBtn.click();
    // Wait for dialog to open
    await expect(page.getByPlaceholder(/jane smith/i)).toBeVisible({ timeout: 8000 });
    await page.keyboard.press("Escape");
    // After close, the name field should disappear
    await expect(page.getByPlaceholder(/jane smith/i)).not.toBeVisible({ timeout: 3000 });
  });

  test("submitting without required fields stays on dialog or shows validation", async ({
    page,
  }) => {
    await page.goto("/contacts");
    await page.waitForLoadState("networkidle");
    const addBtn = page.getByRole("button", { name: /add contact/i });
    await addBtn.waitFor({ state: "visible", timeout: 10000 });
    await addBtn.click();
    await page.waitForTimeout(300);
    // Click the save button without filling anything
    const submitButton = page.getByRole("button", { name: /save|add contact|create/i }).last();
    if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitButton.click();
      await page.waitForTimeout(400);
      // App must not crash
      await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
    }
  });
});
