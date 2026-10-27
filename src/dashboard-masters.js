import ExcelJS from 'exceljs';
import sanitize from 'sanitize-html';
import { importMaster, importHeaders } from './master-imports.js';
import { pool } from './db.js';
import { esc } from './dashboard-shell.js';
import { slugFor } from './referral-sources.js';
import { tableQuery, tableFilters, renderTable, tableExport, tableRowActions, selectedTableIds } from './dashboard-table.js';

const text = (key, label, extra = {}) => ({ key, label, required: true, max: 255, ...extra });
const integer = (key, label, extra = {}) => ({ key, label, type: 'number', required: true, min: -2147483648, max: 2147483647, ...extra });
const richOptions = { allowedTags: ['p','br','strong','b','em','i','u','s','h2','h3','ul','ol','li','blockquote','a'], allowedAttributes: { a: ['href','title'] } };
const optionLabel = (field, value) => field.type === 'boolean' ? value === '1' ? 'Ya' : 'Tidak' : Object.entries(calendarColors).find(([, hex]) => hex === value)?.[0] || value;
const status = options => text('status', 'Status', { options });
// Only resources and actions present in the active Laravel resources are enabled here.
export const calendarColors = { merah: '#ff0000', biru: '#083e6b', hijau: '#28a745', ungu: '#6f42c1', kuning: '#ffc107', oranye: '#fd7e14', pink: '#e83e8c', coklat: '#8b4513', teal: '#20c997', abu: '#6c757d', hitam: '#000000', putih: '#ffffff' };
export const masterResources = {
 'program-pendidikan': { title: 'Program Pendidikan', table: 'program_pendidikans', permission: 'program::pendidikan',
  fields: [text('nama_program', 'Nama Program'), ...['deskripsi', 'list_target', 'target_hafalan'].map(key => text(key, key.replaceAll('_', ' '), { type: 'rich', max: 65535, required: key !== 'target_hafalan' })), ...['link_pendaftaran', 'biaya_pendaftaran', 'biaya_daftar_ulang', 'biaya_tahunan', 'biaya_spp'].map(key => text(key, key.replaceAll('_', ' '), { required: false })), text('deskripsi_biaya', 'Deskripsi Biaya', { required: false, type: 'textarea', max: 65535 })],
  search: ['nama_program', 'link_pendaftaran', 'biaya_pendaftaran', 'biaya_daftar_ulang', 'biaya_tahunan', 'biaya_spp'], sorts: ['created_at', 'updated_at'], related: [['kelas', 'id_program_pendidikan'], ['penerimaan_santris', 'program_pendidikan_id']] },
 'kalender-akademik': { title: 'Kalender Akademik', table: 'kalender_akademiks', permission: 'kalender::akademik', singleDelete: true, importable: true,
  fields: [text('tanggal', 'Tanggal Mulai', { type: 'date' }), text('tanggal_selesai', 'Tanggal Selesai', { type: 'date' }), text('kegiatan', 'Kegiatan'), text('keterangan', 'Keterangan', { type: 'textarea', required: false, max: 65535 }), text('warna', 'Warna', { options: Object.values(calendarColors) })], search: ['kegiatan', 'keterangan'], sorts: ['tanggal', 'tanggal_selesai'] },
 prestasi: { title: 'Prestasi', table: 'prestasis', permission: 'prestasi', view: true, importable: true,
  fields: [text('nama', 'Nama'), text('peringkat', 'Peringkat', { max: 50 }), text('nama_lomba', 'Nama Lomba'), text('tingkat', 'Tingkat'), text('penyelenggara', 'Penyelenggara'), integer('tahun', 'Tahun')], search: ['nama', 'nama_lomba', 'tingkat', 'penyelenggara'], sorts: ['peringkat', 'tahun', 'created_at', 'updated_at'] },
 'nama-kota': { title: 'Nama Kota', table: 'nama_kota', permission: 'nama::kota', importable: true,
  fields: [text('nama_latin', 'Nama Latin', { max: 100 }), text('nama_arab', 'Nama Arab', { max: 100 }), text('status', 'Terverifikasi', { type: 'boolean', options: ['0', '1'], default: '0' })], search: ['nama_latin', 'nama_arab'], sorts: ['nama_latin', 'nama_arab', 'status'] },
 'tema-soal': { title: 'Tema Soal', table: 'cbt_tema_soal', permission: 'c::b::t::tema::soal',
  fields: [text('nama_tema', 'Nama Tema')], search: ['nama_tema'], sorts: ['id', 'nama_tema'], count: { table: 'cbt_soal', key: 'tema_soal_id', label: 'Jumlah Soal' }, related: [['cbt_soal', 'tema_soal_id']] },
 'kategori-artikel': { title: 'Kategori Artikel', table: 'kategori_artikels', permission: 'kategori::artikel', softDelete: true, slug: 'nama', statusOnly: true,
  fields: [text('nama', 'Nama'), status(['aktif', 'tidak aktif'])], search: ['nama'], sorts: ['created_at', 'updated_at', 'deleted_at'] },
 'kategori-fasilitas': { title: 'Kategori Fasilitas', table: 'kategori_fasilitas', permission: 'kategori::fasilitas', slug: 'nama_kategori',
  fields: [text('nama_kategori', 'Nama Kategori'), text('deskripsi_kategori', 'Deskripsi Kategori', { required: false, type: 'textarea', max: 65535 })], search: ['nama_kategori'], sorts: ['created_at', 'updated_at'], related: [['fasilitas', 'kategori_fasilitas_id']] },
 'struktur-mahad': { title: "Struktur Ma'had", table: 'struktur_mahads', permission: 'struktur::mahad',
  fields: [text('struktur', 'Struktur'), text('nama', 'Nama'), integer('level', 'Level')], search: ['struktur', 'nama'], sorts: ['level', 'created_at', 'updated_at'] },
 menu: { title: 'Menu', table: 'menus', permission: 'menu',
  fields: [text('nama', 'Nama'), text('route', 'Route'), text('icon', 'Icon'), integer('views', 'Views', { required: false, default: 0 }), integer('waktu', 'Waktu', { required: false, default: 0 }), status(['aktif', 'tidak', 'ditinjau'])], search: ['nama', 'route'], sorts: ['views', 'waktu', 'created_at', 'updated_at'] },
 'event-mahad': { title: "Wisuda/Event Ma'had", table: 'event_mahads', permission: 'event::mahad', view: true, singleDelete: true,
  fields: [text('nama', 'Nama'), integer('tanggal', 'Tanggal', { min: 1, max: 31 }), integer('bulan', 'Bulan', { min: 1, max: 12 }), integer('tahun', 'Tahun', { min: 1, max: 9999 })], search: ['nama'], sorts: ['tanggal', 'bulan', 'tahun', 'created_at', 'updated_at'], related: [['ijazahs', 'event_id'], ['ijazah_darul_ilmis', 'event_id'], ['ijazah_mahad_alies', 'event_id']] }
};

