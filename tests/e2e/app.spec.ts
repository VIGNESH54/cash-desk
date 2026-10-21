import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Fonts come from Google; they are blocked in some environments and are not an app error.
const IGNORED = /fonts\.g|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_CONNECTION|Failed to load resource/;

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !IGNORED.test(m.text()) && errors.push(m.text()));
  (page as Page & { errors: string[] }).errors = errors;
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.route('https://wa.me/**', (r) => r.fulfill({ body: 'ok' }));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.getByRole('button', { name: /try the demo/i }).click();
  await expect(page.locator('.queue').first()).toBeVisible();
});

test.afterEach(async ({ page }) => {
  expect((page as Page & { errors: string[] }).errors).toEqual([]);
});

const card = (page: Page, name: string) => page.locator('.queue', { hasText: name });
const nav = (page: Page, hash: string) => page.goto(`/#/${hash}`);

test('today shows the demo queue, most urgent first', async ({ page }) => {
  await expect(page.locator('.queue')).toHaveCount(5);
  await expect(page.locator('.queue').first()).toContainText('Patel Engineering');
  await expect(page.getByText('Needs a person')).toBeVisible();
});

test('sending a message removes it and records history', async ({ page }) => {
  const c = card(page, 'Gupta');
  await c.getByRole('link', { name: 'Open WhatsApp' }).click();
  await c.getByRole('button', { name: 'I sent it' }).click();
  await expect(page.locator('.queue')).toHaveCount(4);
  await page.reload();
  await expect(page.locator('.queue')).toHaveCount(4);
  await page
    .getByRole('link', { name: /customers/i })
    .last()
    .click();
  await page.getByRole('link', { name: /Gupta/ }).click();
  await expect(page.locator('.timeline')).toContainText('Weekly follow-up sent by whatsapp');
});

test('skipping does not surface another message the same day', async ({ page }) => {
  await card(page, 'Kumar').getByRole('button', { name: 'Skip today' }).click();
  await expect(page.locator('.queue')).toHaveCount(4);
  await page.waitForTimeout(300);
  await expect(page.locator('.queue')).toHaveCount(4);
});

test('a customer without a phone can be fixed from the queue', async ({ page }) => {
  const c = card(page, 'Singh');
  await expect(c.getByText('No valid phone')).toBeVisible();
  await c.getByRole('button', { name: 'Add number' }).click();
  await page.getByLabel('WhatsApp number').fill('12345');
  await page.getByRole('button', { name: 'Save number' }).click();
  await expect(c.getByText('No valid phone')).toBeVisible(); // invalid number is not accepted as valid
  await c.getByRole('button', { name: 'Add number' }).click();
  await page.getByLabel('WhatsApp number').fill('9876543210');
  await page.getByRole('button', { name: 'Save number' }).click();
  await expect(c.getByRole('link', { name: 'Open WhatsApp' })).toBeVisible();
});

test('payments: overpayment is blocked, full payment clears the invoice', async ({ page }) => {
  await nav(page, 'customers');
  await page.getByRole('link', { name: /Kumar/ }).click();
  await page.getByRole('button', { name: 'Record payment' }).click();
  await page.getByLabel('Amount received').fill('99999999');
  await expect(page.getByRole('button', { name: 'Save payment' })).toBeDisabled();
  await page.getByLabel('Amount received').fill('32000');
  await page.getByRole('button', { name: 'Save payment' }).click();
  await expect(page.getByText('Paid', { exact: true }).first()).toBeVisible();
  await nav(page, 'today');
  await expect(card(page, 'Kumar')).toHaveCount(0);
});

test('a promised date pauses reminders', async ({ page }) => {
  await nav(page, 'customers');
  await page.getByRole('link', { name: /Gupta/ }).click();
  await page.getByRole('button', { name: /promised a date/i }).click();
  await page.getByRole('button', { name: 'Save promise' }).click();
  await nav(page, 'today');
  // promise set for today: a check-in is expected instead of the weekly nag
  await expect(card(page, 'Gupta')).toContainText(/promise|today/i);
});

test('import: preview, import, and duplicates are not added twice', async ({ page }) => {
  const csv =
    'Customer,Invoice No,Date,Amount,Pending,Phone\nNew Buyer Co,NB-1,2026-09-01,50000,50000,9811122233\nNew Buyer Co,NB-2,2026-09-10,20000,20000,9811122233\n';
  for (const round of [1, 2]) {
    await nav(page, 'import');
    await page.getByLabel(/paste rows/i).fill(csv);
    if (round === 1) {
      await expect(page.getByText('Invoices to add').locator('..')).toContainText('2');
      await page.getByRole('button', { name: /Import 2 invoices/ }).click();
      await expect(page.getByText(/Imported 2 invoices and 1 new customers/)).toBeVisible();
    } else {
      await expect(page.getByText('Invoices to add').locator('..')).toContainText('0');
      await expect(page.getByRole('button', { name: /Import 0 invoices/ })).toBeDisabled();
    }
  }
});

test('settings validate the bank rate and persist changes', async ({ page }) => {
  await nav(page, 'settings');
  const rate = page.getByLabel(/RBI bank rate/);
  await rate.fill('-3');
  await expect(page.getByRole('button', { name: 'Save settings' })).toBeDisabled();
  await rate.fill('5.5');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await page.reload();
  await expect(page.getByLabel(/RBI bank rate/)).toHaveValue('5.5');
});

test('demo time travel changes the queue and reset restores it', async ({ page }) => {
  await nav(page, 'settings');
  await page.getByRole('button', { name: '+1 week' }).click();
  await nav(page, 'today');
  await expect(page.locator('.queue')).not.toHaveCount(5);
  await nav(page, 'settings');
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await nav(page, 'today');
  await expect(page.locator('.queue')).toHaveCount(5);
});

test('statement shows principal, interest and a total', async ({ page }) => {
  await nav(page, 'customers');
  await page.getByRole('link', { name: /Patel/ }).click();
  await page.getByRole('link', { name: /Statement with interest/ }).click();
  await expect(page.getByText('Principal + interest claimed')).toBeVisible();
  await expect(page.locator('tfoot')).toContainText('₹');
});

test('opting a customer out removes them from the queue', async ({ page }) => {
  await nav(page, 'customers');
  await page.getByRole('link', { name: /Kumar/ }).click();
  await page.getByLabel(/Asked us to stop reminders/).check();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await nav(page, 'today');
  await expect(card(page, 'Kumar')).toHaveCount(0);
});

test('hostile text is rendered as text, never as markup', async ({ page }) => {
  await nav(page, 'customers');
  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByLabel('Name').fill('<img src=x onerror="window.__pwned=1">');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('h1')).toContainText('<img src=x');
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
});

for (const route of ['today', 'money', 'customers', 'import', 'brief', 'settings']) {
  test(`${route}: no horizontal overflow and no serious accessibility violations`, async ({ page }) => {
    await nav(page, route);
    await page.waitForTimeout(200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(
      bad.map(
        (v) =>
          `${v.id}: ${v.nodes
            .map((n) => n.target.join(' '))
            .slice(0, 3)
            .join(' | ')}`
      )
    ).toEqual([]);
  });
}
