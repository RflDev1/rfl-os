import { expect, test } from "@playwright/test";

test("a visitor can understand the entry point", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /enter the realm/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /join with discord/i })).toBeVisible();
  await expect(page.getByText(/crowns never cost real money/i)).toBeVisible();
});

test("public discovery routes render useful empty states", async ({ page }) => {
  await page.goto("/live");
  await expect(page.getByRole("heading", { name: /no event is scheduled/i })).toBeVisible();
  await page.goto("/cards");
  await expect(page.getByRole("heading", { name: /start your collection/i })).toBeVisible();
  await page.goto("/market");
  await expect(page.getByRole("heading", { name: /realm market/i })).toBeVisible();
  await expect(page.getByText(/no cards match these filters/i)).toBeVisible();
});

test("production security headers are present", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});

test("mobile visitors receive primary bottom navigation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("link")).toHaveCount(6);
});
