import { test, expect } from "@playwright/test";

test.describe("Basic Smoke Test", () => {
  test("should load the home page and show the hero section", async ({ page }) => {
    // Navigate to local dev server (port 3000 as configured in playwright.config.ts)
    await page.goto("/");

    // Check document title
    await expect(page).toHaveTitle(/AA Jersey/i);

    // Verify main hero heading is visible
    const heroHeading = page.locator("h1");
    await expect(heroHeading).toContainText("Jersey Original");

    // Verify key action button exists
    const shopButton = page.locator("text=Belanja Sekarang").first();
    await expect(shopButton).toBeVisible();
  });

  test("should render the navbar with correct navigation links", async ({ page }) => {
    await page.goto("/");

    // Verify that brand name or main nav logo is present
    const brand = page.locator("text=AA Jersey").first();
    await expect(brand).toBeVisible();

    // Verify shop link exists
    const shopLink = page.locator('a[href="/shop"]').first();
    await expect(shopLink).toBeVisible();
  });
});
