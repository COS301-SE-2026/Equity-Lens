import { expect, test } from "@playwright/test";
import { bypassAuth } from "./helpers/auth";

test.describe("news e2e testing", () => {

  test.beforeEach(async ({ page }) => {
    await bypassAuth(page);
  });

  test("should go to the news page", async ({ page }) => {
    await page.goto("/news", { waitUntil: "domcontentloaded"});


    await expect(page).toHaveURL(/news/i);
    
    await expect(
      page.locator("body")
    ).toContainText(/Investment News/i);

        await expect(
      page.locator("body")
    ).toContainText(/Stay updated with the latest market news and insights/i);  

    
  });

});