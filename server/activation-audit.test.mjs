import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {paymentParams} from './payment.mjs';
import {LEGAL_VERSION} from './legal.mjs';
for (const algorithm of ['md5','sha256']) test(`payment signature and IsTest: ${algorithm}`,()=>{
 const data={service:'consultation_tarot',receiptMethod:'email',email:'qa@example.com'};
 for(const testMode of [true,false]) {
  const p=paymentParams({id:42,amount:4000},data,'audit-shop','audit-password',{test:testMode,algorithm});
  assert.equal(p.OutSum,'4000.00');assert.equal(p.InvId,'42');assert.ok(p.Description.length<=100);
  assert.equal(p.IsTest,testMode?'1':undefined);
  const raw=`audit-shop:4000.00:42:${p.Receipt}:audit-password:Shp_receipt_contact=qa@example.com:Shp_receipt_method=email`;
  assert.equal(p.SignatureValue,createHash(algorithm).update(raw).digest('hex'));
  assert.equal(JSON.parse(decodeURIComponent(p.Receipt)).items[0].sum,4000);
 }
});
test('legal versions match published source and footer contains full identity',()=>{
 for(const name of ['consent','privacy']) {
  const source=readFileSync(new URL(`../src/pages/${name}.astro`,import.meta.url),'utf8');
  const [,d,m,y]=source.match(/revision="(\d{2})\.(\d{2})\.(\d{4})"/);
  assert.ok(LEGAL_VERSION.includes(`${name} ${y}-${m}-${d}`));
 }
 const footer=readFileSync(new URL('../src/components/ContactDetails.astro',import.meta.url),'utf8');
 assert.ok(footer.includes('Кельина Эльвира Рустемовна'));
 const order=readFileSync(new URL('../src/pages/order.astro',import.meta.url),'utf8');
 assert.match(order,/href="\/privacy\/"/);
 assert.doesNotMatch(order,/<input[^>]*name="consent"[^>]*\schecked(?:[\s=>])/);
});
