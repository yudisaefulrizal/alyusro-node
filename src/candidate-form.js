import puppeteer from 'puppeteer-core';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { esc } from './dashboard-shell.js';
import { studentFile, studentRoot } from './student-storage.js';

let active = 0;
export async function candidateFormHtml(row, root = studentRoot) {
 const pkbm = ['Madrasah', "Darul 'Ilmi"].includes(row.jenjang);
 const title = row.jenjang === 'Madrasah' ? 'PENERIMAAN PESERTA DIDIK BARU (PPDB) PAKET B' : row.jenjang === "Darul 'Ilmi" ? 'PENERIMAAN PESERTA DIDIK BARU (PPDB) PAKET C' : row.jenjang === "Ma'had 'Aly" ? 'PENERIMAAN MAHASANTRI BARU (PMB)' : 'PENERIMAAN SANTRI BARU (PSB)';
 const institution = pkbm ? 'PKBM AL YUSRO' : 'MAHAD TAHFIZH AL YUSRO';
 const logo = await readFile(new URL(pkbm ? '../assets/legacy-public/pkbm/pkbm.jpg' : '../assets/legacy-public/pkbm/mahad.png', import.meta.url));
 let photo = '';
 const stored = await studentFile(row.foto, root);
 if (stored) try { photo = 'data:image/jpeg;base64,' + (await sharp(await readFile(stored.file), { limitInputPixels: 16000000 }).rotate().resize(240, 315, { fit: 'cover' }).jpeg().toBuffer()).toString('base64'); } catch { /* Unreadable photos leave the printed photo box empty. */ }
 const value = key => row[key] ?? '-';
 const upper = key => String(value(key)).toUpperCase();
 const money = key => row[key] ? 'Rp ' + Number(row[key]).toLocaleString('id-ID') : '-';
 const fields = [
  ['Nomor Pendaftaran',value('nomor_pendaftaran')], ['Nama Peserta',upper('nama')], ['Jenis Kelamin',value('jenis_kelamin')], ['NISN',value('nisn')], ['NIK',value('nik')], ['No KK',value('no_kk')],
  ['Tempat Tanggal Lahir',`${value('tempat_lahir')}, ${value('tanggal_lahir')}-${value('bulan_lahir')}-${value('tahun_lahir')}`], ['No. Registrasi Akta Lahir',value('no_registrasi_akta_lahir')],
  ['Kewarganegaraan',row.kewarganegaraan ?? 'Indonesia (WNI)'], ['Berkebutuhan khusus',row.berkebutuhan_khusus ?? 'Tidak'], ['Alamat',value('alamat')], ['RT/RW',`${value('rt')}/${value('rw')}`], ['Nama Kelurahan/Desa',value('nama_kelurahan')], ['Kecamatan',value('kecamatan')], ['Tempat Tinggal',row.tempat_tinggal ?? 'Bersama orangtua'], ['Anak keberapa',value('anak_ke')],
  ...['ayah','ibu'].flatMap(parent => [[`Nama ${parent}`,upper('nama_' + parent)], [`NIK ${parent}`,value('nik_' + parent)], [`Tahun lahir ${parent}`,value('tahun_lahir_' + parent)], [`Pendidikan ${parent}`,value('pendidikan_' + parent)], [`Pekerjaan ${parent}`,value('pekerjaan_' + parent)], [`Penghasilan bulanan ${parent}`,money('penghasilan_bulanan_' + parent)]]),
  ['No. Handphone',value('nomor_hp')], ['Email',value('email')], ['Tinggi Badan',`${value('tinggi_badan')} cm`], ['Berat Badan',`${value('berat_badan')} kg`], ['Jarak ke sekolah',value('jarak_ke_sekolah')], ['Jumlah saudara kandung',value('jumlah_saudara_kandung')], ['Jalur Pendaftaran',row.jalur_pendaftaran ?? 'Siswa baru'], ['Asal Sekolah',value('asal_sekolah')], ['NPSN Sekolah',value('npsn')]
 ];
 const date = row.created_at ? new Date(String(row.created_at).replace(' ', 'T') + (String(row.created_at).includes('Z') ? '' : '+07:00')) : null;
 const dateText = date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta'}).format(date) : '-';
 return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Formulir ${esc(row.nama)}</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>@page{size:A4;margin:15mm 12mm}*{box-sizing:border-box}body{margin:0;color:#000;font-family:'Times New Roman',serif}header{display:flex;align-items:center;border-bottom:2px solid;padding-bottom:8px;margin-bottom:10px}header img{width:50px;height:50px;object-fit:contain}header div{text-align:center;flex:1}h1,h2{font-size:12px;margin:4px}header p{font-size:10px;margin:4px}table{width:100%;border-collapse:collapse;font-size:9px;table-layout:fixed}td{padding:3px;vertical-align:top;overflow-wrap:anywhere}td:first-child{width:32%;font-weight:bold}td:nth-child(2){width:12px}td:last-child{border-bottom:1px dotted #333}tr{break-inside:avoid}.privacy{font-size:9px;margin-top:14px;padding:10px;border:1px solid;break-inside:avoid}.signatures{display:flex;justify-content:space-between;font-size:10px;margin-top:12px;break-inside:avoid}.signatures>div{width:38%}.signatures>div:nth-child(2){width:20%;text-align:center}.signatures>div:last-child{text-align:right}.photo{display:inline-flex;width:80px;height:105px;border:1px solid;align-items:center;justify-content:center}.photo img{width:100%;height:100%;object-fit:cover}small{font-size:8px}</style></head><body><header><img src="data:${pkbm ? 'image/jpeg' : 'image/png'};base64,${logo.toString('base64')}" alt="Logo"><div><h1>${title}</h1><h2>${institution}</h2><p>Kp. Cimanggu, Desa Gunung Mulya, Kecamatan Tenjolaya,<br>Kabupaten Bogor, Kode Pos 16371</p></div></header><table>${fields.map(([label,text]) => `<tr><td>${esc(label)}</td><td>:</td><td>${esc(text)}</td></tr>`).join('')}</table><div class="privacy"><p>Data Anda dikumpulkan untuk keperluan PPDB &amp; administrasi pendidikan, disimpan selama masa aktif belajar (maks. 5 tahun pasca lulus), dan hanya dibagikan kepada Dinas Pendidikan. Anda berhak mengakses, memperbaiki, atau menarik persetujuan (dengan konsekuensi pembatalan pendaftaran).</p><p><strong>Persetujuan:</strong> Dengan menandatangani formulir ini, Anda (calon peserta didik &amp; orang tua/wali) menyatakan bahwa data benar dan menyetujui pengumpulan &amp; pemrosesan data pribadi sebagaimana dijelaskan di atas. Data palsu berakibat pembatalan pendaftaran.</p></div><div class="signatures"><div>Mengetahui,<br>Orang Tua / Wali<br><br><br><br>________________________<p>(${esc(upper('nama_ayah'))} / ${esc(upper('nama_ibu'))})</p><small>*Tanda tangan menyatakan persetujuan pemrosesan data pribadi</small></div><div><span class="photo">${photo ? `<img src="${photo}" alt="Foto">` : 'FOTO'}</span></div><div>${esc(dateText)}<br>Panitia Pendaftaran<br><br><br><br>________________________<p>( Suhandi, S.Pd., M.Pd. )</p><small>*Penanggung jawab pengelolaan data</small></div></div></body></html>`;
}

export async function renderCandidateForm(row, root = studentRoot) {
 if (active >= 2) return { status: 503, title: 'Cetak formulir', body: '<p>Pencetakan sedang sibuk. Coba kembali.</p>' };
 active++;
 let browser;
 try {
  const html = await candidateFormHtml(row, root);
  browser = await puppeteer.launch({ executablePath: process.env.PDF_CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox','--disable-dev-shm-usage'], timeout: 20000 });
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  await page.setRequestInterception(true);
  page.on('request', request => request.url().startsWith('data:') || request.url() === 'about:blank' ? request.continue() : request.abort());
  await page.setContent(html, { waitUntil: 'load', timeout: 20000 });
  return { status: 200, content: Buffer.from(await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true, timeout: 25000 })), type: 'application/pdf', filename: `formulir-${row.nomor_pendaftaran || row.id}.pdf` };
 } finally { try { if (browser) await browser.close(); } finally { active--; } }
}
