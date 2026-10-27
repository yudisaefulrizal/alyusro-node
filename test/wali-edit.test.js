import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.js';
import { readFile } from 'node:fs/promises';
import { createWaliEdit } from '../src/wali-edit.js';
import { createWaliRegistration } from '../src/wali-create.js';

const access={permissions:['update_santri::wali']}, user={nomor_kk:'111'};
const data={jenjang:'Madrasah',referral_source_id:'1',nama:'Anak Uji',jenis_kelamin:'Laki-laki',tempat_lahir:'Bogor',tanggal_lahir:'6',bulan_lahir:'12',tahun_lahir:'2012',nik:'1234567890123456',nisn:'12345'};
test('edit wali memakai fixture SQL terisolasi, memvalidasi dan membatasi KK',async()=>{
 const c=await pool.getConnection();
 try{
  const migration=await readFile(new URL('../../database/migrations/2026_10_27_000084_create_santris_table.php',import.meta.url),'utf8');
  const schema=migration.slice(migration.indexOf('CREATE TABLE `santris`'),migration.indexOf('\nSQL\n')).replace('CREATE TABLE','CREATE TEMPORARY TABLE');
  await c.query(schema);
  await c.query('CREATE TEMPORARY TABLE penerimaan_santris (id INT PRIMARY KEY, program_pendidikan_id INT, kode_gelombang VARCHAR(255), status VARCHAR(20), tanggal_mulai DATE, tanggal_selesai DATE)');
  await c.query('CREATE TEMPORARY TABLE program_pendidikans (id INT PRIMARY KEY, nama_program VARCHAR(255))');
  await c.query('CREATE TEMPORARY TABLE referral_sources (id INT PRIMARY KEY, name VARCHAR(255))');
  await c.query("INSERT INTO program_pendidikans VALUES (1,'Madrasah'),(2,\"Darul 'Ilmi\")");
  await c.query("INSERT INTO penerimaan_santris VALUES (1,1,'MD-2026-G1','aktif','2026-01-01','2026-12-31'),(2,2,'DI-2026-G1','aktif','2026-01-01','2026-12-31')");
  await c.query("INSERT INTO referral_sources VALUES (1,'Teman')");
  await c.execute("INSERT INTO santris (id,no_kk,nama,jenis_kelamin,tempat_lahir,tanggal_lahir,bulan_lahir,tahun_lahir,jenjang,status,nik,nisn,referral_source_id,penerimaan_santri_id,nomor_pendaftaran) VALUES (1,'111','Awal','Laki-laki','Bogor','6','12','2012','Madrasah','santri','1234567890123456','12345',1,1,'MD-2026-G1-001'),(2,'222','Rahasia','Laki-laki','Bogor','6','12','2012','Madrasah','santri','9876543210987654','98765',1,1,'MD-2026-G1-002')");
  const db={getConnection:async()=>({execute:(...args)=>c.execute(...args),beginTransaction:()=>c.beginTransaction(),commit:()=>c.commit(),rollback:()=>c.rollback(),release:()=>{}})};
  const edit=createWaliEdit(db,()=>new Date('2026-10-27T00:00:00Z'));
  const register=createWaliRegistration(db,()=>new Date('2026-10-27T00:00:00Z'));
  const create=(extra={})=>register({user,access:{permissions:['create_santri::wali']},csrf:'test',...extra});
  assert.equal((await create({access:{permissions:[]}})).status,403);
  assert.equal((await create({user:{nomor_kk:''}})).status,422);
  const form=await create();assert.equal(form.status,200);assert.match(form.body,/Daftarkan Santri/);
  assert.equal((await create({data:{...data,nik:'bad'}})).status,422);
  assert.equal((await create({data:{...data,jenjang:'Tidak aktif'}})).status,422);
  assert.equal((await create({data})).status,422);
  const newData={...data,nama:'Pendaftar Baru',nik:'1111222233334444',nisn:'56789',no_kk:'222',status:'diterima',nomor_pendaftaran:'PALS U'};
  assert.equal((await create({data:newData})).status,303);
  const [[created]]=await c.execute('SELECT no_kk,status,nomor_pendaftaran,penerimaan_santri_id FROM santris WHERE nik=?',[newData.nik]);
  assert.equal(created.no_kk,'111');assert.equal(created.status,'belum terverifikasi');assert.equal(created.nomor_pendaftaran,'MD-2026-G1-003');assert.equal(created.penerimaan_santri_id,1);
  assert.equal((await create({data:newData})).status,422);
  await c.query("UPDATE penerimaan_santris SET status='nonaktif'");
  assert.equal((await create({data:{...newData,nik:'1111222233335555',nisn:'56780'}})).status,422);
  await c.query("UPDATE penerimaan_santris SET status='aktif'");

  const call=(extra={})=>edit({user,access,id:'1',csrf:'test',...extra});
  assert.equal((await call({access:{permissions:[]}})).status,403);
  assert.equal((await call({id:'2'})).status,404);
  assert.equal((await call({user:{nomor_kk:''}})).status,404);
  assert.match((await call()).body,/Nama Lengkap Santri/);
  assert.equal((await call({data:{...data,nik:'salah'}})).status,422);
  assert.equal((await call({data:{...data,nik:'9876543210987654'}})).status,422);
  assert.equal((await call({data:{...data,jenjang:'Tidak aktif'}})).status,422);
  assert.equal((await call({data:{...data,nama:'<script>',status:'diterima',no_kk:'222'}})).status,303);
  const [[row]]=await c.query('SELECT nama,no_kk,status FROM santris WHERE id=1');assert.equal(row.nama,'<script>');assert.equal(row.no_kk,'111');assert.equal(row.status,'santri');
  assert.match((await call()).body,/&lt;script&gt;/);
  assert.equal((await call({data:{...data,jenjang:"Darul 'Ilmi"}})).status,303);
  const [[updated]]=await c.query('SELECT jenjang,status,penerimaan_santri_id,nomor_pendaftaran FROM santris WHERE id=1');
  assert.equal(updated.jenjang,"Darul 'Ilmi");assert.equal(updated.status,'belum terverifikasi');assert.equal(updated.penerimaan_santri_id,2);assert.equal(updated.nomor_pendaftaran,'DI-2026-G1-001');
 }finally{await c.query('DROP TEMPORARY TABLE IF EXISTS santris, penerimaan_santris, program_pendidikans, referral_sources');c.release();}
});
test.after(()=>pool.end());
