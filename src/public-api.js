import { locationInfo, localDate, followingDate, prayers } from '../public/prayer-time.js';
import { randomBytes } from 'node:crypto';
import { query } from './db.js';
import { publicRoutes } from './public-pages.js';
const links = new Map();
const limits = new Map();
const cache = new Map();
const redirects = {facebook:'https://www.facebook.com/MahadTahfizhAlYusro',instagram:'https://www.instagram.com/mahadtahfizhalyusro/',youtube:'https://www.youtube.com/watch?v=UyTGpbTa9SQ',whatsapp:'https://wa.me/6281938926972',map:'https://maps.app.goo.gl/3H8h2iucQwDajhV39','masuk-grup-info':'https://chat.whatsapp.com/Jzgyvh5NoxKAMfUn32Fkay','mencoba-daftar':'/dashboard/register'};
async function jsonBody(req, limit=8192) {
 let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>limit)throw Object.assign(new Error('Ukuran data terlalu besar.'),{status:413});chunks.push(chunk);}
 return Buffer.concat(chunks);
}
async function upstream(url) {const r=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Layanan eksternal tidak merespons.');return r.json();}
export async function handlePublicApi(req,res,send,path,search) {
 const json=(status,data)=>send(status,'application/json',JSON.stringify(data));
 const redirect=url=>{res.writeHead(302,{Location:url});res.end();};
 if(req.method==='GET'||req.method==='HEAD') {
  if(path.startsWith('/konversi/')&&redirects[path.slice(10)]){redirect(redirects[path.slice(10)]);return true;}
  if(path.startsWith('/r/')){
   const code=path.slice(3);if(!/^[A-Za-z0-9-]{4,50}$/.test(code)){send(404,'text/plain','Tautan tidak ditemukan.');return true;}
   const rows=links.has(code)?[{original_url:links.get(code)}]:await query('SELECT original_url FROM short_links WHERE short_code = ? LIMIT 1',[code]);
   if(rows[0]&&/^https?:\/\//i.test(rows[0].original_url))redirect(rows[0].original_url);else send(404,'text/plain','Tautan tidak ditemukan.');return true;
  }
  if(path==='/sitemap.xml') {
   const menus=await query("SELECT route FROM menus WHERE status = 'aktif'");
   const articles=await query("SELECT slug FROM artikels WHERE status = 'published' AND deleted_at IS NULL");
   const facilities=await query('SELECT slug FROM fasilitas');
   const base=process.env.PUBLIC_URL||'http://127.0.0.1:8075';
   const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
   const paths=[...new Set([...menus.map(m=>m.route),...publicRoutes,...articles.map(a=>'/artikel/'+encodeURIComponent(a.slug)),...facilities.map(f=>'/fasilitas/'+encodeURIComponent(f.slug))])];
   send(200,'application/xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.filter(p=>p.startsWith('/')).map(p=>`<url><loc>${esc(base+p)}</loc></url>`).join('')}</urlset>`);return true;
  }
  if(path==='/cekpsb') {
   const response={}; const statuses=['belum terverifikasi','sudah terverifikasi','diterima','Tidak lulus seleksi','sudah daftar ulang'];
   for(const [key,label,jenjang,prefix] of [['darul_ilmi','Darul Ilmi',"darul 'ilmi",'DI'],['madrasah','Madrasah','madrasah','MD'],['mahdon_tarbawi','Mahdon Tarbawi','mahdon tarbawi','MT'],['mahad_aly',"Ma'had 'Aly","ma'had 'aly",'MA']]) {
    const [latest]=await query('SELECT kode_gelombang FROM penerimaan_santris WHERE kode_gelombang LIKE ? ORDER BY id DESC LIMIT 1',[prefix+'%']);
    if(!latest){response[key]=label+': belum ada data pendaftar.';continue;}
    const year=latest.kode_gelombang.split('-')[1];
    const rows=await query(`SELECT s.status, COUNT(*) total, SUM(s.jenis_kelamin = 'laki-laki') ikhwan, SUM(s.jenis_kelamin = 'perempuan') akhwat FROM santris s JOIN penerimaan_santris p ON p.id=s.penerimaan_santri_id WHERE s.jenjang=? AND p.kode_gelombang LIKE ? AND s.status IN (${statuses.map(()=>'?').join(',')}) GROUP BY s.status`,[jenjang,prefix+'-'+year+'-%',...statuses]);
    response[key]=`${label} TA ${year}: total ${rows.reduce((sum,r)=>sum+Number(r.total),0)} santri. `+rows.map(r=>`${r.status}: ${r.total} (${r.ikhwan} ikhwan, ${r.akhwat} akhwat)`).join('. ');
   }
   json(200,response);return true;
  }
  if(path==='/api/jadwal-shalat') {
   const info=locationInfo(search.get('lokasi')||'Kab. Bogor');if(!info){json(422,{message:'Lokasi tidak valid.'});return true;}
   const location=info.name; const current=localDate(new Date(),info.timeZone); const date=search.get('tanggal')||current;
   if(![current,followingDate(current)].includes(date)){json(422,{message:'Pilih jadwal hari ini atau esok hari.'});return true;}
   const key=location+date;
   try {
    if(!cache.has(key)) {
     const cities=await upstream('https://api.myquran.com/v2/sholat/kota/cari/'+encodeURIComponent(location));
     const city=cities.data?.find(c=>c.lokasi.toLowerCase()===location.toLowerCase());if(!city){json(404,{message:'Lokasi tidak ditemukan.'});return true;}
     const result=await upstream(`https://api.myquran.com/v2/sholat/jadwal/${encodeURIComponent(city.id)}/${date}`);
     if(!result.status||!prayers.every(([key])=>/^([01]\d|2[0-3]):[0-5]\d$/.test(result.data?.jadwal?.[key]||'')))throw Error('Jadwal belum tersedia.');
     if(cache.size>100)cache.clear();cache.set(key,result.data.jadwal);
    }
    json(200,{lokasi:location,date,timeZone:info.timeZone,zona:info.label,jadwal:cache.get(key)});
   }catch{json(502,{message:'Jadwal shalat belum dapat dimuat dari MyQuran. Silakan coba lagi.'});}
   return true;
  }
 }
 if(req.method==='POST'&&['/shorten','/api/konversi-nama-latin-to-arabic','/app/hapus-bg'].includes(path)) {
  try {
   // Browser requests must come from this application; non-browser local test clients omit Origin.
   if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host){json(403,{message:'Asal permintaan tidak diizinkan.'});return true;}
   if(path==='/app/hapus-bg') {
    const buffer=await jsonBody(req,2*1024*1024+16384);
    const form=await new Response(buffer,{headers:{'Content-Type':req.headers['content-type']||''}}).formData();
    const file=form.get('file');if(!file||file.size>2*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type)){json(422,{message:'Gunakan gambar PNG/JPEG/WebP maksimal 2 MB.'});return true;}
    const outgoing=new FormData();outgoing.set('file',file);
    const response=await fetch('https://matha.site/remove-bg/',{method:'POST',body:outgoing,signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw Error('Layanan penghapus background tidak tersedia.');const body=await response.json();
    if(!body.image_base64||body.image_base64.length>16000000||!/^[A-Za-z0-9+/=\s]+$/.test(body.image_base64))throw Error('Hasil gambar tidak valid.');
    json(200,{image_base64:body.image_base64});return true;
   }
   if(!req.headers['content-type']?.startsWith('application/json')){json(415,{message:'Gunakan JSON.'});return true;}
   let data;try{data=JSON.parse((await jsonBody(req)).toString());}catch(error){if(error.status)throw error;json(400,{message:'JSON tidak valid.'});return true;}
   if(!data||typeof data!=='object'){json(422,{message:'Data tidak valid.'});return true;}
   if(path==='/shorten') {
    const key=req.socket.remoteAddress;const now=Date.now();let limit=limits.get(key);if(!limit||now-limit.start>86400000){limit={count:0,start:now};limits.set(key,limit);}if(limit.count>=50){json(429,{message:'Batas 50 tautan per hari tercapai.'});return true;}
    let target;try{target=new URL(data.url);}catch{json(422,{message:'URL tidak valid.'});return true;}
    if(!['http:','https:'].includes(target.protocol)||target.username||target.password||target.href.length>2048){json(422,{message:'URL tidak valid.'});return true;}
    let code=data.slug||randomBytes(4).toString('hex');if(typeof code!=='string'||!/^[A-Za-z0-9-]{4,50}$/.test(code)){json(422,{message:'Slug 4–50 karakter: huruf, angka, atau tanda hubung.'});return true;}
    if(links.has(code)||(await query('SELECT id FROM short_links WHERE short_code = ? LIMIT 1',[code])).length){json(409,{message:'Slug sudah digunakan.'});return true;}
    links.set(code,target.href);limit.count++;json(200,{status:true,code,short_url:`/r/${code}`});return true;
   }
   if(typeof data.nama_latin!=='string'||!data.nama_latin.trim()||data.nama_latin.length>100){json(422,{message:'Nama wajib diisi, maksimal 100 karakter.'});return true;}
   const words=data.nama_latin.trim().toLowerCase().split(/\s+/);const parts=[];
   for(let i=0;i<words.length;i++){let word=words[i];if(['al','az','el'].includes(word)&&i+1<words.length)word+=' '+words[++i];parts.push(word);}
   const rows=await query(`SELECT nama_latin,nama_arab FROM perpustakaan_namas WHERE LOWER(nama_latin) IN (${parts.map(()=>'?').join(',')})`,parts);
   const names=new Map(rows.map(r=>[r.nama_latin.toLowerCase(),r.nama_arab]));json(200,{nama_arab:parts.map(p=>names.get(p)||`${p} Belum terdefinisi`).join(' ')});return true;
  }catch(error){json(error.status||502,{message:error.status?error.message:'Layanan belum dapat memproses permintaan. Silakan coba lagi.'});return true;}
 }
 return false;
}
