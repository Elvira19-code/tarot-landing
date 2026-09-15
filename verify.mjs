import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4321';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await fs.mkdir('../../work/qa', { recursive: true });
const routes = ['/', '/services/', '/about/', '/process/', '/reviews/', '/contact/', '/privacy/'];
for (const width of [1440, 390, 320]) {
  await page.setViewportSize({ width, height: width > 600 ? 1000 : 844 });
  for (const route of routes) {
    const response = await page.goto(base + route);
    assert.equal(response.status(), 200, route);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('main h1').count(), 1, route);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    assert.equal(overflow, false, `Overflow ${width} ${route}`);
    const missing = await page.locator('img').evaluateAll(imgs => imgs.filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src));
    assert.deepEqual(missing, [], `Images ${route}`);
    if (width !== 320) await page.screenshot({ path: `../../work/qa/${width}-${route.replaceAll('/', '') || 'home'}.png`, fullPage: true, animations: 'disabled' });
  }
}
await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(base + '/services/#matrix');
assert.equal(await page.locator('#tab-matrix').getAttribute('aria-selected'), 'true');
await page.getByRole('tab', { name: 'Астрология', exact: true }).click();
assert.equal(await page.locator('#panel-astrology').isVisible(), true);
await page.getByRole('tab', { name: 'Астрология', exact: true }).press('ArrowRight');
assert.equal(await page.locator('#tab-matrix').getAttribute('aria-selected'), 'true');
await page.locator('#panel-matrix .button').click();
assert.equal(await page.locator('#service').inputValue(), 'matrix');
await page.locator('#booking-form button[type=submit]').click();
assert.equal(await page.locator('#form-result').isVisible(), false);
await page.getByLabel('Ваше имя').fill('Тестовая запись');
await page.getByLabel('Контакт для ответа').fill('@test_client');
await page.getByLabel('Ваш вопрос').fill('Хочу разобраться с выбором проекта.');
await page.locator('#booking-form button[type=submit]').click();
assert.equal(await page.locator('#form-result').isVisible(), false);
await page.locator('#consent').check();
await page.locator('#booking-form button[type=submit]').click();
assert.equal(await page.locator('#form-result').isVisible(), true);
assert.match(await page.locator('#booking-text').textContent(), /Тестовая запись/);
assert.match(await page.locator('#booking-text').textContent(), /Матрица/);
await page.locator('.faq summary').first().click();
assert.equal(await page.locator('.faq details').first().getAttribute('open'), '');
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(base);
await page.getByRole('button', { name: 'Открыть меню' }).click();
assert.equal(await page.locator('#navigation').isVisible(), true);
await page.locator('#navigation').getByRole('link', { name: 'Услуги', exact: true }).click();
assert.match(page.url(), /services/);
assert.deepEqual(errors, []);
console.log('PASS: 7 routes at 1440/390/320px; images; tabs and keyboard; service handoff; form validation and consent; FAQ; mobile navigation; no browser errors.');
await browser.close();
