import { expect, test, type BrowserContext } from "@playwright/test";

async function signIn(context: BrowserContext, baseURL?: string) {
  if (!baseURL || !process.env.E2E_ADMIN_SESSION_TOKEN) throw new Error("Authenticated E2E fixture is not configured.");
  await context.addCookies([{ name: "authjs.session-token", value: process.env.E2E_ADMIN_SESSION_TOKEN, url: baseURL }]);
}

test("key pages do not overflow the viewport", async ({ page }) => {
  for (const route of ["/", "/fighters", "/cards", "/market"]) {
    await page.goto(route);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), { message: `${route} should not overflow horizontally` }).toBe(true);
  }
});

test("pack opening and reveal cards fit the viewport", async ({ context, page, baseURL }) => {
  await signIn(context, baseURL);
  await page.goto("/packs/cly0000000000000000000003");
  await page.getByRole("button", { name: "Purchase and open" }).click();
  await expect(page.getByRole("heading", { name: "Reveal your cards." })).toBeVisible();

  const viewport = page.viewportSize();
  if (!viewport) throw new Error("The browser project needs a viewport.");
  const cards = page.locator(".reveal-grid button");
  await expect(cards).toHaveCount(5);
  for (const box of await cards.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().toJSON()))) {
    expect(box.width).toBeLessThanOrEqual(180);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(viewport.width + 1);
  }
  await cards.first().click();
  await expect(cards.first()).toHaveClass(/is-revealed/);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
