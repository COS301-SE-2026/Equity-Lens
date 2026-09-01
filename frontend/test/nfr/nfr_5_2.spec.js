import { test, expect } from "@playwright/test";

test("testing NFR 5.3", async ({page}) => {
    await page.goto("https://ww.equitylens.co.za");

    await page.goto("https://ww.equitylens.co.za/dashboard");

    const explanations = page.locator('[data-testid="indicator-explanation"]');

    const count = await explanations.count();

    expect(count).toBeGreaterThan(0);

    

})
