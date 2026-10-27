import { createAdmissionsAdmin } from '../src/admissions-admin.js';
import { createReferralSources } from '../src/referral-sources.js';
import { createStatusNotes } from '../src/status-notes.js';
import { createWaliDocuments } from '../src/wali-documents.js';
import { createWaliEdit, renderForm } from '../src/wali-edit.js';
import { createWaliWidget } from '../src/wali-widget.js';
import { server } from '../src/server.js';
import { pool } from '../src/db.js';
import { authPage } from '../src/auth-views.js';
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const user={id:0,name:'Wali Santri',email:'preview@example.test',nomor_kk:'1234567890123456'};
const access={roles:['Wali santri'],permissions:['widget_NomorKkWidget','view_any_santri::wali','view_any_berkas::santri::wali','update_berkas::santri::wali','update_santri::wali','create_santri::wali','view_any_status::catatan','create_status::catatan','update_status::catatan','delete_any_status::catatan','view_any_referral::source','create_referral::source','update_referral::source','delete_any_referral::source','view_any_penerimaan::santri','create_penerimaan::santri','update_penerimaan::santri','delete_penerimaan::santri','delete_any_penerimaan::santri']};
const session={id:'preview',csrf:'preview'};
const editStudent=createWaliEdit({getConnection:async()=>({execute:async sql=>[sql.startsWith('SELECT * FROM santris')?[{id:1,no_kk:user.nomor_kk,nama:'Santri contoh',jenjang:'Madrasah',referral_source_id:1,jenis_kelamin:'Laki-laki'}]:sql.includes('program_pendidikans')?[{nama_program:'Madrasah'}]:[{id:1,name:'Teman'}]],release(){}})});
const editPage=await editStudent({user,access,id:'1',csrf:session.csrf});
const docs=createWaliDocuments(async sql=>sql.includes('LIMIT 1')?[{id:1,nama:'Santri contoh',jenjang:'Madrasah'}]:[{id:1,nama:'Santri contoh'}]);
const docList=await docs(user,access,new URLSearchParams());
const docEdit=await docs(user,access,new URLSearchParams(),'1',session.csrf);
const notes=createStatusNotes({getConnection:async()=>({execute:async()=>[[{id:1,status:'Diterima',label_tombol:'Hubungi panitia',nomor_wa:'628123456789',pesan_whatsapp:'Halo {nama}',catatan:'Silakan hubungi panitia'}]],release(){}})});
const noteList=await notes({access,action:'list',csrf:session.csrf});
const noteEdit=await notes({access,action:'edit',id:'1',csrf:session.csrf});
const referrals=createReferralSources({getConnection:async()=>({execute:async()=>[[{id:1,name:'Teman',slug:'teman',description:'Informasi dari teman',santris_count:2}]],release(){}})});
const referralList=await referrals({access,action:'list',csrf:session.csrf});
const referralEdit=await referrals({access,action:'edit',id:'1',csrf:session.csrf});
const admin=createAdmissionsAdmin({getConnection:async()=>({execute:async sql=>[sql.startsWith('SELECT * FROM penerimaan_santris')?[{id:1,program_pendidikan_id:1,tahun:'2026',gelombang:1,tanggal_mulai:'2026-01-01',tanggal_selesai:'2026-12-31',tanggal_tes:'2027-01-01',biaya_pendaftaran:250000,status:'aktif'}]:sql.includes('FROM program_pendidikans')?[{id:1,nama_program:'Madrasah'}]:[{id:1,kode_gelombang:'MD-2026-G1',tanggal_mulai:'2026-01-01',tanggal_selesai:'2026-12-31',tanggal_tes:'2027-01-01',biaya_pendaftaran:250000,status:'aktif',jumlah_santri:3}]],release(){}})});
const admissionList=await admin({access,action:'list',csrf:session.csrf});
const admissionEdit=await admin({access,action:'edit',id:'1',csrf:session.csrf});
const createPage=renderForm({no_kk:user.nomor_kk},[{nama_program:'Madrasah'}],[{id:1,name:'Teman'}],session.csrf,[],{},true);
const wali=await createWaliWidget(async sql=>sql.includes('FROM penerimaan_santris WHERE')
 ? [{kode_gelombang:'MD-2026-G1',tanggal_mulai:'2026-10-01',tanggal_selesai:'2026-10-31',phase:'active'}]
 : [{id:1,nama:'Santri contoh',nomor_pendaftaran:'MD-001',jenjang:'Madrasah',status:'sudah terverifikasi',status_defined:1,catatan:'Data sudah diperiksa',status_catatan:'Silakan hubungi panitia.',nomor_wa:'628123456789',pesan_whatsapp:'Halo {nama}, {nomor}',label_tombol:'Hubungi panitia'}])(user,access);
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;let browser;
try{
 browser=await puppeteer.launch({executablePath:process.env.PDF_CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
 page.on('request',r=>{const path=new URL(r.url()).pathname;if(r.isNavigationRequest()&&path==='/dashboard/penerimaan-santri')r.respond({status:200,contentType:'text/html',body:authPage(path,session,user,access,'',200,{module:admissionList})});else if(r.isNavigationRequest()&&path==='/dashboard/penerimaan-santri/1/edit')r.respond({status:200,contentType:'text/html',body:authPage(path,session,user,access,'',200,{module:admissionEdit})});else if(r.isNavigationRequest()&&path==='/dashboard/sumber-informasi')r.respond({status:200,contentType:'text/html',body:authPage(path,session,user,access,'',200,{module:referralList})});else if(r.isNavigationRequest()&&path==='/dashboard/sumber-informasi/1/edit')r.respond({status:200,contentType:'text/html',body:authPage(path,session,user,access,'',200,{module:referralEdit})});else if(r.isNavigationRequest()&&path==='/dashboard/status-catatan')r.respond({status:200,contentType:'text/html',body:authPage(path,session,user,access,'',200,{module:noteList})});else if(r.isNavigationRequest()&&path==='/dashboard/status-catatan/1/edit')r.respond({status:200,contentType:'text/html',body:authPage(path,session,user,access,'',200,{module:noteEdit})});else if(r.isNavigationRequest()&&path==='/dashboard/dokumen-wali')r.respond({status:200,contentType:'text/html',body:authPage(path,session,user,access,'',200,{module:docList})});else if(r.isNavigationRequest()&&path==='/dashboard/dokumen-wali/1/edit')r.respond({status:200,contentType:'text/html',body:authPage(path,session,user,access,'',200,{module:docEdit})});else if(r.isNavigationRequest()&&path==='/dashboard/santri-wali/create')r.respond({status:200,contentType:'text/html',body:authPage(path,session,user,access,'',200,{module:createPage})});else if(r.isNavigationRequest()&&path==='/dashboard/santri-wali/1/edit')r.respond({status:200,contentType:'text/html',body:authPage(path,session,user,access,'',200,{module:editPage})});else if(r.isNavigationRequest()&&['/dashboard','/dashboard/edit-profile'].includes(path))r.respond({status:200,contentType:'text/html',body:authPage(path,session,user,access,'',200,{wali})});else r.continue();});
 const dir=new URL('../storage/auth-preview/',import.meta.url);await mkdir(dir,{recursive:true});
 for(const theme of ['light','dark'])for(const width of [1440,390]){
  await page.setViewport({width,height:900});await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:theme}]);await page.goto(base+'/dashboard',{waitUntil:'networkidle0'});
  assert.equal(await page.$eval('html',e=>e.dataset.theme),theme);
  await page.evaluate(()=>document.fonts.load('24px alyusro-icon'));
  assert.equal(await page.evaluate(()=>document.fonts.check('24px alyusro-icon')),true);
  assert.match(await page.$eval('.dashboard-icon',e=>getComputedStyle(e).fontFamily),/alyusro-icon/);
  assert.equal(await page.$$eval('svg',els=>els.length),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.click('[data-wali-upload]');assert.equal(await page.$eval('.wali-upload-dialog',e=>e.open),true);assert.match(await page.$eval('#wali-upload-title',e=>e.textContent),/Pass Foto/);await page.click('[data-wali-cancel]');assert.equal(await page.$eval('.wali-upload-dialog',e=>e.open),false);
  await page.click('[data-kk-edit]');assert.equal(await page.$eval('.kk-editor',e=>e.hidden),false);await page.click('[data-kk-cancel]');assert.equal(await page.$eval('.kk-editor',e=>e.hidden),true);
  if(width===390){await page.click('.sidebar-toggle');assert.equal(await page.$eval('.sidebar-toggle',e=>e.getAttribute('aria-expanded')),'true');await page.keyboard.press('Escape');assert.equal(await page.$eval('.sidebar-toggle',e=>e.getAttribute('aria-expanded')),'false');}
  await page.screenshot({path:fileURLToPath(new URL(`dashboard-${theme}-${width}.png`,dir)),fullPage:true});
  await page.goto(base+'/dashboard/penerimaan-santri',{waitUntil:'networkidle0'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.goto(base+'/dashboard/penerimaan-santri/1/edit',{waitUntil:'networkidle0'});assert.equal(await page.$eval('input[name=tahun]',e=>e.value),'2026');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:fileURLToPath(new URL(`penerimaan-${theme}-${width}.png`,dir)),fullPage:true});
  await page.goto(base+'/dashboard/sumber-informasi',{waitUntil:'networkidle0'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.goto(base+'/dashboard/sumber-informasi/1/edit',{waitUntil:'networkidle0'});assert.equal(await page.$eval('input[name=name]',e=>e.value),'Teman');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:fileURLToPath(new URL(`sumber-informasi-${theme}-${width}.png`,dir)),fullPage:true});
  await page.goto(base+'/dashboard/status-catatan',{waitUntil:'networkidle0'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.click('[data-table-select-all]');assert.equal(await page.$eval('[data-table-select-row]',e=>e.checked),true);await page.click('[data-table-select-all]');assert.equal(await page.$eval('[data-table-select-row]',e=>e.checked),false);await page.screenshot({path:fileURLToPath(new URL(`tabel-status-${theme}-${width}.png`,dir)),fullPage:true});
  await page.goto(base+'/dashboard/status-catatan/1/edit',{waitUntil:'networkidle0'});assert.equal(await page.$eval('input[name=status]',e=>e.value),'Diterima');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:fileURLToPath(new URL(`status-catatan-${theme}-${width}.png`,dir)),fullPage:true});
  await page.goto(base+'/dashboard/dokumen-wali',{waitUntil:'networkidle0'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.goto(base+'/dashboard/dokumen-wali/1/edit',{waitUntil:'networkidle0'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:fileURLToPath(new URL(`dokumen-${theme}-${width}.png`,dir)),fullPage:true});
 }
 await page.click('.account-menu>summary');await page.click('[data-theme-choice=light]');assert.equal(await page.$eval('html',e=>e.dataset.theme),'light');await page.reload({waitUntil:'networkidle0'});assert.equal(await page.$eval('html',e=>e.dataset.theme),'light');
 await page.goto(base+'/dashboard/santri-wali/create',{waitUntil:'networkidle0'});assert.equal(await page.$eval('form[action="/dashboard/santri-wali/create"]',e=>!!e),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.goto(base+'/dashboard/santri-wali/1/edit',{waitUntil:'networkidle0'});assert.equal(await page.$eval('input[name=nama]',e=>e.value),'Santri contoh');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.goto(base+'/dashboard/edit-profile',{waitUntil:'networkidle0'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);console.log('Dashboard tiruan: desktop/HP, terang/gelap, sidebar, menu akun, persistensi tema, dan edit/batal KK lulus. Tidak memakai akun asli.');
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));await pool.end();}
