export const FAKE_USER = {
  sub: 'e2e-user-sub',
  email: 'test@test.com',
  full_name: 'Test User',
};

export async function bypassAuth(page) {
  await page.addInitScript((user) => {
    window.__E2E_AUTH_BYPASS__ = user;
  }, FAKE_USER);
}