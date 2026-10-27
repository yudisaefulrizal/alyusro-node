import sanitize from 'sanitize-html';
import {query} from './db.js';
export const escapeArticle=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc=escapeArticle;
export function plainText(value){
 return sanitize(String(value??''),{allowedTags:[],allowedAttributes:{}}).replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39|#x[\da-f]+|#\d+);/gi,e=>{
  const names={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'",'&nbsp;':' '};if(names[e])return names[e];
  const n=e.startsWith('&#x')?parseInt(e.slice(3,-1),16):parseInt(e.slice(2,-1),10);return Number.isFinite(n)&&n>0&&n<=0x10ffff?String.fromCodePoint(n):e;
 }).replace(/\s+/g,' ').trim();
}
const limit=(value,n)=>{const text=plainText(value);return text.length>n?text.slice(0,n).trimEnd()+'...':text;};
const image=value=>'/storage/'+String(value??'').split('/').map(encodeURIComponent).join('/');
export const articleHref=slug=>'/artikel/'+encodeURIComponent(slug);
export function articleHtml(value){
 return sanitize(String(value??''),{
  allowedTags:sanitize.defaults.allowedTags.concat(['img']),
  allowedAttributes:{...sanitize.defaults.allowedAttributes,'*':['class','dir','style','lang'],a:['href','title','target','rel'],img:['src','alt','title','width','height','loading'],td:['colspan','rowspan','style'],th:['colspan','rowspan','scope','style']},
  allowedStyles:{'*':{'text-align':[/^(?:left|right|center|justify)$/],'direction':[/^(?:rtl|ltr)$/],'color':[/^#[\da-f]{3,8}$/i,/^rgba?\([\d\s.,%]+\)$/,/^[a-z]+$/i],'background-color':[/^#[\da-f]{3,8}$/i,/^rgba?\([\d\s.,%]+\)$/],'font-size':[/^\d+(?:\.\d+)?(?:px|em|rem|%)$/],'font-weight':[/^(?:normal|bold|[1-9]00)$/],'font-style':[/^(?:normal|italic)$/],'text-decoration':[/^(?:underline|line-through|none)$/],'width':[/^\d+(?:\.\d+)?(?:px|%)$/]}},
  transformTags:{a:(tag,attrs)=>({tagName:tag,attribs:{...attrs,...(attrs.target==='_blank'?{rel:'noopener noreferrer'}:{})}}),img:(tag,attrs)=>({tagName:tag,attribs:{...attrs,src:(attrs.src||'').replace(/^https?:\/\/(?:www\.)?mahadalyusro\.sch\.id\/storage\//i,'/storage/'),loading:'lazy'}})},
 });
}
function relativeDate(value){
 const date=new Date(String(value).replace(' ','T')+'+07:00');const seconds=Math.round((date-new Date())/1000);
 if(!Number.isFinite(seconds))return '';
 const formatter=new Intl.RelativeTimeFormat('id-ID',{numeric:'auto'});
 for(const [unit,size] of [['year',31536000],['month',2592000],['day',86400],['hour',3600],['minute',60]])if(Math.abs(seconds)>=size)return formatter.format(Math.round(seconds/size),unit);
 return formatter.format(seconds,'second');
}
const categoryLink=slug=>'/artikel/categories/'+encodeURIComponent(slug);
function categoriesHtml(categories,active,detail=false){return `<nav class="temukan_informasi article-categories" aria-label="Kategori artikel"><a class="kategori ${!active?'active':''}" href="/artikel" ${!active?'aria-current="page"':''}>${detail?'← kembali':'Semua'}</a>${categories.map(c=>`<a class="kategori ${c.slug===active?'active':''}" href="${categoryLink(c.slug)}" ${c.slug===active?'aria-current="page"':''}>${esc(c.nama)}</a>`).join('')}</nav>`;}
function pagination(path,search,page,last){
 const href=n=>{const params=new URLSearchParams();if(search.get('KategoriArtikel')&&path==='/artikel')params.set('KategoriArtikel',search.get('KategoriArtikel'));params.set('page',n);return path+'?'+esc(params.toString());};
 const button=(n,label,className='')=>`<div class="${className}"><a href="${href(n)}" aria-label="${label==='‹'?'Halaman sebelumnya':label==='›'?'Halaman selanjutnya':esc(label)}">${esc(label)}</a></div>`;
 const numbers=[...new Set([1,...Array.from({length:5},(_,i)=>page-2+i).filter(n=>n>=1&&n<=last),last])].sort((a,b)=>a-b);
 let previous=0;const links=numbers.map(n=>{const gap=n>previous+1?'<span class="pagination-gap">…</span>':'';previous=n;return gap+(n===page?`<div class="active"><span aria-current="page" aria-label="Halaman ${n}">${n}</span></div>`:button(n,String(n)));}).join('');
 return `<nav class="paginasi_kontainer" aria-label="Halaman artikel">${page>1?button(page-1,'‹','sebelumnya'):'<div class="sebelumnya disabled" aria-disabled="true"><span>‹</span></div>'}<div class="list_paginasi">${button(1,'Terbaru')}${links}${button(last,'Terlama')}</div>${page<last?button(page+1,'›','selanjutnya'):'<div class="selanjutnya disabled" aria-disabled="true"><span>›</span></div>'}</nav>`;
}
export async function articlePage(path,search){
 const categories=await query('SELECT id,nama,slug FROM kategori_artikels ORDER BY id');
 const categoryMatch=path.match(/^\/artikel\/categories\/([^/]+)$/);
 const categorySlug=categoryMatch?decodeURIComponent(categoryMatch[1]):path==='/artikel'?search.get('KategoriArtikel'):null;
 const category=categorySlug?categories.find(c=>c.slug===categorySlug):null;if(categorySlug&&!category)return null;
 const detail=path.match(/^\/artikel\/([^/]+)$/);
 if(detail){
  const slug=decodeURIComponent(detail[1]);
  const [a]=await query("SELECT a.id,a.judul,a.slug,a.isi,a.thumbnail,a.views,a.`like`,a.created_at,a.kategori_artikel_id,u.name AS author FROM artikels a LEFT JOIN users u ON u.id=a.penulis_id WHERE a.slug=? AND a.status='published' AND a.deleted_at IS NULL LIMIT 1",[slug]);if(!a)return null;
  const active=categories.find(c=>c.id===a.kategori_artikel_id)?.slug;
  const shareUrl=(process.env.PUBLIC_URL||'http://127.0.0.1:8075')+articleHref(a.slug);
  const description=limit(a.judul+', '+plainText(a.isi),155);const author=a.author||'Tim Ma’had Al Yusro';
  const extra=`<link rel="stylesheet" href="/pages/artikel-detail.css"><link rel="stylesheet" href="/pages/article-fixes.css"><meta name="description" content="${esc(description)}"><meta name="author" content="${esc(author)}"><meta property="og:type" content="article"><meta property="og:title" content="${esc(plainText(a.judul))}"><meta property="og:description" content="${esc(description)}"><meta property="og:image" content="${esc((process.env.PUBLIC_URL||'http://127.0.0.1:8075')+image(a.thumbnail))}"><meta property="og:url" content="${esc(shareUrl)}"><meta name="twitter:card" content="summary_large_image">`;
  return {title:limit(a.judul,50),extra,content:`<article class="article-detail" data-slug="${esc(a.slug)}">${categoriesHtml(categories,active,true)}<h1 class="judul_artikel">${esc(plainText(a.judul))}</h1><div class="isi_artikel"><img class="thumbnail" src="${image(a.thumbnail)}" alt="${esc(plainText(a.judul))}"><div class="info_artikel"><div class="like">${Number(a.like)||0} Likes</div><div class="view">${Number(a.views)||0} Views</div><time class="tanggal" datetime="${esc(String(a.created_at).replace(' ','T')+'+07:00')}">${esc(a.created_at)}</time></div><div class="isi_artikel"><div class="article-body">${articleHtml(a.isi)}</div><div class="penulis"><strong>Penulis: ${esc(author)}</strong></div><p>Nabi ﷺ Bersabda : "Barangsiapa yang menunjukkan kebaikan kepada orang lain, maka baginya pahala seperti orang yang melakukannya". [HR. Muslim: 1893]</p><p>klik tombol di bawah untuk bagikan informasi ini,<br>‎جزاكم الله خيرا</p><div class="tombol-group"><button type="button" class="tombol" id="article-like" aria-pressed="false" title="Sukai artikel di perangkat ini" aria-label="Sukai artikel di perangkat ini"><i class="ysr-like" aria-hidden="true"></i></button><a href="https://api.whatsapp.com/send?text=${encodeURIComponent(a.judul+' - '+shareUrl)}" target="_blank" rel="noopener noreferrer" class="tombol" title="Share ke WhatsApp" aria-label="Share ke WhatsApp" data-share="whatsapp"><i class="ysr-whatsapps" aria-hidden="true"></i></a><a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}" target="_blank" rel="noopener noreferrer" class="tombol" title="Share ke Facebook" aria-label="Share ke Facebook" data-share="facebook"><i class="ysr-facebook" aria-hidden="true"></i></a><button type="button" class="tombol" id="copy-url-btn" data-url="${esc(shareUrl)}" title="Salin URL" aria-label="Salin URL"><i class="ysr-link" aria-hidden="true"></i></button><a href="${articleHref(a.slug)}/download" class="tombol" title="Unduh PDF artikel" aria-label="Unduh PDF artikel"><i class="ysr-download" aria-hidden="true"></i></a></div><p id="article-action-status" role="status"></p></div></div>${categoriesHtml(categories,active,true)}</article><script src="/article-page.js" defer></script>`};
 }
 if(path!=='/artikel'&&!categoryMatch)return null;
 const where=" WHERE a.status='published' AND a.deleted_at IS NULL"+(category?' AND a.kategori_artikel_id=?':'');const params=category?[category.id]:[];
 const [{total}]=await query('SELECT COUNT(*) total FROM artikels a'+where,params);const last=Math.max(1,Math.ceil(Number(total)/10));
 const page=Math.min(last,Math.max(1,Number.parseInt(search.get('page'),10)||1));
 const fields='SELECT a.id,a.judul,a.slug,a.isi,a.thumbnail,a.views,a.`like`,a.created_at FROM artikels a';
 const rows=await query(fields+where+` ORDER BY a.created_at DESC,a.id DESC LIMIT 10 OFFSET ${(page-1)*10}`,params);
 const featured=await query(fields+where+' ORDER BY RAND() LIMIT 5',params);const hero=featured[4]||featured[0];
 const tiles=featured.slice(0,4).map(a=>`<div class="gambar_kecil"><a href="${articleHref(a.slug)}"><img src="${image(a.thumbnail)}" alt="${esc(a.judul)}"><div class="judul"><h4>${esc(limit(a.judul,30))}</h4></div></a></div>`).join('');
 const grid=hero?`<div class="kontainer_grid_daftar_artikel"><div class="daftar_grid_artikel"><div class="kolom_kiri"><div class="kontainer_gambar_kecil">${tiles}</div></div><div class="kontainer_gambar_besar"><div class="kolom_kanan"><a href="${articleHref(hero.slug)}"><img src="${image(hero.thumbnail)}" alt="${esc(hero.judul)}"><div class="body"><h2>${esc(limit(hero.isi,70))}</h2></div><div class="judul">${esc(hero.judul)}</div></a></div></div></div></div>`:'';
 const list=rows.map(a=>`<article class="kontainer_list_artikel"><a class="thumbnail_list_artikel" href="${articleHref(a.slug)}"><img src="${image(a.thumbnail)}" alt="${esc(a.judul)}" loading="lazy"></a><div class="isi_list_artikel"><h2 class="judul_list_artikel"><a href="${articleHref(a.slug)}">${esc(plainText(a.judul))}</a></h2><div class="info_list_artikel"><div class="like">${Number(a.like)||0} Likes</div><div class="view">${Number(a.views)||0} Views</div><time class="tanggal" title="${esc(a.created_at)}">${esc(relativeDate(a.created_at))}</time></div><div class="cuplikasi_isi_konten">${esc(limit(a.isi,200))}</div><a class="baca_penuh" href="${articleHref(a.slug)}">Selengkapnya</a></div></article>`).join('');
 return {title:category?category.nama:'Al Yusro Info',extra:'<link rel="stylesheet" href="/css/site/pages/artikel-index.css"><link rel="stylesheet" href="/pages/article-fixes.css">',content:`<section class="article-list">${categoriesHtml(categories,categorySlug)}${grid}${list||'<p class="article-empty">Belum ada artikel dalam kategori ini.</p>'}${Number(total)?pagination(path,search,page,last):''}</section>`};
}
