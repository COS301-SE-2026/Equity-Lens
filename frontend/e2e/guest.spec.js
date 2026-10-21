import { expect, test } from '@playwright/test';
import * as XLSX from 'xlsx';

const GUEST_TOKEN = 'e2e-guest-token';
const HOLDINGS = [
  { 'Instrument Name': 'Naspers Limited', Quantity: 10, 'Total Cost': 30000 },
  { 'Instrument Name': 'Mr Price Group', Quantity: 50, 'Total Cost': 10000 },
];

// the same sheets and headers as the Excel template the Portfolio page reads
const statement = () => {
  const book = XLSX.utils.book_new();
  const sheet = (rows, headers) =>
    rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([headers]);
  XLSX.utils.book_append_sheet(
    book,
    sheet([{ 'Account Number': 'EE-1', 'Portfolio Name': 'My shares', 'Statement Date': '2026-09-30' }]),
    'Portfolio',
  );
  XLSX.utils.book_append_sheet(book, sheet(HOLDINGS), 'Holdings');
  XLSX.utils.book_append_sheet(
    book,
    sheet([], ['Transaction Date', 'Transaction Type', 'Instrument Name', 'Price', 'Quantity']),
    'Purchase and Sales',
  );
  XLSX.utils.book_append_sheet(
    book,
    sheet([], ['Transaction Date', 'Settlement Date', 'Transaction Type', 'Value']),
    'Contributions and Withdrawals',
  );
  XLSX.utils.book_append_sheet(
    book,
    sheet([], ['Transaction Date', 'Instrument Name', 'Gross Dividend', 'Tax Rate(%)']),
    'Dividends and Withholding Tax',
  );
  XLSX.utils.book_append_sheet(
    book,
    sheet([], ['Transaction Date', 'Settlement Date', 'Narrative', 'Value']),
    'Expenses',
  );
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
};

/** @param {import('@playwright/test').Page} page */
async function mockApi(page) {
  const seen = { authorizations: [], holdings: [] };

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const method = request.method();
    const authorization = request.headers().authorization;
    if (authorization) seen.authorizations.push(authorization);

    if (pathname.endsWith('/auth/guest')) {
      if (method === 'GET') return route.fulfill({ json: { enabled: true } });
      if (method === 'DELETE') return route.fulfill({ json: { status: 'ended' } });
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

    if (method === 'POST' && /\/import_pdf\/?$/.test(pathname)) {
      return route.fulfill({ json: { Success: true, Message: 'saved', document_id: 'doc-1' } });
    }
    if (pathname.includes('/import_pdf/save_portfolios')) {
      return route.fulfill({ json: { Success: true, Message: 'saved', portfolio_id: 'p-1' } });
    }
    if (pathname.includes('/import_pdf/save_holdings')) {
      seen.holdings.push(request.postDataJSON().instrument_name);
      return route.fulfill({ json: { Success: true, Message: 'saved' } });
    }
    if (pathname.includes('/import_pdf/save_')) {
      return route.fulfill({ json: { Success: true, Message: 'saved' } });
    }

    if (method === 'GET' && /\/api\/portfolio\/?$/.test(pathname)) {
      const holdings = seen.holdings.map((name, i) => ({
        ticker: ['NPN.JO', 'MRP.JO'][i],
        name,
        value: 1000,
        quantity: 1,
        sector: 'Retail',
      }));
      return route.fulfill({ json: { holdings, summary: { num_holdings: holdings.length } } });
    }
    if (pathname.endsWith('/portfolio/current')) {
      const mine = seen.holdings.length
        ? [{ id: 'p-1', portfolio_name: 'My shares', account_number: 'EE-1', account_type: 'zar' }]
        : [];
      return route.fulfill({ json: mine });
    }
    return route.fulfill({ json: {} });
  });

  return seen;
}

test.describe('guest session', () => {
  test('a guest starts empty, imports their own statement and ends the session', async ({ page }) => {
    const seen = await mockApi(page);

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Continue as guest' }).click();

    await expect(page).toHaveURL(/dashboard/i);
    await expect(page.getByText(/Guest session - your data is deleted when you end the session/i)).toBeVisible();
    await expect(page.getByText('Upload holdings to see them here.')).toBeVisible();
    await expect.poll(() => seen.authorizations).toContain(`Bearer ${GUEST_TOKEN}`);

    await page.goto('/portfolio', { waitUntil: 'domcontentloaded' });
    await page.selectOption('#account-type-select', 'zar');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'statement.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: statement(),
    });
    await expect.poll(() => seen.holdings).toEqual(['Naspers Limited', 'Mr Price Group']);

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Mr Price Group').first()).toBeVisible();
    await expect(page.getByText('Naspers Limited').first()).toBeVisible();

    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Guest sessions are deleted automatically when they end.')).toBeVisible();
    await expect(page.getByRole('button', { name: /delete account/i })).toHaveCount(0);

    await page.getByRole('button', { name: 'End session' }).first().click();

    await expect(page).toHaveURL(/login/i);
    const stored = await page.evaluate(() => sessionStorage.getItem('equitylens.guest'));
    expect(stored).toBeNull();
  });
});
