import test from 'node:test';
import assert from 'node:assert/strict';
import {clientIp} from './client-ip.mjs';

test('client address headers are accepted only from an explicitly trusted local proxy',()=>{
 const req=(peer,ip)=>({socket:{remoteAddress:peer},headers:{'x-real-ip':ip}});
 assert.equal(clientIp(req('127.0.0.1','192.0.2.1')),'127.0.0.1');
 assert.equal(clientIp(req('127.0.0.1','192.0.2.1'),true),'192.0.2.1');
 assert.equal(clientIp(req('192.0.2.2','192.0.2.1'),true),'192.0.2.2');
 assert.equal(clientIp(req('127.0.0.1','192.0.2.1, 192.0.2.2'),true),'127.0.0.1');
 assert.equal(clientIp(req('::1','2001:db8::1'),true),'2001:db8::1');
 assert.equal(clientIp(req('127.0.0.1',['192.0.2.1']),true),'127.0.0.1');
});
