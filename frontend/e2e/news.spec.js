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

    // await expect(
    //   page.locator("body")
    // ).toContainText(
    //   /Here's what Wall Street doesn't get about young investors/i
    // );

    // await expect(
    //   page.locator("body")
    // ).toContainText(
    //   /Eve Halimi and Anam Lakhani created Alinea/i
    // );


  });

});