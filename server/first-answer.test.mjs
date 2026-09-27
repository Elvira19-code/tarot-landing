import test from 'node:test';
import assert from 'node:assert/strict';
import {validate,orderPrice} from './catalog.mjs';
import {validateBooking} from './bookings.mjs';
const base={service:'first',name:'Test',email:'test@example.com',receiptMethod:'email',ageConfirmed:true,consent:true,offer:true,firstQuestion:'Мой запрос',amount:1};
test('first answer prices are calculated on the server for every combination',()=>{
 for(const [natal,questions,extended,amount] of [[false,false,false,590],[true,false,false,790],[false,true,false,690],[true,true,false,890],[true,true,true,990]]){
  const data=validate({...base,firstNatal:natal,firstQuestions:questions,firstExtended:extended,birth:'1990-01-01',place:'Москва'});
  assert.equal(orderPrice(data),amount);
  assert.equal(data.firstNatal,natal);
  assert.equal('appointmentDate' in data,false);
  assert.equal('birth' in data,natal);
 }
});
test('first answer rejects incomplete full set, missing request and missing natal data',()=>{
 assert.throws(()=>validate({...base,firstExtended:true}));
 assert.throws(()=>validate({...base,firstQuestion:''}));
 assert.throws(()=>validate({...base,firstNatal:true}));
 assert.throws(()=>validateBooking({...base,contact:'@test'}));
});
