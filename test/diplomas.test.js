import { auditedConnection } from '../src/audit.js';
import test from 'node:test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash,randomBytes } from 'node:crypto';
import { readFile,readdir,mkdir,writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import { pool } from '../src/db.js';
import { createDashboardMasters } from '../src/dashboard-masters.js';
import { diplomaDefinitions,diplomaSummary } from '../src/diploma-resources.js';
import { diplomaPrintHtml } from '../src/diploma-print.js';
import { createDiplomas } from '../src/diplomas.js';
import { createAuthHandler } from '../src/auth.js';
import { diplomaHeaders } from '../src/diploma-imports.js';

test('Tiga Ijazah: data/relasi, penomoran, nilai/IPK, impor/ekspor, cetak template, permission dan audit',async()=>{
 const tables=['users','santris','foto_santris','event_mahads','nama_kota','audit_logs',...Object.values(diplomaDefinitions).map(config=>config.table)],raw=await pool.getConnection(),prefix='ndip_'+randomBytes(5).toString('hex')+'_',created=[];let server,browser;
 const pattern=new RegExp('\\b('+tables.join('|')+')\\b','g'),rewrite=sql=>sql.replace(pattern,name=>prefix+name);
 const wrap=connection=>auditedConnection({execute:(sql,args)=>connection.execute(rewrite(sql),args),query:(sql,args)=>connection.query(rewrite(sql),args),beginTransaction:()=>connection.beginTransaction(),commit:()=>connection.commit(),rollback:()=>connection.rollback(),release:()=>connection.release()});
 const c=wrap(raw);
 try {
  const directory=new URL('../../database/migrations/',import.meta.url),filenames=await readdir(directory);
  for(const table of tables){const source=await readFile(new URL(filenames.find(file=>file.endsWith(`_create_${table}_table.php`)),directory),'utf8');await raw.query(rewrite(source.match(/CREATE TABLE[\s\S]*?ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci/)[0]).replace(/CONSTRAINT `([^`]+)`/g,(_,name)=>'CONSTRAINT `'+prefix+name+'`'));created.push(table);}
  await c.execute("INSERT INTO users(id,name,email,password) VALUES(1,'Penguji','diploma@fixture.test','fixture')");
  const levels=['Madrasah',"Darul 'Ilmi","Ma'had 'Aly"];
  for(let i=1;i<=3;i++)await c.execute('INSERT INTO santris(id,nama,nama_arab,jenis_kelamin,nis,nis_darul_ilmi,nis_mahad_aly,tempat_lahir,tanggal_lahir,bulan_lahir,tahun_lahir,jenjang,no_kk) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',[i,'Santri '+i,'أحمد '+i,i===2?'Perempuan':'Laki-laki','N'+i,'DI'+i,'MA'+i,'Bogor','1','1','2010',levels[i-1],'123']);
  await c.execute("INSERT INTO event_mahads(id,nama,tanggal,bulan,tahun,created_at) VALUES(1,'Wisuda fixture',27,10,2026,'2026-10-27 10:00:00')");
  await c.execute("INSERT INTO nama_kota(nama_latin,nama_arab,status) VALUES('bogor','بوغور',1)");
  const db={getConnection:async()=>wrap(await pool.getConnection())},hijri=async()=>({day:15,month:5,year:1448});
  const masters=createDashboardMasters(db),diploma=createDiplomas(db,{hijri}),user={id:1,name:'Penguji',password:'fixture'},access={roles:['Penguji'],permissions:Object.keys(diplomaDefinitions).flatMap(resource=>['view_any','view','create','update','delete','delete_any'].map(action=>action+'_'+resource.replaceAll('-','::')))};
  const rawCookie='8'.repeat(64),hash=value=>createHash('sha256').update(value).digest('hex'),session={id:hash(rawCookie),user_id:1,password_hash:hash(user.password),csrf:'csrf'};
  const store={session:async()=>session,user:async()=>user,access:async()=>access,touch:async()=>{}},handler=createAuthHandler({store,masters,diploma,auditEnabled:true});
  const {server:assets}=await import('../src/server.js');server=http.createServer(async(req,res)=>{if(!await handler(req,res,new URL(req.url,'http://localhost').pathname))assets.emit('request',req,res);});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`,headers={cookie:'alyusro_node_session='+rawCookie},get=path=>fetch(origin+'/dashboard/'+path,{headers,redirect:'manual'}),post=(path,data,extra={})=>fetch(origin+'/dashboard/'+path,{method:'POST',headers:{...headers,origin,...extra},body:new URLSearchParams(data),redirect:'manual'});
  const output=new URL('../storage/auth-preview/',import.meta.url);await mkdir(output,{recursive:true});
  let studentId=0;
  for(const [resource,config] of Object.entries(diplomaDefinitions)){
   studentId++;
   const values={santri_id:String(studentId),event_id:'1',...Object.fromEntries(config.grades.map(key=>[key,'80.25'])),_csrf:'csrf'};
   assert.equal((await post(resource+'/create',{...values,_csrf:'bad'})).status,403);
   assert.equal((await post(resource+'/create',{...values,event_id:'999'})).status,422);
   assert.equal((await post(resource+'/create',{...values,[config.grades[0]]:'101'})).status,422);
   const created=await post(resource+'/create',values);assert.equal(created.status,303,await created.text());
   const [[row]]=await c.execute(`SELECT * FROM ${config.table} WHERE santri_id=?`,[studentId]);assert.ok(row.nomor_ijazah.startsWith('MATHA-'+config.code+'-2026-'));assert.equal(row.temp_predikat,config.hours?'Baik':'Jayyid Jiddan');
   if(config.hours){assert.equal(Number(row.temp_ipk),3);assert.ok(diplomaSummary(resource,row).hours>1000);}else assert.equal(Number(row.temp_rata_rata),80.25);
   if(resource==='ijazah'){
    const php=String.raw`require 'vendor/autoload.php'; $app=require 'bootstrap/app.php'; $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); $model=new App\Models\Santri; $model->setTable(getenv('FIXTURE_PREFIX').'santris'); $student=$model->findOrFail(1); echo json_encode(['nama'=>$student->nama,'arab'=>$student->nama_arab],JSON_UNESCAPED_UNICODE); Illuminate\Support\Facades\DB::table(getenv('FIXTURE_PREFIX').'santris')->where('id',1)->update(['nama'=>'Nama lintas aplikasi']);`;
    const {stdout}=await promisify(execFile)('php',['-r',php],{cwd:new URL('../../',import.meta.url),env:{...process.env,FIXTURE_PREFIX:prefix}});
    assert.deepEqual(JSON.parse(stdout),{nama:'Santri 1',arab:'أحمد 1'});
    assert.match(await (await get(resource+'?q=lintas')).text(),/Nama lintas aplikasi/);
    await c.execute("UPDATE santris SET nama='Santri 1' WHERE id=1");
   }
   assert.equal((await post(resource+'/create',values)).status,422);
   assert.equal((await post(resource+'/'+row.id+'/edit',{...values,nomor_ijazah:'HACK',verifikasi_kepala_sekolah:'1',verifikasi_mudir:'1',catatan_mudir:'Catatan <uji>'})).status,303);
   const [[edited]]=await c.execute(`SELECT * FROM ${config.table} WHERE id=?`,[row.id]);assert.equal(edited.nomor_ijazah,row.nomor_ijazah);assert.equal(edited.verifikasi_mudir,1);
   assert.equal((await post(resource+'/recalculate',{_csrf:'csrf'})).status,422);assert.equal((await post(resource+'/recalculate',{_csrf:'csrf',confirm:'HITUNG'})).status,303);
   const table=await get(resource+'?event_id=1&q=Santri');assert.equal(table.status,200);assert.match(await table.text(),/Santri/);
   const selected=await post(resource+'/bulk-export',{_csrf:'csrf',['id_'+row.id]:'1'}),book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(await selected.arrayBuffer()));assert.equal(book.worksheets[0].rowCount,2);assert.equal(book.worksheets[0].getCell('A2').value,'Santri '+studentId);
   const template=await get(resource+'/template'),imported=new ExcelJS.Workbook();await imported.xlsx.load(Buffer.from(await template.arrayBuffer()));assert.equal(imported.worksheets[0].columnCount,diplomaHeaders(resource).length);
   imported.worksheets[0].addRow(diplomaHeaders(resource).map(key=>key==='nama'?'Santri':key==='nis'?'N'+studentId:config.grades.includes(key)?60:key.includes('latin')?'Judul Ilmiah':'عنوان البحث'));
   const upload=async bytes=>{const form=new FormData();form.set('_csrf','csrf');form.set('workbook',new Blob([bytes]),'nilai.xlsx');return fetch(origin+'/dashboard/'+resource+'/import',{method:'POST',headers:{...headers,origin},body:form,redirect:'manual'});};
   assert.equal((await upload(Buffer.from(await imported.xlsx.writeBuffer()))).status,303);
   const [[changed]]=await c.execute(`SELECT * FROM ${config.table} WHERE id=?`,[row.id]);assert.equal(changed[config.grades[0]],config.hours?70:60);assert.equal(changed.nomor_ijazah,row.nomor_ijazah);assert.equal(changed.verifikasi_mudir,1);
   imported.worksheets[0].getCell('C2').value={formula:'1+1',result:2};assert.equal((await upload(Buffer.from(await imported.xlsx.writeBuffer()))).status,422);
   const [[student]]=await c.execute('SELECT * FROM santris WHERE id=?',[studentId]),[[event]]=await c.execute('SELECT * FROM event_mahads WHERE id=1');
   for(const kind of ['print','transcript']){
    const rendered=await get(`${resource}/${row.id}/${kind}`);assert.equal(rendered.status,200);assert.equal(rendered.headers.get('cache-control'),'no-store');const bytes=Buffer.from(await rendered.arrayBuffer()),metadata=await sharp(bytes).metadata();assert.equal(metadata.format,'png');assert.ok(metadata.width>2000);await writeFile(new URL(`diploma-${resource}-${kind}.png`,output),bytes);
    const document=await diplomaPrintHtml(resource,changed,student,event,{kind,hijri,cityArabic:'بوغور'});assert.match(document.html,/Santri/);if(kind==='print')assert.ok(document.html.includes(row.nomor_ijazah));assert.doesNotMatch(document.html,/<script/);
   }
   const qr=await get(`${resource}/${row.id}/qr`);assert.equal((await sharp(Buffer.from(await qr.arrayBuffer())).metadata()).format,'png');
   if(process.env.DIPLOMA_UI){
    if(!browser){const {default:puppeteer}=await import('puppeteer-core');browser=await puppeteer.launch({executablePath:process.env.PDF_CHROME_PATH || '/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});}
    const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.setCookie({name:'alyusro_node_session',value:rawCookie,url:origin});
    for(const width of [1440,390])for(const theme of ['light','dark'])for(const suffix of ['', '?q=empty-fixture','/create','/'+row.id+'/edit']){await page.setViewport({width,height:900});await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:theme}]);const response=await page.goto(origin+'/dashboard/'+resource+suffix,{waitUntil:'networkidle0'});assert.equal(response.status(),200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:fileURLToPath(new URL(`diploma-ui-${resource}-${theme}-${width}-${suffix.replaceAll(/[^a-z0-9]/g,'') || 'list'}.png`,output)),fullPage:true});}
    assert.deepEqual(errors,[]);await page.close();
   }
   const [[logs]]=await c.execute('SELECT COUNT(*) AS n FROM audit_logs WHERE table_name=?',[config.table]);assert.ok(logs.n>=3);
  }
  access.permissions=[];for(const resource of Object.keys(diplomaDefinitions))for(const suffix of ['', '/1/print','/1/transcript','/1/qr','/create'])assert.equal((await get(resource+suffix)).status,403);
 }finally{if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}for(const table of created.reverse())await raw.query(`DROP TABLE IF EXISTS ${prefix+table}`);raw.release();}
});
test.after(()=>pool.end());
