import { expect, test } from '@playwright/test';

const GUEST_TOKEN = 'e2e-guest-token';

/**
 * @param {import('@playwright/test').Page} page
 * @param {boolean} guestOn
 */
async function mockApi(page, guestOn) {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());

    if (pathname.endsWith('/auth/guest')) {
      if (request.method() === 'GET') return route.fulfill({ json: { enabled: guestOn } });
      return route.fulfill({
        status: 201,
        json: {
          access_token: GUEST_TOKEN,
          token_type: 'bearer',
          expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          user: { id: 'e2e-guest', full_name: 'Guest', is_guest: true },
        },
      });
    }
    return route.fulfill({ json: {} });
  });
}

test.describe('landing page', () => {
  test('shows the hero and its illustrative chart first', async ({ page }) => {
    await mockApi(page, false);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Illustrative example')).toBeVisible();
    await expect(
      page.getByText('Acacia Holdings lowers its full-year guidance', { exact: true }),
    ).toBeVisible();
  });

  test('Get started goes to register', async ({ page }) => {
    await mockApi(page, false);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.getByRole('main').getByRole('link', { name: 'Get started' }).first().click();

    await expect(page).toHaveURL(/register/);
  });

  test('Try it now starts a guest session on the dashboard', async ({ page }) => {
    await mockApi(page, true);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: 'Try it now, no sign-up' }).first().click();

    await expect(page).toHaveURL(/dashboard/i);
    await expect(
      page.getByText(/Guest session - your data is deleted when you end the session/i),
    ).toBeVisible();
  });

  test('a chip brings its card into view and the dialog walks through the pages', async ({
    page,
  }) => {
    await mockApi(page, false);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page
      .getByText('Inside', { exact: true })
      .locator('..')
      .getByRole('button', { name: 'Analytics' })
      .click();
    const card = page.locator('#page-analytics');
    await expect(card).toBeFocused();
    await expect(card).toBeInViewport();

    await card.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Analytics' })).toBeVisible();
    const shot = dialog.getByRole('img');
    await expect(shot).toBeVisible();
    await expect.poll(() => shot.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);

    await page.keyboard.press('ArrowRight');
    await expect(dialog.getByRole('heading', { name: 'News' })).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(dialog.getByRole('heading', { name: 'Analytics' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(card).toBeFocused();
  });
});