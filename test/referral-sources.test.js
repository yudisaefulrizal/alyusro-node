import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.js';
import { createReferralSources,slugFor } from '../src/referral-sources.js';
const access={permissions:['view_any_referral::source','create_referral::source','update_referral::source','delete_any_referral::source']};
test('sumber informasi: CRUD, jumlah santri, validasi dan permission pada SQL TEMPORARY',async()=>{
 const c=await pool.getConnection();
 try{
  await c.query('CREATE TEMPORARY TABLE referral_sources (id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(100) NOT NULL,slug VARCHAR(100) UNIQUE,description VARCHAR(255),created_at DATETIME,updated_at DATETIME)');
  await c.query('CREATE TEMPORARY TABLE santris (id INT PRIMARY KEY,referral_source_id INT)');
  const referrals=createReferralSources({getConnection:async()=>({execute:(...args)=>c.execute(...args),release(){}})});
  const call=(action,extra={})=>referrals({access,action,csrf:'csrf',...extra});
  for(const action of ['list','create','edit','delete'])assert.equal((await call(action,{access:{permissions:[]},id:'1'})).status,403);
  assert.equal(slugFor('Keluarga & Teman'),'keluarga-teman');assert.equal(slugFor('École'),'ecole');
  assert.equal((await call('create',{data:{name:'',description:''}})).status,422);
  assert.equal((await call('create',{data:{name:'100% Teman',description:'<script>tes</script>'}})).status,303);
  assert.equal((await call('create',{data:{name:'100 Teman'}})).status,422);
  await c.query('INSERT INTO santris VALUES (1,1),(2,1),(3,NULL)');
  const list=await call('list',{params:new URLSearchParams('q=%25&sort=santris_count&direction=desc')});assert.match(list.body,/100% Teman/);assert.match(list.body,/<td data-column="1">2<\/td>/);assert.match(list.body,/mengosongkan sumber informasi/);
  assert.match((await call('list',{params:new URLSearchParams('jumlah=ada')})).body,/100% Teman/);
  assert.doesNotMatch((await call('list',{params:new URLSearchParams('jumlah=kosong')})).body,/<td data-column="0">100% Teman/);
  assert.equal((await call('list',{params:new URLSearchParams('jumlah=invalid')})).status,422);
  assert.doesNotMatch((await call('list',{params:new URLSearchParams('q=_')})).body,/100% Teman/);
  assert.equal((await call('list',{params:new URLSearchParams('sort=id%3BDELETE')})).status,422);
  assert.match((await call('edit',{id:'1'})).body,/&lt;script&gt;tes/);
  assert.equal((await call('edit',{id:'9'})).status,404);
  assert.equal((await call('edit',{id:'1',data:{name:'Teman Baru',slug:'palsu',description:'uji'}})).status,303);
  const [[row]]=await c.query('SELECT name,slug FROM referral_sources WHERE id=1');assert.equal(row.name,'Teman Baru');assert.equal(row.slug,'100-teman');
  assert.equal((await call('delete',{data:{_csrf:'csrf'}})).status,422);
  assert.equal((await call('delete',{data:{_csrf:'csrf',id_1:'1',bad:'1'}})).status,422);
  assert.equal((await call('delete',{data:{_csrf:'csrf',id_1:'1'}})).status,303);
  assert.doesNotMatch((await call('list')).body,/Teman Baru/);
 }finally{await c.query('DROP TEMPORARY TABLE IF EXISTS santris, referral_sources');c.release();}
});
test.after(()=>pool.end());
