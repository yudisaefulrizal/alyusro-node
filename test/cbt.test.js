import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomBytes,createHash } from 'node:crypto';
import { readFile,readdir,mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { pool } from '../src/db.js';
import { auditedConnection } from '../src/audit.js';
import { createDashboardMasters } from '../src/dashboard-masters.js';
import { createCbtAdmin } from '../src/cbt-admin.js';
import { createCbtRuntime } from '../src/cbt-runtime.js';
import { createAuthHandler } from '../src/auth.js';

test('CBT: bank/ujian/peserta, impor, KK, timer, snapshot, retry/concurrent submit, nilai dan browser',async()=>{
 // Real, uniquely named fixture tables let two independent connections exercise FOR UPDATE.
 // All SQL identifiers are rewritten below; operational records are never used.
 const tables=['users','santris','audit_logs','cbt_tema_soal','cbt_soal','cbt_ujian','cbt_peserta','cbt_peserta_publik','node_cbt_attempts'],prefix='ncbt_'+randomBytes(5).toString('hex')+'_';
 const pattern=new RegExp('\\b('+[...tables].sort((a,b)=>b.length-a.length).join('|')+')\\b','g'),rewrite=sql=>sql.replace(pattern,name=>prefix+name);
 const raw=await pool.getConnection(),created=[];let server,browser;
 const wrap=connection=>auditedConnection({execute:(sql,args)=>connection.execute(rewrite(sql),args),query:(sql,args)=>connection.query(rewrite(sql),args),beginTransaction:()=>connection.beginTransaction(),commit:()=>connection.commit(),rollback:()=>connection.rollback(),release:()=>connection.release()});
 const c=wrap(raw),db={getConnection:async()=>wrap(await pool.getConnection())};
 try {
  const directory=new URL('../../database/migrations/',import.meta.url),filenames=await readdir(directory);
  for(const table of tables){
   if(table==='node_cbt_attempts'){await raw.query(`CREATE TABLE ${prefix+table} (peserta_id BIGINT UNSIGNED PRIMARY KEY,attempt_key CHAR(32) NOT NULL DEFAULT '',snapshot LONGTEXT NOT NULL,answers LONGTEXT NOT NULL,deadline BIGINT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);}
   else {const source=await readFile(new URL(filenames.find(file=>file.endsWith(`_create_${table}_table.php`)),directory),'utf8');const ddl=source.match(/CREATE TABLE[\s\S]*?ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci/)[0];await raw.query(rewrite(ddl).replace(/CONSTRAINT `([^`]+)`/g,(_,name)=>'CONSTRAINT `'+prefix+name+'`'));}
   created.push(table);
  }
  await c.query('ALTER TABLE cbt_peserta '+Array.from({length:100},(_,i)=>'MODIFY j'+(i+1)+' TEXT NULL').join(','));
  await c.execute("INSERT INTO users(id,name,email,password,nomor_kk) VALUES(1,'Wali fixture','cbt@fixture.test','fixture','123')");
  await c.execute("INSERT INTO santris(nama,jenis_kelamin,tempat_lahir,tanggal_lahir,bulan_lahir,tahun_lahir,jenjang,no_kk,nomor_pendaftaran) VALUES ('Milik sendiri','L','Bogor','1','1','2010','Madrasah','123','REG-1'),('Lintas KK','P','Bogor','1','1','2010','Madrasah','456','REG-2')");
  await c.execute("INSERT INTO cbt_tema_soal(id,nama_tema) VALUES(1,'Tema fixture')");
  let timestamp=Math.floor(Date.now()/1000);
  const user={id:1,name:'Wali fixture',password:'fixture',nomor_kk:'123'},access={roles:['Penguji'],permissions:['soal','ujian','peserta'].flatMap(key=>['view_any','view','create','update','delete','delete_any'].map(action=>action+'_c::b::t::'+key))};
  const rawCookie='9'.repeat(64),hash=value=>createHash('sha256').update(value).digest('hex'),session={id:hash(rawCookie),user_id:1,password_hash:hash(user.password),csrf:'csrf'};
  const store={session:async()=>session,user:async()=>user,access:async()=>access,touch:async()=>{}};
  const masters=createDashboardMasters(db),cbtManagement=createCbtAdmin(db),cbt=createCbtRuntime(db,()=>timestamp),handler=createAuthHandler({store,masters,cbtManagement,cbt,auditEnabled:true});
  const {server:assets}=await import('../src/server.js');server=http.createServer(async(req,res)=>{if(!await handler(req,res,new URL(req.url,'http://localhost').pathname))assets.emit('request',req,res);});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`,headers={cookie:'alyusro_node_session='+rawCookie},get=path=>fetch(origin+'/dashboard/'+path,{headers,redirect:'manual'}),post=(path,data,extra={})=>fetch(origin+'/dashboard/'+path,{method:'POST',headers:{...headers,origin,...extra},body:new URLSearchParams(data),redirect:'manual'});
  const question={tema_soal_id:'1',pertanyaan:'Dua tambah dua?',tipe_soal:'pilihan_ganda',jawaban_benar:'4',jawaban_salah_1:'5',bobot:'2',aktif:'1',verifikasi:'verified',_csrf:'csrf'};
  assert.equal((await post('cbt-soal/create',question)).status,303);
  assert.equal((await post('cbt-soal/create',{...question,pertanyaan:'Matahari terbit di timur?',tipe_soal:'benar_salah',jawaban_benar:'Benar',jawaban_salah_1:'Salah',bobot:'1'})).status,303);
  assert.equal((await post('cbt-soal/create',{...question,pertanyaan:'Tuliskan alasan',tipe_soal:'essay',jawaban_benar:'EXAM_SECRET_ESSAY',jawaban_salah_1:''})).status,303);
  const exam={nama_ujian:'Ujian fixture',durasi:'10',privasi:'privat',aktif:'1',q1:'1',q2:'2',q101:'3',verification:'verified_only',_csrf:'csrf'};
  assert.equal((await post('cbt-ujian/create',{...exam,q2:'1'})).status,422);
  assert.equal((await post('cbt-ujian/create',exam)).status,303);
  assert.equal((await post('cbt-peserta/create',{nomor_pendaftaran:'missing',ujian_id:'1',_csrf:'csrf'})).status,422);
  assert.equal((await post('cbt-ujian/1/assign',{prefix:'REG-',_csrf:'csrf'})).status,303);
  const [[participant]]=await c.execute("SELECT * FROM cbt_peserta WHERE nomor_pendaftaran='REG-1'");const id=participant.id;
  const list=await get('ujian');assert.equal(list.status,200);const listHtml=await list.text();assert.match(listHtml,/Milik sendiri/);assert.doesNotMatch(listHtml,/Lintas KK/);
  assert.equal((await post('ujian/2/start',{_csrf:'csrf'})).status,404);
  assert.equal((await post('ujian/'+id+'/start',{})).status,403);
  assert.equal((await post('ujian/'+id+'/start',{_csrf:'csrf'},{origin:'https://evil.test'})).status,403);
  assert.equal((await post('ujian/'+id+'/start',{_csrf:'csrf'})).status,303);
  const [[attempt]]=await c.execute('SELECT * FROM node_cbt_attempts WHERE peserta_id=?',[id]);assert.equal(Number(attempt.deadline),timestamp+600);
  timestamp+=10;assert.equal((await post('ujian/'+id+'/start',{_csrf:'csrf'})).status,303);const [[same]]=await c.execute('SELECT deadline FROM node_cbt_attempts WHERE peserta_id=?',[id]);assert.equal(Number(same.deadline),Number(attempt.deadline));
  const run=await get('ujian/'+id+'/run');const html=await run.text();assert.match(html,/Dua tambah dua/);assert.doesNotMatch(html,/EXAM_SECRET_ESSAY|"correct"|jawaban_benar/);
  assert.equal((await post('ujian/'+id+'/save',{_csrf:'csrf',j120:'hacked'})).status,422);
  assert.equal((await post('ujian/'+id+'/save',{_csrf:'csrf',j1:'arbitrary'})).status,422);
  const essay='Jawaban panjang '.repeat(1500);assert.ok(essay.length>16384);
  const saved=await post('ujian/'+id+'/save',{_csrf:'csrf',j1:'4',j101:essay});assert.equal(saved.status,200);assert.equal((await saved.json()).saved,true);
  // Changing the bank after start must not change this attempt's scoring key or weights.
  await c.execute("UPDATE cbt_soal SET jawaban_benar='CHANGED',bobot=100 WHERE id=1");
  const submitted=await Promise.all([post('ujian/'+id+'/submit',{_csrf:'csrf'}),post('ujian/'+id+'/submit',{_csrf:'csrf'})]);assert.deepEqual(submitted.map(response=>response.status).sort(),[303,409]);
  const [[finished]]=await c.execute('SELECT * FROM cbt_peserta WHERE id=?',[id]);assert.equal(finished.status,'finished');assert.equal(finished.nilai,67);assert.equal(finished.j101,essay);
  const [[stats]]=await c.execute('SELECT jumlah_benar,jumlah_salah FROM cbt_soal WHERE id=1');assert.equal(stats.jumlah_benar,1);assert.equal(stats.jumlah_salah,0);
  const [[unanswered]]=await c.execute('SELECT jumlah_salah FROM cbt_soal WHERE id=2');assert.equal(unanswered.jumlah_salah,1);
  const result=await get('ujian/'+id+'/result');assert.match(await result.text(),/67/);
  assert.equal((await post('cbt-peserta/'+id+'/grade',{_csrf:'csrf',nilai_essay:'101'})).status,422);
  assert.equal((await post('cbt-peserta/'+id+'/grade',{_csrf:'csrf',nilai_essay:'80'})).status,303);const [[graded]]=await c.execute('SELECT nilai_total FROM cbt_peserta WHERE id=?',[id]);assert.equal(graded.nilai_total,74);
  assert.equal((await post('cbt-ujian/1/assign',{prefix:'REG-',_csrf:'csrf'})).status,303);const [[kept]]=await c.execute('SELECT status FROM cbt_peserta WHERE id=?',[id]);assert.equal(kept.status,'finished');
  assert.equal((await post('cbt-peserta/'+id+'/reset',{_csrf:'csrf',confirm:'RESET'})).status,303);const [[reset]]=await c.execute('SELECT * FROM cbt_peserta WHERE id=?',[id]);assert.equal(reset.j101,null);assert.equal(reset.nilai,null);assert.equal(reset.started_at,null);
  assert.equal((await post('cbt-peserta/'+id+'/grade',{_csrf:'csrf',nilai_essay:'50'})).status,422);
  await c.execute("UPDATE cbt_soal SET jawaban_benar='4',bobot=2 WHERE id=1");
  assert.equal((await post('ujian/'+id+'/start',{_csrf:'csrf'})).status,303);const [[next]]=await c.execute('SELECT deadline FROM node_cbt_attempts WHERE peserta_id=?',[id]);timestamp=Number(next.deadline)+1;
  assert.equal((await post('ujian/'+id+'/save',{_csrf:'csrf',j1:'4'})).status,409);
  assert.equal((await post('ujian/'+id+'/submit',{_csrf:'csrf',j1:'4',j2:'Benar'})).status,303);const [[expired]]=await c.execute('SELECT nilai FROM cbt_peserta WHERE id=?',[id]);assert.equal(expired.nilai,0);
  const template=await get('cbt-soal/template'),workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(await template.arrayBuffer()));workbook.worksheets[0].addRow(['Tema baru','Soal impor','pilihan_ganda','Benar','Salah','','','','','',1,1]);
  const form=new FormData();form.set('_csrf','csrf');form.set('workbook',new Blob([Buffer.from(await workbook.xlsx.writeBuffer())]),'soal.xlsx');assert.equal((await fetch(origin+'/dashboard/cbt-soal/import',{method:'POST',headers:{...headers,origin},body:form,redirect:'manual'})).status,303);
  const [[imported]]=await c.execute("SELECT * FROM cbt_soal WHERE pertanyaan='Soal impor'");assert.equal(imported.verifikasi,'pending');assert.equal(imported.created_by,1);
  assert.equal((await post('cbt-soal/json',{_csrf:'csrf',json_data:JSON.stringify([{tema:'JSON',pertanyaan:'JSON soal',jawaban_benar:'Ya',bobot:0}])})).status,422);
  assert.equal((await post('cbt-soal/json',{_csrf:'csrf',json_data:JSON.stringify([{tema:'JSON',pertanyaan:'JSON soal',jawaban_benar:'Ya',aktif:'typo'}])})).status,422);
  assert.equal((await post('cbt-soal/json',{_csrf:'csrf',json_data:JSON.stringify([{tema:'JSON',pertanyaan:'JSON soal',jawaban_benar:'Ya',jawaban_salah_1:'Tidak'}])})).status,303);
  assert.equal((await post('cbt-soal/bulk-verify',{_csrf:'csrf',['id_'+imported.id]:'1'})).status,303);
  assert.equal((await post('cbt-ujian/1/generate',{_csrf:'csrf',verification:'verified_only',pg_1:'2',essay_1:'1'})).status,303);
  // Default verified-only form must preserve a previously selected pending/inactive question.
  await c.execute("UPDATE cbt_soal SET verifikasi='pending',aktif=0 WHERE id=1");const editing=await get('cbt-ujian/1/edit');assert.match(await editing.text(),/value="1" selected/);
  const [[existing]]=await c.execute('SELECT * FROM cbt_ujian WHERE id=1');const changes={...exam};for(let i=1;i<=120;i++)changes['q'+i]=String(existing['q'+i] || '');assert.equal((await post('cbt-ujian/1/edit',changes)).status,303);
  assert.equal((await post('cbt-soal/1/delete',{_csrf:'csrf',confirm:'HAPUS'})).status,422);
  // Full PG text must survive the shared widened j columns, and different
  // participants must submit opposite question orders without deadlocking.
  const longAnswer='Jawaban sangat panjang '.repeat(14).trim();
  assert.equal((await post('cbt-soal/create',{...question,pertanyaan:'Opsi lebih dari 160 karakter',jawaban_benar:longAnswer})).status,303);
  const [[longQuestion]]=await c.execute("SELECT id FROM cbt_soal WHERE pertanyaan='Opsi lebih dari 160 karakter'");
  await c.execute('UPDATE cbt_soal SET aktif=1 WHERE id=1');
  assert.equal((await post('cbt-ujian/create',{...exam,nama_ujian:'Urutan terbalik',q1:'2',q2:String(longQuestion.id),q3:'1',q101:'',verification:'all'})).status,303);
  const [[secondExam]]=await c.execute("SELECT id FROM cbt_ujian WHERE nama_ujian='Urutan terbalik'");
  assert.equal((await post('cbt-peserta/create',{_csrf:'csrf',nomor_pendaftaran:'REG-1',ujian_id:String(secondExam.id)})).status,303);
  const [[secondParticipant]]=await c.execute("SELECT id FROM cbt_peserta WHERE ujian_id=? AND nomor_pendaftaran='REG-1'",[secondExam.id]);
  await post('cbt-peserta/'+id+'/reset',{_csrf:'csrf',confirm:'RESET'});
  assert.equal((await post('ujian/'+id+'/start',{_csrf:'csrf'})).status,303);
  assert.equal((await post('ujian/'+secondParticipant.id+'/start',{_csrf:'csrf'})).status,303);
  const opposite=await Promise.all([post('ujian/'+id+'/submit',{_csrf:'csrf',j1:'4',j2:'Benar'}),post('ujian/'+secondParticipant.id+'/submit',{_csrf:'csrf',j1:'Benar',j2:longAnswer,j3:'4'})]);assert.deepEqual(opposite.map(response=>response.status),[303,303]);
  const [[longStored]]=await c.execute('SELECT j2,nilai FROM cbt_peserta WHERE id=?',[secondParticipant.id]);assert.equal(longStored.j2,longAnswer);assert.equal(longStored.nilai,100);
  const resultsResponse=await get('cbt-ujian/1/results');const gradesWorkbook=new ExcelJS.Workbook();await gradesWorkbook.xlsx.load(Buffer.from(await resultsResponse.arrayBuffer()));assert.equal(gradesWorkbook.worksheets[0].getCell('A1').value,'Nama');assert.ok(gradesWorkbook.worksheets[0].getColumn(1).values.includes('Milik sendiri'));
  // Adopt a Laravel-started attempt without extending its original timer or losing answers.
  await post('cbt-peserta/'+id+'/reset',{_csrf:'csrf',confirm:'RESET'});
  const legacyStarted=timestamp-120;
  await c.execute("UPDATE cbt_peserta SET status='ongoing',started_at=FROM_UNIXTIME(?),j1='4' WHERE id=?",[legacyStarted,id]);
  assert.equal((await get('ujian/'+id+'/run')).status,200);
  const [[adopted]]=await c.execute('SELECT deadline,answers FROM node_cbt_attempts WHERE peserta_id=?',[id]);
  assert.equal(Number(adopted.deadline),legacyStarted+Number(existing.durasi)*60);assert.equal(JSON.parse(adopted.answers).j1,'4');
  const output=new URL('../storage/auth-preview/',import.meta.url);await mkdir(output,{recursive:true});
  if(process.env.CBT_UI){
   const {default:puppeteer}=await import('puppeteer-core');browser=await puppeteer.launch({executablePath:process.env.PDF_CHROME_PATH || '/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});const page=await browser.newPage(),errors=[];page.on('requestfailed',request=>console.error('CBT request failed',request.url(),request.failure()?.errorText));page.on('pageerror',error=>errors.push(error.message));await page.setCookie({name:'alyusro_node_session',value:rawCookie,url:origin});
   for(const width of [1440,390])for(const theme of ['light','dark'])for(const resource of ['cbt-soal','cbt-ujian','cbt-peserta','ujian']){
    await page.setViewport({width,height:900});await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:theme}]);const response=await page.goto(origin+'/dashboard/'+resource,{waitUntil:'networkidle0'});assert.equal(response.status(),200,resource);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,resource);await page.screenshot({path:fileURLToPath(new URL(`cbt-${resource}-${theme}-${width}.png`,output)),fullPage:true});
   }
   await post('cbt-peserta/'+id+'/reset',{_csrf:'csrf',confirm:'RESET'});await post('ujian/'+id+'/start',{_csrf:'csrf'});
   await page.goto(origin+'/dashboard/ujian/'+id+'/run',{waitUntil:'domcontentloaded'});await page.waitForSelector('[data-cbt-timer]');assert.ok(await page.$('[data-cbt]'));assert.match(await page.$eval('[data-cbt-timer]',node=>node.textContent),/\d+:\d\d/);
   await page.click('input.cbt-answer');await page.waitForFunction(()=>document.querySelector('[data-cbt-save-status]').textContent==='Jawaban tersimpan di server.');
   const before=await page.$eval('[data-cbt-timer]',node=>node.textContent);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('[data-cbt-timer]').textContent.length>0);assert.equal(await page.$eval('input.cbt-answer:checked',node=>!!node),true);assert.ok(await page.$eval('[data-cbt-timer]',node=>node.textContent));
   await page.screenshot({path:fileURLToPath(new URL('cbt-running-mobile.png',output)),fullPage:true});assert.deepEqual(errors,[]);
  }
  const exported=await get('cbt-peserta?ujian_id=1&export=xlsx');const results=new ExcelJS.Workbook();await results.xlsx.load(Buffer.from(await exported.arrayBuffer()));assert.equal(results.worksheets[0].rowCount,3);
  user.nomor_kk='';assert.equal((await get('ujian')).status,404);user.nomor_kk='456';assert.equal((await get('ujian/'+id+'/run')).status,404);user.nomor_kk='123';
  access.permissions=[];for(const resource of ['cbt-soal','cbt-ujian','cbt-peserta'])assert.equal((await get(resource)).status,403);
 }finally{if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}for(const table of created.reverse())await raw.query(`DROP TABLE IF EXISTS ${prefix+table}`);raw.release();}
});
test.after(()=>pool.end());
