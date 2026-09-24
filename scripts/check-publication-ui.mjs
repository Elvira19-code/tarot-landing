import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
const dir=await mkdtemp(path.join(tmpdir(),'taroway-ui-')),base='http://127.0.0.1:4341';
const child=spawn(process.execPath,['server/app.mjs'],{env:{...process.env,PORT:'4341',APP_ORIGIN:base,DATA_DIR:dir,PAYMENT_MODE:'requests'},windowsHide:true,stdio:['ignore','pipe','pipe']});
let browser;
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),10000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('exit',code=>{clearTimeout(timer);reject(Error('Server exited '+code));});});
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('taroway-age-v1','yes');localStorage.setItem('taroway-chat-choice-v1','deny');});
 for(const route of ['','about','services','contact','reviews','process','privacy','consent','offer','advertising-consent','18plus','order','order-result','admin']){
  const response=await page.goto(base+'/'+(route?route+'/':''));assert.equal(response.status(),200);
  assert.doesNotMatch(await page.locator('main').innerText(),/тестов|демонстрац|заглушк|проект для согласования|локальная редакция/i);
 }
 await page.goto(base+'/reviews/');await expect(page.locator('main')).toContainText('Дмитрий');await expect(page.locator('main')).toContainText('получил');
 await page.goto(base+'/services/');assert.ok(await page.locator('input[type=checkbox][required]').count()>0);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await page.goto(base+'/order/?service=tarot');await expect(page.locator('[name=ageConfirmed]')).not.toBeChecked();
  await page.locator('[name=name]').fill('QA');await page.locator('[name=email]').fill('qa@example.com');await page.locator('[name=question]').fill('QA');
  for(let i=0;i<5;i++)await page.locator('[data-card]').nth(i).click();await page.locator('#show-spread').click();await expect(page.locator('.spread-cards figure')).toHaveCount(5);await expect(page.locator('#gigachat-reading')).toBeHidden();
  for(const name of ['ageConfirmed','offer','consent'])await page.locator('[name='+name+']').check();await page.getByRole('button',{name:'Проверить заказ'}).click();
  await expect(page.locator('#confirm-order')).toHaveText('Отправить заявку');await page.locator('#confirm-order').click();await page.waitForURL('**/order-result/');await expect(page.locator('#next-step')).toBeVisible();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }
 await page.goto(base+'/contact/?service=tarot');await page.locator('[name=name]').fill('QA');await page.locator('[name=contact]').fill('qa@example.com');
 const next=new Date(Date.now()+86400000);while([0,6].includes(next.getUTCDay()))next.setUTCDate(next.getUTCDate()+1);
 await page.locator('[name=appointmentDate]').fill(next.toISOString().slice(0,10));await expect(page.locator('[name=appointmentTime] option')).toHaveCount(5);await page.locator('[name=appointmentTime]').selectOption('11:00');
 for(const name of ['ageConfirmed','offer','consent'])await page.locator('[name='+name+']').check();await page.getByRole('button',{name:'Отправить заявку',exact:true}).click();await expect(page.locator('#form-result')).toBeVisible();
 assert.deepEqual(errors,[]);console.log('PASS: public pages, no demo UI, reviews, age gates, Tarot, request submission, calendar and mobile layout. Isolated data only.');
}finally{if(browser)await browser.close();child.kill();if(child.exitCode===null)await once(child,'exit');}