export function masterRoute(path) {
 const match = path.match(/^\/dashboard\/([a-z-]+)(?:\/(create|delete|import|template)|\/([1-9]\d{0,14})\/(edit|view|delete))?$/);
 if (!match || !Object.hasOwn(masterResources, match[1])) return null;
 return { resource: match[1], action: match[3] ? match[4] : match[2] === 'delete' ? 'bulkDelete' : match[2] || 'list', id: match[3] };
}
const validId = id => /^[1-9]\d{0,14}$/.test(String(id));
const has = (access, config, permission) => access.permissions.includes(`${permission}_${config.permission}`);
const stamp = value => value == null ? '—' : String(value);

function form(config, base, row, action, csrf, errors = [], input = row) {
 const fields = config.statusOnly && action === 'edit' ? config.fields.filter(f => f.key === 'status') : config.fields;
 return { status: errors.length ? 422 : 200, title: `${action === 'create' ? 'Tambah' : 'Edit'} ${config.title}`, body: `<section class="status-note-form"><form method="post" action="${base}/${action === 'create' ? 'create' : `${row.id}/edit`}"><input type="hidden" name="_csrf" value="${esc(csrf)}">${errors.length ? `<div role="alert" class="message">${errors.map(e => `<p>${esc(e)}</p>`).join('')}</div>` : ''}${config.statusOnly && action === 'edit' ? `<p>${esc(row.nama)}</p>` : ''}${fields.map(f => {
  const raw = input[f.key] ?? f.default ?? (f.options ? f.options[0] : '');
  const value = f.type === 'rich' ? sanitize(String(raw), richOptions) : String(raw);
  const attrs = `name="${f.key}" ${f.required ? 'required' : ''}`;
  const control = f.type === 'rich' ? `<textarea ${attrs} data-rich-editor rows="8" maxlength="${f.max}">${esc(value)}</textarea>` : f.options ? `<select ${attrs}>${f.options.map(v => `<option value="${esc(v)}" ${value === v ? 'selected' : ''}>${esc(optionLabel(f, v))}</option>`).join('')}</select>` : f.type === 'textarea' ? `<textarea ${attrs} rows="4" maxlength="${f.max}">${esc(value)}</textarea>` : `<input ${attrs} type="${f.type || 'text'}" ${f.type === 'number' ? `min="${f.min}" max="${f.max}" step="1"` : `maxlength="${f.max}"`} value="${esc(value)}">`;
  return `<label class="field"><span class="field-label">${esc(f.label)}${f.required ? ' <span class="required">*</span>' : ''}</span><span class="input-wrap">${control}</span></label>`;
 }).join('')}<button type="submit">Simpan</button> <a href="${base}">Batal</a></form></section>` };
}

