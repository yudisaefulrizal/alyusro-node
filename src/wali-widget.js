import { cardFiles } from './wali-files.js';
import { query } from './db.js';
import { esc } from './dashboard-shell.js';

// Calendar dates use the school's timezone, independently of the server timezone.
export const jakartaDate = date => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);

export function createWaliWidget(read = query, now = () => new Date()) {
  return async function waliWidget(user, access, csrf = '') {
    if (!access.permissions.includes('view_any_santri::wali')) return '';
    const today = jakartaDate(now());
    const schedules = await read(`SELECT id, gelombang, kode_gelombang, tanggal_mulai, tanggal_selesai,
      CASE WHEN tanggal_mulai <= ? THEN 'active' ELSE 'upcoming' END AS phase
      FROM penerimaan_santris WHERE status = 'aktif' AND tanggal_selesai >= ?
      ORDER BY tanggal_mulai, id`, [today, today]);
    const active = schedules.find(row => row.phase === 'active');
    const upcoming = schedules.find(row => row.phase === 'upcoming');
    const kk = String(user.nomor_kk ?? '').trim();
    const rows = kk ? await read(`SELECT s.id, s.nama, s.nomor_pendaftaran, s.jenjang, s.status, s.catatan,
      sc.catatan AS status_catatan, sc.nomor_wa, sc.pesan_whatsapp, sc.label_tombol, sc.id IS NOT NULL AS status_defined, p.biaya_pendaftaran,
      s.foto_akta_lahir, s.foto_kartu_keluarga, s.foto_ijazah_sd, s.foto_ijazah_smp, s.foto_ijazah_sma,
      s.foto_pembayaran_psb_kuttab, s.foto_pembayaran_psb_madrasah, s.foto_pembayaran_psb_darul_ilmi, s.foto_pembayaran_psb_mahad_aly, s.foto_pembayaran_psb_tk_taud, s.foto_pembayaran_psb_mahdon_tarbawi,
      s.foto_surat_komitment_madrasah, s.foto_surat_komitment_darul_ilmi, s.foto_surat_komitment_mahad_aly,
      (SELECT f.path FROM foto_santris f WHERE f.santri_id=s.id ORDER BY f.id LIMIT 1) AS foto
      FROM santris s LEFT JOIN status_catatan sc ON sc.status = s.status
      LEFT JOIN penerimaan_santris p ON p.id = s.penerimaan_santri_id
      WHERE s.no_kk = ? ORDER BY s.nama, s.id LIMIT 21`, [kk]) : [];
    const dateParts = value => {
      const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
      return Number.isNaN(date.getTime()) ? String(value ?? '') : new Intl.DateTimeFormat('id-ID', {day:'2-digit', month:'long', year:'numeric', timeZone:'UTC'}).format(date);
    };
    const schedule = active
      ? access.permissions.includes('create_santri::wali') ? `<a class="wali-edit-link" href="/dashboard/santri-wali/create">${rows.length ? '+ Daftarkan santri lainnya yang satu KK' : '+ Daftarkan Santri'}</a>` : ''
      : upcoming ? `<p class="wali-upcoming">📅 Pendaftaran berikutnya dibuka:<br><strong>${esc(dateParts(upcoming.tanggal_mulai))} sampai ${esc(dateParts(upcoming.tanggal_selesai))}<br>(Gelombang ${esc(upcoming.gelombang)})</strong></p>`
      : '<p>🚫 Saat ini belum ada jadwal pendaftaran yang tersedia.</p>';
    const contact = row => {
      const label = String(row.label_tombol ?? '').trim();
      const target = String(row.nomor_wa ?? '').trim();
      if (!label || label.toLowerCase() === 'tidak ada' || !target) return '';
      let url;
      if (/^\+?\d{9,15}$/.test(target)) {
        const message = String(row.pesan_whatsapp ?? '').replaceAll('{nama}', String(row.nama ?? '')).replaceAll('{nomor}', String(row.nomor_pendaftaran ?? ''));
        url = `https://wa.me/${target.replace(/^\+/, '')}?${new URLSearchParams({text: message})}`;
      } else {
        try { const parsed = new URL(target); if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return ''; url = parsed.href; }
        catch { return ''; }
      }
      return `<div class="wali-contact"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a></div>`;
    };
    const canEdit = access.permissions.includes('update_santri::wali');
    const documents = row => `<div class="wali-documents">${cardFiles(row).map(([field,label]) => {
      const base=`/dashboard/wali-berkas/${encodeURIComponent(row.id)}/${field}`;
      const exists=!!row[field];
      const title=field === 'foto' ? 'Pass Foto 3x4 (Formal, Baground)' : label;
      const photo=`<img src="${exists ? base : '/assets/default.jpg'}" alt="${esc(title)}" class="wali-photo">`;
      const image=exists ? `<button type="button" class="wali-photo-button" data-wali-zoom aria-label="Perbesar ${esc(title)}">${photo}</button>` : canEdit ? `<button type="button" class="wali-photo-button" data-wali-upload="${base}/upload" data-wali-label="${esc(title)}" aria-label="Unggah ${esc(title)}">${photo}</button>` : photo;
      return `<div class="wali-document"><div class="wali-photo-wrap">${image}${exists && canEdit ? `<form action="${base}/delete" method="post" data-wali-delete><input type="hidden" name="_csrf" value="${esc(csrf)}"><button type="submit" class="wali-delete" aria-label="Hapus ${esc(title)}" title="Hapus ${esc(title)}">🗑️</button></form>` : ''}</div><p>${esc(title)}${field.startsWith('foto_pembayaran_psb_') ? ` Rp. ${esc(Number(row.biaya_pendaftaran || 0).toLocaleString('id-ID'))} Ke Rekening: Muamalat 123 0011 724 a/n Yayasan Al Yusro Mulia Bogor. Catatan:.` : ''}</p></div>`;
    }).join('')}</div>`;
    const dialog = canEdit && rows.length ? `<dialog class="wali-upload-dialog" aria-labelledby="wali-upload-title"><div><h2 id="wali-upload-title">Upload Dokumen</h2><form method="post" enctype="multipart/form-data"><input type="hidden" name="_csrf" value="${esc(csrf)}"><label class="sr-only" for="wali-upload-input">Pilih gambar</label><input id="wali-upload-input" type="file" name="avatar" accept="image/jpeg,image/png,image/webp" required><img class="wali-upload-preview" alt="Pratinjau gambar" hidden><div class="wali-upload-actions"><button type="button" data-wali-cancel>Batal</button><button type="submit">Simpan</button></div></form></div></dialog>` : '';
    const cards = rows.slice(0, 20).map(row => `<article class="wali-card${String(row.status).toLowerCase() === 'aktif' ? ' is-active' : ''}"><div class="wali-card-info"><strong>${esc(row.nama)}</strong>${row.nomor_pendaftaran ? `<strong>${esc(row.nomor_pendaftaran)}</strong>` : ''}<p>Jenjang: <span>${esc(row.jenjang || '-')}</span></p><span class="wali-status">${esc(row.status || '-')}</span></div>${canEdit ? `<a class="wali-edit-link" href="/dashboard/santri-wali/${esc(row.id)}/edit">Edit Formulir (Jika Perlu)</a>` : ''}${documents(row)}<p class="wali-note">Catatan: ${esc(row.catatan || '-')}${row.status_catatan ? ` · ${esc(row.status_catatan)}` : ''}</p>${contact(row)}</article>`).join('');
    return `<section class="widget full student-widget"><div class="student-action">${schedule}</div><p class="wali-intro">📋 Berikut santri yang terhubung dengan KK Anda. Pastikan nomor KK benar.</p>${!kk ? '<p class="wali-empty">Lengkapi nomor KK akun untuk melihat data santri.</p>' : rows.length ? `<div class="wali-cards">${cards}</div>` : '<p class="wali-empty">Belum ada santri yang terhubung.</p>'}${dialog}${rows.length > 20 ? '<p>Menampilkan 20 santri pertama.</p>' : ''}<p class="wali-all"><a href="/dashboard/santri-wali">Lihat semua data santri sesuai KK</a></p></section>`;
  };
}
export const waliWidget = createWaliWidget();
