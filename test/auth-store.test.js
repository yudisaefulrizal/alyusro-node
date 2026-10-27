// Real SQL against connection-local temporary tables; existing accounts stay untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.js';
import { createAuthStore,modelType } from '../src/auth-store.js';
test('SQL autentikasi: akun, role/permission, sesi, rate limit, reset, dan hapus akun',async()=>{
 const c=await pool.getConnection();
 const tables=['users','roles','permissions','model_has_roles','model_has_permissions','role_has_permissions','node_auth_sessions','node_auth_resets','node_auth_limits'];
 try {
  for(const table of tables){
   const [rows]=await c.query(`SHOW CREATE TABLE ${table}`);
   const ddl=rows[0]['Create Table'].replace('CREATE TABLE','CREATE TEMPORARY TABLE').split('\n').filter(line=>!line.includes('FOREIGN KEY')).join('\n').replace(/,\n\)/g,'\n)');
   await c.query(ddl);
  }
  const store=createAuthStore({execute:(...args)=>c.execute(...args),getConnection:async()=>({execute:(...args)=>c.execute(...args),beginTransaction:()=>c.beginTransaction(),commit:()=>c.commit(),rollback:()=>c.rollback(),release:()=>{}})});
  await c.execute("INSERT INTO roles(id,name,guard_name) VALUES(1,'Wali santri','web')");
  await c.execute("INSERT INTO permissions(id,name,guard_name) VALUES(1,'widget_NomorKkWidget','web'),(2,'view_any_user','web'),(3,'wrong_guard','api')");
  await c.execute('INSERT INTO role_has_permissions(role_id,permission_id) VALUES(1,1)');
  const id=await store.register({name:'Wali SQL Uji',email:'sql@example.test',nomor_kk:'1234567890123456',password:'fake-hash-for-sql-test'});
  await c.execute('INSERT INTO model_has_permissions(permission_id,model_type,model_id) VALUES(2,?,?),(3,?,?)',[modelType,id,modelType,id]);
  assert.equal((await store.login('sql@example.test')).id,id);assert.equal((await store.login('1234567890123456')).id,id);
  assert.deepEqual((await store.access(id)).roles,['Wali santri']);assert.deepEqual(new Set((await store.access(id)).permissions),new Set(['widget_NomorKkWidget','view_any_user']));
  await assert.rejects(()=>store.register({name:'Duplicate',email:'sql@example.test',nomor_kk:'42',password:'x'}),{code:'ER_DUP_ENTRY'});
  assert.equal((await store.access(id)).roles.length,1);
  const now=Math.floor(Date.now()/1000),session={id:'a'.repeat(64),user_id:id,csrf:'b'.repeat(64),password_hash:'c'.repeat(64),remember:0,expires_at:now+60,last_activity:now,ip_address:'127.0.0.1',user_agent:'SQL test'};
  await store.putSession(session);assert.equal((await store.session(session.id)).user_id,id);await store.touch(session.id,now+120);assert.equal((await store.sessions(id)).length,1);
  await store.putSession({...session,id:'d'.repeat(64)});await store.revokeOthers(id,session.id);assert.equal((await store.sessions(id)).length,1);
  assert.equal(await store.rate('e'.repeat(64),1),true);assert.equal(await store.rate('e'.repeat(64),1),false);
  await store.profile(id,{name:'Updated',email:'sql@example.test'});await store.kk(id,'42');await store.avatar(id,'fotoProfil/test.webp');assert.equal((await store.user(id)).nomor_kk,'42');
  await store.changePassword(id,'changed-hash','remember');assert.equal((await store.user(id)).password,'changed-hash');
  const user=await store.user(id);assert.equal(await store.createReset(user,'f'.repeat(64)),true);assert.equal(await store.createReset(user,'0'.repeat(64)),false);
  assert.equal(await store.reset(user.email,'0'.repeat(64),'reset-hash','new-remember'),false);assert.equal(await store.reset(user.email,'f'.repeat(64),'reset-hash','new-remember'),true);assert.equal((await store.user(id)).password,'reset-hash');assert.equal((await store.sessions(id)).length,0);assert.equal(await store.reset(user.email,'f'.repeat(64),'x','y'),false);
  await store.deleteUser(id);assert.equal(await store.user(id),undefined);assert.deepEqual(await store.access(id),{roles:[],permissions:[]});
 }finally{for(const table of tables)await c.query(`DROP TEMPORARY TABLE IF EXISTS ${table}`);c.release();await pool.end();}
});
