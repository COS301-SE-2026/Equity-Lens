import { expect, test } from "@playwright/test";

test.describe("Register page e2e testing", () => {

  test("to show the register page", async ({ page }) => {
    await page.goto("/register");

    await expect(
      page.getByRole("heading", { name: /Create your account/i })
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: /Create Account/i })
    ).toBeVisible();
  });

  test("in here to fill in th form on registration", async ({ page }) => {
   await page.goto("/register");

  const enternsname = page.getByPlaceholder(/Your Name Here/i);
  const entersemail = page.getByPlaceholder(/your@email.com/i);
  const enterpassword = page.getByPlaceholder(/Min 8 characters/i);
  const enterconfirmpassword = page.getByPlaceholder(/Repeat your password/i);

  await enternsname.fill("Steven");
  await entersemail.fill("test@gmail.com");
  await enterpassword.fill("Test16767@#%");
  await enterconfirmpassword.fill("Test16767@#%");

  await expect(enternsname).toHaveValue("Steven");
  await expect(entersemail).toHaveValue("test@gmail.com");
  await expect(enterpassword).toHaveValue("Test16767@#%");
  await expect(enterconfirmpassword).toHaveValue("Test16767@#%");

  });

});