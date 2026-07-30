import { expect, test } from "@playwright/test";
import { bypassAuth } from "./helpers/auth";

test.describe("Help e2e testing", () => {

  test.beforeEach(async ({ page }) => {
    await bypassAuth(page);
  });

  test("should go to the Help page", async ({ page }) => {
    await page.goto("/help");

    await expect(page).toHaveURL(/help/i);
    
    await expect(
      page.locator("body")
    ).toContainText(/Check on dashboard/i);

        await expect(
      page.locator("body")
    ).toContainText(/Take a look at your dashboard/i);

        await expect(
      page.locator("body")
    ).toContainText(/Go to dashboard/i);

        await expect(
      page.locator("body")
    ).toContainText(/Look at the analytics/i);

        await expect(
      page.locator("body")
    ).toContainText(/Explained formulas/i);

    await expect(
      page.locator("body")
    ).toContainText(/Go to analytics page/i);

    await expect(
      page.locator("body")
    ).toContainText(/Ask AI Assistant questions/i);

    await expect(
      page.locator("body")
    ).toContainText(/Ask questions in plain english/i);

    await expect(
      page.locator("body")
    ).toContainText(/Go to AI Assistant/i);

    await expect(
      page.locator("body")
    ).toContainText(/Import your portfolio/i);

    await expect(
      page.locator("body")
    ).toContainText(/Upload a PDF or Excel file/i);

    await expect(
      page.locator("body")
    ).toContainText(/Go to portfolio/i);

    await expect(
      page.locator("body")
    ).toContainText(/Check on news about your stocks/i);

    await expect(
      page.locator("body")
    ).toContainText(/Keep up to date with market news./i);

     await expect(
      page.locator("body")
    ).toContainText(/Go to news page/i);

         await expect(
      page.locator("body")
    ).toContainText(/FAQs/i);

         await expect(
      page.locator("body")
    ).toContainText(/Resources \(Click box to get output\)/i);


  });

});