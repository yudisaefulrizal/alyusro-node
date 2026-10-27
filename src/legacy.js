import { readFile } from 'node:fs/promises';
import sanitize from 'sanitize-html';
import { query } from './db.js';
import { articlePage } from './article-pages.js';
import { publicPage } from './public-pages.js';
const home = await readFile(new URL('../templates/home.html', import.meta.url), 'utf8');
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const html = value => sanitize(String(value ?? ''), { allowedTags: sanitize.defaults.allowedTags.concat(['img']), allowedAttributes: { ...sanitize.defaults.allowedAttributes, img: ['src','alt','width','height','loading'], '*': ['class','dir'] } });
const url = value => { const s = String(value ?? ''); return /^(https?:\/\/|\/(?!\/))/.test(s) ? escape(s) : '#'; };
const storage = value => '/storage/' + String(value ?? '').split('/').map(encodeURIComponent).join('/');
const programRoutes = { taud: 'TK Taud', kuttab: 'kuttab', madrasah: 'Madrasah', 'darul-ilmi': "Darul 'Ilmi", mahdon: 'Mahdon Tarbawi', 'mahad-aly': "Ma'had 'Aly" };
export function layout(title, content, menus, path, extra = '') {
  const nav = list => list.map(m => `<li class="tombol_informasi aktif ${m.route === path ? 'tombol_informasi_aktif' : ''}"><a href="${url(m.route?.startsWith('/') ? m.route : '/' + m.route)}"><i class="${escape(m.icon)} icon_info" aria-hidden="true"></i><span>${escape(m.nama)}</span></a></li>`).join('');
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escape(title)}</title><link rel="icon" href="/logo/logo_al_yusro.png"><link rel="stylesheet" href="/css/site/site.css"><link rel="stylesheet" href="/legacy.css"><script src="/public-pages.js" defer></script>${extra}<script src="/legacy.js" defer></script></head><body><div class="sosmed-float">${['whatsapp','instagram','youtube','facebook'].map(s => `<a class="${s}-float" href="/konversi/${s}" target="_blank" rel="noopener noreferrer"><img src="/logo/${s}.svg" alt="${s}"></a>`).join('')}</div><div class="container_header"><div class="header"><div class="logo"><a href="/"><img src="/logo/Logo%20Ma'had%20Tahfizh%20Al%20Yusro%20Teks.jpg" alt="Logo Ma'had Al Yusro" width="107" height="60"></a></div><div class="sosial_media"><a class="login" href="/psb"><i class="ysr-pendaftaran"></i> Pendaftaran</a><a class="login" href="/dashboard/login"><i class="ysr-login"></i> Wali/Asatidz</a></div></div><div class="temukan_informasi">Temukan Informasi Yang Anda Cari</div><ul class="pilihan_informasi" aria-label="Informasi">${nav(menus)}</ul><div class="kontainer_hero"><div class="hero"><h1 class="hero_p1">${escape(title)}</h1></div></div>${content}<div class="footer_nav"></div><footer class="site_footer"><div class="footer_bottom"><p>© ${new Date().getFullYear()} Ma'had Al Yusro. All rights reserved.</p></div></footer><div class="link_pendaftaran_santri_madrasah"><ul class="pilihan_link_pendaftaran_santri_madrasah"><li class="tombol_informasi tombol_informasi_pendaftaran"><a href="/psb"><span><i class="ysr-pendaftaran"></i> Pendaftaran</span></a></li></ul></div><div class="pilihan_informasi_populer_kontainer"><ul class="pilihan_informasi_populer">${nav(menus.slice(0,4))}</ul></div><div class="link_brosur"><ul class="pilihan_link_brosur"><li class="tombol_informasi tombol_informasi_pendaftaran"><a href="/Brosur/Brosur%20penerimaan%20santri%20baru%20Program%20Madrasah%20(Jenjang%20SMP)%20Mahad%20Tahfizh%20Al%20Yusro.pdf"><span>Brosur Madrasah (SMP)</span></a></li></ul></div><div class="link_group"><ul class="pilihan_link_group"><li class="tombol_informasi tombol_informasi_pendaftaran"><a href="/konversi/masuk-grup-info"><span>Grup Info Al Yusro <i class="ysr-whatsapps"></i></span></a></li></ul></div></div></body></html>`;
}
const info = content => `<div class="isi_kontainer"><div class="list-info">${content}</div></div>`;
export async function renderLegacy(path, search = new URLSearchParams()) {
 const menus = await query("SELECT nama, route, icon FROM menus WHERE status = 'aktif' ORDER BY views DESC");
 let title, content, extra = '';
 if (path === '/') { title = "Sekolah Sunnah - Ma'had Tahfizh Al Yusro"; content = home; }
 else if (path === '/program') {
  title = 'Program Pendidikan'; const rows = await query('SELECT id, nama_program, deskripsi FROM program_pendidikans');
  content = info(rows.map(p => `<h2><a href="/program/id/${p.id}">${escape(p.nama_program)}</a></h2>${html(p.deskripsi)}`).join(''));
 } else if (path.startsWith('/jenjang/pendidikan/') || path.startsWith('/program/') || path === '/mahad-aly') {
  const slug = path.split('/').at(-1); const id = path.match(/^\/program\/id\/(\d+)$/)?.[1];
  const rows = id ? await query('SELECT * FROM program_pendidikans WHERE id = ?', [id]) : programRoutes[slug] ? await query('SELECT * FROM program_pendidikans WHERE nama_program = ? LIMIT 1', [programRoutes[slug]]) : [];
  const p = rows[0]; if (!p) return null;
  title = 'Program ' + p.nama_program;
  content = info(`<h2>${escape(p.nama_program)}</h2><div class="isi_data">${html(p.deskripsi)}<h3>Target Lulusan</h3>${html(p.list_target)}<h3>Target Hafalan</h3>${html(p.target_hafalan)}<h3>Biaya-Biaya</h3><ul>${[['Pendaftaran','biaya_pendaftaran'],['Daftar Ulang','biaya_daftar_ulang'],['Tahunan','biaya_tahunan'],['SPP','biaya_spp']].map(([label,key]) => `<li>Biaya ${label}: ${html(p[key])}</li>`).join('')}</ul><h3>Deskripsi Biaya</h3>${html(p.deskripsi_biaya)}<h3>Link Pendaftaran</h3><a href="${url(p.link_pendaftaran)}">${escape(p.link_pendaftaran)}</a></div>`);
 } else if (path === '/fasilitas' || path.startsWith('/fasilitas/')) {
  const categories = await query('SELECT id, nama_kategori, slug FROM kategori_fasilitas');
  const category = path.match(/^\/fasilitas\/kategori\/(.+)$/)?.[1];
  const cat = categories.find(c => c.slug === category); if (category && !cat) return null;
  const slug = !category && path !== '/fasilitas' ? decodeURIComponent(path.slice('/fasilitas/'.length)) : null;
  const rows = await query('SELECT id, nama_fasilitas, deskripsi, slug FROM fasilitas' + (cat ? ' WHERE kategori_fasilitas_id = ?' : slug ? ' WHERE slug = ?' : ''), cat ? [cat.id] : slug ? [slug] : []);
  if (slug && !rows.length) return null;
  const gallery = await query('SELECT fasilitas_id, gambar, deskripsi_gambar FROM galeri_fasilitas');
  title = 'Fasilitas ' + (cat?.nama_kategori ?? (slug ? rows[0].nama_fasilitas : ''));
  content = `<div class="temukan_informasi"><a class="kategori" href="/fasilitas">Semua</a>${categories.map(c => `<a class="kategori" href="/fasilitas/kategori/${encodeURIComponent(c.slug)}">${escape(c.nama_kategori)}</a>`).join('')}</div>` + rows.map(f => `<h2 class="kategori_fasilitas"><a href="/fasilitas/${encodeURIComponent(f.slug)}">${escape(f.nama_fasilitas)}</a></h2><div class="slide_show"><div class="slideshow-container">${gallery.filter(g => g.fasilitas_id === f.id).map((g,i) => `<div class="slides" ${i ? 'hidden' : ''}><img src="${storage(g.gambar)}" alt="${escape(g.deskripsi_gambar)}" loading="lazy"></div>`).join('')}<button class="prev" aria-label="Gambar sebelumnya">❮</button><button class="next" aria-label="Gambar berikutnya">❯</button></div></div>${slug ? info(html(f.deskripsi)) : ''}`).join('');
 } else if (path === '/artikel' || path.startsWith('/artikel/')) {
  const page = await articlePage(path, search); if (!page) return null; title = page.title; content = page.content; extra = page.extra;
 } else { const page = await publicPage(path, search); if (!page) return null; title = page.title; content = page.content; const stylePath = path.startsWith('/jadwal/shalat/') ? '/jadwal/shalat' : path; const style = {'/kalender-akademik':'homes-kalender-akademik','/prestasi':'homes-prestasi','/pendidikan/tenaga/pendidik':'homes-tenaga-pendidik','/konversi/nama':'konversi_nama-index','/jadwal/shalat':'jadwal_shalat-index'}[stylePath]; if(style) extra += `<link rel="stylesheet" href="/pages/${style}.css">`; }
 return layout(title, content, menus, path, extra);
}
