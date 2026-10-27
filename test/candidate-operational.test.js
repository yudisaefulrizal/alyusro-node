import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { readdir, readFile, mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import sharp from 'sharp';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { pool } from '../src/db.js';
import { createCandidates } from '../src/candidates.js';
import { createWaliFiles } from '../src/wali-files.js';
import { createAuthHandler } from '../src/auth.js';
import { candidateFormHtml } from '../src/candidate-form.js';

test('Calon Santri: SQL/HTTP nyata, berkas, formulir PDF, filter dan permission', async () => {
 const c = await pool.getConnection(), tables = ['santris','foto_santris','status_catatan','penerimaan_santris','ijazahs','ijazah_darul_ilmis','ijazah_mahad_alies','sabaq'];
 const folder = await mkdtemp(join(tmpdir(),'alyusro-candidate-')), root = pathToFileURL(folder + '/');
 let server, browser;
 try {
  const directory = new URL('../../database/migrations/',import.meta.url), files = await readdir(directory);
  for (const table of tables) {
   const source = await readFile(new URL(files.find(f => f.endsWith(`_create_${table}_table.php`)),directory),'utf8');
   await c.query(source.match(/CREATE TABLE[\s\S]*?ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci/)[0].replace('CREATE TABLE','CREATE TEMPORARY TABLE'));
  }
  await c.execute("INSERT INTO santris (id,nama,nomor_pendaftaran,no_kk,jenis_kelamin,tempat_lahir,tanggal_lahir,bulan_lahir,tahun_lahir,jenjang,status,created_at,foto_surat_komitment_darul_ilmi,foto_ijazah_smp) VALUES (1,'Ahmad <Uji>','REG-1','123','Laki-laki','Bogor','1','1','2010',\"Darul 'Ilmi\",'Menunggu','2026-10-27 10:00:00','image.jpg','image.jpg'),(2,'Rahasia','REG-2','456','Laki-laki','Bogor','1','1','2010','Madrasah','Santri','2026-10-27 10:00:00',NULL,NULL)");
  await c.execute("INSERT INTO status_catatan (status,pesan_whatsapp,label_tombol,nomor_wa) VALUES ('Menunggu','','',''),('diterima','','','')");
  const image = await sharp({create:{width:30,height:40,channels:3,background:'blue'}}).jpeg().toBuffer();
  await writeFile(join(folder,'image.jpg'),image);
  await c.execute("INSERT INTO foto_santris (santri_id,path) VALUES (1,'image.jpg')");
  const db = {getConnection:async()=>({ execute:(...args)=>c.execute(...args),beginTransaction:()=>c.beginTransaction(),commit:()=>c.commit(),rollback:()=>c.rollback(),release(){} })};
  const candidatesHandler = createCandidates(db,root), filesHandler = createWaliFiles(db,root);
  const access = {roles:['Penguji'],permissions:['view_any_calon::santri','update_calon::santri']};
  const user = {id:1,name:'Penguji',password:'fixture'}, raw = 'd'.repeat(64), hash = v => createHash('sha256').update(v).digest('hex');
  const session = {id:hash(raw),user_id:1,password_hash:hash(user.password),csrf:'csrf'};
  const store = {session:async()=>session,user:async()=>user,access:async()=>access,touch:async()=>{}};
  const handler = createAuthHandler({store,candidatesHandler,files:filesHandler});
  const {server:assets} = await import('../src/server.js');
  server = http.createServer(async(req,res)=>{if(!await handler(req,res,new URL(req.url,'http://localhost').pathname))assets.emit('request',req,res);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin = `http://127.0.0.1:${server.address().port}`, base = origin + '/dashboard/calon-santri', headers = {cookie:'alyusro_node_session='+raw};
  const get = path=>fetch(base+path,{headers,redirect:'manual'});
  const list = await get(''); assert.equal(list.status,200); const html = await list.text(); assert.match(html,/Ahmad &lt;Uji&gt;/); assert.doesNotMatch(html,/Rahasia/); assert.match(html,/Surat Komitmen/); assert.match(html,/\/1\/print/);
  const exported = await get('?q=Ahmad&from=2026-10-27&until=2026-10-27&export=xlsx');
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(await exported.arrayBuffer())); assert.equal(workbook.worksheets[0].rowCount,2); assert.equal(workbook.worksheets[0].getCell('A2').value,'Ahmad <Uji>');
  const surat = await get('/1/berkas/foto_surat_komitment_darul_ilmi'); assert.equal(surat.status,200); assert.equal((await sharp(Buffer.from(await surat.arrayBuffer())).metadata()).format,'jpeg');
  const zip = await get('/1/zip'); const archive = await JSZip.loadAsync(Buffer.from(await zip.arrayBuffer())); assert.ok(archive.file('1/foto_surat_komitment_darul_ilmi.jpg'));
  const pdf = await get('/1/print'); assert.equal(pdf.status,200); assert.equal(pdf.headers.get('cache-control'),'no-store'); assert.equal(pdf.headers.get('content-type'),'application/pdf');
  const bytes = Buffer.from(await pdf.arrayBuffer()); assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  const filename = join(folder,'formulir.pdf'); await writeFile(filename,bytes);
  const {stdout:text} = await promisify(execFile)('pdftotext',[filename,'-']);
  for (const expected of ['AHMAD <UJI>','REG-1','PAKET C','Persetujuan','No KK','123','Panitia Pendaftaran']) assert.ok(text.includes(expected),expected);
  assert.doesNotMatch(text,/Rahasia/);
  assert.equal((await get('/2/print')).status,404);
  assert.equal((await get('/2/berkas/foto')).status,404);
  const head = await fetch(base+'/1/print',{method:'HEAD',headers}); assert.equal(head.status,200); assert.equal(await head.text(),'');
  const post = (path,data,extra={})=>fetch(base+path,{method:'POST',headers:{...headers,origin,...extra},body:new URLSearchParams(data),redirect:'manual'});
  assert.equal((await post('/1/status',{status:'diterima'})).status,403);
  assert.equal((await post('/1/status',{_csrf:'csrf',status:'diterima'},{origin:'https://evil.test'})).status,403);
  assert.equal((await post('/1/status',{_csrf:'csrf',status:'bad'})).status,422);
  assert.equal((await post('/1/status',{_csrf:'csrf',status:'diterima'})).status,303);
  const [[updated]] = await c.execute('SELECT status FROM santris WHERE id=1'); assert.equal(updated.status,'diterima');
  if(process.env.CANDIDATE_UI) {
   const {default:puppeteer} = await import('puppeteer-core');
   browser = await puppeteer.launch({executablePath:process.env.PDF_CHROME_PATH || '/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
   const page = await browser.newPage(), errors=[]; page.on('pageerror',e=>errors.push(e.message));
   await page.setCookie({name:'alyusro_node_session',value:raw,url:origin});
   const output = new URL('../storage/auth-preview/',import.meta.url); await mkdir(output,{recursive:true});
   for(const width of [1440,390])for(const theme of ['light','dark']) {
    await page.setViewport({width,height:900});await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:theme}]);
    for(const suffix of ['', '?q=tidak-ada']) {
     const response=await page.goto(base+suffix,{waitUntil:'networkidle0'});assert.equal(response.status(),200);
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
     await page.screenshot({path:fileURLToPath(new URL(`candidate-${theme}-${width}${suffix?'-empty':''}.png`,output)),fullPage:true});
    }
   }
   assert.deepEqual(errors,[]);
   await promisify(execFile)('pdftoppm',['-f','1','-singlefile','-scale-to','1200','-png',filename,fileURLToPath(new URL('candidate-form',output))]);
  }
  access.permissions.push('delete_calon::santri');
  assert.equal((await post('/1/delete',{_csrf:'csrf'})).status,422);
  await c.execute('INSERT INTO ijazahs (santri_id,event_id,nilai_quran,nilai_bahasa_arab,nilai_tajwid,nilai_khot,nilai_tauhid,nilai_hadist,nilai_fiqih,nilai_tafsir,nilai_nahwu) VALUES (1,1,0,0,0,0,0,0,0,0,0)');
  assert.equal((await post('/1/delete',{_csrf:'csrf',confirm:'HAPUS'})).status,422);
  const [[retained]] = await c.execute('SELECT COUNT(*) AS n FROM foto_santris WHERE santri_id=1'); assert.equal(retained.n,1);
  await c.execute('DELETE FROM ijazahs');
  assert.equal((await post('/1/delete',{_csrf:'csrf',confirm:'HAPUS'})).status,303);
  const [[removed]] = await c.execute('SELECT COUNT(*) AS n FROM foto_santris WHERE santri_id=1'); assert.equal(removed.n,0);
  assert.equal((await post('/2/delete',{_csrf:'csrf',confirm:'HAPUS'})).status,404);
  access.permissions=[];
  for (const path of ['','/1/print','/1/zip','/1/berkas/foto']) assert.equal((await get(path)).status,403,path);
  assert.equal((await post('/1/status',{_csrf:'csrf',status:'Menunggu'})).status,403);
  const escaped = await candidateFormHtml({nama:'<script>alert(1)</script>',jenjang:'Madrasah'},root); assert.doesNotMatch(escaped,/<script>/); assert.match(escaped,/&lt;script&gt;/);
 } finally {
  if(browser)await browser.close();
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  for(const table of tables)await c.query(`DROP TEMPORARY TABLE IF EXISTS ${table}`);
  c.release();await rm(folder,{recursive:true,force:true});
 }
});

test.after(() => pool.end());
