import { expect, test } from "@playwright/test";
import { bypassAuth } from "./helpers/auth";

test.describe("portfolio e2e testing", () => {

  test.beforeEach(async ({ page }) => {
    await bypassAuth(page);
  });

  test("should go to portfolio page and show upload UI", async ({ page }) => {
    await page.goto("/portfolio");

    await expect(page).toHaveURL(/portfolio/i);

    await expect(
      page.locator("body")
    ).toContainText(/Upload Portfolio/i);
  });

});
