import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {generateReading,readingMessages} from './gigachat.mjs';
const data={service:'tarot',question:'Что учитывать?',spread:'choice',cards:[0,2,25,47,77],reversed:[false,true,false,true,false],email:'private@example.com',name:'Private'};
test('GigaChat sends chosen cards, not billing contacts; validates provider response',async()=>{
 const messages=readingMessages(data);assert.ok(!JSON.stringify(messages).includes('private@example.com'));assert.ok(!JSON.stringify(messages).includes('Private'));
 assert.equal(JSON.parse(messages[1].content).cards[1].orientation,'перевёрнутая');
 const dir=await mkdtemp(path.join(tmpdir(),'giga-test-'));const keyFile=path.join(dir,'key');await writeFile(keyFile,'not-a-real-key');
 const fetchImpl=async(url,options)=>{assert.equal(url,'https://foundation-models.api.cloud.ru/v1/chat/completions');assert.equal(options.redirect,'error');return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:'Разбор'}}]})};};
 assert.equal(await generateReading(data,{keyFile,fetchImpl}),'Разбор');
 await assert.rejects(generateReading(data,{keyFile,fetchImpl:async()=>({ok:false,status:402})}),/HTTP 402/);
 await assert.rejects(generateReading(data,{keyFile,fetchImpl:async()=>({ok:true,json:async()=>({choices:[{finish_reason:'length',message:{content:'partial'}}]})})}),/incomplete/);
 assert.throws(()=>readingMessages({...data,service:'natal'}),/calculation/);
});
