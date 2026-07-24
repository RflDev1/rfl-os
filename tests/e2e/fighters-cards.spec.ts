import { expect, test } from "@playwright/test";

test("public Fighters directory opens an individual status-aware profile", async ({ page }) => {
  await page.goto("/fighters");
  await expect(page.getByRole("heading", { name: "Meet the fighters." })).toBeVisible();
  await page.getByRole("link", { name: /Test Champion/ }).click();
  await expect(page.getByRole("heading", { name: "Test Champion" })).toBeVisible();
  await expect(page.getByText("ACTIVE", { exact: true })).toBeVisible();
  await expect(page.locator(".record-block span").filter({ hasText: "Wins" }).getByText("8", { exact: true })).toBeVisible();
  await expect(page.locator(".record-block span").filter({ hasText: "Losses" }).getByText("2", { exact: true })).toBeVisible();
});

test("admin card creator accepts artwork and creates an image-backed card", async ({ context, page, baseURL }, testInfo) => {
  if (!baseURL || !process.env.E2E_ADMIN_SESSION_TOKEN) throw new Error("Authenticated E2E fixture is not configured.");
  await context.addCookies([{ name: "authjs.session-token", value: process.env.E2E_ADMIN_SESSION_TOKEN, url: baseURL }]);
  await page.goto("/admin/cards");
  const cardForm = page.locator("section.admin-panel").filter({ has: page.getByRole("heading", { name: "Add card" }) }).locator("form");
  await expect(cardForm.getByLabel("Card artwork")).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
  await cardForm.getByLabel("Card set", { exact: true }).selectOption("cly0000000000000000000001");
  await cardForm.getByLabel("Linked fighter (optional)", { exact: true }).selectOption("cly0000000000000000000000");
  await cardForm.getByLabel("Name").fill(`Champion ${testInfo.project.name}`);
  await cardForm.getByLabel("Subtitle").fill("Founding Champion");
  await cardForm.getByLabel("Or existing HTTPS image URL").fill("https://assets.nyc3.digitaloceanspaces.com/cards/champion-one.webp");
  await cardForm.getByLabel("Rarity").selectOption("LEGENDARY");
  const cardNumber = { desktop: "1", tablet: "2", mobile: "3" }[testInfo.project.name] ?? "4";
  await cardForm.getByLabel("Card number").fill(cardNumber);
  await cardForm.getByRole("button", { name: "Add card" }).click();
  await expect(page.getByText("Card definition created.")).toBeVisible();
});
