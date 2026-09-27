import test from 'node:test';
import assert from 'node:assert/strict';
import {validate,orderPrice} from './catalog.mjs';
import {readingMessages} from './gigachat.mjs';
test('new spreads validate card count and use server-owned prices',()=>{
 for(const [spread,count,price] of [['year',12,450],['mirror',6,350]]){
  const input={service:'tarot',spread,question:'Что учитывать?',name:'Test',email:'test@example.com',receiptMethod:'email',ageConfirmed:true,offer:true,consent:true,cards:Array.from({length:count},(_,i)=>i),reversed:Array(count).fill(false),amount:1};
  const data=validate(input);
  assert.equal(orderPrice(data),price);
  const cards=JSON.parse(readingMessages(data)[1].content).cards;
  assert.equal(cards.length,count);
  assert.ok(cards.every(card=>typeof card.position==='string'));
  assert.throws(()=>validate({...input,cards:input.cards.slice(1)}));
  assert.throws(()=>validate({...input,cards:Array(count).fill(0)}));
 }
});
test('retired products cannot create new orders',()=>{
 assert.throws(()=>validate({service:'consultation_photo',ageConfirmed:true}),/формат/);
});
