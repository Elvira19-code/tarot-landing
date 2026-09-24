import test from 'node:test';
import assert from 'node:assert/strict';
import {validate,catalog} from './catalog.mjs';
const base={ageConfirmed:true,name:'Test',email:'a@b.ru',service:'day',birth:'1990-01-01',place:'Moscow',start:'2090-01-01',offer:true,consent:true};
test('prices and period controlled by server',()=>{assert.equal(catalog.day.price,350);assert.equal(validate({...base,price:1}).end,'2090-01-01');assert.equal(validate({...base,service:'week'}).end,'2090-01-07');});
test('invalid calendar date rejected',()=>assert.throws(()=>validate({...base,birth:'1990-02-30'})));
test('both consents required',()=>{assert.throws(()=>validate({...base,offer:false}));assert.throws(()=>validate({...base,consent:'true'}));});
test('tarot preserves choice and rejects duplicates',()=>{const x={...base,service:'tarot',question:'Choice',spread:'choice',cards:[3,1,6,5,0],reversed:[false,true,false,true,false]};assert.deepEqual(validate(x).cards,x.cards);assert.throws(()=>validate({...x,cards:[1,1,2,3,4]}));});
test('age confirmation required',()=>{for(const ageConfirmed of [undefined,false,'true'])assert.throws(()=>validate({...base,ageConfirmed}));});
test('tarot orientations are validated and preserved for every spread',()=>{
 for(const [spread,count] of [['choice',5],['relationship',7],['cross',10]]){
  const input={...base,service:'tarot',question:'Test',spread,cards:Array.from({length:count},(_,i)=>i),reversed:Array.from({length:count},(_,i)=>i%2===0)};
  assert.deepEqual(validate(input).reversed,input.reversed);
  for(const reversed of [undefined,[],['false'],Array(count).fill(1)])assert.throws(()=>validate({...input,reversed}));
 }
});
