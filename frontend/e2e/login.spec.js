import { test, expect } from '@playwright/test';
import { bypassAuth } from './helpers/auth';

test('login e2e testing', async ({ page }) => {
  await bypassAuth(page);
  await page.goto('/dashboard');

  await expect(page).toHaveURL(/dashboard/i);

  await expect(page.getByText(/portfolio performance/i)).toBeVisible();
  await expect(page.getByText(/dividend income/i)).toBeVisible();
  await expect(page.getByText(/watchlist/i)).toBeVisible();
  await expect(page.getByText(/holdings/i)).toBeVisible();

  await page.goto('/analytics');

  await expect(page).toHaveURL(/analytics/i);


  await expect(page.getByText(/financial indicators/i)).toBeVisible();


});