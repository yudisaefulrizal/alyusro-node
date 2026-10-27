import { calendarPage } from './calendar-page.js';
import { readFile } from 'node:fs/promises';
import sanitize from 'sanitize-html';
import { locations, locationInfo } from '../public/prayer-time.js';
import { query } from './db.js';
const staticPages = JSON.parse(await readFile(new URL('../templates/static.json',import.meta.url),'utf8'));
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rich = s => sanitize(String(s ?? ''),{allowedTags:sanitize.defaults.allowedTags.concat(['img']),allowedAttributes:{...sanitize.defaults.allowedAttributes,img:['src','alt'], '*':['class','dir']}});
const info = body => `<div class="isi_kontainer"><div class="list-info">${body}</div></div>`;
const table = (headers, rows) => `<div class="table-scroll"><table class="prestasi-table"><thead><tr>${headers.map(h=>`<th class="table-header">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr class="prestasi-row">${row.map(cell=>`<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
export const publicRoutes = [...Object.keys(staticPages),'/biaya','/kurikulum/tahfizh','/ekstrakurikuler','/prestasi','/pendidikan/tenaga/pendidik','/kalender-akademik','/kalender/akademikh','/jadwal/shalat','/konversi/nama','/idulfitri','/iduladha','/link','/seo-check','/app/hapus-bg','/upload-gambar','/generate/flayer-berduka','/generate/ijazah'];
export async function publicPage(path, search) {
 if(staticPages[path]) return staticPages[path];
 if(path==='/kurikulum/tahfizh') {
  const [p]=await query('SELECT deskripsi,kegiatan,kriteria_muhaffizh,target_hafalan,metode_tahfizh,ujian_tahfizh FROM kurikulum_tahfizhs LIMIT 1');
  return {title:'Kurikulum Tahfizh',content:info(p ? rich(p.deskripsi)+[['A. Kegiatan','kegiatan'],['B. Kriteria Muhaffizh','kriteria_muhaffizh'],['C. Target Hafalan','target_hafalan'],['D. Metode','metode_tahfizh'],['E. Ujian Tahfizh','ujian_tahfizh']].map(([label,key])=>`<h2>${label}</h2>${rich(p[key])}`).join(''):'<p>Informasi kurikulum belum tersedia.</p>')};
 }
 if(path==='/biaya') {
  const rows=await query('SELECT id,nama_program,biaya_pendaftaran,biaya_daftar_ulang,biaya_tahunan,biaya_spp,deskripsi_biaya FROM program_pendidikans');
  return {title:'Biaya Pendidikan',content:info(rows.map(p=>`<h2><a href="/program/id/${p.id}">${esc(p.nama_program)}</a></h2>${table(['Pendaftaran','Daftar Ulang','Tahunan','SPP'],[[p.biaya_pendaftaran,p.biaya_daftar_ulang,p.biaya_tahunan,p.biaya_spp]])}${rich(p.deskripsi_biaya)}`).join(''))};
 }
 if(path==='/ekstrakurikuler') return {title:'Ekstrakurikuler',content:info('<p>Informasi ekstrakurikuler belum tersedia.</p>')};
 if(path==='/prestasi') {
  const rows=await query('SELECT nama,peringkat,nama_lomba,tingkat,penyelenggara,tahun FROM prestasis ORDER BY tahun DESC');
  return {title:'Prestasi Santri Ma’had Tahfizh Al Yusro',content:info(table(['Nama','Peringkat','Perlombaan','Tingkat','Penyelenggara','Tahun'],rows.map(p=>[p.nama,p.peringkat,p.nama_lomba,p.tingkat,p.penyelenggara,p.tahun])))};
 }
 if(path==='/pendidikan/tenaga/pendidik') {
  const rows=await query('SELECT struktur,nama,level FROM struktur_mahads WHERE level IN (1,2,4) ORDER BY level,id');
  return {title:'Pendidik & Tenaga Kependidikan',content:`<div class="isi_kontainer"><div class="group-box-asatidz"><div class="asatidz">${rows.map(p=>`<div class="kepala_asatidz"><div class="pendidik_asatidz">${esc(p.struktur)}</div><div class="nama_asatidz">${esc(p.nama)}</div></div>`).join('')}</div></div></div>`};
 }
 if(path==='/kalender-akademik') return calendarPage(search);
 if(path==='/kalender/akademikh') {
  const yearNow=Number(new Intl.DateTimeFormat('en',{timeZone:'Asia/Jakarta',year:'numeric'}).format(new Date()));
  const year=Math.min(2100,Math.max(2000,Number(search.get('tahun'))||yearNow)); const hijri=path.endsWith('akademikh');
  const rows=await query('SELECT tanggal,tanggal_selesai,kegiatan,warna FROM kalender_akademiks WHERE tanggal <= ? AND COALESCE(tanggal_selesai,tanggal) >= ? ORDER BY tanggal',[`${year}-12-31`,`${year}-01-01`]);
  const date=s=>s?new Intl.DateTimeFormat(hijri?'id-ID-u-ca-islamic':'id-ID',{dateStyle:'long',timeZone:'Asia/Jakarta'}).format(new Date(String(s).slice(0,10)+'T12:00:00+07:00')):'';
  return {title:hijri?'Kalender Akademik Hijriah':'Kalender Akademik',content:info(`<form method="get" class="public-form"><label>Tahun Masehi <input name="tahun" type="number" min="2000" max="2100" value="${year}"></label><button>Tampilkan</button></form><p><a href="/kalender-akademik?tahun=${year}">Kalender Masehi</a> · <a href="/kalender/akademikh?tahun=${year}">Kalender Hijriah</a></p>${hijri?'<p>Tanggal Hijriah menggunakan perhitungan kalender browser dan dapat berbeda dari penetapan resmi.</p>':''}<div class="calendar-grid">${Array.from({length:12},(_,month)=>`<section><h3>${new Intl.DateTimeFormat('id-ID',{month:'long'}).format(new Date(year,month,1))}</h3><div class="month-grid">${['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(x=>`<b>${x}</b>`).join('')}${'<span></span>'.repeat((new Date(year,month,1).getDay()+6)%7)}${Array.from({length:new Date(year,month+1,0).getDate()},(_,d)=>{const key=`${year}-${String(month+1).padStart(2,'0')}-${String(d+1).padStart(2,'0')}`;const events=rows.filter(r=>String(r.tanggal).slice(0,10)<=key&&String(r.tanggal_selesai||r.tanggal).slice(0,10)>=key);return `<span class="${events.length?'has-event':''}" title="${esc(events.map(r=>r.kegiatan).join('; '))}">${hijri?new Intl.DateTimeFormat('id-ID-u-ca-islamic',{day:'numeric'}).format(new Date(key+'T12:00:00+07:00')):d+1}</span>`}).join('')}</div></section>`).join('')}</div>${table(['Mulai','Selesai','Kegiatan'],rows.map(r=>[date(r.tanggal),date(r.tanggal_selesai),r.kegiatan]))}`)};
 }
 if(path==='/jadwal/shalat'||path.startsWith('/jadwal/shalat/')) {
  const selected=path.startsWith('/jadwal/shalat/')?decodeURIComponent(path.slice('/jadwal/shalat/'.length)):search.get('lokasi')||'Kab. Bogor';
  const location=locationInfo(selected); if(!location) return null;
  return {title:'Jadwal Shalat',content:`<section class="container prayer-page" data-location="${esc(location.name)}" aria-label="Jadwal shalat ${esc(location.name)}">
   <div class="styled-select-container"><label class="sr-only" for="lokasi-dropdown">Pilih lokasi jadwal shalat</label><select id="lokasi-dropdown" class="styled-select">${locations.map(([name])=>`<option value="${esc(name)}" ${name===location.name?'selected':''}>${esc(name)}</option>`).join('')}</select></div>
   <h2 class="judul-container"><span id="tanggal"></span><span aria-hidden="true"> / </span><span id="tanggalHijriah"></span></h2>
   <div id="clock"></div>
   <table class="center-table"><caption class="sr-only">Waktu shalat di ${esc(location.name)} (${location.label})</caption><tbody>${[['subuh','Subuh'],['dzuhur','Dzuhur'],['ashar','Ashar'],['maghrib','Maghrib'],['isya','Isya']].map(([key,name])=>`<tr><th scope="row" class="keterangan"><strong>Shalat ${name}</strong></th><td class="titik_dua" aria-hidden="true"><strong>:</strong></td><td><span id="${key}">—</span></td></tr>`).join('')}</tbody></table>
   <div class="countdown-container" id="countdown"></div>
   <p id="prayer-status" role="status">Memuat jadwal shalat…</p><button type="button" id="prayer-retry" class="share-button" hidden>Coba lagi</button>
   <div class="prayer-actions"><button type="button" id="prayer-share" class="share-button" disabled>Share to WhatsApp</button><button type="button" id="prayer-remind" class="share-button" disabled>Minta ingatkan saya</button></div>
   <p id="reminder-status" role="status"></p>
   <p class="sumber">*sumber: <a href="https://bimasislam.kemenag.go.id/jadwalshalat" target="_blank" rel="noopener noreferrer">Kemenag</a>, <a href="https://api.myquran.com/v2/" target="_blank" rel="noopener noreferrer">MyQuran</a>.<br>Waktu mengikuti wilayah yang dipilih (${location.label}). Tanggal Hijriah merupakan hasil perhitungan kalender.</p>
   <noscript>Aktifkan JavaScript untuk menampilkan jadwal shalat, mengganti lokasi, dan memakai hitung mundur.</noscript>
  </section><script type="module" src="/prayer-page.js"></script>`};
 }
 if(path==='/konversi/nama') return {title:'Konversi nama latin ke huruf Arab',content:info('<form id="name-conversion" class="public-form"><label>Nama Latin <input name="nama_latin" maxlength="100" required placeholder="Masukkan nama"></label><button>Konversi</button><p id="conversion-result" role="status" dir="auto"></p></form>')};
 if(path==='/idulfitri'||path==='/iduladha'||path==='/generate/flayer-berduka'||path==='/generate/ijazah') {
  const kind=path.split('/').at(-1); const config={idulfitri:['Hari Raya Idul Fitri 1447 H','Twibbonz.jpg.jpeg',.45,'#220000'],iduladha:['Selamat Hari Raya Idul Adha 1446 H','iduladha.png',.568,'#0f77c0'],'flayer-berduka':['Flayer Berduka','berduka_ikhwan.jpg',.6,'#083e6b'],ijazah:['Generator Ijazah','ijazah.jpg',.5,'#083e6b']}[kind];
  return {title:config[0],content:info(`<div class="public-form"><label>Nama <input id="greeting-name" maxlength="60" placeholder="Nama Anda"></label><button id="greeting-download">Unduh PNG</button><p id="greeting-status" role="status"></p></div><canvas id="greeting-canvas" data-image="/template/${encodeURIComponent(config[1])}" data-y="${config[2]}" data-color="${config[3]}" aria-label="Pratinjau ${esc(config[0])}"></canvas>${kind==='ijazah'?'<p>Generator ini hanya membuat contoh gambar bernama. Penerbitan ijazah resmi memerlukan dashboard.</p>':''}`)};
 }
 if(path==='/link') return {title:'Singkat Link',content:info('<form id="shortener-form" class="public-form"><label>URL tujuan <input name="url" type="url" required maxlength="2048" placeholder="https://contoh.com"></label><label>Slug (opsional) <input name="slug" maxlength="50" pattern="[A-Za-z0-9-]{4,50}"></label><button>Buat tautan percobaan</button><p>Tautan percobaan berlaku selama server Node.js berjalan. Tautan lama tetap dibaca dari database.</p><p id="short-result" role="status"></p></form>')};
 if(path==='/seo-check') return {title:'Cek SEO',content:info('<form id="seo-form" class="public-form"><label>Alamat website <input type="url" name="url" required placeholder="https://mahadalyusro.sch.id"></label><button>Buka analisis PageSpeed</button></form>')};
 if(path==='/app/hapus-bg') return {title:'Hapus Background',content:info('<form id="remove-bg" class="public-form"><label>Pilih gambar (maksimal 2 MB) <input type="file" name="file" accept="image/png,image/jpeg,image/webp" required></label><p>Gambar akan dikirim ke layanan matha.site, sama seperti aplikasi lama.</p><button>Hapus background</button><p id="bg-result" role="status"></p></form>')};
 if(path==='/upload-gambar') return {title:'Upload Foto Santri',content:info('<p>Unggah foto santri melalui dashboard agar foto terhubung dengan akun dan data santri yang benar.</p><a href="/dashboard/login">Masuk dashboard</a>')};
 return null;
}
