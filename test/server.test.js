import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.js';
import { server } from '../src/server.js';
let base;
before(async () => { await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(resolve => server.close(resolve)); await pool.end(); });
test('halaman publik dan aset tersedia', async () => {
  for (const path of ['/', '/program', '/program/madrasah', '/fasilitas', '/pendaftaran', '/style.css', '/app.js', '/assets/logo.png']) {
    const response = await fetch(base + path); assert.equal(response.status, 200, path);
    if (response.headers.get('content-type').startsWith('text/html')) { const html = await response.text(); assert.match(html, /lang="id"/); assert.doesNotMatch(html, /@yield|@section|\{\{/); }
  }
});
test('halaman tidak dikenal dan berkas privat tidak terbuka', async () => {
  for (const path of ['/tidak-ada', '/program/tidak-ada', '/.env', '/src/server.js', '/storage/berkas-santri/private.jpg']) assert.equal((await fetch(base + path)).status, 404);
});
const post = body => fetch(base + '/api/pendaftaran', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
test('validasi server menolak data tidak lengkap', async () => {
  const response = await post({}); assert.equal(response.status, 422); assert.equal(Object.keys((await response.json()).errors).length, 4);
  assert.equal((await post(null)).status, 422);
});
test('simulasi valid memberikan konfirmasi tanpa pendaftaran resmi', async () => {
  const response = await post({ name: 'Santri Contoh', phone: '081234567890', program: 'madrasah', consent: true });
  assert.equal(response.status, 200); assert.match((await response.json()).message, /tidak disimpan/);
});
test('payload rusak dan terlalu besar ditolak', async () => {
  for (const [body, status] of [['{', 400], ['x'.repeat(9000), 413]]) {
    const response = await fetch(base + '/api/pendaftaran', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }); assert.equal(response.status, status);
  }
});
test('seluruh menu publik aktif terlayani dengan tampilan lama', async () => {
  const { query } = await import('../src/db.js');
  const menus = await query("SELECT route FROM menus WHERE status = 'aktif'");
  for(const {route} of menus) {
    const response=await fetch(base+route); assert.equal(response.status,200,route);
    const html=await response.text(); assert.match(html,/css\/site\/site.css/,route);
    assert.doesNotMatch(html,/@foreach|@endsection|\{\{|\{!!/,route);
  }
});
test('halaman tambahan, kalender, dan sitemap tersedia', async () => {
 const {publicRoutes}=await import('../src/public-pages.js');
 for(const path of [...publicRoutes,'/sitemap.xml','/jadwal/shalat/Kota%20Bogor','/kalender-akademik?tahun=2026']) {
  const response=await fetch(base+path);assert.equal(response.status,200,path);
 }
});
test('redirect konversi dan tautan tidak dikenal ditangani',async()=>{
 const r=await fetch(base+'/konversi/whatsapp',{redirect:'manual'});assert.equal(r.status,302);assert.equal(r.headers.get('location'),'https://wa.me/6281938926972');
 assert.equal((await fetch(base+'/r/tidak-ada-12345')).status,404);
});
test('konversi nama membaca kamus tanpa menambah data',async()=>{
 const response=await fetch(base+'/api/konversi-nama-latin-to-arabic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nama_latin:'nama-tes-tidak-ada-123'})});assert.equal(response.status,200);assert.match((await response.json()).nama_arab,/Belum terdefinisi/);
});
test('shortener percobaan memvalidasi URL dan membuat redirect',async()=>{
 const post=body=>fetch(base+'/shorten',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await post({url:'javascript:alert(1)'})).status,422);
 const created=await post({url:'https://example.com/path',slug:'tes-'+Date.now()});assert.equal(created.status,200);
 const {short_url}=await created.json();const redirect=await fetch(base+short_url,{redirect:'manual'});assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),'https://example.com/path');
});
test('kategori, detail, dan versi cetak memakai data publik asli',async()=>{
 const {query}=await import('../src/db.js');
 for(const [sql,prefix] of [["SELECT slug FROM kategori_artikels",'/artikel/categories/'],['SELECT slug FROM kategori_fasilitas','/fasilitas/kategori/'],["SELECT slug FROM artikels WHERE status='published' AND deleted_at IS NULL LIMIT 3",'/artikel/'],['SELECT slug FROM fasilitas LIMIT 3','/fasilitas/']]) {
  const rows=await query(sql);for(const row of rows){const path=prefix+encodeURIComponent(row.slug);assert.equal((await fetch(base+path)).status,200,path);if(prefix==='/artikel/')assert.equal((await fetch(base+path+'/download')).status,200);}
 }
 const stats=await fetch(base+'/cekpsb');assert.equal(stats.status,200);assert.equal(Object.keys(await stats.json()).length,4);
});
test('aset halaman struktur dan share PSB terlayani',async()=>{
 for(const path of ['/pages/homes-struktur-organisasi-0.js','/pages/share-psb-0.js','/pages/homes-prestasi.css','/struktur/mahad.jpeg','/template/psb.png','/template/iduladha.png','/template/Twibbonz.jpg.jpeg'])assert.equal((await fetch(base+path)).status,200,path);
});
test('jadwal shalat memakai tanggal Jakarta dan menangani layanan gagal',async()=>{
 const originalFetch=globalThis.fetch;
 try {
  globalThis.fetch=(url,...args)=>{
   if(String(url).startsWith('https://api.myquran.com/v2/sholat/kota/cari/'))return Promise.resolve(Response.json({data:[{id:'1234',lokasi:'Kota Bogor'}]}));
   if(String(url).startsWith('https://api.myquran.com/v2/sholat/jadwal/'))return Promise.resolve(Response.json({status:true,data:{jadwal:{subuh:'04:20',dzuhur:'11:45',ashar:'15:00',maghrib:'17:50',isya:'19:00'}}}));
   return originalFetch(url,...args);
  };
  const response=await fetch(base+'/api/jadwal-shalat?lokasi=Kota%20Bogor');assert.equal(response.status,200);assert.equal((await response.json()).jadwal.subuh,'04:20');
  globalThis.fetch=(url,...args)=>String(url).startsWith('https://api.myquran.com/')?Promise.reject(Error('offline')):originalFetch(url,...args);
  const failed=await fetch(base+'/api/jadwal-shalat?lokasi=Kota%20Makassar');assert.equal(failed.status,502);assert.match((await failed.json()).message,/belum dapat dimuat/);
 }finally{globalThis.fetch=originalFetch;}
});
test('banner publik tersedia dari cache tanpa membuka berkas santri',async()=>{
 const response=await fetch(base+'/storage/og/og_360p.webp');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/image\/webp/);
 assert.equal((await fetch(base+'/storage/bukti-pembayaran/rahasia.jpg')).status,404);
});
test('font, logo, dan ikon memakai salinan lokal mandiri', async()=>{
 for(const path of ['/fonts/UbuntuSans-Regular.ttf','/logo/logo_al_yusro.png','/css/fontawesome/css/all.min.css','/css/fontawesome/webfonts/fa-solid-900.woff2']){
  const response=await fetch(base+path);
  assert.equal(response.status,200,path);
 }
});
test('manifest mencatat salinan terverifikasi dan data privat tidak disajikan',async()=>{
 const {readFile}=await import('node:fs/promises');
 const manifest=JSON.parse(await readFile(new URL('../storage/asset-copy-manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.summary.uploads.files,manifest.summary.uploads.verified);
 assert.equal(manifest.summary.private.files,manifest.summary.private.verified);
 const privateFile=manifest.files.private[0]?.path;
 if(privateFile) {
  const encoded=privateFile.split('/').map(encodeURIComponent).join('/');
  for(const path of ['/storage/private/'+encoded,'/private/'+encoded,'/storage/'+encoded]) assert.equal((await fetch(base+path)).status,404);
 }
 const upload=manifest.files.uploads.find(f=>/^(berkas|foto-santri|pass_foto_santri)\//.test(f.path));
 if(upload)assert.equal((await fetch(base+'/storage/'+upload.path.split('/').map(encodeURIComponent).join('/'))).status,404);
});
test('jadwal shalat mempertahankan tabel dan kontrol sumber pada semua URL lokasi',async()=>{
 for(const path of ['/jadwal/shalat','/jadwal/shalat/Kota%20Sorong','/jadwal/shalat?lokasi=Kota%20Makassar']) {
  const response=await fetch(base+path);assert.equal(response.status,200);
  const html=await response.text();
  for(const id of ['lokasi-dropdown','tanggal','tanggalHijriah','subuh','dzuhur','ashar','maghrib','isya','countdown','prayer-share','prayer-remind'])assert.ok(html.includes(`id="${id}"`),path+' '+id);
  assert.match(html,/pages\/jadwal_shalat-index.css/);assert.match(html,/type="module" src="\/prayer-page.js"/);
 }
 assert.equal((await fetch(base+'/api/jadwal-shalat?lokasi=tidak-ada')).status,422);
 assert.equal((await fetch(base+'/api/jadwal-shalat?tanggal=2020-01-01')).status,422);
});
test('kalender satu bulan mempertahankan navigasi, pencarian, tabel, dan warna database',async()=>{
 const {query}=await import('../src/db.js');
 const response=await fetch(base+'/kalender-akademik?tahun=2026&bulan=12');assert.equal(response.status,200);
 const html=await response.text();assert.match(html,/Desember 2026/);
 for(const id of ['prevMonth','nextMonth','calendar','searchInput','kalenderTable'])assert.ok(html.includes(`id="${id}"`),id);
 assert.match(html,/homes-kalender-akademik.css/);assert.match(html,/calendar-page.js/);assert.doesNotMatch(html,/class="calendar-grid"/);
 const encoded=html.match(/data-events="([^"]*)"/)[1];
 const events=JSON.parse(encoded.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&'));
 assert.ok(events.length>0);
 const [row]=await query('SELECT kegiatan FROM kalender_akademiks WHERE kegiatan = ? LIMIT 1',[events[0].kegiatan]);assert.equal(row.kegiatan,events[0].kegiatan);
 for(const path of ['/calendar-model.js','/calendar-page.js','/pages/homes-kalender-akademik.css'])assert.equal((await fetch(base+path)).status,200,path);
});
test('daftar artikel memiliki grid sorotan, kategori aktif, dan pagination lengkap',async()=>{
 const response=await fetch(base+'/artikel');const html=await response.text();assert.equal(response.status,200);
 assert.match(html,/kontainer_grid_daftar_artikel/);assert.equal((html.match(/class="gambar_kecil"/g)||[]).length,4);assert.match(html,/class="kolom_kanan"/);
 assert.equal((html.match(/<article class="kontainer_list_artikel"/g)||[]).length,10);assert.match(html,/Terbaru/);assert.match(html,/Terlama/);assert.match(html,/aria-current="page"/);
 const {query}=await import('../src/db.js');const [category]=await query("SELECT c.slug FROM kategori_artikels c JOIN artikels a ON a.kategori_artikel_id=c.id WHERE a.status='published' AND a.deleted_at IS NULL GROUP BY c.id,c.slug HAVING COUNT(*)>10 LIMIT 1");
 if(category){
  const list=await (await fetch(base+'/artikel/categories/'+encodeURIComponent(category.slug)+'?page=2')).text();
  assert.ok(list.includes('/artikel/categories/'+encodeURIComponent(category.slug)+'?page=1'));assert.match(list,/Halaman 2/);
  const queryList=await (await fetch(base+'/artikel?KategoriArtikel='+encodeURIComponent(category.slug)+'&page=2')).text();assert.ok(queryList.includes('KategoriArtikel='+encodeURIComponent(category.slug)+'&amp;page=1'));
 }
});
test('detail artikel menampilkan penulis, isi, metadata, dan tombol berbagi',async()=>{
 const {query}=await import('../src/db.js');const [article]=await query("SELECT a.slug,u.name author FROM artikels a LEFT JOIN users u ON u.id=a.penulis_id WHERE a.status='published' AND a.deleted_at IS NULL LIMIT 1");
 const response=await fetch(base+'/artikel/'+encodeURIComponent(article.slug));const html=await response.text();assert.equal(response.status,200);
 for(const text of ['class="judul_artikel"','class="thumbnail"','class="info_artikel"','class="article-body"','Penulis:','id="article-like"','id="copy-url-btn"','data-share="whatsapp"','data-share="facebook"','artikel-detail.css'])assert.ok(html.includes(text),text);
 assert.match(html,/meta name="author"/);assert.match(html,/og:type" content="article/);assert.ok(!html.includes('kontainer_grid_daftar_artikel'));
 const draft=await query("SELECT slug FROM artikels WHERE status!='published' AND deleted_at IS NULL LIMIT 1");if(draft.length)assert.equal((await fetch(base+'/artikel/'+encodeURIComponent(draft[0].slug))).status,404);
});
test('sanitasi artikel mempertahankan format dan menolak script/handler berbahaya',async()=>{
 const {articleHtml,plainText}=await import('../src/article-pages.js');
 const safe=articleHtml('<p style="text-align:right;color:#083e6b" dir="rtl">Arab &amp; Latin</p><script>alert(1)</script><img src="/storage/x.png" onerror="alert(1)"><a href="javascript:alert(1)">x</a>');
 assert.match(safe,/text-align:right/);assert.match(safe,/dir="rtl"/);assert.doesNotMatch(safe,/<script|onerror|javascript:/);assert.equal(plainText('<p>A &amp; B&nbsp;عربي</p>'),'A & B عربي');
});
test('unduhan artikel mengirim PDF asli dan menolak artikel tidak publik',async()=>{
 const {query}=await import('../src/db.js');
 const [article]=await query("SELECT slug FROM artikels WHERE status='published' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1");
 const response=await fetch(base+'/artikel/'+encodeURIComponent(article.slug)+'/download');assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/pdf');assert.match(response.headers.get('content-disposition'),/attachment; filename=".*\.pdf"/);
 const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.ok(bytes.length>10000);
 const head=await fetch(base+'/artikel/'+encodeURIComponent(article.slug)+'/download',{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.get('content-type'),'application/pdf');assert.equal((await head.arrayBuffer()).byteLength,0);
 assert.equal((await fetch(base+'/artikel/tidak-ada-12345/download')).status,404);
 const [draft]=await query("SELECT slug FROM artikels WHERE status!='published' AND deleted_at IS NULL LIMIT 1");if(draft)assert.equal((await fetch(base+'/artikel/'+encodeURIComponent(draft.slug)+'/download')).status,404);
});
