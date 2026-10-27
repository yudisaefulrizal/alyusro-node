import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { mkdtemp,rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { createWaliStudents } from '../src/wali-students.js';
import { createAuthHandler,verifyPassword,passwordValid } from '../src/auth.js';
const hash=v=>createHash('sha256').update(v).digest('hex');
async function fixture(options={}) {
 let time=Math.floor(Date.now()/1000);const users=new Map([[1,{id:1,name:'Wali Uji',email:'wali@example.test',nomor_kk:'1234567890123456',password:await bcrypt.hash('password-awal',4)}]]);
 const sessions=new Map(),resets=new Map(),limits=new Map(),mail=[];
 const permissions=[];
 const store={
  session:async id=>{const s=sessions.get(id);return s&&s.expires_at>time?{...s}:undefined;},
  putSession:async s=>sessions.set(s.id,{...s}),deleteSession:async id=>sessions.delete(id),touch:async(id,expires_at)=>Object.assign(sessions.get(id),{expires_at,last_activity:time}),
  user:async id=>users.get(id),login:async value=>[...users.values()].find(u=>u.email===value||u.nomor_kk===value),email:async value=>[...users.values()].find(u=>u.email===value),
  access:async()=>({roles:['Wali santri'],permissions}),sessions:async id=>[...sessions.values()].filter(s=>s.user_id===id),
  revokeOthers:async(id,current)=>{for(const [key,s]of sessions)if(s.user_id===id&&key!==current)sessions.delete(key);},
  rate:async(key,max)=>{let r=limits.get(key);if(!r||r.until<=time)r={n:0,until:time+60};r.n++;limits.set(key,r);return r.n<=max;},
  register:async data=>{if([...users.values()].some(u=>u.email===data.email||u.nomor_kk===data.nomor_kk))throw Object.assign(Error(),{code:'ER_DUP_ENTRY'});const id=users.size+1;users.set(id,{...data,id});return id;},
  profile:async(id,data)=>Object.assign(users.get(id),data),kk:async(id,value)=>users.get(id).nomor_kk=value,avatar:async(id,path)=>users.get(id).avatar_url=path,
  changePassword:async(id,password,remember_token)=>Object.assign(users.get(id),{password,remember_token}),
  deleteUser:async id=>{users.delete(id);for(const [key,s]of sessions)if(s.user_id===id)sessions.delete(key);},
  createReset:async(user,value)=>{const r=resets.get(user.email);if(r&&r.time>time-60)return false;resets.set(user.email,{value,time,id:user.id});return true;},
  reset:async(email,value,password,remember_token)=>{const r=resets.get(email);if(!r||r.time<=time-3600||r.value!==value)return false;Object.assign(users.get(r.id),{password,remember_token});resets.delete(email);for(const [key,s]of sessions)if(s.user_id===r.id)sessions.delete(key);return true;},
 };
 const root=await mkdtemp('/tmp/alyusro-auth-');
 const handler=createAuthHandler({wali:async()=>'<a href="/dashboard/santri-wali">Data santri</a>',store,sendMail:async(user,token)=>mail.push({user,token}),now:()=>time,uploadRoot:pathToFileURL(root+'/'),...options});
 const server=http.createServer(async(req,res)=>{if(!await handler(req,res,new URL(req.url,'http://localhost').pathname)){res.writeHead(404);res.end();}});
 server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
 function client(){let cookie='';return {
  async get(path){const r=await fetch(base+path,{headers:{cookie},redirect:'manual'});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return r;},
  async csrf(path='/dashboard/login'){const r=await this.get(path);return (await r.text()).match(/name="_csrf" value="([^"]+)"/)?.[1];},
  async post(path,data,extra={}){const r=await fetch(base+path,{method:'POST',headers:{cookie,origin:base,...(data instanceof FormData?{}:{'content-type':'application/x-www-form-urlencoded'}),...extra},body:data instanceof FormData?data:new URLSearchParams(data),redirect:'manual'});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return r;},
  async login(login='wali@example.test',password='password-awal',remember=false){return this.post('/dashboard/login',{_csrf:await this.csrf(),login,password,...(remember?{remember:'1'}:{})});},
  get cookie(){return cookie;},
 };}
 return {client,users,sessions,resets,permissions,mail,store,advance:n=>time+=n,close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}};
}
test('bcrypt Laravel $2y$ didukung dan password terlalu panjang ditolak',async()=>{const encoded=await bcrypt.hash('password-awal',4);assert.equal(await verifyPassword('password-awal',encoded.replace('$2b$','$2y$')),true);assert.equal(await verifyPassword('salah',encoded),false);assert.equal(passwordValid('1234567'),false);assert.equal(passwordValid('أ'.repeat(37)),false);});
test('dashboard dilindungi; login email/KK, remember, rotasi sesi, logout',async t=>{const f=await fixture();t.after(f.close);const c=f.client();assert.equal((await c.get('/dashboard')).headers.get('location'),'/dashboard/login');const old=c.cookie;const login=await c.login('1234567890123456','password-awal',true);assert.equal(login.status,303);assert.notEqual(c.cookie,old);assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Lax; Max-Age=/);const page=await c.get('/dashboard');assert.match(await page.text(),/Wali santri/);assert.equal(page.headers.get('cache-control'),'no-store');const r=await c.post('/dashboard/logout',{_csrf:await c.csrf('/dashboard')});assert.equal(r.headers.get('location'),'/');assert.equal((await c.get('/dashboard')).headers.get('location'),'/dashboard/login');});
test('CSRF dan origin diperiksa sebelum mutasi, GET logout tidak mengeluarkan akun',async t=>{const f=await fixture();t.after(f.close);const c=f.client();await c.login();assert.equal((await c.post('/dashboard/profile',{name:'Ubah',email:'new@example.test'})).status,403);assert.equal((await c.post('/dashboard/profile',{_csrf:await c.csrf('/dashboard'),name:'Ubah',email:'new@example.test'},{origin:'https://evil.example'})).status,403);assert.equal(f.users.get(1).name,'Wali Uji');await c.get('/dashboard/logout');assert.equal((await c.get('/dashboard')).status,200);});
test('pembatasan percobaan login bertahan antar sesi per IP',async t=>{const f=await fixture();t.after(f.close);const c=f.client();const csrf=await c.csrf();for(let i=0;i<10;i++)assert.equal((await c.post('/dashboard/login',{_csrf:csrf,login:'wali@example.test',password:'salah'})).status,422);assert.equal((await f.client().login()).status,429);f.advance(61);assert.equal((await c.login()).status,303);});
test('pendaftaran memvalidasi konfirmasi/persetujuan, hash password dan duplikasi',async t=>{const f=await fixture();t.after(f.close);const c=f.client();const data={_csrf:await c.csrf('/dashboard/register'),name:'Wali Baru',email:'baru@example.test',nomor_kk:'2222222222222222',password:'password-baru',passwordConfirmation:'password-baru'};assert.equal((await c.post('/dashboard/register',data)).status,422);f.advance(61);data.terms='1';assert.equal((await c.post('/dashboard/register',data)).status,303);assert.equal(f.users.size,2);assert.equal(await verifyPassword('password-baru',f.users.get(2).password),true);const other=f.client();data._csrf=await other.csrf('/dashboard/register');assert.equal((await other.post('/dashboard/register',data)).status,422);assert.equal(f.users.size,2);});
test('reset menggunakan token sekali pakai, cooldown, dan mencabut sesi',async t=>{const f=await fixture();t.after(f.close);const signed=f.client();await signed.login();const c=f.client();let csrf=await c.csrf('/dashboard/password-reset/request');const send=()=>c.post('/dashboard/password-reset/request',{_csrf:csrf,email:'wali@example.test'});assert.equal((await send()).status,200);await send();assert.equal(f.mail.length,1);const raw=f.mail[0].token;assert.notEqual(f.resets.get('wali@example.test').value,raw);const reset={_csrf:csrf,email:'wali@example.test',token:raw,password:'password-baru',passwordConfirmation:'password-baru'};assert.equal((await c.post('/dashboard/password-reset/reset',reset)).status,303);assert.equal((await signed.get('/dashboard')).headers.get('location'),'/dashboard/login');assert.equal((await c.post('/dashboard/password-reset/reset',reset)).status,422);assert.equal((await c.login('wali@example.test','password-baru')).status,303);});
test('token reset kedaluwarsa dan email tidak dikenal tidak membocorkan keberadaan akun',async t=>{const f=await fixture();t.after(f.close);const c=f.client();const csrf=await c.csrf('/dashboard/password-reset/request');const r=await c.post('/dashboard/password-reset/request',{_csrf:csrf,email:'missing@example.test'});assert.equal(r.status,200);assert.match(await r.text(),/Jika email terdaftar/);await c.post('/dashboard/password-reset/request',{_csrf:csrf,email:'wali@example.test'});f.advance(3601);const freshCsrf=await c.csrf('/dashboard/password-reset/request');assert.equal((await c.post('/dashboard/password-reset/reset',{_csrf:freshCsrf,email:'wali@example.test',token:f.mail[0].token,password:'password-baru',passwordConfirmation:'password-baru'})).status,422);});
test('profil di-escape, nomor KK perlu permission, dan perubahan password mencabut sesi lain',async t=>{const f=await fixture();t.after(f.close);const c=f.client(),other=f.client();await c.login();await other.login();const csrf=await c.csrf('/dashboard');assert.equal((await c.post('/dashboard/nomor-kk',{_csrf:csrf,nomor_kk:'42'})).status,403);f.permissions.push('widget_NomorKkWidget');assert.equal((await c.post('/dashboard/nomor-kk',{_csrf:csrf,nomor_kk:'42'})).status,303);assert.equal(f.users.get(1).nomor_kk,'42');await c.post('/dashboard/profile',{_csrf:csrf,name:'<script>alert(1)</script>',email:'wali@example.test'});assert.match(await(await c.get('/dashboard')).text(),/&lt;script&gt;/);assert.equal((await c.post('/dashboard/password',{_csrf:csrf,current_password:'password-awal',password:'password-baru',passwordConfirmation:'password-baru'})).status,303);assert.equal((await c.get('/dashboard')).status,200);assert.equal((await other.get('/dashboard')).status,303);});
test('logout perangkat lain dan hapus akun membutuhkan password/konfirmasi',async t=>{const f=await fixture();t.after(f.close);const c=f.client(),other=f.client();await c.login();await other.login();const csrf=await c.csrf('/dashboard');assert.equal((await c.post('/dashboard/sessions/revoke',{_csrf:csrf,current_password:'salah'})).status,422);assert.equal((await other.get('/dashboard')).status,200);await c.post('/dashboard/sessions/revoke',{_csrf:csrf,current_password:'password-awal'});assert.equal((await other.get('/dashboard')).status,303);assert.equal((await c.post('/dashboard/account/delete',{_csrf:csrf,current_password:'password-awal',confirmation:'tidak'})).status,422);assert.equal(f.users.size,1);assert.equal((await c.post('/dashboard/account/delete',{_csrf:csrf,current_password:'password-awal',confirmation:'HAPUS'})).status,303);assert.equal(f.users.size,0);assert.equal((await c.get('/dashboard')).status,303);});
test('unggah foto divalidasi dan hanya disajikan kepada pemilik yang login',async t=>{const f=await fixture();t.after(f.close);const c=f.client();await c.login();const csrf=await c.csrf('/dashboard');const invalid=new FormData();invalid.set('_csrf',csrf);invalid.set('avatar',new Blob(['<svg onload="alert(1)"></svg>'],{type:'image/png'}),'bad.png');assert.equal((await c.post('/dashboard/avatar',invalid)).status,422);const image=await sharp({create:{width:10,height:10,channels:3,background:'blue'}}).png().toBuffer();const valid=new FormData();valid.set('_csrf',csrf);valid.set('avatar',new Blob([image],{type:'image/png'}),'photo.png');assert.equal((await c.post('/dashboard/avatar',valid)).status,303);assert.match(f.users.get(1).avatar_url,/^fotoProfil\/[a-f0-9]+\.webp$/);const r=await c.get('/dashboard/avatar');assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/webp');assert.equal((await f.client().get('/dashboard/avatar')).status,303);});
test('sesi kedaluwarsa dan perubahan password dari aplikasi lain membatalkan login',async t=>{const f=await fixture({sessionMinutes:1});t.after(f.close);const c=f.client();await c.login();f.advance(61);assert.equal((await c.get('/dashboard')).headers.get('location'),'/dashboard/login');await c.login();f.users.get(1).password=await bcrypt.hash('password-dari-laravel',4);assert.equal((await c.get('/dashboard')).headers.get('location'),'/dashboard/login');});

test('HTTP data wali dilindungi sesi/permission, no-store, HEAD dan navigasi aktif',async t=>{
 const students=createWaliStudents(async()=>[{id:7,nama:'Santri Uji',jenjang:'Madrasah',status:'santri'}]);
 const f=await fixture({students});t.after(f.close);const c=f.client();
 assert.equal((await c.get('/dashboard/santri-wali')).headers.get('location'),'/dashboard/login');
 await c.login();assert.equal((await c.get('/dashboard/santri-wali')).status,403);
 f.permissions.push('view_any_santri::wali');
 const list=await c.get('/dashboard/santri-wali');assert.equal(list.status,200);assert.equal(list.headers.get('cache-control'),'no-store');assert.match(await list.text(),/Santri Uji/);
 assert.equal((await c.get('/dashboard/santri-wali/7')).status,403);
 f.permissions.push('view_santri::wali');assert.equal((await c.get('/dashboard/santri-wali/7')).status,200);
 const head=await fetch(new URL('/dashboard/santri-wali', (await c.get('/dashboard')).url),{method:'HEAD',headers:{cookie:c.cookie}});assert.equal(head.status,200);assert.equal(await head.text(),'');
 assert.match(await(await c.get('/dashboard')).text(),/href="\/dashboard\/santri-wali"/);
});

test('HTTP dashboard menyajikan statistik sesuai permission melalui sesi, HEAD dan no-store',async t=>{
 const {createDashboardStats}=await import('../src/dashboard-stats.js');
 let calls=0;
 const stats=createDashboardStats(async()=>{calls++;return [{jenjang:'madrasah',status:'santri',total:12}];});
 const f=await fixture({stats});t.after(f.close);const c=f.client();
 await c.get('/dashboard');assert.equal(calls,0);
 await c.login();await c.get('/dashboard');assert.equal(calls,0);
 f.permissions.push('widget_JumlahSantri');
 const result=await c.get('/dashboard');assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');
 const html=await result.text();assert.match(html,/Total: <strong>12<\/strong>/);assert.doesNotMatch(html,/<h2>Alumni/);
 const head=await fetch(result.url,{method:'HEAD',headers:{cookie:c.cookie}});assert.equal(head.status,200);assert.equal(await head.text(),'');
});

test('HTTP widget penerimaan menerima filter GET dan tetap memakai sesi serta permission',async t=>{
 const {createAdmissionStats}=await import('../src/admission-stats.js');
 let calls=0;
 const admissions=createAdmissionStats(async()=>{calls++;return [];});
 const f=await fixture({admissions});t.after(f.close);const c=f.client();
 assert.equal((await c.get('/dashboard?psb_year=2026')).status,303);assert.equal(calls,0);
 await c.login();await c.get('/dashboard');assert.equal(calls,0);
 f.permissions.push('widget_JumlahPsbSantriMadrasah');
 const result=await c.get('/dashboard?psb_year=&psb_wave=');assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');assert.match(await result.text(),/Rekap status pendaftar Madrasah/);
 const invalid=await c.get('/dashboard?psb_wave=abc');assert.match(await invalid.text(),/Filter penerimaan tidak valid/);
});

test('HTTP widget wali meneruskan KK akun, permission, no-store dan HEAD', async t => {
 const {createWaliWidget}=await import('../src/wali-widget.js');
 const calls=[];
 const wali=createWaliWidget(async(sql,args)=>{calls.push({sql,args});return sql.includes('FROM santris s LEFT JOIN')?[{id:8,nama:'Anak Wali',jenjang:'Madrasah',status:'diterima'}]:[];});
 const f=await fixture({wali});t.after(f.close);const c=f.client();
 await c.get('/dashboard');assert.equal(calls.length,0);
 await c.login();await c.get('/dashboard');assert.equal(calls.length,0);
 f.permissions.push('view_any_santri::wali','view_santri::wali');
 const response=await c.get('/dashboard');assert.equal(response.headers.get('cache-control'),'no-store');
 const html=await response.text();assert.match(html,/Anak Wali/);assert.doesNotMatch(html,/Lihat detail santri/);
 assert.deepEqual(calls.find(call=>call.sql.includes('FROM santris s LEFT JOIN')).args,['1234567890123456']);
 const head=await fetch(response.url,{method:'HEAD',headers:{cookie:c.cookie}});
 assert.equal(head.status,200);assert.equal(head.headers.get('cache-control'),'no-store');assert.equal(await head.text(),'');
});

test('HTTP berkas kartu memerlukan sesi, CSRF, origin dan meneruskan KK serta izin', async t => {
 const calls=[];
 const files=async args=>{calls.push(args);return args.access.permissions.includes('update_santri::wali')?{status:(!args.action||args.action==='read')?200:303,content:Buffer.from('image')}:{status:403};};
 const f=await fixture({files});t.after(f.close);const c=f.client();
 assert.equal((await c.get('/dashboard/wali-berkas/1/foto')).headers.get('location'),'/dashboard/login');
 await c.login();const csrf=await c.csrf('/dashboard');
 assert.equal((await c.post('/dashboard/wali-berkas/1/foto/delete',{})).status,403);assert.equal(calls.length,0);
 assert.equal((await c.post('/dashboard/wali-berkas/1/foto/delete',{_csrf:csrf},{origin:'https://evil.example'})).status,403);assert.equal(calls.length,0);
 assert.equal((await c.post('/dashboard/wali-berkas/1/foto/delete',{_csrf:csrf})).status,403);
 f.permissions.push('update_santri::wali');
 assert.equal((await c.post('/dashboard/wali-berkas/1/foto/delete',{_csrf:csrf})).status,303);
 assert.equal(calls.at(-1).user.nomor_kk,'1234567890123456');assert.equal(calls.at(-1).field,'foto');
 const img=await c.get('/dashboard/wali-berkas/1/foto');assert.equal(img.headers.get('cache-control'),'no-store');assert.equal(img.headers.get('content-type'),'image/jpeg');
});

test('HTTP edit santri memerlukan sesi dan CSRF serta meneruskan akun dan permission',async t=>{
 const calls=[];
 const editStudent=async args=>{calls.push(args);return args.access.permissions.includes('update_santri::wali')?args.data?{status:303}:{status:200,title:'Edit Data Santri',body:'<section>Edit santri</section>'}:{status:403,title:'Akses ditolak',body:'<p>Akses ditolak</p>'};};
 const f=await fixture({editStudent});t.after(f.close);const c=f.client();
 assert.equal((await c.get('/dashboard/santri-wali/7/edit')).headers.get('location'),'/dashboard/login');
 await c.login();assert.equal((await c.get('/dashboard/santri-wali/7/edit')).status,403);
 f.permissions.push('update_santri::wali');
 const get=await c.get('/dashboard/santri-wali/7/edit');assert.equal(get.status,200);assert.equal(get.headers.get('cache-control'),'no-store');
 const count=calls.length;assert.equal((await c.post('/dashboard/santri-wali/7/edit',{nama:'Test'})).status,403);assert.equal(calls.length,count);
 const csrf=await c.csrf('/dashboard');assert.equal((await c.post('/dashboard/santri-wali/7/edit',{_csrf:csrf,nama:'Test'})).headers.get('location'),'/dashboard');
 assert.equal(calls.at(-1).user.nomor_kk,'1234567890123456');assert.equal(calls.at(-1).id,'7');
});

test('HTTP pendaftaran santri memakai sesi, permission, CSRF dan KK akun',async t=>{
 const calls=[];
 const registerStudent=async args=>{calls.push(args);return args.access.permissions.includes('create_santri::wali')?args.data?{status:303}:{status:200,title:'Daftarkan Santri',body:'<section>Daftar</section>'}:{status:403,title:'Akses ditolak',body:'<p>Akses ditolak</p>'};};
 const f=await fixture({registerStudent});t.after(f.close);const c=f.client();
 assert.equal((await c.get('/dashboard/santri-wali/create')).headers.get('location'),'/dashboard/login');
 await c.login();assert.equal((await c.get('/dashboard/santri-wali/create')).status,403);
 f.permissions.push('create_santri::wali');const page=await c.get('/dashboard/santri-wali/create');assert.equal(page.status,200);assert.equal(page.headers.get('cache-control'),'no-store');
 const count=calls.length;assert.equal((await c.post('/dashboard/santri-wali/create',{nama:'Test'})).status,403);assert.equal(calls.length,count);
 const csrf=await c.csrf('/dashboard');assert.equal((await c.post('/dashboard/santri-wali/create',{_csrf:csrf,nama:'Test'})).headers.get('location'),'/dashboard');
 assert.equal(calls.at(-1).user.nomor_kk,'1234567890123456');
});

test('HTTP dokumen wali memakai izin dokumen, sesi, CSRF dan no-store',async t=>{
 const {createWaliDocuments}=await import('../src/wali-documents.js');
 const docs=createWaliDocuments(async(sql,args)=>sql.includes('LIMIT 1')?[{id:1,nama:'Anak',jenjang:'Madrasah'}]:[{id:1,nama:'Anak'}]);
 const fileCalls=[];const files=async args=>{fileCalls.push(args);return {status:args.action?303:200,content:Buffer.from('image')};};
 const f=await fixture({documents:docs,files});t.after(f.close);const c=f.client();
 assert.equal((await c.get('/dashboard/dokumen-wali')).headers.get('location'),'/dashboard/login');
 await c.login();assert.equal((await c.get('/dashboard/dokumen-wali')).status,403);
 f.permissions.push('view_any_berkas::santri::wali');const list=await c.get('/dashboard/dokumen-wali');assert.equal(list.headers.get('cache-control'),'no-store');assert.match(await list.text(),/Anak/);
 assert.match(await(await c.get('/dashboard')).text(),/href="\/dashboard\/dokumen-wali"/);
 assert.equal((await c.get('/dashboard/dokumen-wali/1/edit')).status,403);
 f.permissions.push('update_berkas::santri::wali');assert.equal((await c.get('/dashboard/dokumen-wali/1/edit')).status,200);
 const head=await fetch(list.url,{method:'HEAD',headers:{cookie:c.cookie}});assert.equal(head.status,200);assert.equal(await head.text(),'');
 const count=fileCalls.length;assert.equal((await c.post('/dashboard/dokumen-wali/1/foto/delete',{})).status,403);assert.equal(fileCalls.length,count);
 const csrf=await c.csrf('/dashboard');const result=await c.post('/dashboard/dokumen-wali/1/foto/delete',{_csrf:csrf});assert.equal(result.headers.get('location'),'/dashboard/dokumen-wali/1/edit');assert.equal(fileCalls.at(-1).scope,'documents');assert.equal(fileCalls.at(-1).user.nomor_kk,'1234567890123456');
});

test('HTTP Status Catatan memakai sesi, permission, CSRF dan no-store',async t=>{
 const calls=[];
 const notes=async args=>{calls.push(args);return args.access.permissions.includes('view_any_status::catatan')?(args.data?{status:303}:{status:200,title:'Status Catatan',body:'<section>Status</section>'}):{status:403,title:'Akses ditolak',body:'<section>Ditolak</section>'};};
 const f=await fixture({notes});t.after(f.close);const c=f.client();
 assert.equal((await c.get('/dashboard/status-catatan')).headers.get('location'),'/dashboard/login');
 await c.login();assert.equal((await c.get('/dashboard/status-catatan')).status,403);
 f.permissions.push('view_any_status::catatan');const r=await c.get('/dashboard/status-catatan');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
 assert.match(await(await c.get('/dashboard')).text(),/href="\/dashboard\/status-catatan"/);
 const count=calls.length;assert.equal((await c.post('/dashboard/status-catatan/delete',{id_1:'1'})).status,403);assert.equal(calls.length,count);
 const csrf=await c.csrf('/dashboard');assert.equal((await c.post('/dashboard/status-catatan/delete',{_csrf:csrf,id_1:'1'})).headers.get('location'),'/dashboard/status-catatan');assert.equal(calls.at(-1).action,'delete');
 const head=await fetch(r.url,{method:'HEAD',headers:{cookie:c.cookie}});assert.equal(head.status,200);assert.equal(await head.text(),'');
});

test('HTTP Sumber Informasi memerlukan sesi, permission, CSRF dan no-store',async t=>{
 const calls=[];
 const referrals=async args=>{calls.push(args);return args.access.permissions.includes('view_any_referral::source')?(args.data?{status:303}:{status:200,title:'Sumber Informasi',body:'<section>Sumber</section>'}):{status:403,title:'Akses ditolak',body:'<section>Ditolak</section>'};};
 const f=await fixture({referrals});t.after(f.close);const c=f.client();
 assert.equal((await c.get('/dashboard/sumber-informasi')).headers.get('location'),'/dashboard/login');
 await c.login();assert.equal((await c.get('/dashboard/sumber-informasi')).status,403);
 f.permissions.push('view_any_referral::source');const r=await c.get('/dashboard/sumber-informasi');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
 assert.match(await(await c.get('/dashboard')).text(),/href="\/dashboard\/sumber-informasi"/);
 const count=calls.length;assert.equal((await c.post('/dashboard/sumber-informasi/delete',{id_1:'1'})).status,403);assert.equal(calls.length,count);
 const csrf=await c.csrf('/dashboard');assert.equal((await c.post('/dashboard/sumber-informasi/delete',{_csrf:csrf,id_1:'1'})).headers.get('location'),'/dashboard/sumber-informasi');assert.equal(calls.at(-1).action,'delete');
 const head=await fetch(r.url,{method:'HEAD',headers:{cookie:c.cookie}});assert.equal(head.status,200);assert.equal(await head.text(),'');
});

test('HTTP Penerimaan Santri memakai sesi, CSRF, no-store dan rute sesuai tindakan',async t=>{
 const calls=[];
 const admissionsAdminHandler=async args=>{calls.push(args);return args.access.permissions.includes('view_any_penerimaan::santri')?(args.data?{status:303}:{status:200,title:'Penerimaan Santri',body:'<section>Penerimaan</section>'}):{status:403,title:'Akses ditolak',body:'<section>Ditolak</section>'};};
 const f=await fixture({admissionsAdminHandler});t.after(f.close);const c=f.client();
 assert.equal((await c.get('/dashboard/penerimaan-santri')).headers.get('location'),'/dashboard/login');
 await c.login();assert.equal((await c.get('/dashboard/penerimaan-santri')).status,403);
 f.permissions.push('view_any_penerimaan::santri');const r=await c.get('/dashboard/penerimaan-santri');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
 assert.match(await(await c.get('/dashboard')).text(),/href="\/dashboard\/penerimaan-santri"/);
 const count=calls.length;assert.equal((await c.post('/dashboard/penerimaan-santri/delete',{id_1:'1'})).status,403);assert.equal(calls.length,count);
 const csrf=await c.csrf('/dashboard');assert.equal((await c.post('/dashboard/penerimaan-santri/1/delete',{_csrf:csrf})).headers.get('location'),'/dashboard/penerimaan-santri');assert.equal(calls.at(-1).action,'delete');
 assert.equal((await c.post('/dashboard/penerimaan-santri/delete',{_csrf:csrf,id_1:'1'})).status,303);assert.equal(calls.at(-1).action,'bulkDelete');
 const head=await fetch(r.url,{method:'HEAD',headers:{cookie:c.cookie}});assert.equal(head.status,200);assert.equal(await head.text(),'');
});
