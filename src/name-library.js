import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { tableExcel } from './dashboard-table.js';

// The legacy dictionary combines al/az/el with the following word.
export function nameParts(name) {
 const words = name.trim().toLowerCase().split(/\s+/u), parts = [];
 for (let i = 0; i < words.length; i++) {
  let part = words[i];
  if (['al', 'az', 'el'].includes(part) && i + 1 < words.length) part += ' ' + words[++i];
  if (part) parts.push(part);
 }
 return parts;
}

export async function convertNamesWorkbook({ c, data, message }) {
 const invalid = text => message(422, text);
 if (!data) return message(405, 'Metode tidak tersedia.');
 if (!Buffer.isBuffer(data.workbook) || !data.workbook.length || data.workbook.length > 1048576) return invalid('Pilih workbook .xlsx maksimal 1 MB.');
 let sheet;
 try {
  const zip = await JSZip.loadAsync(data.workbook), entries = Object.values(zip.files);
  if (entries.length > 200 || entries.reduce((n, f) => n + (f._data?.uncompressedSize || 0), 0) > 8 * 1024 * 1024) return invalid('Isi workbook terlalu besar.');
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(data.workbook);
  if (workbook.worksheets.length !== 1) return invalid('Workbook harus memiliki tepat satu lembar.');
  sheet = workbook.worksheets[0];
 } catch { return invalid('Workbook .xlsx tidak dapat dibaca.'); }
 if (sheet.rowCount < 2 || sheet.rowCount > 1001 || sheet.columnCount !== 1 || sheet.getCell('A1').value !== 'nama_latin') return invalid('Gunakan template satu kolom nama_latin dengan 1–1.000 baris.');
 const names = [];
 for (let n = 2; n <= sheet.rowCount; n++) {
  const raw = sheet.getCell('A' + n).value;
  if (raw === null || raw === '') continue;
  if (typeof raw !== 'string' || !raw.trim() || Array.from(raw.trim()).length > 255) return invalid(`Baris ${n}: nama harus teks 1–255 karakter tanpa rumus.`);
  names.push(raw.trim());
 }
 if (!names.length) return invalid('Tidak ada nama yang dapat dikonversi.');
 await c.beginTransaction();
 try {
  const parts = [...new Set(names.flatMap(nameParts))], dictionary = new Map();
  // Keep parameter counts bounded, and use the newest duplicate like the legacy pluck.
  for (let offset = 0; offset < parts.length; offset += 500) {
   const chunk = parts.slice(offset, offset + 500);
   const [rows] = await c.execute(`SELECT nama_latin,nama_arab FROM perpustakaan_namas WHERE LOWER(nama_latin) IN (${chunk.map(() => '?').join(',')}) ORDER BY id FOR UPDATE`, chunk);
   for (const row of rows) dictionary.set(row.nama_latin.toLowerCase(), row.nama_arab);
  }
  for (const part of parts) if (!dictionary.has(part)) {
   const arab = part + ' Belum terdefinisi';
   if (Array.from(arab).length > 255) { await c.rollback(); return invalid('Nama yang belum terdefinisi terlalu panjang untuk kamus.'); }
   await c.execute("INSERT INTO perpustakaan_namas (nama_latin,nama_arab,status,created_at,updated_at) VALUES (?,?,'1',NOW(),NOW())", [part, arab]);
   dictionary.set(part, arab);
  }
  const rows = names.map(nama_latin => ({ nama_latin, nama_arab: nameParts(nama_latin).map(part => dictionary.get(part)).join(' ') }));
  const xlsx = await tableExcel(rows, [{ key: 'nama_latin', label: 'Nama Latin' }, { key: 'nama_arab', label: 'Nama Arab' }]);
  await c.commit();
  return { status: 200, xlsx };
 } catch (error) { await c.rollback(); throw error; }
}
