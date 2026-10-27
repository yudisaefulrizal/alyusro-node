import { server } from '../src/server.js';
import { pool } from '../src/db.js';
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;
try{
 browser=await puppeteer.launch({executablePath:process.env.PDF_CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=`http://127.0.0.1:${server.address().port}`;
 await mkdir(new URL('../storage/auth-preview/',import.meta.url),{recursive:true});
 for(const width of [1440,390]){
  await page.setViewport({width,height:900});
  for(const path of ['/dashboard/login','/dashboard/register','/dashboard/password-reset/request']){
   const response=await page.goto(base+path,{waitUntil:'networkidle0'});
   if(response.status()!==200)throw Error(`${path}: ${response.status()}`);
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error(`Overflow ${path} ${width}`);
   await page.screenshot({path:fileURLToPath(new URL(`../storage/auth-preview/${path.split('/').pop()}-${width}.png`,import.meta.url)),fullPage:true});
  }
 }
 await page.goto(base+'/dashboard/login',{waitUntil:'networkidle0'});
 await page.click('.password-toggle');
 if(await page.$eval('input[name=password]',el=>el.type)!=='text')throw Error('Toggle password gagal');
 await page.goto(base+'/dashboard/edit-profile',{waitUntil:'networkidle0'});
 if(!page.url().endsWith('/dashboard/login'))throw Error('Halaman profil tidak dilindungi');
 if(errors.length)throw Error(errors.join('\n'));
 console.log('Login, daftar, lupa password: desktop/HP tanpa overflow atau exception JS; toggle password dan proteksi profil lulus.');
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));await pool.end();}
