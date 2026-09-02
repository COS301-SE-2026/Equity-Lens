import { expect, test } from "@playwright/test";
import { bypassAuth } from "./helpers/auth";

test.describe("Help e2e testing", () => {

  test.beforeEach(async ({ page }) => {
    await bypassAuth(page);
  });

  test("should go to the Help page", async ({ page }) => {
      await page.goto("/help", { waitUntil: "domcontentloaded"});

    
    await expect(
      page.locator("body")
    ).toContainText(/Getting Started/i);

        await expect(
      page.locator("body")
    ).toContainText(/Import data/i);

    await expect(
      page.getByText("News & market", {exact: true}
      ))

  await expect(
      page.getByText("Getting Started", {exact: true}
      ))

      await expect(
      page.getByText("Import data", {exact: true}
      ))

      await expect(
      page.getByText("Understand your portfolio", {exact: true}
      ))

      await expect(
      page.getByText("AI Assistant", {exact: true}
      ))

      await expect(
      page.getByText("Learn the basics of EquityLens and where to find everything.", {exact: true}
      ))


      await expect(
      page.getByText("Upload your portfolio as a PDF statement or the Excel template.", {exact: true}
      ))

      await expect(
      page.getByText("View your holdings, allocation and portfolio analytics.", {exact: true}
      ))

      await expect(
      page.getByText("Stay updated with news about your investments.", {exact: true}
      ))


       await expect(
      page.getByText("Which file formats can I upload?", {exact: true}
      ))



       await expect(
      page.getByText("Can the AI Assistant see my portfolio?", {exact: true}
      ))


       await expect(
      page.getByText("Is this financial advice?", {exact: true}
      ))


  });

});