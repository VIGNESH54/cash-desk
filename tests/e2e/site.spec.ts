import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route(/api\.pwnedpasswords\.com/, (r) => r.abort());
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/#/');
});

test('the home page explains the product and has no accessibility or overflow problems', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Cash Desk does the writing');
  for (const h of ['One morning, four steps', 'The law is on the supplier', 'Questions people ask first']) {
    await expect(page.getByRole('heading', { name: new RegExp(h) })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
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

test('the interest calculator responds and the FAQ opens', async ({ page }) => {
  const result = page.locator('.s-result strong').first();
  const before = await result.textContent();
  await page
    .locator('.s-calc input[type=range]')
    .nth(1)
    .evaluate((el: HTMLInputElement) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(el, '200');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  await expect(result).not.toHaveText(before!);
  await page.getByText('Is this legal advice?').click();
  await expect(page.locator('.s-faq').getByText(/follow public summaries/)).toBeVisible();
});

test('you can go from the demo back to the overview and return to the demo', async ({ page }) => {
  await page.getByRole('button', { name: 'Try the demo' }).first().click();
  await expect(page.locator('.queue').first()).toBeVisible();
  await expect(page.getByText(/You are in a demo/)).toBeVisible();
  await page.getByRole('link', { name: 'Back to the overview' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Cash Desk does the writing');
  await page.getByRole('button', { name: 'Back to the demo' }).first().click();
  await expect(page.locator('.queue').first()).toBeVisible();
  await page.getByRole('link', { name: 'Cash Desk overview' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('the guide on the Today screen can be dismissed and stays dismissed', async ({ page }) => {
  await page.getByRole('button', { name: 'Try the demo' }).first().click();
  await expect(page.getByText('How this screen works')).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByText('How this screen works')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.queue').first()).toBeVisible();
  await expect(page.getByText('How this screen works')).toHaveCount(0);
});

test('app pages without a demo or account send visitors to the overview, not a blank page', async ({ page }) => {
  await page.goto('/#/money');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Cash Desk does the writing');
  await page.goto('/#/signin');
  await expect(page.getByRole('heading', { name: /Sign in/ })).toBeVisible();
  await page.getByRole('link', { name: 'Back to the overview' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Cash Desk');
});
