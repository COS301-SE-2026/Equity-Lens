import { expect, test } from "@playwright/test";
import { bypassAuth } from "./helpers/auth";

test.describe("news e2e testing", () => {

  test.beforeEach(async ({ page }) => {
    await bypassAuth(page);
  });

  test("should go to the Analytics page", async ({ page }) => {
    await page.goto("/analytics");

    await expect(page).toHaveURL(/analytics/i);
    
    await expect(
      page.locator("body")
    ).toContainText(/Analytics/i);

        await expect(
      page.locator("body")
    ).toContainText(/How your holdings are doing - hover a label for a quick explanation, click a value to learn more/i);  


  });

});