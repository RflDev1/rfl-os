import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context, baseURL }) => {
  if (!baseURL || !process.env.E2E_ADMIN_SESSION_TOKEN) throw new Error("Authenticated E2E fixture is not configured.");
  await context.addCookies([{ name: "authjs.session-token", value: process.env.E2E_ADMIN_SESSION_TOKEN, url: baseURL }]);
});

test("admin can open the control panel and fight-building form", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await page.goto("/admin/home");
  await expect(page.getByRole("heading", { name: "Add a fighter" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Schedule an event" })).toBeVisible();
  await expect(page.getByLabel("Event date and time")).toHaveAttribute("type", "datetime-local");
  await expect(page.getByRole("heading", { name: "Add a fight", exact: true })).toBeVisible();
});

test("profile picture destination exposes the admin-only Control Panel button", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "RFL Admin" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Control Panel" })).toHaveAttribute("href", "/admin");
  await expect(page.locator('img[src*="rfl-logo.png"]').first()).toBeVisible();
});
