import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
test('live callback checks MD5, amount, duplicates and persists payment exactly once',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'robo-test-'));
 const child=spawn(process.execPath,['server/app.mjs'],{env:{...process.env,PORT:'0',DATA_DIR:dir,APP_ORIGIN:'http://localhost',NODE_ENV:'production',PAYMENT_MODE:'robokassa',ROBOKASSA_LOGIN:'taroway',ROBOKASSA_HASH:'md5',ROBOKASSA_PASSWORD_1:'test-one',ROBOKASSA_PASSWORD_2:'test-two',ROBOKASSA_RECEIPTS_READY:'1',GIGACHAT_ENABLED:'0'},windowsHide:true,stdio:['ignore','pipe','pipe']});
 try{
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),10000);child.stdout.on('data',chunk=>{const m=String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(timer);resolve(m[0]);}});child.once('exit',()=>{clearTimeout(timer);reject(Error('startup failed'));});});
 const date=new Date(Date.now()+2*86400000);while([0,6].includes(date.getUTCDay()))date.setUTCDate(date.getUTCDate()+1);
 const post=(url,data,token)=>fetch(base+url,{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});
 const input={service:'consultation_tarot',name:'QA',receiptMethod:'email',email:'qa@example.com',ageConfirmed:true,offer:true,consent:true,consultationQuestion:'QA',appointmentDate:date.toISOString().slice(0,10),appointmentTime:'11:00'};
 const response=await post('/api/orders',input);assert.equal(response.status,201);const order=await response.json();
 const pay=await (await post('/api/pay',{},order.token)).json();assert.equal(pay.params.IsTest,undefined);assert.equal(pay.params.MerchantLogin,'taroway');assert.ok(pay.params.Receipt);
 const callback=(amount='4000.000000',signature,duplicate=false)=>{const suffix=':Shp_receipt_contact=qa@example.com:Shp_receipt_method=email';const fields=new URLSearchParams({OutSum:amount,InvId:String(order.id),Shp_receipt_contact:'qa@example.com',Shp_receipt_method:'email',SignatureValue:signature||createHash('md5').update(`${amount}:${order.id}:test-two${suffix}`).digest('hex')});if(duplicate)fields.append('InvId',String(order.id));return fetch(base+'/api/robokassa/result',{method:'POST',body:fields});};
 assert.equal((await callback('4000.000000','bad')).status,403);
 assert.equal((await callback('1.000000')).status,400);
 assert.equal((await callback('4000.000000',null,true)).status,400);
 assert.equal(await (await callback()).text(),'OK'+order.id);
 assert.equal(await (await callback()).text(),'OK'+order.id);
 const saved=await (await fetch(base+'/api/order',{headers:{Authorization:'Bearer '+order.token}})).json();assert.equal(saved.state,'paid_consultation');assert.equal(saved.booking.status,'confirmed');
 const db=new DatabaseSync(path.join(dir,'orders.sqlite'));assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payments').get().n,1);db.close();
 }finally{child.kill();if(child.exitCode===null)await once(child,'exit');}
});
