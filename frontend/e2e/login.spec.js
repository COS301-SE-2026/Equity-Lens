import { test, expect } from '@playwright/test';

test('login e2e testing', async ({ page }) => {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 1,
        full_name: 'Test User',
        email: 'test@test.com',
      }),
    });
  });

  await page.goto('/login');

  await page.evaluate(() => {
    localStorage.setItem('equitylens_token', 'mock-token');
  });

  await page.goto('/dashboard');

  await expect(page).toHaveURL(/dashboard/i);


});