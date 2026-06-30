import { expect, test } from "@playwright/test";
import { bypassAuth } from "./helpers/auth";

test.describe("AI Assistant e2e testing", () => {

  test.beforeEach(async ({ page }) => {
    await bypassAuth(page);
  });

  test("should render the AI Assistant page", async ({ page }) => {
    await page.goto("/ai");

    await expect(page.locator("body")).toContainText(/AI Assistant/i);
    await expect(page.locator("body")).toContainText(/Hello Test/i);
    await expect(page.locator("body")).toContainText(/Type below to get started/i);
    await expect(page.getByRole("button", { name: /Send/i })).toBeVisible();

  });

  test("should send a message in the ai chatbot", async ({ page }) => {
    await page.goto("/ai");

    const input = page.locator('input[type="text"]').first();

    await input.fill("How is Apple doing?");
    await page.getByRole("button", { name: /Send/i }).click();
    
    await expect(page.locator("body")).toContainText(/How is Apple doing/i);
    
  });


});