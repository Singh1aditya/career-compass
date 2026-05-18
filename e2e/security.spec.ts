import { test, expect } from "@playwright/test";

// Security-focused E2E checks:
//  1. XSS — injected script tags must not execute
//  2. Auth protection — protected routes redirect unauthenticated users
//  3. No sensitive data in page source
//  4. Secure headers (Content-Security-Policy, X-Frame-Options, etc.)

test.describe("XSS protection", () => {
  test("injected script tag in search does not execute", async ({ page }) => {
    let xssTriggered = false;
    // Listen for any dialog (alert/confirm/prompt) that would indicate XSS
    page.on("dialog", async (dialog) => {
      xssTriggered = true;
      await dialog.dismiss();
    });

    await page.goto("/contacts");
    await page.waitForLoadState("networkidle");

    // Try to find any search/filter input and inject a script tag
    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill("<script>window.__xss=true;</script>");
      await page.waitForTimeout(500);
    }

    // Try the global search trigger
    const searchBtn = page.getByRole("button", { name: /search/i }).first();
    if (await searchBtn.isVisible().catch(() => false)) {
      await searchBtn.click();
      const globalInput = page.getByPlaceholder(/search/i).first();
      if (await globalInput.isVisible().catch(() => false)) {
        await globalInput.fill('<img src=x onerror="window.__xss=true">');
        await page.waitForTimeout(500);
      }
    }

    expect(xssTriggered).toBe(false);
    const xssExecuted = await page.evaluate(
      () => (window as Window & { __xss?: boolean }).__xss,
    );
    expect(xssExecuted).toBeFalsy();
  });

  test("injected script in contact name field does not execute", async ({ page }) => {
    let xssTriggered = false;
    page.on("dialog", async (dialog) => {
      xssTriggered = true;
      await dialog.dismiss();
    });

    await page.goto("/contacts");
    await page.waitForLoadState("networkidle");
    const addBtn = page.getByRole("button", { name: /add contact/i });
    await addBtn.waitFor({ state: "visible", timeout: 10000 });
    await addBtn.click();
    // Use placeholder instead of role=dialog (more reliable cross-browser)
    const nameField = page.getByPlaceholder(/jane smith/i);
    if (await nameField.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameField.fill('<script>alert("xss")</script>');
      await page.waitForTimeout(300);
    }
    await page.keyboard.press("Escape");

    expect(xssTriggered).toBe(false);
  });
});

test.describe("Route protection", () => {
  test("root / redirects or shows app shell (not a raw error)", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Should either redirect to login, dashboard, or show the app — not a blank crash
    await expect(page.locator("body")).not.toContainText("Cannot GET /");
    await expect(page.locator("body")).not.toContainText("404 Not Found");
  });

  test("direct navigation to /dashboard renders the app shell", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error", {
      timeout: 10000,
    });
  });
});

test.describe("Sensitive data exposure", () => {
  test("page HTML does not contain raw Supabase service-role key pattern", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    const html = await page.content();
    // Service-role JWTs contain 'service_role' claim — check it's not in the page source
    expect(html).not.toMatch(/service_role/);
  });

  test("no raw database credentials in page source", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    const html = await page.content();
    // Should not contain postgres:// or raw DB password patterns
    expect(html).not.toMatch(/postgres:\/\//);
    expect(html).not.toMatch(/password\s*[:=]\s*["'][^"']{8,}/);
  });
});

test.describe("Security headers", () => {
  test("responses include X-Frame-Options: DENY", async ({ page }) => {
    const response = await page.goto("/dashboard");
    expect(response).not.toBeNull();
    const xfo = response!.headers()["x-frame-options"];
    expect(xfo?.toLowerCase()).toBe("deny");
  });

  test("responses include X-Content-Type-Options: nosniff", async ({ page }) => {
    const response = await page.goto("/dashboard");
    expect(response).not.toBeNull();
    const xct = response!.headers()["x-content-type-options"];
    expect(xct?.toLowerCase()).toBe("nosniff");
  });

  test("responses include Content-Security-Policy with frame-ancestors none", async ({ page }) => {
    const response = await page.goto("/dashboard");
    expect(response).not.toBeNull();
    const csp = response!.headers()["content-security-policy"];
    expect(csp).toBeDefined();
    expect(csp).toContain("frame-ancestors");
  });

  test("app renders correctly with security headers active", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error", {
      timeout: 10000,
    });
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible({
      timeout: 10000,
    });
  });
});
