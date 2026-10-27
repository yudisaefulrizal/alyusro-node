import ExcelJS from 'exceljs';
import JSZip from 'jszip';

export function importHeaders(resource) {
 if (resource === 'kalender-akademik') return ['tahun', 'bulan', 'tanggal', 'tahun_selesai', 'bulan_selesai', 'tanggal_selesai', 'kegiatan', 'keterangan', 'warna'];
 if (resource === 'nama-kota') return ['nama_latin', 'nama_arab'];
 return ['nama', 'peringkat', 'nama_lomba', 'tingkat', 'penyelenggara', 'tahun'];
}

// Validate the entire workbook before beginning a transaction; never execute formulas.
export async function importMaster({ c, resource, config, data, validate, colors, message }) {
 const invalid = value => message(422, value);
 if (!Buffer.isBuffer(data.workbook) || !data.workbook.length || data.workbook.length > 1048576) return invalid('Pilih workbook .xlsx maksimal 1 MB.');
 let sheet;
 try {
  const zip = await JSZip.loadAsync(data.workbook);
  const entries = Object.values(zip.files);
  if (entries.length > 200 || entries.reduce((n, f) => n + (f._data?.uncompressedSize || 0), 0) > 8 * 1024 * 1024) return invalid('Isi workbook terlalu besar.');
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(data.workbook);
  if (workbook.worksheets.length !== 1) return invalid('Workbook harus memiliki tepat satu lembar.');
  sheet = workbook.worksheets[0];
 } catch { return invalid('Workbook .xlsx tidak dapat dibaca. Simpan berkas Excel lama sebagai .xlsx terlebih dahulu.'); }
 if (sheet.rowCount < 2 || sheet.rowCount > 1001 || sheet.columnCount > 20) return invalid('Impor harus berisi 1–1.000 baris dengan maksimal 20 kolom.');
 const headers = importHeaders(resource), actual = sheet.getRow(1).values.slice(1).map(v => String(v ?? '').trim().toLowerCase().replaceAll(' ', '_'));
 if (headers.some((key, i) => actual[i] !== key)) return invalid('Judul dan urutan kolom harus sesuai template.');
 const records = [];
 for (let n = 2; n <= sheet.rowCount; n++) {
  const values = headers.map((_, i) => sheet.getRow(n).getCell(i + 1).value);
  if (values.every(v => v === null || v === '')) continue;
  if (values.some(v => v !== null && !['string', 'number', 'boolean'].includes(typeof v))) return invalid(`Baris ${n}: gunakan nilai teks/angka biasa, tanpa rumus atau objek.`);
  const row = Object.fromEntries(headers.map((key, i) => [key, String(values[i] ?? '').trim()]));
  if (resource === 'kalender-akademik') {
   const date = suffix => [row['tahun' + suffix], row['bulan' + suffix]?.padStart(2, '0'), row['tanggal' + suffix]?.padStart(2, '0')].join('-');
   row.tanggal = date(''); row.tanggal_selesai = date('_selesai');
   row.warna = colors[row.warna.toLowerCase()] || (Object.values(colors).includes(row.warna) ? row.warna : colors.biru);
  }
  if (resource === 'nama-kota') { row.nama_latin = row.nama_latin.toLowerCase(); row.status = '0'; }
  const checked = validate(config.fields, row);
  if (checked.errors.length) return invalid(`Baris ${n}: ${checked.errors.join(' ')}`);
  records.push(checked.values);
 }
 if (!records.length) return invalid('Tidak ada baris yang dapat diimpor.');
 await c.beginTransaction();
 try {
  for (const values of records) {
   if (resource === 'nama-kota') {
    const [existing] = await c.execute('SELECT id FROM nama_kota WHERE LOWER(nama_latin)=? ORDER BY id LIMIT 1 FOR UPDATE', [values.nama_latin]);
    if (existing.length) { await c.execute('UPDATE nama_kota SET nama_arab=?,updated_at=NOW() WHERE id=?', [values.nama_arab, existing[0].id]); continue; }
   }
   const keys = Object.keys(values);
   await c.execute(`INSERT INTO ${config.table} (${keys.map(k => '`' + k + '`')},created_at,updated_at) VALUES (${keys.map(() => '?')},NOW(),NOW())`, Object.values(values));
  }
  await c.commit();
 } catch (error) { await c.rollback(); throw error; }
 return { status: 303 };
}
