import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// Applies the exact Content-Security-Policy from netlify.toml and checks the app still works and nothing is blocked.
const toml = readFileSync('netlify.toml', 'utf8');
const csp = /Content-Security-Policy = "([^"]+)"/.exec(toml)![1]!;

test('the app works under the production Content-Security-Policy', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (m) => /Content Security Policy|Refused to/i.test(m.text()) && violations.push(m.text()));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const res = await route.fetch();
    await route.fulfill({ response: res, headers: { ...res.headers(), 'content-security-policy': csp } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /try the demo/i }).click();
  await expect(page.locator('.queue').first()).toBeVisible();
  await page.goto('/#/money');
  await expect(page.locator('.ageing')).toBeVisible();
  expect(violations).toEqual([]);
});
