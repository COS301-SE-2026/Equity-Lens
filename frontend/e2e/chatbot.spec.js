import { expect, test } from "@playwright/test";
import { bypassAuth } from "./helpers/auth";

test.describe("AI Assistant e2e testing", () => {

  test.beforeEach(async ({ page }) => {
    await bypassAuth(page);
  });

  test("should render the AI Assistant page", async ({ page }) => {
    await page.goto("/ai", { waitUntil: "domcontentloaded"});

      await expect(
      page.getByText("AI Assistant", {exact: true}
      ))

       await expect(
      page.getByText("Hello Test", {exact: true}
      ))

       await expect(
      page.getByText("Type below to get started", {exact: true}
      ))

       await expect(
      page.getByText("New Chat", {exact: true}
      ))

       await expect(
      page.getByText("Hello Testd", {exact: true}
      ))

       await expect(
      page.getByText("How is my portfolio", {exact: true}
      ))

       await expect(
      page.getByText("performing compared to the JSE Benchmark ?", {exact: true}
      ))

  });


});