import { expect, test } from "@playwright/test";

import { bypassAuth } from "./helpers/auth";

test.describe("news e2e testing", () => {

  test.beforeEach(async ({ page }) => {
    await bypassAuth(page);
  });

  test("should go to the news page", async ({ page }) => {
    await page.goto("/news");

    await expect(page).toHaveURL(/news/i);
    
    await expect(
      page.locator("body")
    ).toContainText(/Investment News/i);

        await expect(
      page.locator("body")
    ).toContainText(/Stay updated with the latest market news and insights/i);  

            await expect(
      page.locator("body")
    ).toContainText(/Top Gainer/i);  


      await expect(
      page.locator("body")
    ).toContainText(/Top Loser/i);  

      await expect(
      page.locator("body")
    ).toContainText(/My Watchlist/i);  

      await expect(
      page.locator("body")
    ).toContainText(/0/i);  

      await expect(
      page.locator("body")
    ).toContainText(/Stocks/i);  
    
      await expect(
      page.locator("body")
    ).toContainText(/Ticker/i); 

    
      await expect(
      page.locator("body")
    ).toContainText(/Change/i); 

    
      await expect(
      page.locator("body")
    ).toContainText(/Action/i); 

          await expect(
      page.locator("body")
    ).toContainText(/All/i); 

         await expect(
      page.locator("body")
    ).toContainText(/Top/i); 

      await expect(
      page.locator("Body")
    ).toContainText(/Business/i); 

          await expect(
      page.locator("Body")
    ).toContainText(/Business/i); 


          await expect(
      page.locator("Body")
    ).toContainText(/Technology/i); 

              await expect(
      page.locator("Body")
    ).toContainText(/Politics/i); 

              await expect(
      page.locator("Body")
    ).toContainText(/Crime/i); 

  });

});