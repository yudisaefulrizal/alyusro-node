import { permissionCacheSettings, invalidatePermissionCache } from '../src/permission-cache.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import { pool } from '../src/db.js';
import { modelType, createAuthStore } from '../src/auth-store.js';
import { runAudit, redactAudit } from '../src/audit.js';
import { createAdminResources } from '../src/admin-resources.js';
import { createAuthHandler } from '../src/auth.js';

test('User/Peran/Audit: SQL/HTTP, permission, cache, sesi, relasi, audit atomik dan UI', async () => {
 const c=await pool.getConnection(), tables=['users','roles','permissions','model_has_roles','model_has_permissions','role_has_permissions','audit_logs','cache','sessions','node_auth_sessions','node_auth_resets','santris','artikels'];
 let server,browser;
 try {
  const directory=new URL('../../database/migrations/',import.meta.url), files=await readdir(directory);
  for(const table of tables) {
   const filename=files.find(f=>f.endsWith(`_create_${table}_table.php`));
   if(filename) {
    const source=await readFile(new URL(filename,directory),'utf8');
    await c.query(source.match(/CREATE TABLE[\s\S]*?ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci/)[0].replace('CREATE TABLE','CREATE TEMPORARY TABLE'));
   } else {
    const [rows]=await c.query(`SHOW CREATE TABLE ${table}`);
    await c.query(rows[0]['Create Table'].replace('CREATE TABLE','CREATE TEMPORARY TABLE'));
   }
  }
  await c.execute("INSERT INTO users(id,name,email,password,nomor_kk) VALUES (1,'Admin fixture','admin@fixture.test','fixture','1'),(2,'100% <User>','user@fixture.test','fixture','2')");
  await c.execute("INSERT INTO roles(id,name,guard_name) VALUES (1,'Wali santri','web'),(2,'Operator','web'),(3,'API only','api')");
  await c.execute("INSERT INTO permissions(id,name,guard_name) VALUES (1,'view_any_user','web'),(2,'update_user','web'),(3,'hidden','api')");
  await c.execute('INSERT INTO model_has_roles(role_id,model_type,model_id) VALUES(1,?,2),(3,?,2)',[modelType,modelType]);
  const db={getConnection:async()=>({execute:(...args)=>c.execute(...args),beginTransaction:()=>c.beginTransaction(),commit:()=>c.commit(),rollback:()=>c.rollback(),release(){}}),execute:(...args)=>c.execute(...args)};
  const admin=createAdminResources(db,{invalidate:async connection=>connection.execute('DELETE FROM cache WHERE `key`=?',['fixture_spatie.permission.cache'])});
  const access={roles:['Penguji'],permissions:['user','role','audit::log'].flatMap(key=>['view_any','view','create','update','delete','delete_any'].map(action=>action+'_'+key))};
  const user={id:1,name:'Admin fixture',password:'fixture'};
  const call=(resource,action='list',extra={})=>runAudit({enabled:true,userId:1,ip:'127.0.0.1',userAgent:'fixture'},()=>admin({resource,action,user,access,csrf:'csrf',...extra}));
  for(const resource of ['users','roles','audit-logs'])assert.equal((await call(resource,'list',{access:{permissions:[]}})).status,403);
  assert.equal((await call('audit-logs','create')).status,404);
  assert.equal((await call('users','create',{data:{}})).status,422);
  const values={name:'Baru <User>',email:'new@fixture.test',nomor_kk:'3',password:'Password-baru-123',role_1:'1'};
  assert.equal((await call('users','create',{data:{...values,role_3:'1'}})).status,422);
  await c.execute("INSERT INTO cache (`key`,value,expiration) VALUES ('fixture_spatie.permission.cache','stale',999999999),('unrelated','keep',999999999)");
  assert.equal((await call('users','create',{data:values})).status,303);
  const [[created]]=await c.execute('SELECT * FROM users WHERE email=?',[values.email]);assert.ok(await bcrypt.compare(values.password,created.password));assert.equal(created.nomor_kk,'3');
  const [[cache]]=await c.execute('SELECT COUNT(*) AS n FROM cache');assert.equal(cache.n,1);
  const effective=await permissionCacheSettings();assert.equal(effective.driver,'database');assert.equal(effective.table,'cache');
  await c.execute('INSERT INTO cache (`key`,value,expiration) VALUES (?,?,999999999)',[effective.key,'stale Laravel permission']);await c.beginTransaction();await invalidatePermissionCache(c);await c.commit();
  const [[freshCache]]=await c.execute('SELECT COUNT(*) AS n FROM cache WHERE `key`=?',[effective.key]);assert.equal(freshCache.n,0);
  const [[log]]=await c.execute("SELECT * FROM audit_logs WHERE table_name='users' AND record_id=? AND action='INSERT'",[String(created.id)]);
  assert.equal(log.user_id,1);assert.equal(log.actor_type,'USER');assert.equal(JSON.parse(log.new_data).email,values.email);assert.doesNotMatch(log.new_data,/password|remember_token|Password-baru/);
  const form=await call('users','edit',{id:String(created.id)});assert.doesNotMatch(form.body,/\$2[aby]\$/);
  assert.equal((await call('users','create',{data:values})).status,422);
  assert.equal((await call('users','edit',{id:String(created.id),data:{...values,password:'',role_2:'1'}})).status,303);
  const [[unchanged]]=await c.execute('SELECT password FROM users WHERE id=?',[created.id]);assert.equal(unchanged.password,created.password);
  const store=createAuthStore(db);assert.deepEqual(new Set((await store.access(created.id)).roles),new Set(['Wali santri','Operator']));
  const raw='e'.repeat(64), hash=value=>createHash('sha256').update(value).digest('hex');
  await store.putSession({id:raw,user_id:created.id,csrf:raw,password_hash:raw,remember:0,expires_at:9999999999,last_activity:1,ip_address:'127.0.0.1',user_agent:'fixture'});
  await c.execute("INSERT INTO sessions (id,user_id,payload,last_activity) VALUES ('laravel',?,'fixture',1)",[created.id]);
  await c.execute('INSERT INTO node_auth_resets (user_id,email,token_hash,created_at) VALUES (?,?,?,1)',[created.id,values.email,raw]);
  assert.equal((await call('users','edit',{id:String(created.id),data:{...values,password:'Ganti-password-123'}})).status,303);
  for(const table of ['sessions','node_auth_sessions','node_auth_resets']){const [[count]]=await c.execute(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=?`,[created.id]);assert.equal(count.n,0);}
  const [[passwordLog]]=await c.execute("SELECT new_data FROM audit_logs WHERE table_name='users' AND action='UPDATE' ORDER BY id DESC LIMIT 1");assert.deepEqual(JSON.parse(passwordLog.new_data).changed_sensitive_fields,['password','remember_token']);
  const list=await call('users','list',{params:new URLSearchParams('q=%25&role=1')});assert.match(list.body,/100% &lt;User&gt;/);assert.doesNotMatch(list.body,/new@fixture/);
  assert.equal((await call('users','list',{params:new URLSearchParams('role=3')})).status,422);
  const exported=await call('users','list',{params:new URLSearchParams('q=%25&export=xlsx')});const book=new ExcelJS.Workbook();await book.xlsx.load(exported.xlsx);assert.equal(book.worksheets[0].rowCount,2);assert.equal(book.worksheets[0].getCell('A2').value,'100% <User>');
  assert.equal((await call('roles','create',{data:{name:'Peran baru',perm_3:'1'}})).status,422);
  assert.equal((await call('roles','create',{data:{name:'Peran baru',perm_1:'1',perm_2:'1'}})).status,303);
  const [[role]]=await c.execute("SELECT id FROM roles WHERE name='Peran baru'");
  assert.match((await call('roles','view',{id:String(role.id)})).body,/update_user/);
  assert.equal((await call('roles','edit',{id:'3'})).status,404);
  assert.equal((await call('roles','create',{data:{name:'Peran baru'}})).status,422);
  assert.equal((await call('users','bulk-role',{data:{id_2:'1'}})).status,200);
  assert.equal((await call('users','bulk-role',{data:{id_2:'1',role_id:String(role.id)}})).status,303);
  assert.deepEqual((await store.access(2)).permissions.sort(),['update_user','view_any_user']);
  const [[apiRole]]=await c.execute('SELECT COUNT(*) AS n FROM model_has_roles WHERE model_id=2 AND role_id=3');assert.equal(apiRole.n,1);
  assert.equal((await call('roles','bulkDelete',{data:{['id_'+role.id]:'1'}})).status,422);
  assert.equal((await call('users','bulkDelete',{data:{id_1:'1'}})).status,422);
  assert.equal((await call('users','bulkDelete',{data:{id_2:'1',id_999:'1'}})).status,404);
  const before=await c.execute('SELECT COUNT(*) AS n FROM audit_logs');
  await c.beginTransaction();
  await runAudit({enabled:true,userId:1},()=>c.execute('UPDATE users SET name=? WHERE id=?',['rolled back',created.id]));
  await c.rollback();
  const after=await c.execute('SELECT COUNT(*) AS n FROM audit_logs');assert.equal(after[0][0].n,before[0][0].n);
  const [[notChanged]]=await c.execute('SELECT name FROM users WHERE id=?',[created.id]);assert.equal(notChanged.name,values.name);
  // An unavailable audit sink must also roll back an otherwise autocommit mutation.
  await c.query("ALTER TABLE audit_logs ADD CONSTRAINT fixture_reject CHECK (request_id <> 'fail-audit')");
  try{await assert.rejects(()=>runAudit({enabled:true,userId:1,requestId:'fail-audit'},()=>c.execute('UPDATE users SET name=? WHERE id=?',['lost log',created.id])));}finally{await c.query('ALTER TABLE audit_logs DROP CHECK fixture_reject');}
  const [[atomic]]=await c.execute('SELECT name FROM users WHERE id=?',[created.id]);assert.equal(atomic.name,values.name);
  await assert.rejects(()=>runAudit({enabled:true,userId:1},()=>c.execute("INSERT INTO roles (name,guard_name) VALUES ('multi1','web'),('multi2','web')")));
  const [[multi]]=await c.execute("SELECT COUNT(*) AS n FROM roles WHERE name LIKE 'multi%'");assert.equal(multi.n,0);
  assert.deepEqual(redactAudit({password:'secret',nested:{csrf:'hidden',name:'kept'}}),{nested:{name:'kept'}});
  const session={id:hash(raw),user_id:1,password_hash:hash(user.password),csrf:'csrf'};
  const fixtureStore={session:async()=>session,user:async()=>user,access:async()=>access,touch:async()=>{}};
  const handler=createAuthHandler({store:fixtureStore,admin,auditEnabled:true});
  const {server:assets}=await import('../src/server.js');
  server=http.createServer(async(req,res)=>{if(!await handler(req,res,new URL(req.url,'http://localhost').pathname))assets.emit('request',req,res);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`,headers={cookie:'alyusro_node_session='+raw};
  const get=path=>fetch(origin+'/dashboard/'+path,{headers,redirect:'manual'});
  const post=(path,data,extra={})=>fetch(origin+'/dashboard/'+path,{method:'POST',headers:{...headers,origin,...extra},body:new URLSearchParams(data),redirect:'manual'});
  for(const resource of ['users','roles','audit-logs']) {
   const response=await get(resource);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
   const head=await fetch(origin+'/dashboard/'+resource,{method:'HEAD',headers});assert.equal(head.status,200);assert.equal(await head.text(),'');
  }
  assert.equal((await post('roles/create',{name:'HTTP'})).status,403);
  assert.equal((await post('roles/create',{_csrf:'csrf',name:'HTTP'},{origin:'https://evil.test'})).status,403);
  assert.equal((await post('roles/create',{_csrf:'csrf',name:'HTTP',perm_1:'1'})).status,303);
  const detail=await get('audit-logs/'+log.id+'/view');assert.doesNotMatch(await detail.text(),/Password-baru|fixture-hash|remember_token/);
  assert.equal((await post('audit-logs/delete',{_csrf:'csrf',id_1:'1'})).status,404);
  if(process.env.ADMIN_UI) {
   const {default:puppeteer}=await import('puppeteer-core');browser=await puppeteer.launch({executablePath:process.env.PDF_CHROME_PATH || '/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
   const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.setCookie({name:'alyusro_node_session',value:raw,url:origin});
   const output=new URL('../storage/auth-preview/',import.meta.url);await mkdir(output,{recursive:true});
   for(const width of [1440,390])for(const theme of ['light','dark'])for(const resource of ['users','roles','audit-logs']) {
    await page.setViewport({width,height:900});await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:theme}]);
    for(const suffix of ['','?q=empty-fixture']) {
     const response=await page.goto(origin+'/dashboard/'+resource+suffix,{waitUntil:'networkidle0'});assert.equal(response.status(),200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
     await page.screenshot({path:fileURLToPath(new URL(`admin-${resource}-${theme}-${width}${suffix?'-empty':''}.png`,output)),fullPage:true});
    }
    const path=resource==='audit-logs'?`audit-logs/${log.id}/view`:resource+'/create';
    await page.goto(origin+'/dashboard/'+path,{waitUntil:'networkidle0'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   }
   await page.goto(origin+'/dashboard/roles/create',{waitUntil:'networkidle0'});await page.type('[name=name]','Browser role');await page.click('[name=perm_1]');
   await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),page.click('.status-note-form button')]);
   const [[submitted]]=await c.execute("SELECT id FROM roles WHERE name='Browser role'");assert.ok(submitted.id);
   assert.deepEqual(errors,[]);
  }
  assert.equal((await call('users','bulk-role',{data:{id_2:'1',role_id:'1'}})).status,303);
  assert.equal((await call('roles','delete',{id:String(role.id),data:{confirm:'HAPUS'}})).status,303);
  assert.equal((await call('users','bulkDelete',{data:{['id_'+created.id]:'1'}})).status,303);
  const [[deleted]]=await c.execute('SELECT COUNT(*) AS n FROM model_has_roles WHERE model_id=? AND model_type=?',[created.id,modelType]);assert.equal(deleted.n,0);
  access.permissions=[];for(const resource of ['users','roles','audit-logs'])assert.equal((await get(resource)).status,403);
 }finally{
  if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  for(const table of tables)await c.query(`DROP TEMPORARY TABLE IF EXISTS ${table}`);c.release();
 }
});
test.after(()=>pool.end());
