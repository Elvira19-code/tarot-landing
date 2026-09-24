import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
 const page = await browser.newPage();
 await page.route('https://www.chatbase.co/embed.min.js', route => route.fulfill({body:'',contentType:'text/javascript'}));
 await page.goto('http://127.0.0.1:4321/');
 assert.equal(await page.locator('script[src*="chatbase.co/embed"]').count(),0);
 await page.click('#disable-chat');
 await page.reload();
 assert.equal(await page.locator('script[src*="chatbase.co/embed"]').count(),0);
 await page.click('#chat-settings');
 await page.click('#enable-chat');
 assert.equal(await page.locator('script[src*="chatbase.co/embed"]').count(),1);
 await page.reload();
 assert.equal(await page.locator('script[src*="chatbase.co/embed"]').count(),1);
 await page.click('#chat-settings');
 await Promise.all([page.waitForEvent('load'), page.click('#disable-chat')]);
 assert.equal(await page.locator('script[src*="chatbase.co/embed"]').count(),0);
 for (const width of [390, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  for (const route of ['privacy', 'consent', 'offer', 'advertising-consent', 'contact']) {
   const response = await page.goto(`http://127.0.0.1:4321/${route}/`);
   assert.equal(response.status(), 200);
   assert.equal(await page.locator('h1').count(), 1);
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
   await page.screenshot({ path: `legal-${route}-${width}.png`, fullPage: true });
  }
  console.log('Layout passed', width);
 }
 await page.fill('#name', 'Test');
 await page.fill('#contact', 'test@example.com');
 await page.selectOption('#service', 'tarot');
 for (const [offer, consent, expected] of [[false,false,false],[true,false,false],[false,true,false],[true,true,true]]) {
  await page.locator('#offer').setChecked(offer);
  await page.locator('#consent').setChecked(consent);
  await page.locator('button[type=submit]').click();
  assert.equal(await page.locator('#form-result').isVisible(), expected);
 }
 await page.uncheck('#consent');
 assert.equal(await page.locator('#form-result').isVisible(), false);
 const xml = await (await page.request.get('http://127.0.0.1:4321/sitemap.xml')).text();
 for (const route of ['privacy', 'consent', 'offer']) assert.ok(xml.includes(`/${route}/`));
 assert.equal(await page.locator('.footer-legal a[href="#"]').count(), 0);
 console.log('Consent matrix, sitemap and footer passed');
} finally { await browser.close(); }
