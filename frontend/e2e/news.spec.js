import { expect, test } from "@playwright/test";

test.describe("news e2e testing", () => {

  test.beforeEach(async ({ page }) => {
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          full_name: "Test User",
          email: "test@test.com",
        }),
      });
    });

    await page.goto("/login");

    await page.evaluate(() => {
      localStorage.setItem("equitylens_token", "justmock");
    });
  });

  test("should go to the news page", async ({ page }) => {
    await page.goto("/news");

    await expect(page).toHaveURL(/news/i);

    await expect(
      page.locator("body")
    ).toContainText(/Investment News/i);

    await expect(
      page.locator("body")
    ).toContainText(
      /Here's what Wall Street doesn't get about young investors/i
    );

    await expect(
      page.locator("body")
    ).toContainText(
      /Eve Halimi and Anam Lakhani created Alinea/i
    );


  });

});