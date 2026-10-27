import puppeteer from 'puppeteer-core';
import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {query} from './db.js';
import {articleHtml,escapeArticle,plainText} from './article-pages.js';
const esc=escapeArticle;
const uploads=fileURLToPath(new URL('../storage/uploads/',import.meta.url));
let active=0;
async function font(path){return (await readFile(new URL(path,import.meta.url))).toString('base64');}
let fontCache;
const fonts=()=>fontCache??=Promise.all([
 font('../assets/pdf-fonts/DejaVuSansCondensed.ttf'),font('../assets/pdf-fonts/DejaVuSansCondensed-Bold.ttf'),
 font('../assets/pdf-fonts/DejaVuSansCondensed-Oblique.ttf'),font('../assets/pdf-fonts/DejaVuSansCondensed-BoldOblique.ttf'),
 font('../assets/pdf-fonts/XB Riyaz.ttf'),font('../assets/pdf-fonts/XB RiyazBd.ttf'),
 font('../assets/pdf-fonts/XB RiyazIt.ttf'),font('../assets/pdf-fonts/XB RiyazBdIt.ttf'),
]);
async function embeddedImage(path){
 try{
  if(!path||path.includes('\0'))return null;
  const root=await realpath(uploads);const target=await realpath(resolve(root,path));
  if(!target.startsWith(root+sep)||(await stat(target)).size>15*1024*1024)return null;
  const mime={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif'}[extname(target).toLowerCase()];if(!mime)return null;
  return `data:${mime};base64,${(await readFile(target)).toString('base64')}`;
 }catch{return null;}
}
export async function articlePdfHtml(article){
 const [regular,bold,italic,boldItalic,arabic,arabicBold,arabicItalic,arabicBoldItalic]=await fonts();
 const thumbnail=await embeddedImage(article.thumbnail);
 let body=articleHtml(article.isi);
 // Only inline locally available published content images. The renderer never fetches remote URLs.
 const images=[...body.matchAll(/<img\b[^>]*>/g)];
 for(const [tag] of images){
  const source=tag.match(/\bsrc="([^"]*)"/)?.[1];let data=null;
  if(source?.startsWith('/storage/'))try{data=await embeddedImage(decodeURIComponent(source.slice(9).replace(/&amp;/g,'&')));}catch{}
  body=body.replace(tag,data?tag.replace(/\bsrc="[^"]*"/,`src="${data}"`).replace(/\bloading="lazy"/,'loading="eager"'):'<p class="image-unavailable">[Gambar dalam artikel belum tersedia]</p>');
 }
 const title=plainText(article.judul);const author=article.author||'Tim Ma’had Al Yusro';
 const date=article.created_at?new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'long',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date(String(article.created_at).slice(0,10)+'T12:00:00+07:00')):'';
 return `<!doctype html><html lang="id"><head><meta charset="UTF-8"><title>${esc(title)}</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'"><style>
 @font-face{font-family:DejaVuSansCondensed;src:url(data:font/ttf;base64,${regular}) format('truetype');font-weight:400;font-style:normal}
 @font-face{font-family:DejaVuSansCondensed;src:url(data:font/ttf;base64,${bold}) format('truetype');font-weight:600 900;font-style:normal}
 @font-face{font-family:DejaVuSansCondensed;src:url(data:font/ttf;base64,${italic}) format('truetype');font-weight:400;font-style:italic}
 @font-face{font-family:DejaVuSansCondensed;src:url(data:font/ttf;base64,${boldItalic}) format('truetype');font-weight:600 900;font-style:italic}
 @font-face{font-family:XBRiyaz;src:url(data:font/ttf;base64,${arabic}) format('truetype');font-weight:400;font-style:normal}
 @font-face{font-family:XBRiyaz;src:url(data:font/ttf;base64,${arabicBold}) format('truetype');font-weight:600 900;font-style:normal}
 @font-face{font-family:XBRiyaz;src:url(data:font/ttf;base64,${arabicItalic}) format('truetype');font-weight:400;font-style:italic}
 @font-face{font-family:XBRiyaz;src:url(data:font/ttf;base64,${arabicBoldItalic}) format('truetype');font-weight:600 900;font-style:italic}
 @page{size:A4}*{box-sizing:border-box}body{font-family:DejaVuSansCondensed,XBRiyaz,serif;font-size:12px;line-height:1.8;color:#161616;margin:0}h1{text-align:center;font-size:19px;line-height:1.5;margin:0 0 12px;break-after:avoid}h2,h3,h4{break-after:avoid;line-height:1.5}p{margin:0 0 12px;orphans:3;widows:3}a{color:#083e6b;overflow-wrap:anywhere}.meta{font-size:12px;margin-bottom:15px;text-align:left;color:#444}.thumbnail{text-align:center;margin:0 0 18px;break-inside:avoid}.thumbnail img{max-width:100%;max-height:155mm;object-fit:contain;display:block;margin:auto}.content{text-align:justify;overflow-wrap:anywhere}.content img{max-width:100%;max-height:220mm;height:auto;object-fit:contain;break-inside:avoid}.content blockquote{margin:12px 0;padding:0 15px;border-inline-start:2px solid #ddd}.content li{margin-bottom:6px;orphans:3;widows:3}.content table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px}.content td,.content th{border:1px solid #ddd;padding:5px;overflow-wrap:anywhere}.content tr{break-inside:avoid}.content pre{white-space:pre-wrap}.content .pdf-arabic{font-family:XBRiyaz,DejaVuSansCondensed,serif;font-size:14px;line-height:2;text-align:center}.source{font-size:11px;border-top:1px solid #ddd;margin-top:20px;padding-top:10px;text-align:center;break-inside:avoid}.image-unavailable{font-size:11px;color:#777;text-align:center}
 </style></head><body><h1>${esc(title)}</h1><div class="meta">Ditulis oleh: ${esc(author)}<br>Tanggal: ${esc(date)}</div>${thumbnail?`<div class="thumbnail"><img src="${thumbnail}" alt="${esc(title)}"></div>`:''}<main class="content">${body}</main><div class="source">Artikel ini diunduh dari <strong>mahadalyusro.sch.id</strong></div></body></html>`;
}
export async function renderArticlePdf(article){
 if(active>=2)throw Object.assign(new Error('Pembuatan PDF sedang penuh. Silakan coba lagi.'),{status:503});
 active++;let browser;
 try{
  const html=await articlePdfHtml(article);
  browser=await puppeteer.launch({executablePath:process.env.PDF_CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'],timeout:20000});
  const page=await browser.newPage();await page.setJavaScriptEnabled(false);await page.setRequestInterception(true);
  page.on('request',request=>request.url().startsWith('data:')||request.url()==='about:blank'?request.continue():request.abort());
  await page.setContent(html,{waitUntil:'load',timeout:20000});
  await page.evaluate(async()=>{
   await document.fonts.ready;
   await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));
   for(const element of document.querySelectorAll('.content p,.content li,.content blockquote,.content h2,.content h3')){
    if(element.children.length&&element.querySelector('p,li,blockquote'))continue;
    const text=element.textContent;const arabic=(text.match(/\p{Script=Arabic}/gu)||[]).length;const latin=(text.match(/[a-z]/gi)||[]).length;
    if(arabic>latin){element.classList.add('pdf-arabic');if(!element.hasAttribute('dir'))element.dir='rtl';}
   }
  });
  return Buffer.from(await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true,margin:{top:'15mm',bottom:'18mm',left:'15mm',right:'15mm'},displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="font-family:Arial,sans-serif;font-size:9px;color:#777;text-align:center;width:100%;"><span>Ma’had Tahfizh Al Yusro · </span><span class="pageNumber"></span> / <span class="totalPages"></span></div>',timeout:25000}));
 }finally{try{if(browser)await browser.close();}finally{active--;}}
}
export async function handleArticlePdf(req,res,path){
 const match=path.match(/^\/artikel\/([^/]+)\/download$/);if(!match||!['GET','HEAD'].includes(req.method))return false;
 let slug;try{slug=decodeURIComponent(match[1]);}catch{res.writeHead(400,{'Content-Type':'text/plain; charset=utf-8'});res.end('Alamat artikel tidak valid.');return true;}
 const [article]=await query("SELECT a.judul,a.slug,a.isi,a.thumbnail,a.created_at,u.name author FROM artikels a LEFT JOIN users u ON u.id=a.penulis_id WHERE a.slug=? AND a.status='published' AND a.deleted_at IS NULL LIMIT 1",[slug]);
 if(!article){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Artikel tidak ditemukan.');return true;}
 const filename=(article.slug.replace(/[^a-z0-9._-]/gi,'-').slice(0,140)||'artikel')+'.pdf';
 try{
  const pdf=req.method==='HEAD'?null:await renderArticlePdf(article);
  res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(article.slug+'.pdf')}`,'Cache-Control':'private, no-store',...(pdf?{'Content-Length':pdf.length}:{})});res.end(pdf);
 }catch(error){console.error('Article PDF:',error.message);res.writeHead(error.status||503,{'Content-Type':'text/plain; charset=utf-8','Retry-After':'5'});res.end(error.status?error.message:'PDF belum dapat dibuat. Silakan coba lagi.');}
 return true;
}
