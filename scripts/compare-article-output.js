import puppeteer from 'puppeteer-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {query,pool} from '../src/db.js';
const output=new URL('../storage/comparison/',import.meta.url);await mkdir(output,{recursive:true});
const slug=process.argv[2]||'mengenal-islam-4';
let browser;
try{
 const [article]=await query("SELECT judul,isi FROM artikels WHERE slug=? AND status='published' AND deleted_at IS NULL",[slug]);
 const text=article.isi.replace(/<[^>]*>/g,'');
 const count=re=>(text.match(re)||[]).length;
 const report={title:article.judul,slug,source:{arabicCharacters:count(/\p{Script=Arabic}/gu),zwnj:count(/\u200c/g),zwj:count(/\u200d/g),presentationForms:count(/[\ufb50-\ufdff\ufe70-\ufeff]/g),privateUse:count(/[\ue000-\uf8ff]/g),bidiControls:count(/[\u202a-\u202e\u2066-\u2069]/g),changesWithNFC:text!==text.normalize('NFC')},web:{}};
 browser=await puppeteer.launch({executablePath:process.env.PDF_CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 for(const [name,port] of [['laravel',8000],['node',8075]]){
  const page=await browser.newPage();await page.setViewport({width:1440,height:1100});await page.goto(`http://127.0.0.1:${port}/artikel/${slug}`,{waitUntil:'networkidle0',timeout:30000});
  const result=await page.evaluate(()=>{
   const body=document.querySelector('.article-body')||document.querySelector('.isi_artikel .isi_artikel');
   const elements=[...body.querySelectorAll('p')].filter(p=>/\p{Script=Arabic}/u.test(p.textContent));
   const first=elements[0];first.id='comparison-arabic';
   return {sample:first.textContent.trim(),arabicParagraphs:elements.map(p=>p.textContent.trim()),css:{family:getComputedStyle(first).fontFamily,size:getComputedStyle(first).fontSize,weight:getComputedStyle(first).fontWeight,direction:getComputedStyle(first).direction,alignment:getComputedStyle(first).textAlign}};
  });
  const cdp=await page.createCDPSession();await cdp.send('DOM.enable');await cdp.send('CSS.enable');const {root}=await cdp.send('DOM.getDocument');const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#comparison-arabic'});result.actualFonts=(await cdp.send('CSS.getPlatformFontsForNode',{nodeId})).fonts;
  const element=await page.$('#comparison-arabic');await element.screenshot({path:fileURLToPath(new URL(`web-${name}-arabic.png`,output))});
  report.web[name]=result;await page.close();
 }
 const old=report.web.laravel.arabicParagraphs;const current=report.web.node.arabicParagraphs;
 report.web.sourceParagraphsMatch=current.every((p,i)=>p===old[i]);
 await writeFile(new URL('report.json',output),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{if(browser)await browser.close();await pool.end();}
