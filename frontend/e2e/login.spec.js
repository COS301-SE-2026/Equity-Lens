import { test, expect } from '@playwright/test';
import { bypassAuth } from './helpers/auth';

test('login e2e testing', async ({ page }) => {
  await bypassAuth(page);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded"});

  await expect(page).toHaveURL(/dashboard/i);

});

