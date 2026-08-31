import { test, expect } from "@playwright/test";

const sizes = [
    { width: 375, height: 667 },
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
]

const pages = [
    "/",
    "/login",
    "/register",
    "/dashboard",
    "/portfolio",
    "/analytics",
    "/news",
    "/help",

]



for (const size of sizes) {
    for (const routes of pages) {
        test(`test-5.4 ${routes} ${size.width}`, async ({ page }) => {

            await page.setViewportSize(size);

            await page.goto(`https://www.equitylens.co.za${routes}`);

            const horizontalScroll = await page.evaluate((() => {
                return document.documentElement.scrollWidth > document.documentElement.clientWidth;
            }))

            expect(horizontalScroll).toBe(false);
        })
    }


}

