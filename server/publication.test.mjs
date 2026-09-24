import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';

test('request-only publication saves orders, reserves calendar and rejects payment', async () => {
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 const data=await mkdtemp(path.join(tmpdir(),'taroway-publication-'));
 const child=spawn(process.execPath,['server/app.mjs'],{cwd:root,env:{...process.env,PORT:'0',APP_ORIGIN:'http://localhost',DATA_DIR:data,PAYMENT_MODE:'requests',NODE_ENV:'production'},windowsHide:true,stdio:['ignore','pipe','pipe']});
 try {
  const base=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Server startup timed out')),10000);
   child.stdout.on('data',chunk=>{const match=String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});
   child.once('error',e=>{clearTimeout(timer);reject(e);});
   child.once('exit',code=>{clearTimeout(timer);reject(Error('Server exited: '+code));});
  });
  const post=(url,payload,token)=>fetch(base+url,{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(payload)});
  const date=new Date(Date.now()+86400000);while([0,6].includes(date.getUTCDay()))date.setUTCDate(date.getUTCDate()+1);
  const day=date.toISOString().slice(0,10);
  const input={service:'consultation_tarot',name:'QA',email:'qa@example.com',receiptMethod:'email',ageConfirmed:true,offer:true,consent:true,consultationQuestion:'QA',appointmentDate:day,appointmentTime:'11:00'};
  const response=await post('/api/orders',input);assert.equal(response.status,201);const {token}=await response.json();
  const order=await (await fetch(base+'/api/order',{headers:{Authorization:'Bearer '+token}})).json();assert.equal(order.state,'requested');assert.equal(order.booking.status,'requested');
  assert.equal((await post('/api/pay',{},token)).status,403);
  const availability=await (await fetch(base+'/api/availability?date='+day)).json();assert.ok(!availability.times.includes('11:00'));
  const tarot=await post('/api/orders',{...input,service:'tarot',question:'QA',spread:'choice',cards:[0,22,34,50,77],reversed:[true,false,true,false,false]});assert.equal(tarot.status,201);
 } finally {child.kill();if(child.exitCode===null)await once(child,'exit');}
});
