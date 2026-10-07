import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareCloudPayments} from './cloudpayments-preparation.mjs';
import {consultationSchema} from '../src/data/service-schema.mjs';

const data = {service:'consultation_tarot',receiptMethod:'email',email:'client@example.com'};
test('CloudPayments preparation uses saved price and minimal contact only',()=>{
 const result=prepareCloudPayments({id:7,amount:4000},{...data,question:'private',birth:'1990-01-01'},'test-terminal');
 assert.equal(result.widget.amount,4000);
 assert.equal(result.widget.externalId,'7');
 assert.equal(result.widget.receiptEmail,data.email);
 assert.equal(result.receiptDraft.settlement,'full_prepayment');
 assert.equal(result.receiptDraft.issuance,'requires-confirmation');
 assert.equal(result.widget.receipt,undefined);
 assert.ok(!JSON.stringify(result).includes('private'));
});
test('CloudPayments preparation rejects inconsistent orders and missing settings',()=>{
 for(const amount of [0,1,NaN,Infinity]) assert.throws(()=>prepareCloudPayments({id:7,amount},data,'test'));
 assert.throws(()=>prepareCloudPayments({id:0,amount:4000},data,'test'));
 assert.throws(()=>prepareCloudPayments({id:7,amount:4000},data,''));
 assert.throws(()=>prepareCloudPayments({id:7,amount:4000},{...data,receiptMethod:'sms',phone:'+79001234567'},'test'));
});
test('service schema names the real provider without claiming instant availability',()=>{
 assert.equal(consultationSchema['@type'],'Service');
 assert.equal(consultationSchema.provider.name,'Кельина Эльвира Рустемовна');
 assert.equal(consultationSchema.offers,undefined);
});