export function validateMaster(fields, data) {
 const values = {}, errors = [];
 for (const f of fields) {
  const value = String(data[f.key] ?? f.default ?? '').trim();
  if (f.required && !value) errors.push(`${f.label} wajib diisi.`);
  if (f.type === 'number') {
   if (value && (!/^-?\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < f.min || Number(value) > f.max)) errors.push(`${f.label} harus bilangan bulat antara ${f.min} dan ${f.max}.`);
   values[f.key] = value ? Number(value) : null;
  } else {
   if (f.options && !f.options.includes(value)) errors.push(`${f.label} tidak valid.`);
   if (!f.options && (Array.from(value).length > f.max || (f.type === 'textarea' && Buffer.byteLength(value) > f.max))) errors.push(`${f.label} terlalu panjang.`);
   if (f.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0,4)) < 1000 || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value)) errors.push(`${f.label} tidak valid.`);
   const clean = f.type === 'rich' ? sanitize(value, richOptions) : value;
   if (f.type === 'rich' && f.required && !sanitize(clean, { allowedTags: [], allowedAttributes: {} }).trim()) errors.push(`${f.label} wajib diisi.`);
   values[f.key] = clean || null;
  }
 }
 if (values.tanggal && values.tanggal_selesai && values.tanggal_selesai < values.tanggal) errors.push('Tanggal selesai harus pada atau setelah tanggal mulai.');
 return { values, errors };
}

