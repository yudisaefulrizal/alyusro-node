import { publicStorageRoot } from './config.js';
import { mkdir, realpath, readFile, writeFile, unlink, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import JSZip from 'jszip';

export const contentRoot = publicStorageRoot;
const types = { pdf:'application/pdf', doc:'application/msword', xls:'application/vnd.ms-excel', ppt:'application/vnd.ms-powerpoint', docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation', txt:'text/plain', csv:'text/csv', jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', gif:'image/gif', webp:'image/webp', zip:'application/zip', rar:'application/x-rar-compressed' };
export async function saveContentFile(field, data, root = contentRoot) {
 const bytes = data.upload;
 if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 10485760) throw new Error('Pilih satu berkas maksimal 10 MB.');
 let output = bytes, extension = extname(String(data.upload_name || '')).slice(1).toLowerCase();
 if (field.image) {
  try {
   const image = sharp(bytes, { limitInputPixels: 24000000, animated: false });
   if (!['jpeg','png','webp','gif'].includes((await image.metadata()).format)) throw new Error();
   output = await image.rotate().resize(field.width, Math.round(field.width * 9 / 16), { fit:'cover' }).webp({ quality:85 }).toBuffer(); extension = 'webp';
  } catch { throw new Error('Gambar harus berupa JPEG, PNG, GIF atau WebP yang valid.'); }
 } else {
  if (!types[extension]) throw new Error('Jenis dokumen tidak diizinkan.');
  const starts = hex => bytes.subarray(0, hex.length / 2).toString('hex') === hex;
  let valid = false;
  if (extension === 'pdf') valid = bytes.subarray(0,5).toString() === '%PDF-';
  else if (['doc','xls','ppt'].includes(extension)) valid = starts('d0cf11e0a1b11ae1');
  else if (extension === 'rar') valid = starts('526172211a07');
  else if (['docx','xlsx','pptx','zip'].includes(extension)) {
   try {
    const archive = await JSZip.loadAsync(bytes), entries = Object.values(archive.files);
    valid = entries.length <= 2000 && entries.reduce((n,f) => n + (f._data?.uncompressedSize || 0),0) <= 50 * 1048576;
    if (extension !== 'zip') valid &&= !!archive.file('[Content_Types].xml') && entries.some(f => f.name.startsWith({ docx:'word/', xlsx:'xl/', pptx:'ppt/' }[extension]));
   } catch { valid = false; }
  } else if (['txt','csv'].includes(extension)) valid = !bytes.includes(0) && Buffer.from(bytes.toString('utf8')).equals(bytes);
  else {
   try { valid = (await sharp(bytes, { limitInputPixels:24000000 }).metadata()).format === ({ jpg:'jpeg' }[extension] || extension); } catch { valid = false; }
  }
  if (!valid) throw new Error('Isi berkas tidak sesuai jenis dokumen.');
 }
 const base = await realpath(root), directory = resolve(base, field.directory);
 await mkdir(directory, { recursive:true });
 if (!(await realpath(directory)).startsWith(base + sep)) throw new Error('Lokasi penyimpanan tidak valid.');
 const path = `${field.directory}/${randomBytes(24).toString('hex')}.${extension}`;
 await writeFile(resolve(base,path), output, { flag:'wx', mode:0o644 });
 return path;
}
export async function removeNewContentFile(path, root = contentRoot) { await unlink(new URL(path,root)).catch(() => {}); }
export async function readContentFile(field, path, root = contentRoot) {
 try {
  if (typeof path !== 'string' || !path.startsWith(field.directory + '/')) return null;
  const base = await realpath(root), file = await realpath(resolve(base,path));
  const extension = extname(file).slice(1).toLowerCase();
  if (!file.startsWith(resolve(base,field.directory) + sep) || !types[extension] || (await stat(file)).size > 10485760) return null;
  return { content:await readFile(file), type:types[extension] };
 } catch { return null; }
}
