import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {catalog,deck,validate} from './catalog.mjs';
import {createBookings,validateBooking,moscowDate,PAUSED} from './bookings.mjs';
import {paymentParams} from './payment.mjs';
import {clientIp} from './client-ip.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=process.env.DATA_DIR||path.join(root,'private');
await mkdir(dataDir,{recursive:true});
const db=new DatabaseSync(path.join(dataDir,'orders.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT UNIQUE NOT NULL, data TEXT NOT NULL, amount INTEGER NOT NULL, state TEXT NOT NULL, result TEXT, created TEXT NOT NULL, legal TEXT NOT NULL);`);
const bookings=createBookings(db);
const adminFile=path.join(dataDir,'admin.token');
if(!process.env.ADMIN_TOKEN){try{await writeFile(adminFile,randomBytes(32).toString('base64url'),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}}
const adminToken=process.env.ADMIN_TOKEN||(await readFile(adminFile,'utf8')).trim();
if(adminToken.length<32)throw Error('ADMIN_TOKEN must contain at least 32 characters');
const sessions=new Map();
const cookieSecure=process.env.APP_ORIGIN?.startsWith('https://')?'; Secure':'';
function admin(req){const id=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('taroway_admin='))?.slice(14);return id&&sessions.get(id)>Date.now();}
const mode=process.env.PAYMENT_MODE||'requests';
if(!['requests','demo','robokassa-test'].includes(mode))throw Error('Live payments disabled pending fiscalization and production review');
if(process.env.NODE_ENV==='production'&&mode!=='requests')throw Error('Production accepts requests only until payment and generation are integrated');
const login=process.env.ROBOKASSA_LOGIN,p1=process.env.ROBOKASSA_PASSWORD_1,p2=process.env.ROBOKASSA_PASSWORD_2;
if(mode==='robokassa-test'&&(!login||!p1||!p2))throw Error('Test Robokassa credentials required');
const hash=s=>createHash('sha256').update(s).digest('hex');
const signature=s=>createHash('sha256').update(s).digest('hex');
const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
function reply(res,status,data,type='application/json'){res.writeHead(status,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(type==='application/json'?JSON.stringify(data):data);}
async function body(req){let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>16000)throw Error('Слишком большой запрос.');}return data;}
function auth(req){const t=(req.headers.authorization||'').replace(/^Bearer /,'');return db.prepare('SELECT * FROM orders WHERE token=?').get(hash(t));}
const rates=new Map();
function limited(req,kind,max=10){const key=kind+':'+clientIp(req,process.env.TRUST_LOCAL_PROXY==='1'),now=Date.now(),times=(rates.get(key)||[]).filter(t=>now-t<60000);if(times.length>=max)return true;times.push(now);rates.set(key,times);return false;}
setInterval(()=>{const now=Date.now();for(const [key,times]of rates)if(!times.some(t=>now-t<60000))rates.delete(key);for(const [key,expiry]of sessions)if(expiry<now)sessions.delete(key);},60000).unref();
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&url.pathname==='/api/catalog')return reply(res,200,{catalog,mode});
 if(req.method==='GET'&&url.pathname==='/api/availability')return reply(res,200,bookings.availability(url.searchParams.get('date')||moscowDate()));
 if(req.method==='POST'&&url.pathname==='/api/robokassa/result'){
  if(mode!=='robokassa-test')return reply(res,403,{error:'Disabled'});
  const fields=new URLSearchParams(await body(req));for(const key of fields.keys())if(fields.getAll(key).length!==1)throw Error('Invalid parameters');
  const custom=[...fields.keys()].filter(k=>k.startsWith('Shp_')).sort();
  if(custom.some(k=>!['Shp_receipt_contact','Shp_receipt_method'].includes(k)))return reply(res,403,{error:'Invalid parameters'});
  const suffix=custom.map(k=>`:${k}=${fields.get(k)}`).join('');
  const amount=fields.get('OutSum')||'',id=fields.get('InvId')||'',sig=fields.get('SignatureValue')||'';
  if(!/^\d+\.\d{1,6}$|^\d+$/.test(amount)||!/^\d+$/.test(id)||!equal(signature(`${amount}:${id}:${p2}${suffix}`),sig.toLowerCase()))return reply(res,403,{error:'Invalid signature'});
  const order=db.prepare('SELECT * FROM orders WHERE id=?').get(Number(id));
  if(!order||Number(amount)!==order.amount)return reply(res,400,{error:'Invalid amount'});
  const saved=JSON.parse(order.data);
  if(saved.receiptMethod&&(custom.length!==2||fields.get('Shp_receipt_method')!==saved.receiptMethod||fields.get('Shp_receipt_contact')!==(saved.email||saved.phone)))return reply(res,400,{error:'Receipt contact mismatch'});
  bookings.atomic(()=>{if(order.state!=='pending')return;try{bookings.paid(order.id);db.prepare("UPDATE orders SET state='queued' WHERE id=?").run(order.id);}catch{db.prepare("UPDATE orders SET state='payment_review' WHERE id=?").run(order.id);}});
  return reply(res,200,`OK${id}`,'text/plain');
 }
 if(url.pathname.startsWith('/api/')){
  const origin=process.env.APP_ORIGIN||`http://127.0.0.1:${process.env.PORT||4322}`;
  if(req.method==='POST'&&req.headers.origin!==origin)return reply(res,403,{error:'Origin rejected'});
  if(req.method==='POST'&&url.pathname==='/api/admin/login'){
   if(limited(req,'login',5))return reply(res,429,{error:'Подождите минуту перед следующей попыткой.'});
   const input=JSON.parse(await body(req));if(!equal(hash(String(input.token||'')),hash(adminToken)))return reply(res,401,{error:'Неверный ключ администратора.'});
   const sid=randomBytes(32).toString('base64url');sessions.set(sid,Date.now()+8*3600000);res.setHeader('Set-Cookie',`taroway_admin=${sid}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=28800${cookieSecure}`);return reply(res,200,{ok:true});
  }
  if(url.pathname.startsWith('/api/admin/')){
   if(!admin(req))return reply(res,401,{error:'Войдите в админ-панель.'});
   if(req.method==='GET'&&url.pathname==='/api/admin/state')return reply(res,200,{accepting:bookings.accepting(),bookings:bookings.list(),mode,paymentReview:db.prepare("SELECT id,created FROM orders WHERE state='payment_review'").all()});
   if(req.method==='POST'&&url.pathname==='/api/admin/logout'){const sid=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('taroway_admin='))?.slice(14);sessions.delete(sid);res.setHeader('Set-Cookie',`taroway_admin=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0${cookieSecure}`);return reply(res,200,{ok:true});}
   if(req.method==='POST'&&url.pathname==='/api/admin/change')return reply(res,200,bookings.adminChange(JSON.parse(await body(req))));
   return reply(res,404,{error:'Not found'});
  }
  if(req.method==='POST'&&url.pathname==='/api/bookings'){
   if(limited(req,'booking',5))return reply(res,429,{error:'Слишком много заявок. Подождите минуту.'});
   const data=validateBooking(JSON.parse(await body(req)));
   const id=bookings.atomic(()=>bookings.reserve(data));return reply(res,201,{id,date:data.appointmentDate,time:data.appointmentTime});
  }
  if(req.method==='POST'&&url.pathname==='/api/orders'){
   if(limited(req,'order'))return reply(res,429,{error:'Слишком много запросов. Подождите минуту.'});
   const data=validate(JSON.parse(await body(req)));const token=randomBytes(32).toString('base64url');
   const row=bookings.atomic(()=>{if(!bookings.accepting())throw Error(PAUSED);const row=db.prepare('INSERT INTO orders(token,data,amount,state,created,legal) VALUES(?,?,?,?,?,?)').run(hash(token),JSON.stringify(data),catalog[data.service].price,mode==='requests'?'requested':'pending',new Date().toISOString(),'offer+consent 2026-09-24');if(catalog[data.service].consultation)bookings.reserve(data,Number(row.lastInsertRowid),mode==='requests');return row;});
   return reply(res,201,{token,id:Number(row.lastInsertRowid),amount:catalog[data.service].price});
  }
  const order=auth(req);if(!order)return reply(res,404,{error:'Заказ не найден. Откройте страницу в том же браузере.'});
  if(req.method==='GET'&&url.pathname==='/api/order'){const data=JSON.parse(order.data);const booking=db.prepare('SELECT date,time,status FROM bookings WHERE order_id=?').get(order.id);return reply(res,200,{id:order.id,state:order.state,amount:order.amount,result:order.result,service:catalog[data.service].name,receiptMethod:data.receiptMethod||'email',receiptContact:data.email||data.phone,booking,mode});}
  if(req.method==='POST'&&url.pathname==='/api/pay'){
   if(mode==='requests')return reply(res,403,{error:'Оплата согласуется с исполнителем.'});
   if(order.state!=='pending')return reply(res,409,{error:'Заказ уже обрабатывается.'});
   bookings.requireReservation(order.id);
   if(mode==='demo'){bookings.atomic(()=>{bookings.paid(order.id);db.prepare("UPDATE orders SET state='queued' WHERE id=? AND state='pending'").run(order.id);});return reply(res,200,{demo:true});}
   const params=paymentParams(order,JSON.parse(order.data),login,p1);
   return reply(res,200,{url:'https://auth.robokassa.ru/Merchant/Index.aspx',params});
  }
  return reply(res,404,{error:'Not found'});
 }
 if(req.method!=='GET')return reply(res,405,{},'application/json');
 const name=decodeURIComponent(url.pathname);const filename=path.resolve(root,'dist','.'+name+(name.endsWith('/')?'index.html':''));
 if(!filename.startsWith(path.join(root,'dist')+path.sep))return reply(res,403,{error:'Forbidden'});
 const contents=await readFile(filename);const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.xml':'application/xml','.txt':'text/plain'};
 res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Referrer-Policy':'no-referrer','Cache-Control':'no-store'});res.end(contents);
}catch(error){reply(res,error.code==='ENOENT'?404:400,{error:error.code==='ENOENT'?'Не найдено.':'Проверьте данные заказа. '+(error instanceof SyntaxError?'Некорректный запрос.':error.message)});}});
// Durable queue: payment callbacks only enqueue. A restart retries interrupted work.
db.prepare("UPDATE orders SET state='queued' WHERE state='processing'").run();
let busy=false;
setInterval(async()=>{if(mode==='requests'||busy)return;const order=db.prepare("SELECT * FROM orders WHERE state='queued' ORDER BY id LIMIT 1").get();if(!order)return;busy=true;
 try{db.prepare("UPDATE orders SET state='processing' WHERE id=?").run(order.id);const d=JSON.parse(order.data);
  const result='ДЕМОНСТРАЦИЯ. Это не персональный разбор. Деньги не списывались.\n\n'+(d.service==='tarot'?'Зафиксированные карты: '+d.cards.map((i,index)=>deck[i]+' ('+(d.reversed?.[index]?'перевёрнутая':'прямая')+')').join(', '):'Выбранный формат: '+catalog[d.service].name+(d.start?'\nПериод: '+d.start+' — '+d.end:''))+'\n\nРасчёт Kerykeion и генерация GigaChat требуют отдельной настройки. Реальная генерация в этой версии отключена.';
  db.prepare("UPDATE orders SET state='ready',result=? WHERE id=?").run(result,order.id);
 }catch{db.prepare("UPDATE orders SET state='failed' WHERE id=?").run(order.id);}finally{busy=false;}
},1000);
server.listen(Number(process.env.PORT||4322),'127.0.0.1',()=>console.log('Order server: http://127.0.0.1:'+server.address().port+'/order/ ('+mode+')'));