export function createDashboardMasters(db = pool) {
 return async function masters({ resource, access, action = 'list', id, params = new URLSearchParams(), csrf = '', data }) {
  const config = masterResources[resource];
  if (!config) return { status: 404, title: 'Tidak ditemukan', body: '' };
  const base = `/dashboard/${resource}`;
  const message = (status, value) => ({ status, title: config.title, body: `<section><p>${esc(value)}</p><a href="${base}">Kembali ke daftar</a></section>` });
  const permission = { list: 'view_any', create: 'create', edit: 'update', view: 'view', delete: 'delete', bulkDelete: 'delete_any', import: 'create', template: 'create' }[action];
  if (!permission || (action === 'view' && !config.view) || (action === 'delete' && !config.singleDelete)) return message(404, 'Halaman tidak ditemukan.');
  if (['import', 'template'].includes(action) && !config.importable) return message(404, 'Halaman tidak ditemukan.');
  if (!has(access, config, permission)) return message(403, 'Anda tidak memiliki izin untuk tindakan ini.');
  if (['edit', 'view', 'delete'].includes(action) && !validId(id)) return message(404, 'Data tidak ditemukan.');
  if (action === 'import' && resource === 'nama-kota' && !has(access, config, 'update')) return message(403, 'Impor kota memerlukan izin tambah dan ubah.');
  if (action === 'template') {
   const workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet('Template');
   sheet.addRow(importHeaders(resource));
   return { status: 200, xlsx: Buffer.from(await workbook.xlsx.writeBuffer()) };
  }
  const c = await db.getConnection();
  const active = config.softDelete ? 'deleted_at IS NULL' : '1=1';
  try {
   if (action === 'import') {
    if (!data) return message(405, 'Metode tidak tersedia.');
    return await importMaster({ c, resource, config, data, validate: validateMaster, colors: calendarColors, message });
   }
   if (action === 'list') {
    const query = tableQuery(params, { sorts: config.sorts, defaultSort: config.sorts[0] });
    const definitions = config.fields.filter(f => f.options).map(f => ({ name: f.key, label: f.label, options: f.options.map(value => ({ value, label: optionLabel(f, value) })) }));
    const filters = tableFilters(params, definitions);
    if (!query || !filters) return message(422, 'Pencarian, filter, urutan, atau halaman tidak valid.');
    const where = [active, `(${config.search.map(key => `\`${key}\` LIKE ? ESCAPE '!'`).join(' OR ')})`];
    const args = config.search.map(() => query.pattern);
    for (const [key, value] of Object.entries(filters)) if (value) { where.push(`\`${key}\`=?`); args.push(value); }
    const [rows] = await c.execute(`SELECT *${config.count ? `,(SELECT COUNT(*) FROM ${config.count.table} WHERE ${config.count.key}=${config.table}.id) AS related_count` : ''},COUNT(*) OVER() AS table_total FROM ${config.table} WHERE ${where.join(' AND ')} ORDER BY \`${query.sort}\` ${query.direction.toUpperCase()},id LIMIT ${params.has('export') ? 10001 : query.limit} OFFSET ${params.has('export') ? 0 : query.offset}`, args);
    const columns = config.fields.filter(f => !['textarea', 'rich'].includes(f.type)).map(f => ({ key: f.key, label: f.label, ...(f.options ? { value: row => optionLabel(f, String(row[f.key])) } : {}) }));
    if (config.count) columns.push({ key: 'id', label: 'ID' }, { key: 'related_count', label: config.count.label });
    columns.push({ key: 'created_at', label: 'Dibuat', value: row => stamp(row.created_at) }, { key: 'updated_at', label: 'Diperbarui', value: row => stamp(row.updated_at) });
    if (config.softDelete) columns.push({ key: 'deleted_at', label: 'Dihapus', value: row => stamp(row.deleted_at) });
    const exportColumns = [...config.fields.map(f => ({ key: f.key, label: f.label })), ...(config.count ? [{ key: 'id', label: 'ID' }, { key: 'related_count', label: config.count.label }] : []), ...columns.filter(col => ['created_at', 'updated_at', 'deleted_at'].includes(col.key))];
    const exported = await tableExport(params, rows, exportColumns, config.title);
    if (exported) return exported;
    if (has(access, config, 'update') || (config.view && has(access, config, 'view')) || (config.singleDelete && has(access, config, 'delete'))) columns.push({ label: 'Aksi', html: row => tableRowActions([
     ...(has(access, config, 'update') ? [{ label: config.statusOnly ? 'Ubah Status' : 'Edit', href: `${base}/${row.id}/edit` }] : []),
     ...(config.view && has(access, config, 'view') ? [{ label: 'Detail', href: `${base}/${row.id}/view` }] : []),
     ...(config.singleDelete && has(access, config, 'delete') ? [{ label: 'Hapus', href: `${base}/${row.id}/delete` }] : [])
    ]) });
    return { status: 200, title: config.title, body: `<section>${config.importable && has(access, config, 'create') ? `<p><a href="${base}/template">Unduh template Excel</a></p>${resource !== 'nama-kota' || has(access, config, 'update') ? `<form class="master-import" method="post" action="${base}/import" enctype="multipart/form-data"><input type="hidden" name="_csrf" value="${esc(csrf)}"><label>Impor Excel (.xlsx, maksimal 1 MB / 1.000 baris)<input type="file" name="workbook" accept=".xlsx" required></label><button type="submit">Impor</button></form>` : ''}` : ''}${has(access, config, 'create') ? `<p class="table-create"><a href="${base}/create">Tambah ${esc(config.title)}</a></p>` : ''}${renderTable({ base, query, rows, columns, title: config.title, searchLabel: 'Cari ' + config.search.map(key => config.fields.find(f => f.key === key).label).join(' / '), emptyText: 'Tidak ada data yang cocok.', sortOptions: config.sorts.map(value => ({ value, label: columns.find(col => col.key === value)?.label || value })), filters: definitions.map(f => ({ ...f, value: filters[f.name] })), exportable: true, bulk: has(access, config, 'delete_any') ? { action: `${base}/delete`, csrf, rowLabel: row => row[config.fields[0].key], confirm: 'Hapus data yang dipilih? Tindakan ini memerlukan konfirmasi.', notice: config.related ? 'Data yang masih digunakan tidak dapat dihapus.' : config.softDelete ? 'Kategori dihapus secara lunak; artikel terkait tetap tersimpan.' : '' } : null })}</section>` };
   }
   if (action === 'bulkDelete' || action === 'delete') {
    if (!data) {
     if (action === 'bulkDelete') return message(405, 'Metode tidak tersedia.');
     const [rows] = await c.execute(`SELECT * FROM ${config.table} WHERE id=? AND ${active}`, [id]);
     if (!rows.length) return message(404, 'Data tidak ditemukan.');
     return { status: 200, title: `Hapus ${config.title}`, body: `<section><p>Hapus ${esc(rows[0][config.fields[0].key])}?</p><form method="post" action="${base}/${id}/delete"><input type="hidden" name="_csrf" value="${esc(csrf)}"><input type="hidden" name="confirm" value="HAPUS"><button type="submit">Ya, hapus</button> <a href="${base}">Batal</a></form></section>` };
    }
    const ids = action === 'delete' ? data.confirm === 'HAPUS' ? [id] : null : selectedTableIds(data);
    if (!ids) return message(422, 'Konfirmasi penghapusan tidak valid. Pilih 1–100 data.');
    const placeholders = ids.map(() => '?').join(',');
    await c.beginTransaction();
    try {
     const [locked] = await c.execute(`SELECT id FROM ${config.table} WHERE id IN (${placeholders}) AND ${active} FOR UPDATE`, ids);
     if (locked.length !== ids.length) { await c.rollback(); return message(404, 'Sebagian data tidak ditemukan. Muat ulang daftar.'); }
     for (const [table, foreignKey] of config.related || []) {
      const [related] = await c.execute(`SELECT id FROM ${table} WHERE ${foreignKey} IN (${placeholders}) LIMIT 1`, ids);
      if (related.length) { await c.rollback(); return message(422, 'Data masih digunakan. Lepaskan relasinya sebelum menghapus.'); }
     }
     await c.execute(config.softDelete ? `UPDATE ${config.table} SET deleted_at=NOW(),updated_at=NOW() WHERE id IN (${placeholders}) AND ${active}` : `DELETE FROM ${config.table} WHERE id IN (${placeholders})`, ids);
     await c.commit();
    } catch (error) { await c.rollback(); throw error; }
    return { status: 303 };
   }
   let row = {};
   if (action !== 'create') {
    const [rows] = await c.execute(`SELECT * FROM ${config.table} WHERE id=? AND ${active}`, [id]);
    if (!rows.length) return message(404, 'Data tidak ditemukan.');
    row = rows[0];
   }
   if (action === 'view') return { status: 200, title: config.title, body: `<section><dl>${config.fields.map(f => `<dt>${esc(f.label)}</dt><dd>${esc(row[f.key])}</dd>`).join('')}</dl>${has(access, config, 'update') ? `<a href="${base}/${id}/edit">Edit</a> · ` : ''}<a href="${base}">Kembali ke daftar</a></section>` };
   if (!data) return form(config, base, row, action, csrf);
   const fields = config.statusOnly && action === 'edit' ? config.fields.filter(f => f.key === 'status') : config.fields;
   const { values, errors } = validateMaster(fields, data);
   if (errors.length) return form(config, base, row, action, csrf, errors, data);
   if (config.slug && (action === 'create' || (!config.statusOnly && values[config.slug] !== row[config.slug]))) {
    const original = Array.from(slugFor(values[config.slug])).slice(0, 240).join('');
    if (!original) return form(config, base, row, action, csrf, ['Nama harus menghasilkan slug yang valid.'], data);
    let slug = original, suffix = 0;
    // Include soft-deleted names because the shared database has a unique slug index.
    while (true) {
     const [existing] = await c.execute(`SELECT id FROM ${config.table} WHERE slug=? AND id<>? LIMIT 1`, [slug, id || 0]);
     if (!existing.length) break;
     slug = original + '-' + ++suffix;
     if (suffix > 1000) return form(config, base, row, action, csrf, ['Nama terlalu sering digunakan. Pilih nama lain.'], data);
    }
    values.slug = slug;
   }
   try {
    const keys = Object.keys(values);
    if (action === 'create') await c.execute(`INSERT INTO ${config.table} (${keys.map(k => `\`${k}\``).join(',')},created_at,updated_at) VALUES (${keys.map(() => '?').join(',')},NOW(),NOW())`, Object.values(values));
    else {
     const [updated] = await c.execute(`UPDATE ${config.table} SET ${keys.map(k => `\`${k}\`=?`).join(',')},updated_at=NOW() WHERE id=? AND ${active}`, [...Object.values(values), id]);
     if (!updated.affectedRows) return message(404, 'Data tidak ditemukan.');
    }
   } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return form(config, base, row, action, csrf, ['Nama/slug sudah digunakan. Muat ulang dan coba kembali.'], data);
    throw error;
   }
   return { status: 303 };
  } finally { c.release(); }
 };
}
export const dashboardMasters = createDashboardMasters();
