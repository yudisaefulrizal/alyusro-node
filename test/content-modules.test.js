import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { readdir, readFile, mkdtemp, rm, mkdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import ExcelJS from 'exceljs';
import { pool } from '../src/db.js';
import { contentResources } from '../src/content-resources.js';
import { createDashboardMasters } from '../src/dashboard-masters.js';
import { createAuthHandler } from '../src/auth.js';

const hash = v => createHash('sha256').update(v).digest('hex');
test('Lima modul konten: SQL/HTTP, unggahan, scope penulis, permission dan berkas', async t => {
 const c = await pool.getConnection(), tables = ['users','kategori_artikels','kategori_fasilitas','artikels','fasilitas','galeri_fasilitas','dokumens'];
 const temp = await mkdtemp(join(tmpdir(),'alyusro-content-')), root = pathToFileURL(temp + '/');
 let server, browser;
 try {
  const dir = new URL('../../database/migrations/',import.meta.url), files = await readdir(dir);
  for (const table of tables) {
   const source = await readFile(new URL(files.find(f => f.endsWith(`_create_${table}_table.php`)),dir),'utf8');
   await c.query(source.match(/CREATE TABLE[\s\S]*?ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci/)[0].replace('CREATE TABLE','CREATE TEMPORARY TABLE'));
  }
  await c.query("INSERT INTO users (id,name,email,password) VALUES (1,'Penguji Konten','test@fixture.test','fixture'),(2,'Penulis Lain','other@fixture.test','fixture')");
  await c.query("INSERT INTO kategori_artikels (id,nama,slug,status) VALUES (1,'Kategori artikel','kategori','aktif')");
  await c.query("INSERT INTO kategori_fasilitas (id,nama_kategori,slug) VALUES (1,'Kategori fasilitas','kategori')");
  const db = { getConnection:async()=>({ execute:(...args)=>c.execute(...args),beginTransaction:()=>c.beginTransaction(),commit:()=>c.commit(),rollback:()=>c.rollback(),release(){} }) };
  const masters = createDashboardMasters(db,root);
  const user = { id:1,name:'Penguji Konten',password:'fixture' }, raw = 'c'.repeat(64);
  const access = { roles:['Penguji'], permissions:Object.values(contentResources).flatMap(v => ['view_any','view','create','update','delete','delete_any'].map(p=>p+'_'+v.permission)) };
  const session = { id:hash(raw),user_id:1,password_hash:hash(user.password),csrf:'csrf' };
  const store = { session:async()=>session,user:async()=>user,access:async()=>access,touch:async()=>{} };
  const handler = createAuthHandler({ store,masters });
  const { server:assets } = await import('../src/server.js');
  server = http.createServer(async(req,res)=>{if(!await handler(req,res,new URL(req.url,'http://localhost').pathname))assets.emit('request',req,res);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin = `http://127.0.0.1:${server.address().port}`, headers = { cookie:'alyusro_node_session='+raw };
  const image = await sharp({ create:{ width:100,height:100,channels:3,background:'#337755' } }).png().toBuffer();
  const samples = {
   artikel:{ judul:'Artikel 100% <Uji>',isi:'<p>Isi <strong>Arab العربية</strong></p><script>alert(1)</script>',kategori_artikel_id:'1',status:'draft' },
   'artikel-saya':{ judul:'Artikel Saya 100% <Uji>',isi:'<p>Isi artikel saya</p>',kategori_artikel_id:'1',status:'published' },
   fasilitas:{ nama_fasilitas:'Fasilitas 100% <Uji>',kategori_fasilitas_id:'1',deskripsi:'Deskripsi fasilitas' },
   'galeri-fasilitas':{ fasilitas_id:'1',deskripsi_gambar:'Galeri 100% <Uji>' },
   dokumen:{ nama:'Dokumen 100% <Uji>' }
  };
  const post = async(resource,path,values,bytes,name='uji.png',csrf='csrf',extra={}) => {
   const form = new FormData(); form.set('_csrf',csrf);
   for(const [key,value] of Object.entries(values))form.set(key,value);
   if(bytes)form.set('upload',new Blob([bytes]),name);
   return fetch(origin+'/dashboard/'+resource+path,{method:'POST',headers:{...headers,origin,...extra},body:form,redirect:'manual'});
  };
  const get = path => fetch(origin+path,{headers,redirect:'manual'});
  const call = (resource,action,extra={})=>masters({ resource,action,user,access,csrf:'csrf',...extra });
  for(const [resource,config] of Object.entries(contentResources)) await t.test(resource,async()=>{
   const values = samples[resource], file = config.fields.find(f=>f.type==='file'), bytes = file ? resource==='dokumen'?Buffer.from('%PDF-1.4\n%%EOF'):image : undefined;
   assert.equal((await call(resource,'list',{access:{permissions:[]}})).status,403);
   assert.equal((await post(resource,'/create',values,bytes,'uji.pdf','bad')).status,403);
   assert.equal((await post(resource,'/create',values,bytes,'uji.pdf','csrf',{origin:'https://evil.test'})).status,403);
   assert.equal((await post(resource,'/create',{},undefined)).status,422);
   if(file)assert.equal((await post(resource,'/create',values,Buffer.from('invalid'),'uji.pdf')).status,422);
   const created = await post(resource,'/create',{...values,penulis_id:'99',path:'../../.env',thumbnail:'../../.env'},bytes,resource==='dokumen'?'uji.pdf':'uji.png');
   assert.equal(created.status,303,await created.text());
   const [[row]] = await c.query(`SELECT * FROM ${config.table} ORDER BY id DESC LIMIT 1`), id=String(row.id);
   if(config.author){assert.equal(row.penulis_id,1);assert.doesNotMatch(row.isi,/script/);}
   if(file){
    assert.match(row[file.key],new RegExp('^'+file.directory+'/'));
    const response=await get(`/dashboard/${resource}/${id}/file`);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');
    const content=Buffer.from(await response.arrayBuffer());
    if(file.image){const meta=await sharp(content).metadata();assert.equal(meta.width,file.width);assert.equal(meta.height,Math.round(file.width*9/16));assert.equal(meta.format,'webp');}
    const download=await get(`/dashboard/${resource}/${id}/download`);assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/^attachment/);if(resource==='dokumen')assert.match(download.headers.get('content-disposition'),/\.pdf/);
    assert.equal((await fetch(origin+`/dashboard/${resource}/${id}/file`,{method:'HEAD',headers})).status,200);
   }
   const list=await get('/dashboard/'+resource+'?q=100%25');assert.equal(list.status,200);assert.match(await list.text(),/100% &lt;Uji&gt;/);
   assert.doesNotMatch((await call(resource,'list',{params:new URLSearchParams('q=_')})).body,/100% &lt;Uji&gt;/);
   assert.equal((await call(resource,'list',{params:new URLSearchParams('sort=DROP')})).status,422);
   const exported=await call(resource,'list',{params:new URLSearchParams('export=xlsx')});const book=new ExcelJS.Workbook();await book.xlsx.load(exported.xlsx);assert.ok(book.worksheets[0].rowCount>1);
   const edit=await get(`/dashboard/${resource}/${id}/edit`);assert.equal(edit.status,200);assert.match(await edit.text(),/Simpan/);
   assert.equal((await post(resource,`/${id}/edit`,{...values,status:config.author?'archived':values.status||''})).status,303);
   if(config.author){const [[updated]]=await c.execute('SELECT status FROM artikels WHERE id=?',[id]);assert.equal(updated.status,'archived');}
   if(config.view)assert.equal((await call(resource,'view',{id})).status,200);
   const relation=config.fields.find(f=>f.relation);
   if(relation)assert.equal((await post(resource,`/${id}/edit`,{...values,[relation.key]:'999'})).status,422);
   assert.equal((await call(resource,'edit',{id,access:{permissions:['view_any_'+config.permission]},data:values})).status,403);
   assert.equal((await call(resource,'bulkDelete',{data:{id_999:'1'}})).status,404);
  });
  // Artikel Saya must enforce ownership on every operation, including export and file access.
  const [[firstArticle]]=await c.query('SELECT thumbnail FROM artikels WHERE id=1');
  await c.execute("INSERT INTO artikels (judul,slug,isi,penulis_id,kategori_artikel_id,status,thumbnail) VALUES ('Rahasia Penulis Lain','rahasia','Isi',2,1,'draft',?)",[firstArticle.thumbnail]);
  const [[foreign]]=await c.query('SELECT MAX(id) AS id FROM artikels');
  for(const action of ['edit','view','file','download']) assert.equal((await call('artikel-saya',action,{id:String(foreign.id)})).status,404);
  assert.equal((await call('artikel-saya','edit',{id:String(foreign.id),data:samples['artikel-saya']})).status,404);
  assert.equal((await call('artikel-saya','bulkDelete',{data:{['id_'+foreign.id]:'1'}})).status,404);
  assert.doesNotMatch((await call('artikel-saya','list')).body,/Rahasia Penulis Lain/);
  const ownExport=await call('artikel-saya','list',{params:new URLSearchParams('export=xlsx')});const ownBook=new ExcelJS.Workbook();await ownBook.xlsx.load(ownExport.xlsx);assert.doesNotMatch(JSON.stringify(ownBook.worksheets[0].getSheetValues()),/Rahasia/);
  // Reject deletion of a facility with gallery records.
  assert.equal((await call('fasilitas','bulkDelete',{data:{id_1:'1'}})).status,422);
  // A forged document extension and traversal/symlink paths never yield content.
  assert.equal((await post('dokumen','/create',samples.dokumen,Buffer.from('<script>alert(1)</script>'),'evil.pdf')).status,422);
  assert.equal((await post('dokumen','/create',samples.dokumen,Buffer.alloc(10485761),'large.txt')).status,422);
  await c.query("UPDATE dokumens SET path='../../.env' WHERE id=1");assert.equal((await get('/dashboard/dokumen/1/file')).status,404);
  await writeFile(join(temp,'outside.pdf'),'%PDF-1.4');await symlink(join(temp,'outside.pdf'),join(temp,'dokumen','link.pdf'));
  await c.query("UPDATE dokumens SET path='dokumen/link.pdf' WHERE id=1");
  // Symlinks to outside the storage root are rejected too.
  await symlink('/etc/passwd',join(temp,'dokumen','escape.txt'));await c.query("UPDATE dokumens SET path='dokumen/escape.txt' WHERE id=1");assert.equal((await get('/dashboard/dokumen/1/file')).status,404);
  await c.query("UPDATE dokumens SET path='dokumen/missing.pdf' WHERE id=1");
  if(process.env.CONTENT_UI){
   const puppeteer=await import('puppeteer-core');browser=await puppeteer.default.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
   const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setCookie({name:'alyusro_node_session',value:raw,url:origin});
   const output=new URL('../storage/auth-preview/',import.meta.url);await mkdir(output,{recursive:true});
   for(const theme of ['light','dark'])for(const width of [1440,390]){
    await page.setViewport({width,height:900});await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:theme}]);
    for(const resource of Object.keys(contentResources)){
     for(const suffix of ['','/create',resource==='artikel-saya'?'/2/edit':'/1/edit','?q=missing']){
      const response=await page.goto(origin+'/dashboard/'+resource+suffix,{waitUntil:'networkidle0'});assert.equal(response.status(),200);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,resource+suffix);
      if(!suffix)await page.screenshot({path:fileURLToPath(new URL(`content-${resource}-${theme}-${width}.png`,output)),fullPage:true});
     }
    }
   }
   // Submit a rich article with an uploaded thumbnail using the actual browser form.
   await page.goto(origin+'/dashboard/artikel/create',{waitUntil:'networkidle0'});
   await page.type('[name=judul]','Artikel Browser');await page.$eval('[name=isi]',el=>{el.value='<p>Isi browser</p>';el.dispatchEvent(new Event('input',{bubbles:true}));});
   const editor=await page.$('[contenteditable=true]');if(editor)await editor.evaluate(el=>{el.innerHTML='<p>Isi browser</p>';el.dispatchEvent(new Event('input',{bubbles:true}));});
   await writeFile(join(temp,'browser.png'),image);await (await page.$('[name=upload]')).uploadFile(join(temp,'browser.png'));
   await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),page.click('.status-note-form button[type=submit]')]);assert.equal(new URL(page.url()).pathname,'/dashboard/artikel');
   const [[saved]]=await c.query("SELECT penulis_id,isi FROM artikels WHERE judul='Artikel Browser'");assert.equal(saved.penulis_id,1);assert.match(saved.isi,/Isi browser/);
   assert.deepEqual(errors,[]);
  }
  for(const resource of ['galeri-fasilitas','fasilitas','artikel-saya','artikel','dokumen']){
   const id=resource==='artikel-saya'?'2':'1';
   assert.equal((await call(resource,'bulkDelete',{data:{['id_'+id]:'1'}})).status,303);
   if(contentResources[resource].softDelete)assert.equal((await call(resource,'edit',{id})).status,404);
  }
  access.permissions=[];assert.equal((await get('/dashboard/dokumen')).status,403);assert.equal((await get('/dashboard/artikel/1/file')).status,403);
 } finally {
  if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  await c.rollback();for(const table of tables.reverse())await c.query(`DROP TEMPORARY TABLE IF EXISTS ${table}`);c.release();await rm(temp,{recursive:true,force:true});
 }
});
test('Unggahan thumbnail memakai storage Laravel dan tertanam dalam PDF artikel', async () => {
 const { contentRoot, saveContentFile, readContentFile, removeNewContentFile } = await import('../src/content-files.js');
 const { articlePdfHtml } = await import('../src/article-pdf.js');
 const field = contentResources.artikel.fields.find(f => f.type === 'file');
 let path;
 try {
  const upload = await sharp({ create:{ width:32,height:32,channels:3,background:'#083e6b' } }).png().toBuffer();
  path = await saveContentFile(field,{ upload,upload_name:'fixture.png' });
  const content = await readFile(new URL(path,contentRoot));
  assert.equal((await readContentFile(field,path)).content.equals(content),true);
  const html = await articlePdfHtml({ judul:'Fixture',isi:'<p>Isi</p>',thumbnail:path,author:'Fixture',created_at:'2026-10-27' });
  assert.match(html,/data:image\/webp;base64,/);
 } finally { if(path)await removeNewContentFile(path); }
});
test.after(()=>pool.end());
