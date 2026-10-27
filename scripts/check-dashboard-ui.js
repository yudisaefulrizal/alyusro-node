import { server } from '../src/server.js';
import { pool } from '../src/db.js';
import { authPage } from '../src/auth-views.js';
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const user={id:0,name:'Wali Santri',email:'preview@example.test',nomor_kk:'1234567890123456'};
const access={roles:['Wali santri'],permissions:['widget_NomorKkWidget','view_any_santri::wali','view_any_berkas::santri::wali']};
const session={id:'preview',csrf:'preview'};
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;let browser;
try{
 browser=await puppeteer.launch({executablePath:process.env.PDF_CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
 page.on('request',r=>{const path=new URL(r.url()).pathname;if(r.isNavigationRequest()&&['/dashboard','/dashboard/edit-profile'].includes(path))r.respond({status:200,contentType:'text/html',body:authPage(path,session,user,access)});else r.continue();});
 const dir=new URL('../storage/auth-preview/',import.meta.url);await mkdir(dir,{recursive:true});
 for(const theme of ['light','dark'])for(const width of [1440,390]){
  await page.setViewport({width,height:900});await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:theme}]);await page.goto(base+'/dashboard',{waitUntil:'networkidle0'});
  assert.equal(await page.$eval('html',e=>e.dataset.theme),theme);
  await page.evaluate(()=>document.fonts.load('24px alyusro-icon'));
  assert.equal(await page.evaluate(()=>document.fonts.check('24px alyusro-icon')),true);
  assert.match(await page.$eval('.dashboard-icon',e=>getComputedStyle(e).fontFamily),/alyusro-icon/);
  assert.equal(await page.$$eval('svg',els=>els.length),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.click('[data-kk-edit]');assert.equal(await page.$eval('.kk-editor',e=>e.hidden),false);await page.click('[data-kk-cancel]');assert.equal(await page.$eval('.kk-editor',e=>e.hidden),true);
  if(width===390){await page.click('.sidebar-toggle');assert.equal(await page.$eval('.sidebar-toggle',e=>e.getAttribute('aria-expanded')),'true');await page.keyboard.press('Escape');assert.equal(await page.$eval('.sidebar-toggle',e=>e.getAttribute('aria-expanded')),'false');}
  await page.screenshot({path:fileURLToPath(new URL(`dashboard-${theme}-${width}.png`,dir)),fullPage:true});
 }
 await page.click('.account-menu>summary');await page.click('[data-theme-choice=light]');assert.equal(await page.$eval('html',e=>e.dataset.theme),'light');await page.reload({waitUntil:'networkidle0'});assert.equal(await page.$eval('html',e=>e.dataset.theme),'light');
 await page.goto(base+'/dashboard/edit-profile',{waitUntil:'networkidle0'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);console.log('Dashboard tiruan: desktop/HP, terang/gelap, sidebar, menu akun, persistensi tema, dan edit/batal KK lulus. Tidak memakai akun asli.');
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));await pool.end();}
