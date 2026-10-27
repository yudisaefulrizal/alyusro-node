import puppeteer from 'puppeteer-core';
let active=0;
export async function renderDocument(html,{width,height,format='pdf'}={}) {
 if(active>=2){const error=new Error('Pencetakan sedang sibuk. Coba kembali.');error.status=503;throw error;}
 active++;let browser;
 try {
  browser=await puppeteer.launch({executablePath:process.env.PDF_CHROME_PATH || '/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],timeout:20000});
  const page=await browser.newPage();await page.setJavaScriptEnabled(false);await page.setRequestInterception(true);
  page.on('request',request=>request.url().startsWith('data:')||request.url()==='about:blank'?request.continue():request.abort());
  if(width&&height)await page.setViewport({width,height,deviceScaleFactor:1});
  await page.setContent(html,{waitUntil:'load',timeout:20000});await page.evaluate(()=>document.fonts.ready);
  return Buffer.from(format==='png'?await page.screenshot({type:'png'}):await page.pdf({format:'A4',preferCSSPageSize:true,printBackground:true,timeout:25000}));
 }finally{try{if(browser)await browser.close();}finally{active--;}}
}
