import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile,readdir,mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import { pool } from '../src/db.js';
import { createIntegrationApi } from '../src/integration-api.js';
import { diplomaDefinitions } from '../src/diploma-resources.js';

test('API kompatibilitas: API key, dokumen bertanda tangan, kamus/batch, ekspor n8n, kartu NIS dan verifikasi',async()=>{
 const c=await pool.getConnection(),tables=['santris','foto_santris','penerimaan_santris','dokumens','perpustakaan_namas','audit_logs',...Object.values(diplomaDefinitions).map(config=>config.table)];
 const folder=await mkdtemp(join(tmpdir(),'alyusro-integration-')),root=pathToFileURL(folder+'/');let server;
 try{
  const directory=new URL('../../database/migrations/',import.meta.url),filenames=await readdir(directory);
  for(const table of tables){const source=await readFile(new URL(filenames.find(file=>file.endsWith(`_create_${table}_table.php`)),directory),'utf8');await c.query(source.match(/CREATE TABLE[\s\S]*?ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci/)[0].replace('CREATE TABLE','CREATE TEMPORARY TABLE'));}
  await c.execute("INSERT INTO penerimaan_santris(id,program_pendidikan_id,tahun,gelombang,kode_gelombang,tanggal_mulai,tanggal_selesai,tanggal_tes,biaya_pendaftaran) VALUES(1,1,'2026',1,'MD-2026-1','2026-01-01','2026-12-31','2026-10-27',0)");
  await c.execute("INSERT INTO santris(nama,jenis_kelamin,tempat_lahir,tanggal_lahir,bulan_lahir,tahun_lahir,jenjang,status,nis,nisn,nik,no_kk,email,rt,rw,penerimaan_santri_id) VALUES ('AHMAD <UJI>','Laki-laki','Bogor','1','1','2010','Madrasah','Menunggu','00001','00123','0012345678901234','0012345678901234','USER@FIXTURE.TEST','1','02',1),('Tidak Diekspor','Laki-laki','Bogor','1','1','2010','Madrasah','Santri','00002',NULL,NULL,NULL,NULL,NULL,NULL,1)");
  await c.execute("INSERT INTO perpustakaan_namas(nama_latin,nama_arab,status) VALUES ('ahmad','أحمد','2')");
  const db={getConnection:async()=>({execute:(...args)=>c.execute(...args),beginTransaction:()=>c.beginTransaction(),commit:()=>c.commit(),rollback:()=>c.rollback(),release(){}})};let timestamp=1800000000,api;
  server=http.createServer(async(req,res)=>{if(!await api(req,res,new URL(req.url,'http://localhost').pathname,new URL(req.url,'http://localhost').searchParams)){res.writeHead(404);res.end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
  api=createIntegrationApi(db,{exportKey:'fixture-export',documentKey:'fixture-document',libraryKey:'fixture-library',signingKey:'fixture-signing-key',root,studentsRoot:root,now:()=>timestamp,origin});
  const get=(path,key)=>fetch(origin+path,{headers:key?{'x-api-key':key}:{}}),json=(path,method,data,key)=>fetch(origin+path,{method,headers:{'x-api-key':key,'content-type':'application/json'},body:JSON.stringify(data)});
  for(const [path,key] of [['/api/perpustakaan-nama','fixture-library'],['/api/dokumen/search?nama=test','fixture-document'],['/api/export/calon-santri?tahun=2026&jenjang=Madrasah','fixture-export']])assert.equal((await get(path,'wrong')).status,403);
  const created=await json('/api/perpustakaan-nama','POST',{nama_latin:'Nama <baru>',nama_arab:'جديد',status:'1'},'fixture-library');assert.equal(created.status,201);const entry=await created.json();
  assert.equal((await get('/api/perpustakaan-nama/'+entry.id,'fixture-library')).status,200);
  assert.equal((await json('/api/perpustakaan-nama','POST',{nama_latin:'invalid'},'fixture-library')).status,422);
  assert.equal((await json('/api/perpustakaan-nama/'+encodeURIComponent('Nama <baru>'),'PUT',['Nama baru','محدث','2'],'fixture-library')).status,200);
  assert.equal((await get('/api/perpustakaan-nama?q=Nama','fixture-library')).status,200);
  const deleted=await fetch(origin+'/api/perpustakaan-nama/'+encodeURIComponent('Nama baru'),{method:'DELETE',headers:{'x-api-key':'fixture-library'}});assert.equal(deleted.status,200);
  const book=new ExcelJS.Workbook();book.addWorksheet('Nama').addRows([['Nama'],['Ahmad baru']]);
  const batchForm=()=>{const form=new FormData();return form;};
  const batch=batchForm();batch.set('file',new Blob([Buffer.from(await book.xlsx.writeBuffer())]),'nama.xlsx');
  const converted=await fetch(origin+'/api/konversi-nama-latin-to-arabic-batch',{method:'POST',headers:{'x-api-key':'fixture-library'},body:batch});assert.equal(converted.status,200);assert.deepEqual((await converted.json()).nama_arab,['أحمد baru Belum terdefinisi']);
  const upload=new FormData();upload.set('nama','Dokumen Uji');upload.set('file',new Blob(['Dokumen fixture biasa']),'uji.txt');
  const response=await fetch(origin+'/api/dokumen/upload',{method:'POST',headers:{'x-api-key':'fixture-document'},body:upload});assert.equal(response.status,200);const document=await response.json();
  const download=await fetch(document.data.download);assert.equal(download.status,200);assert.equal(download.headers.get('cache-control'),'no-store');assert.equal(await download.text(),'Dokumen fixture biasa');
  const tampered=new URL(document.data.download);tampered.searchParams.set('signature','0'.repeat(64));assert.equal((await fetch(tampered)).status,403);
  const expired=new URL(document.data.download);timestamp+=3601;assert.equal((await fetch(expired)).status,403);timestamp-=3601;
  const search=await get('/api/dokumen/search?nama=Dokumen','fixture-document');const found=await search.json();assert.equal(found.data.id,document.data.id);assert.ok(found.data.preview.includes('signature='));
  const exported=await get('/api/export/calon-santri?tahun=2026&jenjang=Madrasah','fixture-export'),excel=new ExcelJS.Workbook();assert.equal(exported.status,200);await excel.xlsx.load(Buffer.from(await exported.arrayBuffer()));const sheet=excel.worksheets[0];assert.equal(sheet.rowCount,2);assert.equal(sheet.columnCount,46);assert.equal(sheet.getCell('E2').value,'00001');assert.equal(sheet.getCell('F2').value,'00123');assert.equal(sheet.getCell('P2').value,'002');assert.ok(sheet.getRow(2).values.includes('user@fixture.test'));assert.ok(!sheet.getRow(2).values.includes('Tidak Diekspor'));
  assert.equal((await get('/api/export/calon-santri?tahun=bad&jenjang=Madrasah','fixture-export')).status,422);
  const n8n=await get('/api/export/calon-santri/n8n?tahun=2026&jenjang=Madrasah','fixture-export');assert.equal(n8n.status,200);const saved=await n8n.json();const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(await (await fetch(saved.data.download)).arrayBuffer()));assert.equal(workbook.worksheets[0].rowCount,2);
  const card=await get('/api/cetak/kartu-santri/nis/00001','fixture-export');assert.equal(card.status,200);const cardData=await card.json();assert.equal(cardData.status,true);assert.equal(cardData.data.nis,'00001');const cardFile=await fetch(cardData.data.download);assert.equal((await sharp(Buffer.from(await cardFile.arrayBuffer())).metadata()).format,'png');
  assert.equal((await get('/api/cetak/kartu-santri/nis/missing','fixture-export')).status,404);
  const config=diplomaDefinitions.ijazah,keys=['santri_id','event_id','nomor_ijazah',...config.grades,'verifikasi_kepala_sekolah','verifikasi_mudir'];await c.execute(`INSERT INTO ijazahs (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`,[1,1,'MATHA-MD-2026-001',...config.grades.map(()=>80),1,1]);
  const verified=await get('/mathaapp/ijazah/cek/MATHA-MD-2026-001');assert.equal(verified.status,200);const text=await verified.text();assert.match(text,/Ijazah terverifikasi/);assert.doesNotMatch(text,/0012345678901234|USER@/);
  await c.execute('UPDATE ijazahs SET verifikasi_mudir=0 WHERE id=1');assert.equal((await get('/mathaapp/ijazah/cek/MATHA-MD-2026-001')).status,404);
  const [[logs]]=await c.execute("SELECT COUNT(*) AS n FROM audit_logs WHERE actor_type='SYSTEM'");assert.ok(logs.n>=5);
 }finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}for(const table of tables)await c.query(`DROP TEMPORARY TABLE IF EXISTS ${table}`);c.release();await rm(folder,{recursive:true,force:true});}
});
test.after(()=>pool.end());
