import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir,mkdtemp,rm,mkdir,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL,fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import http from 'node:http';
import sharp from 'sharp';
import ExcelJS from 'exceljs';
import { pool } from '../src/db.js';
import { createDashboardMasters } from '../src/dashboard-masters.js';
import { createStudentsAdmin } from '../src/students-admin.js';
import { createWaliFiles } from '../src/wali-files.js';
import { createAuthHandler } from '../src/auth.js';
import { importHeaders } from '../src/master-imports.js';
import { studentCardIdentity } from '../src/student-card.js';

test('Santri: CRUD, filter, impor NIK atomik, aksi massal, berkas, kartu, scope dan audit SQL/HTTP',async()=>{
 const c=await pool.getConnection(),tables=['users','kelas','program_pendidikans','santris','foto_santris','status_catatan','audit_logs','ijazahs','ijazah_darul_ilmis','ijazah_mahad_alies','sabaq'];
 const folder=await mkdtemp(join(tmpdir(),'alyusro-students-')),root=pathToFileURL(folder+'/');let server,browser;
 try {
  const directory=new URL('../../database/migrations/',import.meta.url),filenames=await readdir(directory);
  for(const table of tables){const source=await readFile(new URL(filenames.find(file=>file.endsWith(`_create_${table}_table.php`)),directory),'utf8');await c.query(source.match(/CREATE TABLE[\s\S]*?ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci/)[0].replace('CREATE TABLE','CREATE TEMPORARY TABLE'));}
  await c.execute("INSERT INTO users(id,name,email,password) VALUES(1,'Penguji','fixture@fixture.test','fixture')");
  await c.execute("INSERT INTO program_pendidikans(id,nama_program,deskripsi,list_target) VALUES(1,'Program fixture','deskripsi','target')");
  await c.execute("INSERT INTO kelas(id,nama_kelas,id_program_pendidikan) VALUES(1,'Kelas satu',1),(2,'Kelas dua',1)");
  const db={getConnection:async()=>({execute:(...args)=>c.execute(...args),beginTransaction:()=>c.beginTransaction(),commit:()=>c.commit(),rollback:()=>c.rollback(),release(){}})};
  const masters=createDashboardMasters(db),studentAdmin=createStudentsAdmin(db,root),files=createWaliFiles(db,root);
  const user={id:1,name:'Penguji',password:'fixture'},access={roles:['Penguji'],permissions:['view_any','view','create','update','delete_any'].map(action=>action+'_santri')};
  const raw='f'.repeat(64),hash=value=>createHash('sha256').update(value).digest('hex'),session={id:hash(raw),user_id:1,password_hash:hash(user.password),csrf:'csrf'};
  const store={session:async()=>session,user:async()=>user,access:async()=>access,touch:async()=>{}};
  const handler=createAuthHandler({store,masters,studentAdmin,files,auditEnabled:true});
  const {server:assets}=await import('../src/server.js');
  server=http.createServer(async(req,res)=>{if(!await handler(req,res,new URL(req.url,'http://localhost').pathname))assets.emit('request',req,res);});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`,base=origin+'/dashboard/santri',headers={cookie:'alyusro_node_session='+raw};
  const get=path=>fetch(base+path,{headers,redirect:'manual'}),post=(path,data,extra={})=>fetch(base+path,{method:'POST',headers:{...headers,origin,...extra},body:new URLSearchParams(data),redirect:'manual'});
  const sample={nama:'100% <Santri>',nama_arab:'طالب',jenis_kelamin:'Laki-laki',nis:'N1',nik:'1234567890123456',tempat_lahir:'Bogor',tanggal_lahir:'1',bulan_lahir:'1',tahun_lahir:'2010',jenjang:'Madrasah',status:'santri',kelas_id:'1',email:'student@fixture.test',no_kk:'123'};
  assert.equal((await post('/create',sample)).status,403);
  assert.equal((await post('/create',{...sample,_csrf:'csrf'},{origin:'https://evil.test'})).status,403);
  assert.equal((await post('/create',{_csrf:'csrf'})).status,422);
  assert.equal((await post('/create',{...sample,kelas_id:'999',_csrf:'csrf'})).status,422);
  const response=await post('/create',{...sample,_csrf:'csrf'});assert.equal(response.status,303,await response.text());
  assert.equal((await post('/create',{...sample,nama:'Lain',nis:'N2',nik:'9999999999999999',_csrf:'csrf'})).status,303);
  const [[row]]=await c.execute('SELECT * FROM santris WHERE nis=?',['N1']);assert.equal(row.nama,sample.nama);assert.equal(row.pengampu_tahfizh_id,null);
  assert.deepEqual(await (await get('/'+row.id+'/status')).json(),{status:'santri'});
  const savedPermissions=[...access.permissions];access.permissions=['view_any_santri::wali'];user.nomor_kk='123';
  assert.equal((await get('/'+row.id+'/status')).status,200);user.nomor_kk='456';assert.equal((await get('/'+row.id+'/status')).status,404);user.nomor_kk='';assert.equal((await get('/'+row.id+'/status')).status,404);access.permissions=savedPermissions;
  const listing=await get('?q=%25&kelas_id=1&jenjang=madrasah');assert.equal(listing.status,200);assert.match(await listing.text(),/100% &lt;Santri&gt;/);
  const form=await get('/'+row.id+'/edit');assert.match(await form.text(),/Kelas satu - Program fixture/);
  const exported=await get('?q=%25&export=xlsx');const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(await exported.arrayBuffer()));assert.equal(workbook.worksheets[0].rowCount,2);assert.equal(workbook.worksheets[0].getCell('A2').value,sample.nama);
  assert.equal((await post('/'+row.id+'/edit',{...sample,kelas_id:'2',nama:'Diperbarui',_csrf:'csrf'})).status,303);
  assert.equal((await post('/bulk-class',{['id_'+row.id]:'1',_csrf:'csrf'})).status,200);
  assert.equal((await post('/bulk-class',{['id_'+row.id]:'1',kelas_id:'1',_csrf:'csrf'})).status,303);
  assert.equal((await post('/bulk-status',{['id_'+row.id]:'1',status:'lulus',_csrf:'csrf'})).status,303);
  const selected=await post('/bulk-export',{['id_'+row.id]:'1',_csrf:'csrf'});const selectedBook=new ExcelJS.Workbook();await selectedBook.xlsx.load(Buffer.from(await selected.arrayBuffer()));assert.equal(selectedBook.worksheets[0].rowCount,2);
  const template=await get('/template');const imported=new ExcelJS.Workbook();await imported.xlsx.load(Buffer.from(await template.arrayBuffer()));assert.equal(imported.worksheets[0].columnCount,80);
  const headersList=importHeaders('santri'),sheet=imported.worksheets[0];
  sheet.addRow(headersList.map(key=>({nik:sample.nik,nama:'Impor parsial',nis:'DIABAIKAN'}[key] || '')));
  const upload=async bytes=>{const form=new FormData();form.set('_csrf','csrf');form.set('workbook',new Blob([bytes]),'santri.xlsx');return fetch(base+'/import',{method:'POST',headers:{...headers,origin},body:form,redirect:'manual'});};
  assert.equal((await upload(Buffer.from(await imported.xlsx.writeBuffer()))).status,303);
  const [[partial]]=await c.execute('SELECT * FROM santris WHERE id=?',[row.id]);assert.equal(partial.nama,'Impor parsial');assert.equal(partial.nis,'N1');assert.equal(partial.email,sample.email);assert.equal(partial.status,'lulus');
  sheet.getCell('A2').value='Harus rollback';sheet.addRow(headersList.map(key=>key==='nik'?'1111111111111111':''));
  assert.equal((await upload(Buffer.from(await imported.xlsx.writeBuffer()))).status,422);const [[rolled]]=await c.execute('SELECT nama FROM santris WHERE id=?',[row.id]);assert.equal(rolled.nama,'Impor parsial');
  sheet.getCell('A3').value={formula:'1+1',result:2};assert.equal((await upload(Buffer.from(await imported.xlsx.writeBuffer()))).status,422);
  const image=await sharp({create:{width:30,height:40,channels:3,background:'blue'}}).png().toBuffer();
  const photoForm=new FormData();photoForm.set('_csrf','csrf');photoForm.set('avatar',new Blob([image]),'photo.png');
  const uploaded=await fetch(base+'/'+row.id+'/berkas/foto/upload',{method:'POST',headers:{...headers,origin},body:photoForm,redirect:'manual'});assert.equal(uploaded.status,303,await uploaded.text());
  assert.equal((await get('/'+row.id+'/berkas/foto')).status,200);assert.equal((await get('/'+row.id+'/berkas/foto/delete')).status,405);
  assert.equal((await get('/'+row.id+'/documents')).status,200);
  const card=await get('/'+row.id+'/card');assert.equal(card.status,200);const bytes=Buffer.from(await card.arrayBuffer()),metadata=await sharp(bytes).metadata();assert.equal(metadata.format,'png');assert.ok(metadata.width>1000);
  assert.equal(studentCardIdentity({jenjang:"Darul 'Ilmi",nis:'old',nis_darul_ilmi:'DI1',jenis_kelamin:'Perempuan'}).number,'DI1');
  const output=new URL('../storage/auth-preview/',import.meta.url);await mkdir(output,{recursive:true});await writeFile(new URL('student-card.png',output),bytes);
  if(process.env.STUDENT_UI){
   const {default:puppeteer}=await import('puppeteer-core');browser=await puppeteer.launch({executablePath:process.env.PDF_CHROME_PATH || '/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.setCookie({name:'alyusro_node_session',value:raw,url:origin});
   for(const width of [1440,390])for(const theme of ['light','dark']){
    await page.setViewport({width,height:900});await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:theme}]);
    for(const path of ['', '?q=empty-fixture','/create','/'+row.id+'/edit','/'+row.id+'/documents']){const response=await page.goto(base+path,{waitUntil:'networkidle0'});assert.equal(response.status(),200,path);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,path);await page.screenshot({path:fileURLToPath(new URL(`student-${theme}-${width}-${path.replaceAll(/[^a-z0-9]/g,'')||'list'}.png`,output)),fullPage:true});}
   }
   assert.deepEqual(errors,[]);
  }
  const [[audit]]=await c.execute("SELECT COUNT(*) AS n FROM audit_logs WHERE table_name='santris' AND action='UPDATE'");assert.ok(audit.n>=4);
  await c.execute("INSERT INTO sabaq (santri_id,index_quran_id,tanggal,status) VALUES (?,1,'2026-10-27','lulus')",[row.id]);
  assert.equal((await post('/delete',{['id_'+row.id]:'1',_csrf:'csrf'})).status,422);
  await c.execute('DELETE FROM sabaq');assert.equal((await post('/delete',{['id_'+row.id]:'1',_csrf:'csrf'})).status,303);
  const [[photos]]=await c.execute('SELECT COUNT(*) AS n FROM foto_santris WHERE santri_id=?',[row.id]);assert.equal(photos.n,0);
  const head=await fetch(base,{method:'HEAD',headers});assert.equal(head.status,200);assert.equal(await head.text(),'');
  access.permissions=['view_any_santri::wali'];
  for(const path of ['','/create','/1/edit','/1/documents','/1/card','/1/berkas/foto'])assert.equal((await get(path)).status,403,path);
 }finally{if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}for(const table of tables)await c.query(`DROP TEMPORARY TABLE IF EXISTS ${table}`);c.release();await rm(folder,{recursive:true,force:true});}
});
test.after(()=>pool.end());
