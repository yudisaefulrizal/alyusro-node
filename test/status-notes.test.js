import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.js';
import { createStatusNotes } from '../src/status-notes.js';
import ExcelJS from 'exceljs';
const access={permissions:['view_any_status::catatan','create_status::catatan','update_status::catatan','delete_any_status::catatan']};
const data={status:'Diterima',pesan_whatsapp:'Halo {nama} {nomor}',label_tombol:'Hubungi',nomor_wa:'628123456789',catatan:'<script>uji</script>'};
test('tanggal status ditampilkan dan diekspor tanpa perubahan zona waktu',async()=>{
 const rows=[{id:1,status:'Diterima',label_tombol:'Hubungi',nomor_wa:'628123456789',updated_at:'2026-10-27 08:05:59',table_total:1}];
 const notes=createStatusNotes({getConnection:async()=>({execute:async()=>[rows],release(){}})});
 const list=await notes({access});
 assert.match(list.body,/27 Oct 2026 08:05/);
 assert.doesNotMatch(list.body,/2026-10-27 08:05:59/);
 const exportResult=await notes({access,params:new URLSearchParams('export=xlsx')});
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(exportResult.xlsx);
 assert.equal(workbook.getWorksheet('Data').getCell('D2').value,'27 Oct 2026 08:05');
});
test('status catatan: daftar, validasi, permission, perubahan dan hapus massal memakai SQL TEMPORARY',async()=>{
 const c=await pool.getConnection();
 try{
  await c.query('CREATE TEMPORARY TABLE status_catatan (id INT AUTO_INCREMENT PRIMARY KEY,status VARCHAR(255) UNIQUE,pesan_whatsapp TEXT NOT NULL,label_tombol VARCHAR(255) NOT NULL,nomor_wa VARCHAR(255) NOT NULL,catatan TEXT,created_at DATETIME,updated_at DATETIME)');
  const notes=createStatusNotes({getConnection:async()=>({execute:(...args)=>c.execute(...args),release(){}})});
  const call=(action,extra={})=>notes({access,action,csrf:'test',...extra});
  for(const action of ['list','create','edit','delete'])assert.equal((await call(action,{access:{permissions:[]},id:'1'})).status,403);
  assert.equal((await call('create',{data:{...data,nomor_wa:'javascript:alert(1)'}})).status,422);
  assert.equal((await call('create',{data:{...data,status:''}})).status,422);
  assert.equal((await call('create',{data})).status,303);
  assert.equal((await call('create',{data})).status,422);
  const form=await call('edit',{id:'1'});assert.match(form.body,/&lt;script&gt;uji/);assert.doesNotMatch(form.body,/<script>/);
  assert.equal((await call('edit',{id:'2'})).status,404);
  assert.equal((await call('edit',{id:'1',data:{...data,status:'100%',nomor_wa:'https://chat.whatsapp.com/example'}})).status,303);
  assert.match((await call('list',{params:new URLSearchParams('q=%25')})).body,/100%/);
  assert.doesNotMatch((await call('list',{params:new URLSearchParams('q=_')})).body,/100%/);
  assert.equal((await call('list',{params:new URLSearchParams('sort=id%3BDELETE')})).status,422);
  assert.equal((await call('delete',{data:{_csrf:'x'}})).status,422);
  assert.equal((await call('delete',{data:{_csrf:'x',id_1:'1',bad:'1'}})).status,422);
  assert.equal((await call('delete',{data:{_csrf:'x',id_1:'1'}})).status,303);
  assert.doesNotMatch((await call('list')).body,/100%/);
 }finally{await c.query('DROP TEMPORARY TABLE IF EXISTS status_catatan');c.release();}
});
test.after(()=>pool.end());
