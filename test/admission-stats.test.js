import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdmissionStats} from '../src/admission-stats.js';
import {pool} from '../src/db.js';
const access={permissions:['widget_JumlahPsbSantriMadrasah']};
test('permission dan filter tidak valid tidak membaca database',async()=>{
 const stats=createAdmissionStats(()=>{throw Error('SQL dilarang');});
 assert.equal(await stats({permissions:[]}), '');
 for(const q of ['psb_year=<script>','psb_wave=0','psb_wave=1 OR 1=1','psb_year=2026&psb_year=2025'])assert.match(await stats(access,new URLSearchParams(q)),/Filter penerimaan tidak valid/);
});
test('SQL rekap penerimaan terisolasi: default terbaru, tahun, gelombang, status, jenjang dan nol',async()=>{
 const c=await pool.getConnection();
 try{
 await c.query('CREATE TEMPORARY TABLE penerimaan_santris(id BIGINT, kode_gelombang VARCHAR(255))');
 await c.query('CREATE TEMPORARY TABLE santris(jenjang VARCHAR(255), status VARCHAR(255), jenis_kelamin VARCHAR(255), penerimaan_santri_id BIGINT)');
 await c.query("INSERT INTO penerimaan_santris VALUES (1,'MD-2025-01'),(2,'MD-2026-01'),(3,'DI-2026-01'),(4,'MD-2026-02')");
 await c.query("INSERT INTO santris VALUES ('madrasah','diterima','Laki-laki',4),('madrasah','diterima','Perempuan',4),('madrasah','diterima','Laki-laki',2),('madrasah','diterima','Perempuan',1),('madrasah','diterima','Perempuan',3),('taud','diterima','Perempuan',4),('madrasah','santri','Perempuan',4)");
 const stats=createAdmissionStats(async(sql,args)=>(await c.execute(sql,args))[0]);
 const initial=await stats(access);assert.match(initial, /value="4" selected/);assert.match(initial, /<th scope="row">diterima<\/th><td>1<\/td><td>1<\/td><td>2<\/td>/);
 const all=await stats(access,new URLSearchParams('psb_year=&psb_wave='));assert.match(all,/<th scope="row">Total<\/th><td>2<\/td><td>2<\/td><td>4<\/td>/);
 const year=await stats(access,new URLSearchParams('psb_year=2025&psb_wave='));assert.match(year,/<th scope="row">Total<\/th><td>0<\/td><td>1<\/td><td>1<\/td>/);
 for(const q of ['psb_year=2025&psb_wave=4','psb_wave=3','psb_year=1999'])assert.match(await stats(access,new URLSearchParams(q)),/Filter penerimaan tidak valid/);
 await c.query('DELETE FROM santris');await c.query('DELETE FROM penerimaan_santris');
 assert.match(await stats(access),/<th scope="row">Total<\/th><td>0<\/td><td>0<\/td><td>0<\/td>/);
 }finally{await c.query('DROP TEMPORARY TABLE IF EXISTS santris');await c.query('DROP TEMPORARY TABLE IF EXISTS penerimaan_santris');c.release();}
});
test.after(()=>pool.end());
